// Camera lab: measures how fast the phone tracks a body and shows the squat readings live.
import { createPose, CONNECTIONS, MODELS } from '../js/pose/engine.js';
import { toPixels, squatFrame, LANDMARK } from '../js/pose/angles.js';
import { createTracker, calibrate, depthVerdict, median, MIN_VISIBILITY } from '../js/pose/squat.js';

const $ = (id) => document.getElementById(id);
const video = $('video');
const canvas = $('overlay');
const ctx = canvas.getContext('2d');

const CALIBRATION_MS = 2000;
const FPS_WINDOW = 60;
const DEPTH_WORDS = { deep: 'llega', short: 'no llega', unsure: 'no se puede asegurar' };
const DELEGATE_WORDS = { GPU: 'Gráfico', CPU: 'Normal' };

const state = {
  running: false, pose: null, stream: null, wakeLock: null,
  frameTimes: [], inferMs: [], seen: [],
  calibrating: null, tracker: null, audio: null, wasDeep: false,
};

function setStatus(text) {
  $('status').textContent = text;
}

function beep(frequency) {
  try {
    state.audio ??= new AudioContext();
    const osc = state.audio.createOscillator();
    const gain = state.audio.createGain();
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.25, state.audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, state.audio.currentTime + 0.25);
    osc.connect(gain).connect(state.audio.destination);
    osc.start();
    osc.stop(state.audio.currentTime + 0.25);
  } catch { /* sound is optional */ }
}

function draw(points, side) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!points) return;
  const used = new Set(Object.values(LANDMARK[side]));
  ctx.lineWidth = Math.max(3, canvas.width / 160);
  ctx.strokeStyle = 'rgba(237, 233, 224, 0.55)';
  for (const [a, b] of CONNECTIONS) {
    if (points[a].visibility < 0.5 || points[b].visibility < 0.5) continue;
    ctx.beginPath();
    ctx.moveTo(points[a].x, points[a].y);
    ctx.lineTo(points[b].x, points[b].y);
    ctx.stroke();
  }
  ctx.fillStyle = '#e2b94d';
  for (const i of used) {
    ctx.beginPath();
    ctx.arc(points[i].x, points[i].y, ctx.lineWidth * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function showSpeed() {
  if (state.frameTimes.length < 5) return;
  const gaps = state.frameTimes.slice(1).map((t, i) => t - state.frameTimes[i]);
  $('fps').textContent = (1000 / median(gaps)).toFixed(0);
  $('ms').textContent = median(state.inferMs).toFixed(0);
  $('seen').textContent = `${Math.round((state.seen.filter(Boolean).length / state.seen.length) * 100)} %`;
}

function onFrame(now) {
  if (!state.running) return;
  if (video.readyState >= 2) {
    if (canvas.width !== video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    const before = performance.now();
    const landmarks = state.pose.detect(video, now);
    const after = performance.now();
    for (const [list, value] of [[state.frameTimes, now], [state.inferMs, after - before], [state.seen, Boolean(landmarks)]]) {
      list.push(value);
      if (list.length > FPS_WINDOW) list.shift();
    }
    if (landmarks) {
      const points = landmarks.map((l) => toPixels(l, canvas.width, canvas.height));
      const frame = squatFrame(points);
      draw(points, frame.side);
      if (frame.visibility >= MIN_VISIBILITY) readBody(frame, now);
      else $('last').textContent = 'No veo bien tobillo, rodilla, cadera y hombro. Aléjate o gira de lado.';
    } else {
      draw(null);
    }
    showSpeed();
  }
  schedule();
}

function readBody(frame, now) {
  $('knee').textContent = frame.knee.toFixed(0);
  $('thigh').textContent = frame.thigh.toFixed(0);
  $('torso').textContent = frame.torso.toFixed(0);

  if (state.calibrating) {
    state.calibrating.frames.push(frame);
    if (now - state.calibrating.startedAt >= CALIBRATION_MS) {
      const standing = calibrate(state.calibrating.frames);
      state.tracker = createTracker(standing);
      state.calibrating = null;
      $('reps').textContent = '0';
      $('last').textContent = `Calibrado: de pie tu rodilla mide ${standing.knee.toFixed(0)} grados. Haz tus sentadillas.`;
      beep(660);
    }
    return;
  }
  if (!state.tracker) return;

  const progress = state.tracker.depthProgress(frame);
  const deep = progress >= 1;
  $('depth').classList.toggle('hit', deep);
  $('depth').firstElementChild.style.width = `${Math.min(100, progress * 100)}%`;
  if (deep && !state.wasDeep) beep(880);
  state.wasDeep = deep;

  const rep = state.tracker.push(frame, now);
  if (rep) {
    $('reps').textContent = String(state.tracker.reps.length);
    $('last').textContent =
      `Repetición ${state.tracker.reps.length}: profundidad ${DEPTH_WORDS[depthVerdict(rep.minThigh)]} ` +
      `(muslo ${rep.minThigh.toFixed(0)} grados), rodilla ${rep.minKnee.toFixed(0)}, torso ${rep.maxTorso.toFixed(0)}, ` +
      `bajada ${rep.downSec.toFixed(1)} s, subida ${rep.upSec.toFixed(1)} s.`;
  }
}

function schedule() {
  if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(onFrame);
  else requestAnimationFrame(() => onFrame(performance.now()));
}

async function start() {
  $('toggle').disabled = true;
  try {
    setStatus('Cargando el modelo (la primera vez tarda)...');
    state.pose = await createPose({ model: $('model').value, delegate: $('delegate').value });
    setStatus('Pidiendo la cámara...');
    state.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: $('facing').value, width: { ideal: 720 }, height: { ideal: 960 } },
    });
    video.srcObject = state.stream;
    await video.play();
    state.wakeLock = await navigator.wakeLock?.request('screen').catch(() => null);
    Object.assign(state, { running: true, frameTimes: [], inferMs: [], seen: [], tracker: null, calibrating: null });
    $('hint').hidden = true;
    $('toggle').textContent = 'Parar';
    setStatus(`Midiendo con el modelo ${MODELS[$('model').value].label}.`);
    schedule();
  } catch (err) {
    stop();
    const denied = err?.name === 'NotAllowedError';
    setStatus(denied ? 'Sin permiso de cámara. Actívalo en el candado de la barra de direcciones.' : `No se pudo empezar: ${err?.message ?? err}`);
  } finally {
    $('toggle').disabled = false;
  }
}

