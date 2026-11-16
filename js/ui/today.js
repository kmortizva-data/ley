// "Hoy": log today's workout set by set, with a target computed from the last session.
import * as db from '../db.js';
import { EXERCISES, WORKOUTS, DEFAULT_INCREMENTS, RAMP_SESSIONS, nextWorkout, plannedSets } from '../logic/program.js';
import { suggest, historyFor } from '../logic/progression.js';
import { esc, num, kg, confirmTap } from './util.js';

function repsText(ex, s) {
  const unit = ex.unit === 's' ? ' s' : ' reps';
  return `${s.low} a ${s.high}${unit}`;
}

/** One plain sentence explaining why today's target is what it is. */
function reasonText(ex, s) {
  const last = s.lastReps?.join(', ');
  switch (s.kind) {
    case 'calibrate':
      if (ex.unit === 's') return 'Primera vez. Aguanta con buena postura y para antes de que se te caiga la cadera. Anota los segundos.';
      return `Primera vez. Busca un peso con el que hagas unas ${Math.round((s.low + s.high) / 2)} repeticiones sintiendo que te quedaban 2 o 3 más.`;
    case 'increase':
      return `La vez pasada hiciste ${last} con ${kg(s.lastWeight)} kg: llegaste al tope en todas las series, así que sube el peso.`;
    case 'reduce':
      return `La vez pasada hiciste ${last} con ${kg(s.lastWeight)} kg: quedaste por debajo de ${s.low} en todas, así que baja el peso.`;
    case 'deload':
      return `Tres sesiones seguidas sin sumar repeticiones con ${kg(s.lastWeight)} kg. Baja un 10 % y vuelve a subir.`;
    case 'add_time':
      return `La vez pasada aguantaste ${last} s. Hoy suma 5 segundos.`;
    case 'hold':
      return `Ya aguantas ${s.high} s en todas las series. Mantén.`;
    default:
      return `La vez pasada hiciste ${last} con ${kg(s.lastWeight)} kg. Mismo peso: intenta sumar una repetición en alguna serie.`;
  }
}

/** Reps to aim for in one set: beat last time by one when the load stays, else the range floor. */
function repGoal(s, setIndex) {
  const before = s.lastReps?.[setIndex];
  if (s.kind === 'add_reps' && before) return Math.min(s.high, before + 1);
  return s.low;
}

function buildDraft(workout, sessions, increments) {
  const entries = {};
  for (const id of WORKOUTS[workout]) {
    const ex = EXERCISES[id];
    const s = suggest(ex, historyFor(id, sessions), increments[ex.gear]);
    const weight = s.weight === null ? '' : kg(s.weight);
    entries[id] = Array.from({ length: plannedSets(id, sessions.length) }, () => ({ weight, reps: '', done: false }));
  }
  return { workout, startedAt: Date.now(), entries };
}

function cardHtml(id, rows, s) {
  const ex = EXERCISES[id];
  const timed = ex.unit === 's';
  const target = s.weight ? `${kg(s.weight)} kg × ${repsText(ex, s)}` : repsText(ex, s);
  const doneCount = rows.filter((r) => r.done).length;
  return `
  <article class="card ex ${doneCount === rows.length ? 'complete' : ''}" data-ex="${id}">
    <header class="ex-head">
      <h2>${esc(ex.name)}</h2>
      <div class="core" aria-label="${doneCount} de ${rows.length} series hechas">
        ${rows.map((r) => `<i class="${r.done ? 'on' : ''}"></i>`).join('')}
      </div>
    </header>
    <p class="target"><span class="tag tag-${s.kind}">Hoy</span> <b>${esc(target)}</b></p>
    <p class="why">${esc(reasonText(ex, s))}</p>
    <div class="sets">
      ${rows.map((r, i) => `
      <div class="set ${r.done ? 'done' : ''} ${timed ? 'timed' : ''}" data-i="${i}">
        <span class="n">${i + 1}</span>
        ${timed ? '' : `<label class="field"><input data-f="weight" inputmode="decimal" value="${esc(r.weight)}" placeholder="0" aria-label="Peso de la serie ${i + 1} en kg"><span>kg</span></label>`}
        <label class="field"><input data-f="reps" inputmode="numeric" value="${esc(r.reps)}" placeholder="${repGoal(s, i)}" aria-label="${timed ? 'Segundos' : 'Repeticiones'} de la serie ${i + 1}"><span>${timed ? 's' : 'reps'}</span></label>
        <button class="check" data-act="check" aria-label="${r.done ? 'Desmarcar' : 'Marcar'} serie ${i + 1}">${r.done ? '✓' : ''}</button>
      </div>`).join('')}
    </div>
    <footer class="ex-foot">
      <button class="link" data-act="add-set">+ serie</button>
      ${rows.length > 1 ? '<button class="link" data-act="drop-set">quitar última</button>' : ''}
      <span class="rest-note">descanso ${ex.rest >= 120 ? `${ex.rest / 60} min` : `${ex.rest} s`}</span>
    </footer>
  </article>`;
}

