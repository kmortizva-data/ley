// Split the skin of the mannequin into the app's muscle groups, without an anatomical model.
// Each skin point already says which bones move it; that, plus where the point sits along the
// bone and whether it faces forward or backward, is enough to tell biceps from triceps.

/** 0 below a, 1 above b, smooth in between. */
export function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

const TRUNK = new Set(['pelvis', 'spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r']);

/**
 * How much one skin point belongs to each muscle group, judged from one bone that moves it.
 * @param {string} bone name of the bone
 * @param {number} along 0 at the start of the bone, 1 at its end (limbs only)
 * @param {number} facing 1 looking straight forward, -1 straight backward
 * @param {number} height 0 at hip height, 1 at the base of the neck (trunk only)
 * @returns {Record<string, number>} muscle -> 0..1
 */
export function muscleShare(bone, along, facing, height) {
  const front = smoothstep(-0.25, 0.3, facing);
  const back = 1 - front;
  if (bone.startsWith('upperarm')) {
    const shoulder = 1 - smoothstep(0.22, 0.42, along);
    const arm = 1 - shoulder;
    return { delts: shoulder, biceps: arm * front, triceps: arm * back };
  }
  if (bone.startsWith('thigh')) {
    const hipPart = 1 - smoothstep(0.08, 0.3, along);
    return { quads: front, hams: back * (1 - hipPart), glutes: back * hipPart };
  }
  if (TRUNK.has(bone)) {
    const upper = smoothstep(0.52, 0.68, height);
    const aboveHips = smoothstep(0.02, 0.16, height);
    return {
      chest: front * upper,
      core: front * (1 - upper) * aboveHips,
      back: back * smoothstep(0.1, 0.24, height),
      glutes: back * (1 - smoothstep(0.02, 0.2, height)),
    };
  }
  return {};
}

/** The part of the body covered by shorts: hips and the top of the thighs. */
export function shortsShare(bone, along, height) {
  if (bone.startsWith('thigh')) return 1 - smoothstep(0.3, 0.36, along);
  if (TRUNK.has(bone)) return 1 - smoothstep(0.06, 0.1, height);
  return 0;
}
