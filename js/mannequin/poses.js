// Hand-written start and end pose of each exercise for the 3D mannequin.
//
// Why by hand: depth estimated from a single photo was too noisy (arms flew out sideways).
// A textbook pose is symmetric and exact, which is what an illustration should show.
//
// A pose is a set of directions, one per bone, in the body's own frame:
//   x = toward the LEFT hand, y = up, z = forward (the way the chest faces when standing).
// Only the left side is written; the right side is its mirror image.
// lean is how far the trunk tips forward, in degrees (0 upright, 90 flat face down, -90 on the back).
// Arm directions are in the room's frame (y is always up), whatever the trunk does.
// head: 0 keeps the head in line with the trunk, 1 keeps it vertical.
//
// Per exercise:
//   anchor  'feet' (standing: feet stay put) or 'pelvis' (sitting or lying: hips stay put)
//   seat    hip height above the floor for anchor 'pelvis', in trunk lengths
//   gear    'barbell' | 'dumbbell' | 'bar' (plain handle through both hands)
//   handle  'across' | 'forward': which way a dumbbell handle runs
//   support what the body rests on, drawn by props.js
//   azimuth camera angle around the figure, degrees (0 is straight in front)
import { Vector3 } from 'three';

const FOOT = [0.18, -0.32, 1];
const STAND = { thigh: [0.07, -1, 0.02], calf: [0, -1, -0.03], foot: FOOT };
const SIT = { thigh: [0.28, -0.06, 1], calf: [0.02, -1, 0.04], foot: FOOT };
const HANG = { upperarm: [0.12, -1, 0.03], lowerarm: [0.1, -1, 0.12] };

