// Double progression: first earn repetitions inside a range, then add load.

/** Round to the nearest multiple of step, without floating point dust. */
export function roundTo(value, step) {
  if (!step) return value;
  return Number((Math.round(value / step) * step).toFixed(2));
}

const STALL_SESSIONS = 3;
const DELOAD_FACTOR = 0.9;

function workingWeight(sets) {
  return Math.max(...sets.map((s) => s.weight));
}

function totalReps(sets) {
  return sets.reduce((sum, s) => sum + s.reps, 0);
}

/**
 * Decide today's target for one exercise.
 * @param {{reps:[number,number], unit?:string}} exercise
 * @param {Array<{sets:Array<{weight:number,reps:number}>}>} history most recent first
 * @param {number} increment smallest load jump available, in kg
 * @returns {{kind:string, weight:number|null, low:number, high:number, lastWeight?:number, lastReps?:number[]}}
 */
export function suggest(exercise, history, increment) {
  const [low, high] = exercise.reps;
  if (!history.length) return { kind: 'calibrate', weight: null, low, high };

  const last = history[0].sets;
  const weight = workingWeight(last);
  const atWeight = last.filter((s) => s.weight === weight);
  const lastReps = atWeight.map((s) => s.reps);
  const base = { lastWeight: weight, lastReps };

  if (exercise.unit === 's') {
    const best = Math.min(...lastReps);
    return { kind: best >= high ? 'hold' : 'add_time', weight: 0, low: Math.min(high, best + 5), high, ...base };
  }

  if (lastReps.every((r) => r >= high)) {
    return { kind: 'increase', weight: roundTo(weight + increment, increment), low, high, ...base };
  }
  if (lastReps.every((r) => r < low)) {
    return { kind: 'reduce', weight: Math.max(0, roundTo(weight - increment, increment)), low, high, ...base };
  }

  const recent = history.slice(0, STALL_SESSIONS);
  const stalled =
    recent.length === STALL_SESSIONS &&
    recent.every((h) => workingWeight(h.sets) === weight) &&
    totalReps(recent[0].sets) <= totalReps(recent[STALL_SESSIONS - 1].sets);
  if (stalled) {
    return { kind: 'deload', weight: roundTo(weight * DELOAD_FACTOR, increment), low, high, ...base };
  }

  return { kind: 'add_reps', weight, low, high, ...base };
}

/** Past performances of one exercise, most recent first. */
export function historyFor(exerciseId, sessions) {
  return sessions
    .filter((s) => s.entries[exerciseId]?.length)
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .map((s) => ({ date: s.finishedAt, sets: s.entries[exerciseId] }));
}