export async function mount(root, ctx) {
  const [sessions, savedIncrements, savedDraft] = await Promise.all([
    db.getAll('sessions'),
    db.getValue('increments', {}),
    db.getValue('draft'),
  ]);
  const increments = { ...DEFAULT_INCREMENTS, ...savedIncrements };
  const ordered = [...sessions].sort((a, b) => b.finishedAt - a.finishedAt);
  // A draft from an old backup may name exercises this version no longer has.
  const draftIsValid = savedDraft && WORKOUTS[savedDraft.workout] && Object.keys(savedDraft.entries).every((id) => EXERCISES[id]);
  const draft = draftIsValid ? savedDraft : buildDraft(nextWorkout(ordered[0]?.workout), sessions, increments);
  const suggestions = Object.fromEntries(
    Object.keys(draft.entries).map((id) => [id, suggest(EXERCISES[id], historyFor(id, sessions), increments[EXERCISES[id].gear])]),
  );
  const save = () => db.setValue('draft', draft);
  const anyDone = () => Object.values(draft.entries).some((rows) => rows.some((r) => r.done));

  function render() {
    const ramp = sessions.length < RAMP_SESSIONS;
    root.innerHTML = `
    <section class="hero">
      <p class="eyebrow">Sesión ${String(sessions.length + 1).padStart(2, '0')}</p>
      <h1>Rutina ${draft.workout}</h1>
      <p class="sub">${ramp
        ? `Arranque suave: 2 series por ejercicio hasta la sesión ${RAMP_SESSIONS}. Después pasan a 3.`
        : 'Cuerpo completo. Deja 2 o 3 repeticiones en reserva en cada serie.'}</p>
      ${anyDone() ? '' : `<button class="link" data-act="swap">Hacer la rutina ${nextWorkout(draft.workout)} hoy</button>`}
    </section>
    ${Object.entries(draft.entries).map(([id, rows]) => cardHtml(id, rows, suggestions[id])).join('')}
    <button class="primary" data-act="finish">Terminar sesión</button>`;
  }

  root.oninput = (e) => {
    const field = e.target.dataset.f;
    if (!field) return;
    const id = e.target.closest('.ex').dataset.ex;
    const i = Number(e.target.closest('.set').dataset.i);
    draft.entries[id][i][field] = e.target.value;
    save();
  };

  root.onclick = async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    const card = e.target.closest('.ex');
    const id = card?.dataset.ex;

    if (act === 'check') {
      const i = Number(e.target.closest('.set').dataset.i);
      const row = draft.entries[id][i];
      if (row.done) {
        row.done = false;
      } else {
        const timed = EXERCISES[id].unit === 's';
        const weight = timed ? 0 : num(row.weight);
        const reps = num(row.reps);
        if (!(weight >= 0) || !(reps > 0) || !Number.isInteger(reps)) {
          ctx.toast(timed ? 'Escribe los segundos que aguantaste.' : 'Escribe el peso y las repeticiones de esta serie.');
          return;
        }
        row.done = true;
        // Carry the load to the following empty sets so they need one tap less.
        for (const next of draft.entries[id].slice(i + 1)) if (!next.done && next.weight === '') next.weight = row.weight;
        ctx.startRest(EXERCISES[id].rest, EXERCISES[id].name);
      }
    } else if (act === 'add-set') {
      const rows = draft.entries[id];
      rows.push({ weight: rows[rows.length - 1].weight, reps: '', done: false });
    } else if (act === 'drop-set') {
      draft.entries[id].pop();
    } else if (act === 'swap') {
      Object.assign(draft, buildDraft(nextWorkout(draft.workout), sessions, increments));
      await save();
      return mount(root, ctx);
    } else if (act === 'finish') {
      const entries = {};
      let pending = 0;
      for (const [exId, rows] of Object.entries(draft.entries)) {
        const done = rows.filter((r) => r.done);
        pending += rows.length - done.length;
        if (done.length) entries[exId] = done.map((r) => ({ weight: EXERCISES[exId].unit === 's' ? 0 : num(r.weight), reps: num(r.reps) }));
      }
      if (!Object.keys(entries).length) return ctx.toast('Marca al menos una serie antes de terminar.');
      const button = e.target.closest('button');
      if (pending && !confirmTap(button, `Faltan ${pending} series. Toca otra vez para terminar`)) return;
      await db.put('sessions', { workout: draft.workout, startedAt: draft.startedAt, finishedAt: Date.now(), entries });
      await db.remove('kv', 'draft');
      ctx.stopRest();
      ctx.toast('Sesión guardada.');
      return ctx.go('history');
    }
    await save();
    render();
  };

  render();
}
