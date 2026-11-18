// Turn 33 body points in 3D into bone rotations for the mannequin.
// Idea: every limb bone is turned so it points from one joint to the next, and the trunk is
// turned so its left-right and up directions match the hips and shoulders.
import { Vector3, Quaternion, Matrix4 } from 'three';

// Bone -> [joint it starts at, joint it points to], as MediaPipe landmark indices.
export const LIMBS = {
  upperarm_l: [11, 13], lowerarm_l: [13, 15], hand_l: [15, 19],
  upperarm_r: [12, 14], lowerarm_r: [14, 16], hand_r: [16, 20],
  thigh_l: [23, 25], calf_l: [25, 27], foot_l: [27, 31],
  thigh_r: [24, 26], calf_r: [26, 28], foot_r: [28, 32],
};
// The bone whose position marks where each limb bone ends in the rest pose.
const NEXT = {
  upperarm_l: 'lowerarm_l', lowerarm_l: 'hand_l', hand_l: 'middle_01_l',
  upperarm_r: 'lowerarm_r', lowerarm_r: 'hand_r', hand_r: 'middle_01_r',
  thigh_l: 'calf_l', calf_l: 'foot_l', foot_l: 'ball_l',
  thigh_r: 'calf_r', calf_r: 'foot_r', foot_r: 'ball_r',
};
// First bone of each limb -> the bone after it and which way that joint folds in the rest pose
// (+1 forward for the elbow, -1 backward for the knee). Knowing the fold lets the first bone be
// turned around its own length too, so the biceps ends up facing the forearm instead of sideways.
const HINGES = {
  upperarm_l: { next: 'lowerarm_l', fold: 1 }, upperarm_r: { next: 'lowerarm_r', fold: 1 },
  thigh_l: { next: 'calf_l', fold: -1 }, thigh_r: { next: 'calf_r', fold: -1 },
};
// Bones that simply follow their parent and are then swung to point at the next joint.
// Hands are left out: the fingertip estimate is too noisy, a hand in line with the forearm reads better.
const FOLLOWERS = ['lowerarm_l', 'lowerarm_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r'];
const FIST_BEND = 1.15; // radians each finger joint closes, about 66 degrees
const MIN_FOLD = 0.2; // below this the joint is nearly straight and gives no reliable fold direction

/** Landmarks arrive in millimeters with y down and z away from the camera; the scene uses meters, y up. */
export function toScene(world) {
  return world.map((p) => new Vector3(p[0] / 1000, -p[1] / 1000, -p[2] / 1000));
}

const mid = (a, b) => a.clone().add(b).multiplyScalar(0.5);

/** Rotation matrix whose columns are a right-handed frame built from a sideways and an up direction. */
export function frame(side, up) {
  const x = side.clone().normalize();
  const y = up.clone().addScaledVector(x, -up.dot(x)).normalize();
  const z = new Vector3().crossVectors(x, y);
  return new Matrix4().makeBasis(x, y, z);
}

/** The rotation that carries the frame (sideA, upA) onto the frame (sideB, upB). */
export function frameRotation(sideA, upA, sideB, upB) {
  const from = frame(sideA, upA);
  const to = frame(sideB, upB);
  return new Quaternion().setFromRotationMatrix(to.multiply(from.invert()));
}

/** Remember the rest pose: where every bone sits and which way each limb points. */
export function readRig(bones) {
  const byName = Object.fromEntries(bones.map((b) => [b.name, b]));
  byName.root.updateWorldMatrix(true, true);
  const rest = {};
  for (const bone of bones) {
    rest[bone.name] = {
      local: bone.quaternion.clone(),
      world: bone.getWorldQuaternion(new Quaternion()),
      position: bone.getWorldPosition(new Vector3()),
    };
  }
  const direction = {};
  for (const [name, next] of Object.entries(NEXT)) {
    direction[name] = rest[next].position.clone().sub(rest[name].position).normalize();
  }
  const pos = (n) => rest[n].position;

  // Closed hands: every finger joint bends around the line of the knuckles. The model rests with
  // its palms facing down, so the correct sense of the bend is the one that lowers the fingertip.
  const fist = {};
  for (const side of ['l', 'r']) {
    const knuckles = pos(`pinky_01_${side}`).clone().sub(pos(`index_01_${side}`)).normalize();
    const finger = pos(`middle_02_${side}`).clone().sub(pos(`middle_01_${side}`)).normalize();
    const lowers = (sign) => finger.clone().applyAxisAngle(knuckles, sign * 0.5).y < finger.y;
    const sign = lowers(1) ? 1 : -1;
    for (const name of ['index', 'middle', 'ring', 'pinky']) {
      for (const joint of ['01', '02', '03']) {
        const bone = `${name}_${joint}_${side}`;
        // The world-space bend, rewritten in the bone's own frame so it can be stored as a local rotation.
        const axis = knuckles.clone().applyQuaternion(rest[bone].world.clone().invert());
        const bend = new Quaternion().setFromAxisAngle(axis, sign * FIST_BEND);
        fist[bone] = rest[bone].local.clone().multiply(bend);
      }
    }
  }

  return {
    byName, rest, direction, fist,
    trunkLength: pos('neck_01').distanceTo(pos('pelvis')),
    forward: pos('ball_l').clone().sub(pos('foot_l')).setY(0).normalize(),
    rootPosition: byName.root.position.clone(),
    hipsSide: pos('thigh_l').clone().sub(pos('thigh_r')),
    shouldersSide: pos('upperarm_l').clone().sub(pos('upperarm_r')),
    trunkUp: mid(pos('upperarm_l'), pos('upperarm_r')).sub(mid(pos('thigh_l'), pos('thigh_r'))),
    neckUp: pos('Head').clone().sub(pos('neck_01')).normalize(),
  };
}