export const POSES = {
  squat: {
    anchor: 'feet', gear: 'barbell', grip: 'fist', azimuth: 38,
    poses: [
      // Bar across the upper back: elbows down and slightly back, forearms up to the bar.
      { lean: 5, thigh: [0.2, -1, 0.04], calf: [0.02, -1, -0.04], foot: [0.3, -0.32, 1], upperarm: [0.75, -0.62, -0.25], lowerarm: [0.05, 0.9, -0.15], head: 0.5 },
      { lean: 40, thigh: [0.5, -0.1, 1], calf: [-0.1, -1, -0.5], foot: [0.3, -0.32, 1], upperarm: [0.75, -0.75, 0.25], lowerarm: [0.05, 0.6, 0.6], head: 0.7 },
    ],
  },
  bench: {
    anchor: 'pelvis', seat: 1.05, gear: 'barbell', grip: 'fist', support: 'bench', azimuth: 62, elevation: 14,
    poses: [
      { lean: -90, thigh: [0.3, -0.25, 1], calf: [0.03, -1, -0.12], foot: FOOT, upperarm: [0.3, 1, 0.02], lowerarm: [-0.08, 1, 0] },
      { lean: -90, thigh: [0.3, -0.25, 1], calf: [0.03, -1, -0.12], foot: FOOT, upperarm: [0.9, -0.22, 0.2], lowerarm: [0, 1, 0] },
    ],
  },
  row: {
    anchor: 'pelvis', seat: 0.62, gear: 'bar', grip: 'fist', support: 'seat', azimuth: 118,
    poses: [
      { lean: 12, thigh: [0.12, -0.12, 1], calf: [0.02, -0.4, 1], foot: [0.1, 0.8, 0.6], upperarm: [0.12, -0.4, 1], lowerarm: [-0.06, -0.08, 1], head: 0.6 },
      { lean: -4, thigh: [0.12, -0.12, 1], calf: [0.02, -0.4, 1], foot: [0.1, 0.8, 0.6], upperarm: [0.28, -0.8, -0.55], lowerarm: [-0.12, 0.05, 1], head: 0.6 },
    ],
  },
  ohp: {
    anchor: 'pelvis', seat: 1.0, gear: 'dumbbell', handle: 'across', grip: 'fist', support: 'seatback', azimuth: 28,
    poses: [
      { lean: -6, ...SIT, upperarm: [1, -0.2, 0.22], lowerarm: [-0.05, 1, 0.05] },
      { lean: -6, ...SIT, upperarm: [0.5, 1, 0.08], lowerarm: [-0.22, 1, 0] },
    ],
  },
  legcurl: {
    anchor: 'pelvis', seat: 1.15, grip: 'fist', support: 'prone', azimuth: 115, elevation: 12,
    poses: [
      { lean: 90, thigh: [0.08, -0.04, -1], calf: [0, -0.08, -1], foot: [0.05, -0.7, -0.7], upperarm: [0.55, -0.45, 0.7], lowerarm: [-0.2, -0.5, 0.85], head: 0.25 },
      { lean: 90, thigh: [0.08, -0.04, -1], calf: [0, 1, 0.3], foot: [0.05, 0.5, -0.85], upperarm: [0.55, -0.45, 0.7], lowerarm: [-0.2, -0.5, 0.85], head: 0.25 },
    ],
  },
  plank: {
    anchor: 'feet', grip: 'fist', azimuth: 72, elevation: 10,
    poses: [
      { lean: 80, thigh: [0.05, -0.17, -1], calf: [0, -0.17, -1], foot: [0, -1, 0.15], upperarm: [0.06, -1, 0.12], lowerarm: [-0.08, -0.03, 1], head: 0.3 },
      { lean: 80, thigh: [0.05, -0.17, -1], calf: [0, -0.17, -1], foot: [0, -1, 0.15], upperarm: [0.06, -1, 0.12], lowerarm: [-0.08, -0.03, 1], head: 0.3 },
    ],
  },
  rdl: {
    anchor: 'feet', gear: 'barbell', grip: 'fist', azimuth: 140,
    poses: [
      { lean: 4, ...STAND, upperarm: [0.1, -1, 0.06], lowerarm: [0.04, -1, 0.1], head: 0.3 },
      { lean: 66, thigh: [0.07, -1, 0.24], calf: [0, -1, -0.1], foot: FOOT, upperarm: [0.08, -1, 0.08], lowerarm: [0.02, -1, 0.04], head: 0.45 },
    ],
  },
  pulldown: {
    anchor: 'pelvis', seat: 1.0, gear: 'bar', grip: 'fist', support: 'seat', azimuth: 152,
    poses: [
      { lean: -3, ...SIT, upperarm: [0.6, 1, 0.12], lowerarm: [0.2, 1, 0.06] },
      { lean: -12, ...SIT, upperarm: [0.9, -0.5, 0.05], lowerarm: [-0.06, 1, 0.28] },
    ],
  },
  incline: {
    anchor: 'pelvis', seat: 0.95, gear: 'dumbbell', handle: 'across', grip: 'fist', support: 'incline', azimuth: 55, elevation: 12,
    poses: [
      { lean: -52, ...SIT, upperarm: [0.25, 1, 0.05], lowerarm: [-0.06, 1, 0] },
      { lean: -52, ...SIT, upperarm: [0.9, -0.38, -0.05], lowerarm: [0, 1, 0.05] },
    ],
  },
  legpress: {
    anchor: 'pelvis', seat: 0.8, grip: 'fist', support: 'recline', azimuth: 68, elevation: 12,
    poses: [
      { lean: -48, thigh: [0.16, 0.6, 1], calf: [0, 0.55, 1], foot: [0.1, 1, -0.35], upperarm: [0.28, -0.9, 0.3], lowerarm: [0, -0.55, 0.85] },
      { lean: -48, thigh: [0.32, 0.95, 0.4], calf: [-0.06, -0.02, 1], foot: [0.1, 1, -0.35], upperarm: [0.28, -0.9, 0.3], lowerarm: [0, -0.55, 0.85] },
    ],
  },
  lateral: {
    anchor: 'feet', gear: 'dumbbell', handle: 'forward', grip: 'fist', azimuth: 22,
    poses: [
      { lean: 0, ...STAND, ...HANG },
      { lean: 0, ...STAND, upperarm: [1, -0.06, 0.14], lowerarm: [1, -0.14, 0.2] },
    ],
  },
  curl: {
    anchor: 'feet', gear: 'dumbbell', handle: 'across', grip: 'fist', azimuth: 32,
    poses: [
      { lean: 0, ...STAND, upperarm: [0.12, -1, 0.03], lowerarm: [0.1, -1, 0.14] },
      { lean: 0, ...STAND, upperarm: [0.12, -1, 0.0], lowerarm: [0.06, 0.74, 0.66] },
    ],
  },
  triceps: {
    anchor: 'feet', gear: 'bar', grip: 'fist', azimuth: 128,
    poses: [
      { lean: 10, ...STAND, upperarm: [0.1, -1, 0.1], lowerarm: [-0.06, 0.4, 1], head: 0.5 },
      { lean: 10, ...STAND, upperarm: [0.1, -1, 0.1], lowerarm: [-0.02, -1, 0.14], head: 0.5 },
    ],
  },
};

