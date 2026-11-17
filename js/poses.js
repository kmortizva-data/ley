// Start and end pose of every exercise, extracted once from the photos (tests/extract_poses.html).

let cache;

/** @returns {Promise<Record<string, [number[][], number[][]]>>} */
export function loadPoses() {
  cache ??= fetch(new URL('../data/poses.json', import.meta.url)).then((r) => r.json());
  return cache;
}

// What each figure rests on. Exercises not listed are done standing.
const SUPPORT = {
  bench: 'lying', incline: 'lying', legcurl: 'lying', legpress: 'lying',
  row: 'seated', ohp: 'seated', pulldown: 'seated',
};

/** Drawing options for an exercise's figure. */
export function figureOptions(exerciseId, exercise) {
  return { gear: exercise.gear, support: SUPPORT[exerciseId] ?? null };
}

// The first plank photo shows the kneeling set-up, so its figure holds the final position.
const HOLD_END = new Set(['plank']);

/** The two poses to animate between for one exercise, or null when there are none. */
export async function posesFor(exerciseId) {
  const pair = (await loadPoses())[exerciseId];
  if (!pair?.[0] || !pair?.[1]) return null;
  return HOLD_END.has(exerciseId) ? [pair[1], pair[1]] : pair;
}
