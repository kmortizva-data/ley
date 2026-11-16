// Training program: exercises, the two alternating workouts and volume accounting.
// Every number here is traced to a source in docs/EVIDENCE.md.

export const MUSCLES = {
  chest: 'Pecho',
  back: 'Espalda',
  quads: 'Cuádriceps',
  hams: 'Isquios',
  glutes: 'Glúteos',
  delts: 'Hombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  core: 'Abdomen',
};

// gear decides the default load increment; reps is the double-progression range;
// rest is seconds between sets; unit 's' means the exercise is timed, not counted.
export const EXERCISES = {
  squat: { name: 'Sentadilla con barra', gear: 'barbell', primary: ['quads', 'glutes'], secondary: ['core'], reps: [6, 10], rest: 180 },
  bench: { name: 'Press de banca', gear: 'barbell', primary: ['chest'], secondary: ['triceps', 'delts'], reps: [6, 10], rest: 180 },
  row: { name: 'Remo sentado en polea', gear: 'machine', primary: ['back'], secondary: ['biceps'], reps: [8, 12], rest: 120 },
  ohp: { name: 'Press militar con mancuernas', gear: 'dumbbell', primary: ['delts'], secondary: ['triceps'], reps: [8, 12], rest: 120 },
  legcurl: { name: 'Curl femoral', gear: 'machine', primary: ['hams'], secondary: [], reps: [10, 15], rest: 90 },
  plank: { name: 'Plancha', gear: 'bodyweight', unit: 's', primary: ['core'], secondary: [], reps: [30, 60], rest: 60 },
  rdl: { name: 'Peso muerto rumano', gear: 'barbell', primary: ['hams', 'glutes'], secondary: ['back'], reps: [8, 12], rest: 180 },
  pulldown: { name: 'Jalón al pecho', gear: 'machine', primary: ['back'], secondary: ['biceps'], reps: [8, 12], rest: 120 },
  incline: { name: 'Press inclinado con mancuernas', gear: 'dumbbell', primary: ['chest'], secondary: ['delts', 'triceps'], reps: [8, 12], rest: 120 },
  legpress: { name: 'Prensa de piernas', gear: 'machine', primary: ['quads', 'glutes'], secondary: [], reps: [8, 12], rest: 180 },
  lateral: { name: 'Elevaciones laterales', gear: 'dumbbell', primary: ['delts'], secondary: [], reps: [10, 15], rest: 90 },
  curl: { name: 'Curl de bíceps', gear: 'dumbbell', primary: ['biceps'], secondary: [], reps: [10, 15], rest: 90, sets: 2 },
  triceps: { name: 'Extensión de tríceps en polea', gear: 'machine', primary: ['triceps'], secondary: [], reps: [10, 15], rest: 90, sets: 2 },
};

export const WORKOUTS = {
  A: ['squat', 'bench', 'row', 'ohp', 'legcurl', 'plank'],
  B: ['rdl', 'pulldown', 'incline', 'legpress', 'lateral', 'curl', 'triceps'],
};

export const DEFAULT_INCREMENTS = { barbell: 2.5, dumbbell: 1, machine: 5, bodyweight: 0 };

export const GEAR_LABELS = {
  barbell: 'Barra (suma de los dos lados)',
  dumbbell: 'Mancuernas (cada una)',
  machine: 'Máquinas y poleas',
};

// Sessions done with fewer sets while the body adapts ("start below the target volume").
export const RAMP_SESSIONS = 6;
export const WEEKLY_SET_TARGET = 10;

/** Workout to do next: A and B alternate, so weeks go A B A, then B A B. */
export function nextWorkout(lastWorkout) {
  return lastWorkout === 'A' ? 'B' : 'A';
}

/** Planned sets for an exercise given how many sessions are already completed. */
export function plannedSets(exerciseId, completedSessions) {
  const base = EXERCISES[exerciseId].sets ?? 3;
  return completedSessions < RAMP_SESSIONS ? Math.min(base, 2) : base;
}

/**
 * Sets per muscle over a list of sessions.
 * A set counts 1 for each primary muscle and 0.5 for each secondary one.
 */
export function setsPerMuscle(sessions) {
  const totals = Object.fromEntries(Object.keys(MUSCLES).map((m) => [m, { direct: 0, indirect: 0 }]));
  for (const session of sessions) {
    for (const [exerciseId, sets] of Object.entries(session.entries)) {
      const ex = EXERCISES[exerciseId];
      if (!ex) continue;
      for (const m of ex.primary) totals[m].direct += sets.length;
      for (const m of ex.secondary) totals[m].indirect += sets.length * 0.5;
    }
  }
  return totals;
}