const SEGMENT = { trunk: 0.5, shoulder: 0.2, hip: 0.1, upperarm: 0.3, lowerarm: 0.27, hand: 0.1, thigh: 0.45, calf: 0.45, foot: 0.2, neck: 0.25, ear: 0.07 };
const unit = (v) => new Vector3(...v).normalize();
const mirror = (v) => new Vector3(-v.x, v.y, v.z);

/**
 * Lay a pose out as the 33 body points the retargeting expects (only the used ones are filled).
 * Lengths are nominal: only the directions between points matter.
 */
export function buildPoints(pose) {
  const lean = (pose.lean * Math.PI) / 180;
  const up = new Vector3(0, Math.cos(lean), Math.sin(lean));
  const pts = Array.from({ length: 33 }, () => new Vector3());
  const shoulderMid = up.clone().multiplyScalar(SEGMENT.trunk);
  const headUp = up.clone().lerp(new Vector3(0, 1, 0), pose.head ?? 0).normalize();

  const sides = [
    { sign: 1, shoulder: 11, elbow: 13, wrist: 15, finger: 19, hip: 23, knee: 25, ankle: 27, toe: 31, ear: 7 },
    { sign: -1, shoulder: 12, elbow: 14, wrist: 16, finger: 20, hip: 24, knee: 26, ankle: 28, toe: 32, ear: 8 },
  ];
  for (const s of sides) {
    const dir = (v) => (s.sign === 1 ? unit(v) : mirror(unit(v)));
    const side = new Vector3(s.sign, 0, 0);
    const lowerarm = dir(pose.lowerarm);
    pts[s.hip].copy(side).multiplyScalar(SEGMENT.hip);
    pts[s.shoulder].copy(shoulderMid).addScaledVector(side, SEGMENT.shoulder);
    pts[s.elbow].copy(pts[s.shoulder]).addScaledVector(dir(pose.upperarm), SEGMENT.upperarm);
    pts[s.wrist].copy(pts[s.elbow]).addScaledVector(lowerarm, SEGMENT.lowerarm);
    pts[s.finger].copy(pts[s.wrist]).addScaledVector(lowerarm, SEGMENT.hand);
    pts[s.knee].copy(pts[s.hip]).addScaledVector(dir(pose.thigh), SEGMENT.thigh);
    pts[s.ankle].copy(pts[s.knee]).addScaledVector(dir(pose.calf), SEGMENT.calf);
    pts[s.toe].copy(pts[s.ankle]).addScaledVector(dir(pose.foot), SEGMENT.foot);
    pts[s.ear].copy(shoulderMid).addScaledVector(headUp, SEGMENT.neck).addScaledVector(side, SEGMENT.ear);
  }
  return pts;
}
