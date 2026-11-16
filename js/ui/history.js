// "Historial": every saved session, newest first.
import * as db from '../db.js';
import { EXERCISES } from '../logic/program.js';
import { esc, kg, shortDate, confirmTap } from './util.js';

function setsText(id, sets) {
  const timed = EXERCISES[id]?.unit === 's';
  return sets.map((s) => (timed ? `${s.reps} s` : `${kg(s.weight)} kg × ${s.reps}`)).join(' · ');
}

export async function mount(root, ctx) {
  const sessions = (await db.getAll('sessions')).sort((a, b) => b.finishedAt - a.finishedAt);

  if (!sessions.length) {
    root.innerHTML = `
    <section class="hero"><p class="eyebrow">Historial</p><h1>Aún no hay sesiones</h1>
    <p class="sub">Cuando termines tu primera sesión en Hoy, aparece aquí con cada serie.</p></section>`;
    return;
  }

  root.innerHTML = `
  <section class="hero"><p class="eyebrow">Historial</p><h1>${sessions.length} ${sessions.length === 1 ? 'sesión' : 'sesiones'}</h1></section>
  ${sessions.map((s, i) => {
    const total = Object.values(s.entries).reduce((n, sets) => n + sets.length, 0);
    const minutes = Math.max(1, Math.round((s.finishedAt - s.startedAt) / 60000));
    return `
    <details class="card log" ${i === 0 ? 'open' : ''}>
      <summary>
        <span class="badge">${esc(s.workout)}</span>
        <span class="log-date">${shortDate(s.finishedAt)}</span>
        <span class="log-meta">${total} series · ${minutes} min</span>
      </summary>
      <dl>
        ${Object.entries(s.entries).map(([id, sets]) => `
        <dt>${esc(EXERCISES[id]?.name ?? id)}</dt><dd>${esc(setsText(id, sets))}</dd>`).join('')}
      </dl>
      <button class="link danger" data-del="${esc(s.id)}">Borrar esta sesión</button>
    </details>`;
  }).join('')}`;

  root.oninput = null;
  root.onclick = async (e) => {
    const button = e.target.closest('[data-del]');
    if (!button || !confirmTap(button, 'Toca otra vez para borrar')) return;
    await db.remove('sessions', Number(button.dataset.del));
    ctx.toast('Sesión borrada.');
    mount(root, ctx);
  };
}
