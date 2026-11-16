// Estimated one-repetition maximum (e1RM): a single number to compare sets of different loads.

// Above this many reps the estimate drifts too far to be useful.
export const MAX_REPS_FOR_ESTIMATE = 12;

/** Epley formula: load x (1 + reps / 30). One rep returns the load itself. */
export function epley(weight, reps) {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

/** Best estimate among the sets of one session, or null when none qualifies. */
export function bestE1rm(sets) {
  const usable = sets.filter((s) => s.weight > 0 && s.reps >= 1 && s.reps <= MAX_REPS_FOR_ESTIMATE);
  if (!usable.length) return null;
  return Math.max(...usable.map((s) => epley(s.weight, s.reps)));
}
