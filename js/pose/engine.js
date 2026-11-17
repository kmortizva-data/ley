// Thin wrapper over MediaPipe Pose Landmarker (Apache 2.0), loaded from vendor/ so it works offline.
// Everything runs on the device: frames are never stored or sent anywhere.
import { FilesetResolver, PoseLandmarker } from '../../vendor/mediapipe/vision_bundle.mjs';

const BASE = new URL('../../vendor/mediapipe/', import.meta.url);

export const MODELS = {
  lite: { file: 'pose_landmarker_lite.task', label: 'Ligero' },
  full: { file: 'pose_landmarker_full.task', label: 'Completo' },
};

/** Pairs of landmark indices that form the skeleton lines. */
export const CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS.map((c) => [c.start, c.end]);

let filesetPromise;

/**
 * @param {{model?: 'lite'|'full', delegate?: 'GPU'|'CPU'}} options
 * @returns {Promise<{detect:(source:HTMLVideoElement|HTMLCanvasElement, timeMs:number)=>Array|null, close:()=>void}>}
 */
export async function createPose({ model = 'lite', delegate = 'GPU' } = {}) {
  filesetPromise ??= FilesetResolver.forVisionTasks(new URL('wasm', BASE).href);
  const landmarker = await PoseLandmarker.createFromOptions(await filesetPromise, {
    baseOptions: { modelAssetPath: new URL(MODELS[model].file, BASE).href, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
  });
  return {
    /** 33 landmarks normalized to 0..1, or null when nobody is found. */
    detect(source, timeMs) {
      return landmarker.detectForVideo(source, timeMs).landmarks?.[0] ?? null;
    },
    close() {
      landmarker.close();
    },
  };
}
