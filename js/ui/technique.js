// Live technique check for the squat. Hands-free once started: the phone finds the body,
// calibrates on the user's own standing posture, counts reps aloud and beeps at depth.
// Frames are processed on the device and never stored or sent.
import * as db from '../db.js';
import { EXERCISES } from '../logic/program.js';
import { createPose, CONNECTIONS, MODELS } from '../pose/engine.js';
import { toPixels, squatFrame, LANDMARK } from '../pose/angles.js';
import { createTracker, calibrate, summarize, median, MIN_VISIBILITY, ERROR_MARGIN_DEG } from '../pose/squat.js';
import { posesFor } from '../poses.js';
import { figureSvg, animateFigure } from '../figure.js';
import { esc } from './util.js';

const MIN_FPS = 15; // below this the live feedback lags behind the movement
const FPS_SAMPLE = 45; // frames measured before judging the model
const WARMUP_FRAMES = 10;
const SEEN_FRAMES = 20; // consecutive frames with the body visible before calibrating
const CALIBRATION_MS = 2000;
const STANDING_KNEE_DEG = 150;
const NUMBERS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince'];
const DEPTH_TEXT = { deep: 'Llega', short: 'No llega', unsure: 'No se puede asegurar' };

export async function mount(root, ctx, id) {
  if (id !== 'squat') return ctx.go('today');
  const poses = await posesFor(id).catch(() => null);
  const s = {
    running: false, phase: 'idle', pose: null, stream: null, wakeLock: null, audio: null,
    model: await db.getValue('poseModel', 'full'), modelSettled: false,
    times: [], seenRun: 0, calibration: null, tracker: null, wasDeep: false, stopGhost: null,
  };

  root.innerHTML = `
  <section class="hero compact">
    <a class="link back" href="#exercise/${esc(id)}">Volver a la ficha</a>
    <p class="eyebrow">Técnica en vivo</p>
    <h1>${esc(EXERCISES[id].name)}</h1>
  </section>
  <div class="stage" data-stage>
    <video playsinline muted></video>
    <canvas></canvas>
    <div class="stage-hint" data-hint>
      <p><b>Cómo colocarte</b></p>
      <p>Apoya el teléfono a la altura de la cadera, a 2 o 3 metros, con la pantalla hacia ti.</p>
      <p>Ponte <b>de lado</b>, con todo el cuerpo dentro del cuadro. Solo tú en la imagen.</p>
      <p>Sube el volumen: la app te habla.</p>
    </div>
    <div class="meter"><i data-meter></i><b data-goal></b></div>
    <div class="count" data-count hidden>0</div>
    ${poses ? `<div class="ghost-fig">${figureSvg(poses, 0, { gear: 'barbell' })}</div>` : ''}
  </div>
  <p class="big-status" data-status role="status">Pulsa Empezar y camina a tu sitio.</p>
  <div class="row">
    <button class="primary" data-act="toggle">Empezar</button>
    <label class="select inline-select"><span>Cámara</span>
      <select data-facing><option value="user">Frontal (te ves)</option><option value="environment">Trasera</option></select></label>
  </div>
  <p class="note" data-speed></p>
  <div data-summary></div>
  <article class="card">
    <h2>Qué mide y qué no</h2>
    <p class="note">Mide la profundidad, el ángulo de la rodilla, la inclinación del torso y el ritmo. Con una sola cámara no ve si la espalda se redondea ni si las rodillas se meten hacia dentro.</p>
    <p class="note">La medida tiene un error de unos ${ERROR_MARGIN_DEG} grados. Cuando quedas más cerca que eso del objetivo, la app dice "no se puede asegurar" en vez de inventar un veredicto. No reemplaza a un entrenador.</p>
  </article>`;

  const el = (sel) => root.querySelector(sel);
  const video = el('video');
  const canvas = el('canvas');
  const g = canvas.getContext('2d');
  const ghost = el('.ghost-fig svg');
  if (ghost && poses) s.stopGhost = animateFigure(ghost, poses, { gear: 'barbell' });

  const status = (text) => { el('[data-status]').textContent = text; };

  function say(text) {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'es-ES';
      u.rate = 1.1;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch { /* voice is optional */ }
  }

  function beep(frequency) {
    try {
      s.audio ??= new AudioContext();
      const osc = s.audio.createOscillator();
      const gain = s.audio.createGain();
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.3, s.audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, s.audio.currentTime + 0.25);
      osc.connect(gain).connect(s.audio.destination);
      osc.start();
      osc.stop(s.audio.currentTime + 0.25);
    } catch { /* sound is optional */ }
  }

  function draw(points, side) {
    g.clearRect(0, 0, canvas.width, canvas.height);
    if (!points) return;
    g.lineWidth = Math.max(4, canvas.width / 120);
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(237, 233, 224, 0.6)';
    for (const [a, b] of CONNECTIONS) {
      if (points[a].visibility < 0.5 || points[b].visibility < 0.5) continue;
      g.beginPath();
      g.moveTo(points[a].x, points[a].y);
      g.lineTo(points[b].x, points[b].y);
      g.stroke();
    }
    g.fillStyle = '#e2b94d';
    for (const i of Object.values(LANDMARK[side])) {
      g.beginPath();
      g.arc(points[i].x, points[i].y, g.lineWidth * 1.5, 0, Math.PI * 2);
      g.fill();
    }
  }

  /** After a short sample, keep the most accurate model that is fast enough on this phone. */
  async function settleModel() {
    const gaps = s.times.slice(WARMUP_FRAMES + 1).map((t, i) => t - s.times[WARMUP_FRAMES + i]);
    const fps = 1000 / median(gaps);
    s.modelSettled = true;
    if (fps < MIN_FPS && s.model === 'full') {
      s.model = 'lite';
      const slow = s.pose;
      s.pose = null; // frames are skipped while the lighter model loads
      slow.close();
      s.pose = await createPose({ model: 'lite', delegate: 'GPU' });
      s.times = [];
      s.modelSettled = false;
      el('[data-speed]').textContent = `El modelo completo iba a ${fps.toFixed(0)} cuadros por segundo: cambio al ligero.`;
      return;
    }
    await db.setValue('poseModel', s.model);
    el('[data-speed]').textContent = `Modelo ${MODELS[s.model].label.toLowerCase()}, ${fps.toFixed(0)} cuadros por segundo.` +
      (fps < MIN_FPS ? ' Va lento: la respuesta puede llegar con retraso.' : '');
  }

  function onBody(frame, now) {
    if (s.phase === 'searching') {
      s.seenRun += 1;
      if (s.seenRun >= SEEN_FRAMES) {
        s.phase = 'waiting';
        status('Te veo. Quédate de pie y quieto.');
        say('Te veo. Quédate de pie.');
      }
    } else if (s.phase === 'waiting') {
      if (frame.knee >= STANDING_KNEE_DEG) {
        s.phase = 'calibrating';
        s.calibration = { startedAt: now, frames: [] };
      }
    } else if (s.phase === 'calibrating') {
      if (frame.knee < STANDING_KNEE_DEG) {
        s.phase = 'waiting';
        return;
      }
      s.calibration.frames.push(frame);
      if (now - s.calibration.startedAt >= CALIBRATION_MS) {
        s.tracker = createTracker(calibrate(s.calibration.frames));
        s.phase = 'tracking';
        el('[data-count]').hidden = false;
        status('Listo. Empieza tus sentadillas.');
        say('Listo. Empieza.');
        beep(660);
      }
    } else if (s.phase === 'tracking') {
      const progress = s.tracker.depthProgress(frame);
      const deep = progress >= 1;
      const meter = el('[data-meter]');
      meter.style.height = `${Math.min(100, (progress / 1.2) * 100)}%`;
      meter.classList.toggle('hit', deep);
      if (deep && !s.wasDeep) beep(880);
      s.wasDeep = deep;
      if (s.tracker.push(frame, now)) {
        const n = s.tracker.reps.length;
        el('[data-count]').textContent = String(n);
        say(NUMBERS[n] ?? String(n));
      }
    }
  }

  function onFrame(now) {
    if (!s.running) return;
    if (video.readyState >= 2 && s.pose) {
      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const landmarks = s.pose.detect(video, now);
      s.times.push(now);
      if (!s.modelSettled && s.times.length >= FPS_SAMPLE) settleModel();
      if (landmarks) {
        const points = landmarks.map((l) => toPixels(l, canvas.width, canvas.height));
        const frame = squatFrame(points);
        draw(points, frame.side);
        if (frame.visibility >= MIN_VISIBILITY) {
          onBody(frame, now);
        } else {
          s.seenRun = 0;
          if (s.phase === 'searching') status('No te veo entero. Aléjate hasta que entren los pies y la cabeza.');
        }
      } else {
        draw(null);
        s.seenRun = 0;
      }
    }
    schedule();
  }

  function schedule() {
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(onFrame);
    else requestAnimationFrame(() => onFrame(performance.now()));
  }

  async function start() {
    const button = el('[data-act="toggle"]');
    button.disabled = true;
    el('[data-summary]').replaceChildren();
    try {
      say('Camina a tu sitio y ponte de lado.');
      status('Cargando. La primera vez tarda unos segundos.');
      s.pose = await createPose({ model: s.model, delegate: 'GPU' });
      const facing = el('[data-facing]').value;
      s.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 960 } },
      });
      el('[data-stage]').classList.toggle('mirror', facing === 'user');
      video.srcObject = s.stream;
      await video.play();
      s.wakeLock = await navigator.wakeLock?.request('screen').catch(() => null);
      Object.assign(s, { running: true, phase: 'searching', times: [], seenRun: 0, tracker: null, modelSettled: false, wasDeep: false });
      el('[data-hint]').hidden = true;
      el('[data-count]').textContent = '0';
      el('[data-count]').hidden = true;
      el('[data-meter]').style.height = '0';
      button.textContent = 'Terminar serie';
      status('Buscándote. Ponte de lado, con todo el cuerpo en el cuadro.');
      schedule();
    } catch (err) {
      stopCamera();
      status(err?.name === 'NotAllowedError'
        ? 'Sin permiso de cámara. Actívalo en el candado de la barra de direcciones y vuelve a pulsar Empezar.'
        : `No se pudo abrir la cámara: ${err?.message ?? err}`);
    } finally {
      button.disabled = false;
    }
  }

  function stopCamera() {
    s.running = false;
    s.stream?.getTracks().forEach((t) => t.stop());
    s.pose?.close();
    s.wakeLock?.release?.();
    Object.assign(s, { stream: null, pose: null, wakeLock: null, phase: 'idle' });
    video.srcObject = null;
    g.clearRect(0, 0, canvas.width, canvas.height);
    el('[data-act="toggle"]').textContent = 'Empezar';
  }

  function showSummary(reps) {
    const box = el('[data-summary]');
    if (!reps.length) {
      status('No conté ninguna repetición. Revisa que estés de lado y entero en el cuadro.');
      return;
    }
    const sum = summarize(reps);
    const lean = sum.reps.filter((r) => r.torso === 'more_lean').length;
    status(`${sum.count} repeticiones contadas.`);
    box.innerHTML = `
    <article class="card">
      <h2>Tu serie</h2>
      <div class="big three">
        <div><span class="big-n ok">${sum.deep}</span><span class="big-u">llegan a profundidad</span></div>
        <div><span class="big-n">${sum.unsure}</span><span class="big-u">no se puede asegurar</span></div>
        <div><span class="big-n warn">${sum.short}</span><span class="big-u">no llegan</span></div>
      </div>
      <div class="table-wrap"><table class="reps">
        <thead><tr><th>N.º</th><th>Profundidad</th><th>Muslo</th><th>Rodilla</th><th>Torso</th><th>Baja</th><th>Sube</th></tr></thead>
        <tbody>${sum.reps.map((r, i) => `
          <tr><td>${i + 1}</td><td class="${r.depth}">${DEPTH_TEXT[r.depth]}</td><td>${r.minThigh.toFixed(0)}°</td><td>${r.minKnee.toFixed(0)}°</td>
          <td class="${r.torso === 'more_lean' ? 'short' : ''}">${r.maxTorso.toFixed(0)}°</td><td>${r.downSec.toFixed(1)} s</td><td>${r.upSec.toFixed(1)} s</td></tr>`).join('')}
        </tbody></table></div>
      <p class="note">Muslo: 0 grados es paralelo al suelo; negativo es más abajo. Rodilla: 180 es pierna recta. Torso: 0 es recto.</p>
      ${lean ? `<p class="note">En ${lean} ${lean === 1 ? 'repetición te inclinaste' : 'repeticiones te inclinaste'} claramente más que en la primera: suele ser cansancio.</p>` : ''}
      <button class="primary" data-act="use" data-n="${sum.count}">Usar ${sum.count} repeticiones en mi serie</button>
    </article>`;
  }

  root.oninput = null;
  root.onclick = async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'toggle') {
      if (!s.running) return start();
      const reps = s.tracker?.reps ?? [];
      stopCamera();
      el('[data-count]').hidden = true;
      showSummary(reps);
    } else if (act === 'use') {
      const draft = await db.getValue('draft');
      const row = draft?.entries?.[id]?.find((r) => !r.done);
      if (!row) return ctx.toast('La sentadilla no está pendiente en la sesión de hoy. Anota el número a mano.');
      row.reps = String(e.target.closest('[data-act]').dataset.n);
      await db.setValue('draft', draft);
      ctx.toast('Repeticiones pasadas a tu serie. Falta el peso y marcarla.');
      ctx.go('today');
    }
  };

  const onHide = () => { if (document.hidden && s.running) stopCamera(); };
  document.addEventListener('visibilitychange', onHide);
  return () => {
    document.removeEventListener('visibilitychange', onHide);
    s.stopGhost?.();
    if (s.running) stopCamera();
    try { speechSynthesis.cancel(); } catch { /* nothing to cancel */ }
  };
}
