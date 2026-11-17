// Geometry on body keypoints. Points are {x, y} in PIXELS (y grows downward, like an image).
// The pose engine returns coordinates normalized to 0..1; convert with toPixels() first,
// otherwise a non-square frame distorts every angle.

// Indices of the MediaPipe Pose Landmarker output (33 landmarks).
export const LANDMARK = {
  left: { shoulder: 11, hip: 23, knee: 25, ankle: 27 },
  right: { shoulder: 12, hip: 24, knee: 26, ankle: 28 },
};

const DEG = 180 / Math.PI;

export function toPixels(landmark, width, height) {
  return { x: landmark.x * width, y: landmark.y * height, visibility: landmark.visibility ?? 1 };
}

/** Angle at vertex b formed by the segments b-a and b-c, in degrees (0 to 180). */
export function angleAt(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const norm = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (!norm) return NaN;
  const cos = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / norm));
  return Math.acos(cos) * DEG;
}

/** Lean of a segment away from vertical, in degrees: 0 is upright, 90 is horizontal. */
export function leanFromVertical(top, bottom) {
  return Math.atan2(Math.abs(top.x - bottom.x), Math.abs(bottom.y - top.y)) * DEG;
}

/**
 * Thigh angle against the horizontal, in degrees.
 * Standing is near 90, thigh parallel to the floor is 0, hip below the knee is negative.
 */
export function thighAngle(hip, knee) {
  return Math.atan2(knee.y - hip.y, Math.abs(knee.x - hip.x)) * DEG;
}

/** The body side the camera sees best: the one whose four joints are most visible. */
export function bestSide(points) {
  const score = (side) => Object.values(LANDMARK[side]).reduce((sum, i) => sum + (points[i]?.visibility ?? 0), 0) / 4;
  const left = score('left');
  const right = score('right');
  return left >= right ? { side: 'left', visibility: left } : { side: 'right', visibility: right };
}

/**
 * Everything the squat check needs from one frame, seen from the side.
 * @param {Array<{x:number,y:number,visibility:number}>} points 33 landmarks in pixels
 * @returns {{side:string, visibility:number, knee:number, hip:number, torso:number, thigh:number}}
 */
export function squatFrame(points) {
  const { side, visibility } = bestSide(points);
  const idx = LANDMARK[side];
  const [shoulder, hip, knee, ankle] = [idx.shoulder, idx.hip, idx.knee, idx.ankle].map((i) => points[i]);
  return {
    side,
    visibility,
    knee: angleAt(hip, knee, ankle),
    hip: angleAt(shoulder, hip, knee),
    torso: leanFromVertical(shoulder, hip),
    thigh: thighAngle(hip, knee),
  };
}
