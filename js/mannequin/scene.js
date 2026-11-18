// The 3D mannequin: loads the public-domain body, lights it, paints the working muscles red
// and moves it between the two poses of an exercise.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { readRig, solvePose, applyPose, LIMBS } from './retarget.js';
import { muscleShare, shortsShare } from './zones.js';
import { createProps } from './props.js';
import { buildPoints } from './poses.js';
import { loopPosition } from '../figure.js';

const MODEL_URL = new URL('../../assets/model/body.gltf', import.meta.url).href;
const SKIN = new THREE.Color().setRGB(0.80, 0.80, 0.82, THREE.SRGBColorSpace);
const WORKING = new THREE.Color().setRGB(0.88, 0.13, 0.10, THREE.SRGBColorSpace);
const SHORTS = new THREE.Color().setRGB(0.09, 0.10, 0.11, THREE.SRGBColorSpace);
const SECONDARY_STRENGTH = 0.45;
const MUSCLES = ['chest', 'back', 'quads', 'hams', 'glutes', 'delts', 'biceps', 'triceps', 'core'];
const NEXT_BONE = { upperarm_l: 'lowerarm_l', upperarm_r: 'lowerarm_r', thigh_l: 'calf_l', thigh_r: 'calf_r' };
const FRAMED_BONES = ['Head', 'hand_l', 'hand_r', 'ball_l', 'ball_r', 'pelvis', 'lowerarm_l', 'lowerarm_r', 'calf_l', 'calf_r'];

let modelPromise;
function loadModel() {
  modelPromise ??= new GLTFLoader().loadAsync(MODEL_URL);
  return modelPromise;
}

/** For every skin point, how much it belongs to each muscle group and to the shorts. */
function measureSkin(mesh, rig) {
  const count = mesh.geometry.attributes.position.count;
  const { skinIndex, skinWeight, normal } = mesh.geometry.attributes;
  const shares = Object.fromEntries(MUSCLES.map((m) => [m, new Float32Array(count)]));
  const shorts = new Float32Array(count);
  const pos = (name) => rig.rest[name].position;
  const forward = pos('ball_l').clone().sub(pos('foot_l')).setY(0).normalize();
  const hipY = (pos('thigh_l').y + pos('thigh_r').y) / 2;
  const neckY = pos('neck_01').y;
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const idx = new THREE.Vector4();
  const wgt = new THREE.Vector4();

  for (let i = 0; i < count; i += 1) {
    mesh.getVertexPosition(i, p);
    mesh.localToWorld(p);
    n.fromBufferAttribute(normal, i).transformDirection(mesh.matrixWorld);
    const facing = n.dot(forward);
    const height = (p.y - hipY) / (neckY - hipY);
    idx.fromBufferAttribute(skinIndex, i);
    wgt.fromBufferAttribute(skinWeight, i);
    for (let k = 0; k < 4; k += 1) {
      const weight = wgt.getComponent(k);
      if (weight <= 0) continue;
      const bone = mesh.skeleton.bones[idx.getComponent(k)].name;
      let along = 0;
      if (NEXT_BONE[bone]) {
        const axis = pos(NEXT_BONE[bone]).clone().sub(pos(bone));
        along = p.clone().sub(pos(bone)).dot(axis) / axis.lengthSq();
      }
      for (const [muscle, share] of Object.entries(muscleShare(bone, along, facing, height))) {
        shares[muscle][i] += share * weight;
      }
      shorts[i] += shortsShare(bone, along, height) * weight;
    }
  }
  return { shares, shorts, count };
}

/**
 * @param {HTMLCanvasElement} canvas give it a CSS size; the drawing buffer follows it
 * @param {{interactive?: boolean}} options
 */