function stop() {
  state.running = false;
  state.stream?.getTracks().forEach((t) => t.stop());
  state.pose?.close();
  state.wakeLock?.release?.();
  Object.assign(state, { stream: null, pose: null, wakeLock: null });
  video.srcObject = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  $('hint').hidden = false;
  $('toggle').textContent = 'Empezar';
}

$('toggle').addEventListener('click', () => {
  if (state.running) {
    stop();
    setStatus('Parado.');
  } else {
    start();
  }
});

$('calibrate').addEventListener('click', () => {
  if (!state.running) return setStatus('Primero pulsa Empezar.');
  state.calibrating = { startedAt: performance.now(), frames: [] };
  state.tracker = null;
  $('last').textContent = 'Quédate de pie, quieto, 2 segundos...';
});

$('log').addEventListener('click', () => {
  if (state.frameTimes.length < FPS_WINDOW) return setStatus('Espera unos segundos más antes de anotar.');
  const row = document.createElement('tr');
  for (const text of [MODELS[$('model').value].label, DELEGATE_WORDS[$('delegate').value], $('fps').textContent]) {
    row.append(Object.assign(document.createElement('td'), { textContent: text }));
  }
  $('results').append(row);
  setStatus('Anotado. Pulsa Parar, cambia el modelo y repite.');
});

for (const id of ['model', 'delegate', 'facing']) {
  $(id).addEventListener('change', () => {
    if (state.running) {
      stop();
      setStatus('Cambiaste una opción. Pulsa Empezar de nuevo.');
    }
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.running) {
    stop();
    setStatus('Parado al salir de la página.');
  }
});
