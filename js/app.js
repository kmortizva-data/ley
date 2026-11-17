// App shell: tab routing, toast messages and the rest timer.
import * as today from './ui/today.js';
import * as history from './ui/history.js';
import * as progress from './ui/progress.js';
import * as nutrition from './ui/nutrition.js';
import * as settings from './ui/settings.js';

import * as exercise from './ui/exercise.js';

// technique is loaded on demand: it pulls in the pose engine, which most visits never need.
const technique = { mount: async (...args) => (await import('./ui/technique.js')).mount(...args) };
const VIEWS = { today, history, progress, nutrition, settings, exercise, technique };
// Screens reached from Hoy keep that tab highlighted.
const TAB_OF = { exercise: 'today', technique: 'today' };
const root = document.getElementById('view');
const toastEl = document.getElementById('toast');
const restEl = document.getElementById('rest');
const restClock = restEl.querySelector('[data-clock]');
const restLabel = restEl.querySelector('[data-label]');
const restBar = restEl.querySelector('[data-bar]');

let toastTimer;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

// --- rest timer: driven by an end timestamp so a sleeping screen cannot stall it
const rest = { endsAt: 0, total: 0, tick: null, audio: null };

function beep() {
  try {
    rest.audio ??= new AudioContext();
    const osc = rest.audio.createOscillator();
    const gain = rest.audio.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, rest.audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, rest.audio.currentTime + 0.5);
    osc.connect(gain).connect(rest.audio.destination);
    osc.start();
    osc.stop(rest.audio.currentTime + 0.5);
  } catch { /* sound is optional */ }
}

function stopRest() {
  clearInterval(rest.tick);
  rest.tick = null;
  restEl.classList.remove('show', 'over');
  document.body.classList.remove('resting');
}

function paintRest() {
  const left = Math.ceil((rest.endsAt - Date.now()) / 1000);
  if (left <= 0) {
    if (!restEl.classList.contains('over')) {
      restEl.classList.add('over');
      restClock.textContent = 'Listo';
      restBar.style.transform = 'scaleX(0)';
      navigator.vibrate?.([200, 100, 200]);
      beep();
    }
    if (left < -8) stopRest();
    return;
  }
  restClock.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  restBar.style.transform = `scaleX(${Math.max(0, (rest.endsAt - Date.now()) / (rest.total * 1000))})`;
}

function startRest(seconds, label) {
  rest.total = seconds;
  rest.endsAt = Date.now() + seconds * 1000;
  restLabel.textContent = `Descanso · ${label}`;
  restEl.classList.remove('over');
  restEl.classList.add('show');
  document.body.classList.add('resting');
  clearInterval(rest.tick);
  rest.tick = setInterval(paintRest, 250);
  paintRest();
}

restEl.addEventListener('click', (e) => {
  const act = e.target.closest('[data-rest]')?.dataset.rest;
  if (act === 'skip') stopRest();
  if (act === 'more' && rest.tick) {
    rest.endsAt = Math.max(rest.endsAt, Date.now()) + 30000;
    rest.total += 30;
    restEl.classList.remove('over');
    paintRest();
  }
});

// --- routing
/** The hash is "view" or "view/parameter", for example "exercise/squat". */
function currentRoute() {
  const [view, param] = location.hash.slice(1).split('/');
  return VIEWS[view] ? { view, param } : { view: 'today', param: undefined };
}

function go(target) {
  if (location.hash.slice(1) === target) render();
  else location.hash = target;
}

const ctx = { toast, startRest, stopRest, go };
let cleanup = null;

async function render() {
  const { view, param } = currentRoute();
  const tab = TAB_OF[view] ?? view;
  for (const link of document.querySelectorAll('nav a')) {
    link.classList.toggle('active', link.dataset.tab === tab);
    if (link.dataset.tab === tab) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  // A screen may hand back a function that stops its animation or camera.
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  root.onclick = root.oninput = root.onsubmit = root.onchange = null;
  try {
    cleanup = await VIEWS[view].mount(root, ctx, param);
  } catch (err) {
    console.error(err);
    root.textContent = 'Algo falló al abrir esta pantalla. Recarga la página.';
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);
render();

// Ask the browser not to evict the data, and enable offline use.
navigator.storage?.persist?.();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