export async function createMannequin(canvas, { interactive = true, capture = false } = {}) {
  const gltf = await loadModel();
  // One mannequin at a time: the loaded scene graph is used directly, not copied.
  const model = gltf.scene;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: capture });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x30343c, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(2.5, 4, 3.5);
  const rim = new THREE.DirectionalLight(0xbfd4ff, 1.6);
  rim.position.set(-3, 2.5, -3);
  scene.add(key, rim, model);

  let body = null;
  const others = [];
  model.traverse((node) => {
    if (!node.isSkinnedMesh) return;
    if (!body || node.geometry.attributes.position.count > body.geometry.attributes.position.count) {
      if (body) others.push(body);
      body = node;
    } else {
      others.push(node);
    }
  });
  model.updateWorldMatrix(true, true);
  const rig = readRig(body.skeleton.bones);

  const skin = measureSkin(body, rig);
  const colors = new Float32Array(skin.count * 3);
  body.geometry = body.geometry.clone();
  body.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  body.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.02 });
  body.frustumCulled = false;
  const detail = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.8 });
  for (const mesh of others) {
    mesh.material = detail;
    mesh.frustumCulled = false;
  }

  // Soft contact shadow: a dark blob on the floor, cheaper and calmer than real shadows.
  const blobCanvas = Object.assign(document.createElement('canvas'), { width: 128, height: 128 });
  const g = blobCanvas.getContext('2d');
  const gradient = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(0,0,0,0.55)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 128, 128);
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blobCanvas), transparent: true, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  scene.add(blob);

  const controls = interactive ? new OrbitControls(camera, canvas) : null;
  if (controls) {
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableDamping = true;
    // Horizontal drags turn the figure; vertical drags are left to the page so it still scrolls.
    canvas.style.touchAction = 'pan-y';
  }

  const state = { a: null, b: null, props: null, center: new THREE.Vector3(0, 0.9, 0), handle: 0 };

  function resize() {
    const width = canvas.clientWidth || 300;
    const height = canvas.clientHeight || 300;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  /** Paint the working muscles: primary ones fully red, secondary ones softly. */
  function setMuscles(primary = [], secondary = []) {
    const color = new THREE.Color();
    for (let i = 0; i < skin.count; i += 1) {
      let k = 0;
      for (const m of primary) k = Math.max(k, skin.shares[m]?.[i] ?? 0);
      for (const m of secondary) k = Math.max(k, (skin.shares[m]?.[i] ?? 0) * SECONDARY_STRENGTH);
      color.copy(SKIN).lerp(WORKING, Math.min(1, k)).lerp(SHORTS, Math.min(1, skin.shorts[i]));
      colors.set([color.r, color.g, color.b], i * 3);
    }
    body.geometry.attributes.color.needsUpdate = true;
  }

  /**
   * Show an exercise: solve its two poses, build what it holds and rests on, frame the camera.
   * @param spec an entry of POSES (js/mannequin/poses.js)
   */
  function setExercise(spec, { azimuth = spec.azimuth ?? 35, elevation = spec.elevation ?? 8 } = {}) {
    state.a = solvePose(rig, buildPoints(spec.poses[0]), spec);
    state.b = solvePose(rig, buildPoints(spec.poses[1]), spec);
    if (state.props) scene.remove(state.props.group);
    state.props = createProps(rig, spec);
    scene.add(state.props.group);
    const box = new THREE.Box3();
    const point = new THREE.Vector3();
    for (const t of [0, 1]) {
      applyPose(rig, state.a, state.b, t);
      rig.byName.root.updateWorldMatrix(true, true);
      if (t === 0) state.props.place();
      for (const name of FRAMED_BONES) box.expandByPoint(rig.byName[name].getWorldPosition(point));
      // Equipment can be wider than the body (a barbell) or reach below it (a bench).
      state.props.update();
      state.props.group.updateWorldMatrix(true, true);
      box.expandByObject(state.props.group);
    }
    box.min.y = 0;
    box.expandByScalar(0.14);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    state.center.copy(sphere.center);
    const distance = sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.02;
    const az = THREE.MathUtils.degToRad(azimuth);
    const el = THREE.MathUtils.degToRad(elevation);
    camera.position.set(
      state.center.x + distance * Math.sin(az) * Math.cos(el),
      state.center.y + distance * Math.sin(el),
      state.center.z + distance * Math.cos(az) * Math.cos(el),
    );
    camera.lookAt(state.center);
    if (controls) {
      controls.target.copy(state.center);
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = Math.PI;
      controls.update();
      // Lock the height of the view: the figure only spins around.
      controls.minPolarAngle = controls.maxPolarAngle = controls.getPolarAngle();
    }
    blob.position.set(sphere.center.x, 0.002, sphere.center.z);
    blob.scale.setScalar(Math.max(0.45, sphere.radius * 0.6));
  }

  /** Draw one frame; t is 0 at the first pose and 1 at the second. */
  function frame(t) {
    if (state.a) {
      applyPose(rig, state.a, state.b, t);
      rig.byName.root.updateWorldMatrix(true, true);
      state.props.update();
    }
    controls?.update();
    renderer.render(scene, camera);
  }

  function start() {
    cancelAnimationFrame(state.handle);
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = (now) => {
      frame(still ? 1 : loopPosition(now));
      state.handle = requestAnimationFrame(tick);
    };
    state.handle = requestAnimationFrame(tick);
  }

  function dispose() {
    cancelAnimationFrame(state.handle);
    controls?.dispose();
    renderer.dispose();
  }

  resize();
  setMuscles();
  return { setMuscles, setExercise, frame, start, resize, dispose, rig, canvas, limbs: Object.keys(LIMBS) };
}
