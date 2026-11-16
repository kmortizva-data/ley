// "Nutrición": calorie and protein targets, body weight log and the weekly correction.
import * as db from '../db.js';
import {
  ACTIVITY, TARGET_LOSS_PCT, MIN_WEIGH_INS, MIN_SPAN_DAYS,
  targets, weightTrend, trendIsUsable, weeklyAdjustment,
} from '../logic/nutrition.js';
import { esc, num, kg, todayIso, shortDate, confirmTap } from './util.js';

const DAY_MS = 86400000;
const fmt = (n) => n.toLocaleString('es-ES').replace(/\./g, ' ');

function profileForm(p) {
  return `
  <form class="grid2" data-profile>
    <label class="select"><span>Sexo (para la fórmula)</span>
      <select name="sex"><option value="male" ${p.sex === 'male' ? 'selected' : ''}>Hombre</option><option value="female" ${p.sex === 'female' ? 'selected' : ''}>Mujer</option></select></label>
    <label class="select"><span>Edad (años)</span><input name="age" inputmode="numeric" value="${esc(p.age ?? '')}" placeholder="28"></label>
    <label class="select"><span>Estatura (cm)</span><input name="cm" inputmode="numeric" value="${esc(p.cm ?? '')}"></label>
    <label class="select"><span>Peso (kg)</span><input name="kg" inputmode="decimal" value="${esc(p.kg ?? '')}"></label>
    <label class="select wide"><span>Tu día normal</span>
      <select name="activity">${Object.entries(ACTIVITY).map(([k, a]) => `<option value="${k}" ${p.activity === k ? 'selected' : ''}>${esc(a.label)}</option>`).join('')}</select></label>
    <button class="primary wide" type="submit">Calcular mis metas</button>
  </form>`;
}

function targetsHtml(profile, adjust) {
  const t = targets(profile, adjust);
  const lossKg = (profile.kg * TARGET_LOSS_PCT) / 100;
  return `
  <div class="big">
    <div><span class="big-n">${fmt(t.intake)}</span><span class="big-u">kcal al día</span></div>
    <div><span class="big-n">${t.proteinLow} a ${t.proteinHigh}</span><span class="big-u">g de proteína</span></div>
  </div>
  <ol class="steps">
    <li><b>Gasto en reposo: ${fmt(t.resting)} kcal.</b> Lo que tu cuerpo gasta sin moverte, con la fórmula de Mifflin St Jeor.</li>
    <li><b>Gasto diario: ${fmt(t.daily)} kcal.</b> El gasto en reposo multiplicado por ${ACTIVITY[profile.activity].factor}, según tu día normal. Es una estimación, por eso se corrige con tu peso real.</li>
    <li><b>Déficit: ${fmt(t.deficit)} kcal.</b> Lo que hay que comer de menos para bajar ${TARGET_LOSS_PCT} % de tu peso por semana, unos ${lossKg.toFixed(2)} kg.</li>
    ${adjust ? `<li><b>Corrección acumulada: ${adjust > 0 ? '+' : '−'}${fmt(Math.abs(adjust))} kcal.</b> Lo que tu peso real ha ido pidiendo cambiar.</li>` : ''}
    <li><b>Meta: ${fmt(t.intake)} kcal.</b> Gasto diario menos déficit${adjust ? ', más la corrección' : ''}. Nunca baja de tu gasto en reposo.</li>
  </ol>
  <p class="note">Proteína: de 1.6 a 2.2 g por cada kg que pesas. El piso (${t.proteinLow} g) es lo que más importa cumplir.</p>`;
}

function trendHtml(weights, lastAdjust) {
  const trend = weightTrend(weights);
  if (!trendIsUsable(trend)) {
    const n = trend?.n ?? weights.length;
    return `<p class="empty">Para corregir la meta hacen falta al menos ${MIN_WEIGH_INS} pesajes repartidos en ${MIN_SPAN_DAYS} días. Llevas ${n}. Pésate al levantarte, siempre igual.</p>`;
  }
  const adjust = weeklyAdjustment(trend);
  const daysSince = lastAdjust ? (Date.now() - lastAdjust) / DAY_MS : Infinity;
  const direction = trend.kgPerWeek < 0 ? 'baja' : 'sube';
  const summary = `<p>Tu peso ${direction} <b>${Math.abs(trend.kgPerWeek).toFixed(2)} kg por semana</b> (${Math.abs(trend.pctPerWeek).toFixed(2)} %). El plan es bajar ${TARGET_LOSS_PCT} %.</p>`;
  if (daysSince < 7) return `${summary}<p class="note">Ya corregiste esta semana. La próxima corrección se abre en ${Math.ceil(7 - daysSince)} días.</p>`;
  if (adjust === 0) return `${summary}<p class="note">Vas en el ritmo planeado. No hay nada que corregir.</p>`;
  return `${summary}
  <p>Si comiste según la meta, la corrección es <b>${adjust > 0 ? '+' : '−'}${Math.abs(adjust)} kcal al día</b>${Math.abs(adjust) === 300 ? ' (tope de 300 por semana)' : ''}.</p>
  <button class="primary" data-adjust="${adjust}">Aplicar corrección</button>
  <p class="note">Tú decides: si esta semana no seguiste la meta, no la apliques.</p>`;
}