function setWorldQuaternion(bone, world) {
  const parent = bone.parent.getWorldQuaternion(new Quaternion());
  bone.quaternion.copy(parent.invert().multiply(world));
  bone.updateWorldMatrix(false, true);
}

/**
 * Pose the skeleton from scene-space points and return the result as plain data.
 * @param rig from readRig()
 * @param {Vector3[]} pts 33 points from toScene()
 * @param {'feet'|'pelvis'} anchor which part stays put between the two poses of an exercise
 * @returns {{quaternions: Record<string, Quaternion>, offset: Vector3}}
 */
export function solvePose(rig, input, { anchor = 'feet', grip = null, seat = 1 } = {}) {
  const { byName, rest } = rig;
  // Turn the whole body about the vertical so the hips face the same way as the model's.
  // The photo decides the pose, not the direction we look at it from.
  const seen = input[23].clone().sub(input[24]);
  const yaw = Math.atan2(seen.z, seen.x) - Math.atan2(rig.hipsSide.z, rig.hipsSide.x);
  const upAxis = new Vector3(0, 1, 0);
  const pts = input.map((p) => p.clone().applyAxisAngle(upAxis, yaw));
  for (const [name, bone] of Object.entries(byName)) bone.quaternion.copy(rest[name].local);
  byName.root.position.copy(rig.rootPosition);
  byName.root.updateWorldMatrix(true, true);

  const hipMid = mid(pts[23], pts[24]);
  const shoulderMid = mid(pts[11], pts[12]);
  const up = shoulderMid.clone().sub(hipMid);

  // Trunk: hips first, then the chest on top of them.
  const hips = frameRotation(rig.hipsSide, rig.trunkUp, pts[23].clone().sub(pts[24]), up);
  setWorldQuaternion(byName.pelvis, hips.clone().multiply(rest.pelvis.world));
  const chest = frameRotation(rig.shouldersSide, rig.trunkUp, pts[11].clone().sub(pts[12]), up);
  setWorldQuaternion(byName.spine_02, chest.clone().multiply(rest.spine_02.world));

  // Head: follow the line from between the shoulders to between the ears.
  const neckDir = mid(pts[7], pts[8]).sub(shoulderMid).normalize();
  const neck = new Quaternion().setFromUnitVectors(rig.neckUp, neckDir);
  setWorldQuaternion(byName.neck_01, neck.multiply(rest.neck_01.world));

  const aim = (name) => pts[LIMBS[name][1]].clone().sub(pts[LIMBS[name][0]]).normalize();

  for (const [name, hinge] of Object.entries(HINGES)) {
    const target = aim(name);
    const nextDir = aim(hinge.next);
    const fold = nextDir.clone().addScaledVector(target, -nextDir.dot(target));
    let turn;
    if (fold.length() > MIN_FOLD) {
      // Bone direction plus fold direction fix the bone completely, twist included.
      const restFold = rig.forward.clone().multiplyScalar(hinge.fold);
      turn = frameRotation(rig.direction[name], restFold, target, fold);
    } else {
      turn = new Quaternion().setFromUnitVectors(rig.direction[name], target);
    }
    setWorldQuaternion(byName[name], turn.multiply(rest[name].world));
  }

  // Swing each follower from where its parent left it, so the parent's twist carries down.
  const here = (n) => byName[n].getWorldPosition(new Vector3());
  for (const name of FOLLOWERS) {
    const child = NEXT[name];
    const current = here(child).sub(here(name)).normalize();
    const swing = new Quaternion().setFromUnitVectors(current, aim(name));
    setWorldQuaternion(byName[name], swing.multiply(byName[name].getWorldQuaternion(new Quaternion())));
  }

  // Standing: the lowest foot goes on the floor and the feet stay over the same spot.
  // Sitting or lying: the hips stay put at seat height, so the feet are free to move.
  const world = (n) => byName[n].getWorldPosition(new Vector3());
  let offset;
  if (anchor === 'pelvis') {
    const hips = world('pelvis');
    offset = new Vector3(-hips.x, seat * rig.trunkLength - hips.y, -hips.z);
  } else {
    const floor = Math.min(...['ball_l', 'ball_r', 'foot_l', 'foot_r'].map((n) => world(n).y));
    const feet = mid(world('foot_l'), world('foot_r'));
    offset = new Vector3(-feet.x, -floor, -feet.z);
  }

  const quaternions = Object.fromEntries(Object.entries(byName).map(([n, b]) => [n, b.quaternion.clone()]));
  if (grip === 'fist') Object.assign(quaternions, rig.fist);
  return { quaternions, offset };
}

/** Blend two solved poses onto the skeleton; t is 0 at the first pose and 1 at the second. */
export function applyPose(rig, a, b, t) {
  for (const [name, bone] of Object.entries(rig.byName)) {
    bone.quaternion.slerpQuaternions(a.quaternions[name], b.quaternions[name], t);
  }
  const offset = a.offset.clone().lerp(b.offset, t);
  const root = rig.byName.root;
  // The offset is in world units; the root may sit under a scaled or turned parent.
  root.position.copy(rig.rootPosition);
  root.updateWorldMatrix(true, false);
  const target = root.getWorldPosition(new Vector3()).add(offset);
  root.position.copy(root.parent.worldToLocal(target));
}
