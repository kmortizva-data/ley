// Squat repetition tracking and verdicts, from a stream of per-frame measurements.
// Pure logic: no camera, no DOM. Thresholds hang from the user's own standing posture.

// Measurement error of single-camera knee angles reported for BlazePose (see docs/EVIDENCE.md).
// Any verdict closer than this to its threshold is reported as "unsure".
export const ERROR_MARGIN_DEG = 7;
// Depth target: thigh parallel to the floor. A convention, not a research finding.
export const TARGET_THIGH_DEG = 0;
// A rep starts once the knee has closed this much from standing, and ends when it is back within END.
export const START_DROP_DEG = 25;
export const END_DROP_DEG = 12;
export const MIN_VISIBILITY = 0.6;

/** Middle value of a list; robust against a few jittery frames. */
export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Standing reference from a couple of seconds of frames taken while upright. */
export function calibrate(frames) {
  return { knee: median(frames.map((f) => f.knee)), torso: median(frames.map((f) => f.torso)) };
}

/**
 * Feed frames one by one; each call returns a finished rep or null.
 * @param {{knee:number, torso:number}} standing from calibrate()
 * @param {number} smoothing weight of the newest frame, 1 disables smoothing
 */
export function createTracker(standing, smoothing = 0.5) {
  let phase = 'up';
  let knee = null;
  let rep = null;
  const reps = [];

  function push(frame, timeMs) {
    knee = knee === null ? frame.knee : knee + smoothing * (frame.knee - knee);
    const drop = standing.knee - knee;

    if (phase === 'up' && drop >= START_DROP_DEG) {
      phase = 'down';
      rep = { startMs: timeMs, bottomMs: timeMs, minKnee: knee, minThigh: frame.thigh, maxTorso: frame.torso };
    } else if (phase === 'down') {
      if (knee < rep.minKnee) {
        rep.minKnee = knee;
        rep.bottomMs = timeMs;
      }
      rep.minThigh = Math.min(rep.minThigh, frame.thigh);
      rep.maxTorso = Math.max(rep.maxTorso, frame.torso);
      if (drop <= END_DROP_DEG) {
        phase = 'up';
        const done = {
          minKnee: rep.minKnee,
          minThigh: rep.minThigh,
          maxTorso: rep.maxTorso,
          downSec: (rep.bottomMs - rep.startMs) / 1000,
          upSec: (timeMs - rep.bottomMs) / 1000,
        };
        reps.push(done);
        rep = null;
        return done;
      }
    }
    return null;
  }

  return {
    push,
    reps,
    get phase() { return phase; },
    /** 0 while standing, 1 at the depth target; used by the live depth bar. */
    depthProgress(frame) {
      const span = 90 - TARGET_THIGH_DEG;
      return Math.max(0, Math.min(1.2, (90 - frame.thigh) / span));
    },
  };
}

/** Depth verdict with a grey zone: 'deep', 'short' or 'unsure'. */
export function depthVerdict(minThigh, margin = ERROR_MARGIN_DEG) {
  if (minThigh <= TARGET_THIGH_DEG - margin) return 'deep';
  if (minThigh >= TARGET_THIGH_DEG + margin) return 'short';
  return 'unsure';
}

/**
 * Torso verdict against the user's own first rep, not a universal number:
 * leaning clearly more than at the start of the set is a sign of fatigue.
 */
export function torsoVerdict(maxTorso, firstRepTorso, margin = ERROR_MARGIN_DEG) {
  return maxTorso - firstRepTorso > margin ? 'more_lean' : 'steady';
}

/** Summary of a finished set. */
export function summarize(reps) {
  if (!reps.length) return { count: 0, reps: [] };
  const first = reps[0].maxTorso;
  const detailed = reps.map((r) => ({ ...r, depth: depthVerdict(r.minThigh), torso: torsoVerdict(r.maxTorso, first) }));
  return {
    count: reps.length,
    deep: detailed.filter((r) => r.depth === 'deep').length,
    short: detailed.filter((r) => r.depth === 'short').length,
    unsure: detailed.filter((r) => r.depth === 'unsure').length,
    reps: detailed,
  };
}
