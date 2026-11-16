// Energy and protein targets for losing fat while training (body recomposition).

export const ACTIVITY = {
  sedentary: { factor: 1.2, label: 'Sentado casi todo el día' },
  light: { factor: 1.375, label: 'Algo de movimiento a diario' },
  moderate: { factor: 1.55, label: 'De pie o caminando mucho' },
};

export const KCAL_PER_KG = 7700; // rule of thumb for one kg of body mass
export const TARGET_LOSS_PCT = 0.5; // percent of body weight per week
export const MAX_DEFICIT = 500; // kcal per day, see Murphy & Koehler
export const PROTEIN_G_PER_KG = [1.6, 2.2];
export const MAX_WEEKLY_ADJUST = 300; // kcal, keeps one noisy week from swinging the target
export const TREND_DAYS = 21;
export const MIN_WEIGH_INS = 6;
export const MIN_SPAN_DAYS = 14;

const DAY_MS = 86400000;

/** Resting energy expenditure, Mifflin-St Jeor (kcal per day). */
export function restingEnergy({ sex, kg, cm, age }) {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'male' ? 5 : -161);
}

/** Daily deficit needed to lose a given percent of body weight per week, capped. */
export function deficitFor(kg, pctPerWeek = TARGET_LOSS_PCT) {
  const kgPerWeek = (kg * pctPerWeek) / 100;
  return Math.min(MAX_DEFICIT, (kgPerWeek * KCAL_PER_KG) / 7);
}

/** Full set of targets. adjust is the accumulated weekly correction in kcal. */
export function targets(profile, adjust = 0) {
  const resting = restingEnergy(profile);
  const daily = resting * ACTIVITY[profile.activity].factor;
  const deficit = deficitFor(profile.kg);
  const intake = Math.max(resting, daily - deficit + adjust);
  return {
    resting: Math.round(resting),
    daily: Math.round(daily),
    deficit: Math.round(deficit),
    intake: Math.round(intake / 10) * 10,
    proteinLow: Math.round(profile.kg * PROTEIN_G_PER_KG[0]),
    proteinHigh: Math.round(profile.kg * PROTEIN_G_PER_KG[1]),
  };
}

/**
 * Straight-line trend through recent weigh-ins (least squares).
 * @param {Array<{date:string, kg:number}>} weights date as YYYY-MM-DD
 * @returns {{kgPerWeek:number, pctPerWeek:number, current:number, n:number, spanDays:number}|null}
 */
export function weightTrend(weights, today = Date.now()) {
  const pts = weights
    .map((w) => ({ t: new Date(w.date + 'T12:00:00').getTime() / DAY_MS, kg: w.kg }))
    .filter((p) => p.t >= today / DAY_MS - TREND_DAYS)
    .sort((a, b) => a.t - b.t);
  if (pts.length < 2) return null;
  const spanDays = pts[pts.length - 1].t - pts[0].t;
  const n = pts.length;
  const meanT = pts.reduce((s, p) => s + p.t, 0) / n;
  const meanKg = pts.reduce((s, p) => s + p.kg, 0) / n;
  const sxx = pts.reduce((s, p) => s + (p.t - meanT) ** 2, 0);
  if (!sxx) return null;
  const slope = pts.reduce((s, p) => s + (p.t - meanT) * (p.kg - meanKg), 0) / sxx;
  const current = meanKg + slope * (pts[n - 1].t - meanT);
  const kgPerWeek = slope * 7;
  return { kgPerWeek, pctPerWeek: (kgPerWeek / current) * 100, current, n, spanDays, slope, meanT, meanKg };
}

/** True when the trend rests on enough data to act on it. */
export function trendIsUsable(trend) {
  return Boolean(trend) && trend.n >= MIN_WEIGH_INS && trend.spanDays >= MIN_SPAN_DAYS;
}

/**
 * Weekly correction in kcal per day, assuming the current target was followed.
 * Losing slower than planned gives a negative number (eat less), faster a positive one.
 */
export function weeklyAdjustment(trend, pctTarget = TARGET_LOSS_PCT) {
  const plannedKgPerWeek = -(trend.current * pctTarget) / 100;
  const raw = ((plannedKgPerWeek - trend.kgPerWeek) * KCAL_PER_KG) / 7;
  const capped = Math.max(-MAX_WEEKLY_ADJUST, Math.min(MAX_WEEKLY_ADJUST, raw));
  return Math.round(capped / 10) * 10;
}