export async function mount(root, ctx) {
  const [profile, weights, adjustState] = await Promise.all([
    db.getValue('profile', { sex: 'male', activity: 'light' }),
    db.getAll('weights'),
    db.getValue('kcalAdjust', { value: 0, appliedAt: null }),
  ]);
  const ready = profile.age > 0;
  const recent = [...weights].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);

  const profileCard = `
  <article class="card"><h2>${ready ? 'Tus datos' : 'Empieza por aquí'}</h2>
    ${ready ? '' : '<p class="note">La fórmula necesita estos cuatro datos. Todos se quedan en tu teléfono.</p>'}
    ${profileForm(profile)}</article>`;

  root.innerHTML = `
  <section class="hero"><p class="eyebrow">Nutrición</p><h1>Cuánto comer</h1>
    <p class="sub">Un déficit pequeño para perder grasa sin frenar el músculo.</p></section>
  ${ready ? `<article class="card"><h2>Tus metas</h2>${targetsHtml(profile, adjustState.value)}</article>` : profileCard}
  <article class="card"><h2>Peso de hoy</h2>
    <form class="inline" data-weigh>
      <input name="date" type="date" value="${todayIso()}" max="${todayIso()}" aria-label="Fecha del pesaje">
      <label class="field"><input name="kg" inputmode="decimal" placeholder="${esc(profile.kg ?? '')}" aria-label="Peso en kg"><span>kg</span></label>
      <button class="primary" type="submit">Guardar</button>
    </form>
    ${recent.length ? `<ul class="weights">${recent.map((w) => `<li><span>${shortDate(new Date(w.date + 'T12:00:00').getTime())}</span><b>${kg(w.kg)} kg</b><button class="link danger" data-delw="${esc(w.date)}">borrar</button></li>`).join('')}</ul>` : ''}
  </article>
  ${ready ? `<article class="card"><h2>Corrección semanal</h2>${trendHtml(weights, adjustState.appliedAt)}</article>` : ''}
  ${ready ? profileCard : ''}
  <p class="disclaimer">Pautas generales basadas en estudios, no un plan médico. Si tienes una condición de salud, consulta a un profesional.</p>`;

  root.oninput = null;
  root.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    if (e.target.matches('[data-profile]')) {
      const next = { sex: data.sex, activity: data.activity, age: num(data.age), cm: num(data.cm), kg: num(data.kg) };
      if (!(next.age >= 14 && next.age <= 90) || !(next.cm >= 120 && next.cm <= 220) || !(next.kg >= 35 && next.kg <= 250)) {
        return ctx.toast('Revisa edad, estatura y peso.');
      }
      await db.setValue('profile', next);
    } else if (e.target.matches('[data-weigh]')) {
      const value = num(data.kg);
      if (!(value >= 35 && value <= 250) || !data.date) return ctx.toast('Escribe tu peso en kg.');
      await db.put('weights', { date: data.date, kg: value });
      if (data.date === todayIso()) await db.setValue('profile', { ...profile, kg: value });
      ctx.toast('Peso guardado.');
    }
    mount(root, ctx);
  };
  root.onclick = async (e) => {
    const del = e.target.closest('[data-delw]');
    const adj = e.target.closest('[data-adjust]');
    if (del) {
      if (!confirmTap(del, '¿seguro?')) return;
      await db.remove('weights', del.dataset.delw);
    } else if (adj) {
      await db.setValue('kcalAdjust', { value: adjustState.value + Number(adj.dataset.adjust), appliedAt: Date.now() });
      ctx.toast('Meta corregida.');
    } else return;
    mount(root, ctx);
  };
}
