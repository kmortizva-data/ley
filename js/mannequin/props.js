// What the mannequin holds and what it rests on, drawn as simple shapes.
// Sizes hang from the mannequin's own proportions, so they fit any model scale:
//   u = upper-arm length (for things in the hands), T = trunk length (for benches and seats).
import * as THREE from 'three';

const STEEL = new THREE.MeshStandardMaterial({ color: 0x8b929c, metalness: 0.75, roughness: 0.35 });
const IRON = new THREE.MeshStandardMaterial({ color: 0x1b1d21, metalness: 0.35, roughness: 0.6 });
const PAD = new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.05, roughness: 0.85 });
const FRAME = new THREE.MeshStandardMaterial({ color: 0x4a505a, metalness: 0.6, roughness: 0.45 });
const UP = new THREE.Vector3(0, 1, 0);

/** A cylinder along the local Y axis, centred at offset along that axis. */
function disc(radius, length, offset, material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 28), material);
  mesh.position.y = offset;
  return mesh;
}

function barbell(u) {
  const group = new THREE.Group();
  group.add(disc(0.045 * u, 7.4 * u, 0, STEEL));
  for (const side of [-1, 1]) {
    group.add(disc(0.78 * u, 0.14 * u, side * 3.0 * u, IRON));
    group.add(disc(0.78 * u, 0.14 * u, side * 3.17 * u, IRON));
    group.add(disc(0.1 * u, 0.18 * u, side * 3.36 * u, STEEL));
  }
  return group;
}

function dumbbell(u) {
  const group = new THREE.Group();
  group.add(disc(0.05 * u, 0.62 * u, 0, STEEL));
  for (const side of [-1, 1]) group.add(disc(0.21 * u, 0.2 * u, side * 0.36 * u, IRON));
  return group;
}

/**
 * A box given by its centre and three perpendicular directions.
 * @param {THREE.Vector3} centre
 * @param {THREE.Vector3} across direction of the width
 * @param {THREE.Vector3} along direction of the length
 * @param {[number, number, number]} size width, thickness, length
 */
function slab(centre, across, along, size, material = PAD) {
  const x = across.clone().normalize();
  const z = along.clone().addScaledVector(x, -along.dot(x)).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  mesh.position.copy(centre);
  return mesh;
}

/** A post from a point straight down to the floor. */
function post(top, width, material = FRAME) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, Math.max(top.y, 0.01), width), material);
  mesh.position.set(top.x, top.y / 2, top.z);
  return mesh;
}

/**
 * @param rig from readRig()
 * @param {{gear?: string, handle?: string, support?: string}} spec an entry of POSES
 * @returns {{group: THREE.Group, place: () => void, update: () => void}}
 *   place() once with the skeleton in its first pose (builds what does not move);
 *   update() after every pose change (moves what the hands or feet carry).
 */
export function createProps(rig, spec = {}) {
  const group = new THREE.Group();
  const u = rig.rest.lowerarm_l.position.distanceTo(rig.rest.upperarm_l.position);
  const T = rig.rest.neck_01.position.distanceTo(rig.rest.pelvis.position);
  const world = (name) => rig.byName[name].getWorldPosition(new THREE.Vector3());
  // Middle of the closed hand: most of the way from the wrist to the knuckles.
  const gripPoint = (side) => world(`hand_${side}`).lerp(world(`middle_01_${side}`), 0.8);
  const aim = (object, centre, axis) => {
    object.position.copy(centre);
    object.quaternion.setFromUnitVectors(UP, axis.clone().normalize());
  };
  /** The trunk's own directions right now. */
  const trunk = () => {
    const hips = world('pelvis');
    const up = world('neck_01').sub(hips).normalize();
    const side = world('thigh_l').sub(world('thigh_r')).normalize();
    const front = new THREE.Vector3().crossVectors(side, up).normalize();
    return { hips, up, side, front };
  };
  const movers = [];

  if (spec.gear === 'barbell' || spec.gear === 'bar') {
    const bar = spec.gear === 'barbell' ? barbell(u) : disc(0.04 * u, 1, 0, STEEL);
    group.add(bar);
    movers.push(() => {
      const left = gripPoint('l');
      const right = gripPoint('r');
      aim(bar, left.clone().add(right).multiplyScalar(0.5), left.clone().sub(right));
      // A plain handle is as long as the grip is wide, plus a little past each hand.
      if (spec.gear === 'bar') bar.scale.set(1, left.distanceTo(right) + 1.1 * u, 1);
    });
  }
  if (spec.gear === 'dumbbell') {
    const pair = { l: dumbbell(u), r: dumbbell(u) };
    group.add(pair.l, pair.r);
    movers.push(() => {
      const { side, front } = trunk();
      const axis = spec.handle === 'forward' ? front : side;
      for (const s of ['l', 'r']) aim(pair[s], gripPoint(s), axis);
    });
  }

  let plate = null;
  if (spec.support === 'recline') {
    plate = new THREE.Mesh(new THREE.BoxGeometry(1.3 * T, 0.08 * T, 1.3 * T), FRAME);
    group.add(plate);
    movers.push(() => {
      // The foot plate rides on the soles, square to the line from hip to feet.
      const feet = world('ball_l').add(world('ball_r')).add(world('foot_l')).add(world('foot_r')).multiplyScalar(0.25);
      const push = feet.clone().sub(world('pelvis')).normalize();
      plate.position.copy(feet).addScaledVector(push, 0.1 * T);
      plate.quaternion.setFromUnitVectors(UP, push);
    });
  }

  function place() {
    const { hips, up, side, front } = trunk();
    const level = front.clone().setY(0).normalize(); // the way the body faces, flattened onto the floor
    const add = (...meshes) => group.add(...meshes);
    const backrest = (from, to) => {
      const centre = hips.clone().addScaledVector(up, ((from + to) / 2) * T).addScaledVector(front, -0.2 * T);
      add(slab(centre, side, up, [0.62 * T, 0.1 * T, (to - from) * T]));
      return centre;
    };
    const seat = (length = 0.75) => {
      const centre = hips.clone().addScaledVector(level, 0.22 * T).addScaledVector(UP, -0.2 * T);
      add(slab(centre, side, level, [0.66 * T, 0.1 * T, length * T]), post(centre.clone().addScaledVector(UP, -0.05 * T), 0.16 * T));
    };

    if (spec.support === 'bench') {
      const centre = backrest(-0.35, 1.5);
      add(post(centre.clone().addScaledVector(up, 0.6 * T), 0.14 * T), post(centre.clone().addScaledVector(up, -0.6 * T), 0.14 * T));
    } else if (spec.support === 'incline' || spec.support === 'seatback' || spec.support === 'recline') {
      const centre = backrest(0.05, spec.support === 'seatback' ? 1.15 : 1.45);
      add(post(centre, 0.14 * T));
      seat();
    } else if (spec.support === 'seat') {
      seat();
    } else if (spec.support === 'prone') {
      // Face down: the pad is under the chest and thighs, on the front of the body.
      const centre = hips.clone().addScaledVector(up, 0.15 * T).addScaledVector(front, 0.22 * T);
      add(slab(centre, side, up, [0.62 * T, 0.1 * T, 2.0 * T]));
      add(post(centre.clone().addScaledVector(up, 0.6 * T), 0.14 * T), post(centre.clone().addScaledVector(up, -0.6 * T), 0.14 * T));
    }
  }

  return { group, place, update: () => movers.forEach((move) => move()) };
}
