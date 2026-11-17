// The app's own demonstration figure: a stylized body drawn from pose keypoints,
// moving between the start and end pose of an exercise. No borrowed animation.

// MediaPipe landmark indices kept for the figure, in storage order.
export const JOINTS = [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
const AT = Object.fromEntries(JOINTS.map((j, i) => [j, i]));
const J = {
  nose: AT[0], earL: AT[7], earR: AT[8],
  shL: AT[11], shR: AT[12], elL: AT[13], elR: AT[14], wrL: AT[15], wrR: AT[16],
  hipL: AT[23], hipR: AT[24], knL: AT[25], knR: AT[26], anL: AT[27], anR: AT[28],
  heL: AT[29], heR: AT[30], toeL: AT[31], toeR: AT[32],
};
const LIMBS = {
  L: { arm: [J.shL, J.elL, J.wrL], leg: [J.hipL, J.knL, J.anL], foot: [J.heL, J.toeL], vis: [J.shL, J.hipL, J.knL] },
  R: { arm: [J.shR, J.elR, J.wrR], leg: [J.hipR, J.knR, J.anR], foot: [J.heR, J.toeR], vis: [J.shR, J.hipR, J.knR] },
};

const SIZE = 240;
const PAD = 26;

/** Smooth start and stop: 0..1 in, 0..1 out. */
export function ease(t) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** Position in a there-and-back loop: 0 at the start pose, 1 at the end pose, with short holds. */
export function loopPosition(timeMs, periodMs = 2600) {
  const phase = (timeMs % periodMs) / periodMs;
  const tri = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  return ease(Math.max(0, Math.min(1, (tri - 0.08) / 0.84)));
}

/** Blend two poses (arrays of [x, y, visibility]) joint by joint. */
export function blend(a, b, t) {
  return a.map((p, i) => [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t, Math.min(p[2], b[i][2])]);
}

/** One transform for both poses, so the figure does not jump or resize while moving. */
export function fit(poseA, poseB) {
  const pts = [...poseA, ...poseB];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = (SIZE - 2 * PAD) / Math.max(x1 - x0, y1 - y0, 1);
  const dx = (SIZE - (x1 - x0) * scale) / 2 - x0 * scale;
  const dy = (SIZE - (y1 - y0) * scale) / 2 - y0 * scale;
  return (pose) => pose.map((p) => [p[0] * scale + dx, p[1] * scale + dy, p[2]]);
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const torsoLength = (p) => Math.max(dist(p[J.shL], p[J.hipL]), dist(p[J.shR], p[J.hipR]), 45);

/** Placement plus one shared thickness unit for a pair of poses. */
function stage(poses, options) {
  const place = fit(poses[0], poses[1]);
  const unit = Math.min(80, Math.max(torsoLength(place(poses[0])), torsoLength(place(poses[1]))));
  return { place, options: { ...options, unit } };
}
const line = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');

/** Inner SVG markup for one pose already fitted to the SIZE box. */
export function bodyMarkup(p, { gear = null, support = null, unit = null } = {}) {
  // unit is the torso length that sets every thickness. Passing the same one for all frames keeps
  // the figure from getting thinner when the torso points at the camera.
  const torso = unit ?? torsoLength(p);
  const w = Math.max(9, Math.min(16, torso * 0.2));
  // The side whose joints are less visible is the far one: drawn first and dimmer.
  const score = (s) => LIMBS[s].vis.reduce((sum, i) => sum + p[i][2], 0);
  const far = score('L') < score('R') ? 'L' : 'R';
  const near = far === 'L' ? 'R' : 'L';
  const limb = (s, cls) => `
    <path class="${cls}" stroke-width="${w.toFixed(1)}" d="${line(LIMBS[s].leg.map((i) => p[i]))}"/>
    <path class="${cls}" stroke-width="${(w * 0.8).toFixed(1)}" d="${line(LIMBS[s].foot.map((i) => p[i]))}"/>
    <path class="${cls}" stroke-width="${(w * 0.82).toFixed(1)}" d="${line(LIMBS[s].arm.map((i) => p[i]))}"/>`;
  const trunk = [p[J.shL], p[J.shR], p[J.hipR], p[J.hipL]];
  const neck = [(p[J.shL][0] + p[J.shR][0]) / 2, (p[J.shL][1] + p[J.shR][1]) / 2];
  const head = [(p[J.earL][0] + p[J.earR][0] + p[J.nose][0]) / 3, (p[J.earL][1] + p[J.earR][1] + p[J.nose][1]) / 3];
  const pelvis = [(p[J.hipL][0] + p[J.hipR][0]) / 2, (p[J.hipL][1] + p[J.hipR][1]) / 2];
  const dot = (c, r, cls) => `<circle class="${cls}" cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${r.toFixed(1)}"/>`;

  // What the hands hold: one bar seen end-on, or a dumbbell in each hand.
  let load = '';
  if (gear === 'barbell') load = dot([(p[J.wrL][0] + p[J.wrR][0]) / 2, (p[J.wrL][1] + p[J.wrR][1]) / 2], torso * 0.2, 'fig-bar');
  if (gear === 'dumbbell') load = dot(p[J.wrL], torso * 0.13, 'fig-bar') + dot(p[J.wrR], torso * 0.13, 'fig-bar');

  // What the body rests on, so a lying or seated figure does not seem to float.
  let prop = '';
  if (support === 'lying') {
    // A pad parallel to the back, on the side that faces the floor.
    const len = Math.hypot(neck[0] - pelvis[0], neck[1] - pelvis[1]) || 1;
    let nx = -(neck[1] - pelvis[1]) / len;
    let ny = (neck[0] - pelvis[0]) / len;
    if (ny < 0) { nx = -nx; ny = -ny; }
    const off = w * 1.25;
    const ext = 0.18;
    const a = [neck[0] + (neck[0] - pelvis[0]) * ext + nx * off, neck[1] + (neck[1] - pelvis[1]) * ext + ny * off];
    const b = [pelvis[0] - (neck[0] - pelvis[0]) * ext + nx * off, pelvis[1] - (neck[1] - pelvis[1]) * ext + ny * off];
    prop = `<path class="fig-prop" stroke-width="${(w * 0.7).toFixed(1)}" d="${line([a, b])}"/>`;
  } else if (support === 'seated') {
    const y = pelvis[1] + w * 1.3;
    prop = `<path class="fig-prop" stroke-width="${(w * 0.7).toFixed(1)}" d="${line([[pelvis[0] - torso * 0.35, y], [pelvis[0] + torso * 0.35, y]])}"/>`;
  }

  return `
    ${prop}
    ${limb(far, 'fig-far')}
    <path class="fig-near" stroke-width="${(w * 0.7).toFixed(1)}" d="${line([neck, head])}"/>
    <path class="fig-trunk" stroke-width="${(w * 1.7).toFixed(1)}" d="${line([neck, pelvis])}"/>
    <path class="fig-trunk" stroke-width="${w.toFixed(1)}" d="${line(trunk)} Z"/>
    ${dot(head, torso * 0.2, 'fig-head')}
    ${limb(near, 'fig-near')}${load}`;
}

/** Static SVG of the figure at position t (0 start, 1 end). */
export function figureSvg(poses, t = 0, baseOptions = {}) {
  const { place, options } = stage(poses, baseOptions);
  return `<svg class="figure" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="Figura que muestra el movimiento">
    <line class="fig-floor" x1="14" x2="${SIZE - 14}" y1="${SIZE - 12}" y2="${SIZE - 12}"/>
    <g data-body>${bodyMarkup(place(blend(poses[0], poses[1], t)), options)}</g></svg>`;
}

/**
 * Animate a figure already in the page. Returns a function that stops it.
 * Respects the reduced-motion preference by showing the end pose without moving.
 */
export function animateFigure(svg, poses, baseOptions = {}) {
  const body = svg.querySelector('[data-body]');
  const { place, options } = stage(poses, baseOptions);
  const paint = (t) => { body.innerHTML = bodyMarkup(place(blend(poses[0], poses[1], t)), options); };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    paint(1);
    return () => {};
  }
  let handle;
  const tick = (now) => {
    paint(loopPosition(now));
    handle = requestAnimationFrame(tick);
  };
  handle = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(handle);
}
