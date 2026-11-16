// "Progreso": estimated strength per exercise, weekly sets per muscle and body weight.
import * as db from '../db.js';
import { EXERCISES, MUSCLES, WEEKLY_SET_TARGET, setsPerMuscle } from '../logic/program.js';
import { historyFor } from '../logic/progression.js';
import { bestE1rm } from '../logic/e1rm.js';
import { weightTrend, trendIsUsable } from '../logic/nutrition.js';
import { lineChart } from './charts.js';
import { esc, kg } from './util.js';

const DAY_MS = 86400000;

function strengthPoints(id, sessions) {
  const timed = EXERCISES[id].unit === 's';
  return historyFor(id, sessions)
    .map((h) => ({ x: h.date, y: timed ? Math.max(...h.sets.map((s) => s.reps)) : bestE1rm(h.sets) }))
    .filter((p) => p.y !== null)
    .reverse();
}

function volumeHtml(sessions) {
  const week = sessions.filter((s) => s.finishedAt >= Date.now() - 7 * DAY_MS);
  const totals = setsPerMuscle(week);
  const scale = Math.max(WEEKLY_SET_TARGET * 1.4, ...Object.values(totals).map((t) => t.direct + t.indirect));
  const pct = (v) => `${((v / scale) * 100).toFixed(1)}%`;
  return `
  <div class="vol">
    ${Object.entries(MUSCLES).map(([m, label]) => `
    <div class="vol-row">
      <span class="vol-name">${esc(label)}</span>
      <span class="vol-track">
        <i class="direct" style="width:${pct(totals[m].direct)}"></i><i class="indirect" style="width:${pct(totals[m].indirect)}"></i>
        <b class="goal" style="left:${pct(WEEKLY_SET_TARGET)}"></b>
      </span>
      <span class="vol-n">${kg(totals[m].direct)}</span>
    </div>`).join('')}
  </div>
  <p class="legend"><i class="sw direct"></i> series directas <i class="sw indirect"></i> de apoyo (cuentan la mitad) <i class="sw goal"></i> meta de ${WEEKLY_SET_TARGET} series</p>
  <p class="note">Últimos 7 días. El número de la derecha son las series directas. La meta es para los músculos grandes; bíceps y tríceps también trabajan de apoyo en remos y empujes.</p>`;
}

export async function mount(root, ctx, state = {}) {
  const [sessions, weights] = await Promise.all([db.getAll('sessions'), db.getAll('weights')]);
  const withData = Object.keys(EXERCISES).filter((id) => historyFor(id, sessions).length);
  const selected = withData.includes(state.exercise) ? state.exercise : withData[0];

  let strength = '<p class="empty">Termina una sesión y aquí verás cómo sube tu fuerza.</p>';
  if (selected) {
    const timed = EXERCISES[selected].unit === 's';
    const points = strengthPoints(selected, sessions);
    const chart = points.length
      ? lineChart(points, { xLabel: 'Fecha de la sesión', yLabel: timed ? 'Mejor serie (s)' : 'Fuerza estimada (kg)' })
      : '<p class="empty">Las series de más de 12 repeticiones no dan una estimación fiable.</p>';
    const first = points[0]?.y;
    const last = points[points.length - 1]?.y;
    const delta = points.length > 1 ? `<p class="note">De ${kg(first.toFixed(1))} a ${kg(last.toFixed(1))} ${timed ? 's' : 'kg'} en ${points.length} sesiones.</p>` : '';
    strength = `
    <label class="select"><span>Ejercicio</span>
      <select data-pick>${withData.map((id) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${esc(EXERCISES[id].name)}</option>`).join('')}</select>
    </label>
    ${chart}${delta}
    ${timed ? '' : '<p class="note">Fuerza estimada: el peso que podrías levantar una sola vez, calculado desde tu mejor serie (peso × (1 + repeticiones ÷ 30)). Sirve para comparar series distintas, no para ir a probarlo.</p>'}`;
  }

  let body = '<p class="empty">Registra tu peso en Nutrición para ver la tendencia.</p>';
  if (weights.length) {
    const points = weights
      .map((w) => ({ x: new Date(w.date + 'T12:00:00').getTime(), y: w.kg }))
      .sort((a, b) => a.x - b.x);
    const trend = weightTrend(weights);
    const line = trendIsUsable(trend) ? (x) => trend.meanKg + trend.slope * (x / DAY_MS - trend.meanT) : undefined;
    body = lineChart(points, { xLabel: 'Fecha', yLabel: 'Peso corporal (kg)', trend: line })
      + (line ? '<p class="note">La línea punteada es la tendencia de las últimas 3 semanas. Mira la línea, no el dato de un día.</p>' : '');
  }

  root.innerHTML = `
  <section class="hero"><p class="eyebrow">Progreso</p><h1>Lo que va cambiando</h1></section>
  <article class="card"><h2>Fuerza por ejercicio</h2>${strength}</article>
  <article class="card"><h2>Series por músculo</h2>${volumeHtml(sessions)}</article>
  <article class="card"><h2>Peso corporal</h2>${body}</article>`;

  root.onclick = null;
  root.oninput = (e) => {
    if (e.target.matches('[data-pick]')) mount(root, ctx, { exercise: e.target.value });
  };
}
