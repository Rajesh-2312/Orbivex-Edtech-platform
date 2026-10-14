/**
 * Face engine — the "is the student facing the screen?" half of proctoring.
 *
 * Wraps MediaPipe FaceLandmarker as a module singleton: the model is ~3.7MB and
 * takes a second or two to compile, so it is loaded once and shared by every LSRW
 * page for the life of the tab.
 *
 * Assets are served from our own origin (see frontend/scripts/vendor-mediapipe.mjs).
 * Nothing here touches a CDN — a network blip mid-exam must never be able to
 * terminate an honest student.
 */
import { FaceLandmarker } from '@mediapipe/tasks-vision';
import { getVisionFileset } from './mediapipeFileset';

const MODEL_PATH = '/mediapipe/face_landmarker.task';

export const POSE_THRESHOLDS = {
  YAW: 28,          // degrees left/right before we call it "turned away"
  PITCH_UP: 18,     // chin up — staring at the ceiling
  PITCH_DOWN: -25,  // asymmetric on purpose: glancing down at a keyboard is normal
  GAZE: 0.55,       // blendshape score for eyes driven to one side
};

let loadPromise = null;
let landmarker = null;

/**
 * Loads (once) and returns the FaceLandmarker.
 * Concurrent callers share the same in-flight promise.
 */
export function loadFaceEngine() {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const fileset = await getVisionFileset();
    const baseOptions = { modelAssetPath: MODEL_PATH };

    const options = {
      runningMode: 'VIDEO',
      // 2, not 1 — we cannot report "someone else is in frame" if we only ever
      // ask the model for a single face.
      numFaces: 2,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    };

    try {
      landmarker = await FaceLandmarker.createFromOptions(fileset, {
        ...options,
        baseOptions: { ...baseOptions, delegate: 'GPU' },
      });
    } catch {
      // Plenty of college lab machines have no usable WebGL. CPU is slower but
      // comfortably fast enough at our 7fps sampling rate.
      landmarker = await FaceLandmarker.createFromOptions(fileset, {
        ...options,
        baseOptions: { ...baseOptions, delegate: 'CPU' },
      });
    }
    return landmarker;
  })();

  // A failed load must not poison the singleton — let the next caller retry.
  loadPromise.catch(() => { loadPromise = null; });
  return loadPromise;
}

export function isFaceEngineReady() {
  return !!landmarker;
}

/**
 * Euler angles from MediaPipe's 4x4 facial transformation matrix.
 *
 * The array is column-major, so element (row r, col c) lives at index c*4+r.
 * Getting this transposed is the classic way to end up with yaw and pitch swapped,
 * which shows up as "looking away" firing when someone nods.
 */
function matrixToEuler(m) {
  const r00 = m[0], r10 = m[1], r20 = m[2];
  const r21 = m[6];
  const r22 = m[10];

  const pitch = Math.atan2(-r20, Math.hypot(r21, r22));
  const yaw = Math.atan2(r10, r00);
  const deg = 180 / Math.PI;
  return { yaw: yaw * deg, pitch: pitch * deg };
}

function blend(categories, name) {
  const hit = categories.find(c => c.categoryName === name);
  return hit ? hit.score : 0;
}

/**
 * Runs one detection pass.
 *
 * @param video      the live <video> element
 * @param timestampMs monotonically increasing; MediaPipe rejects going backwards
 * @returns {null|{faceCount:number, yaw:number|null, pitch:number|null, gazeOff:boolean, poseOff:boolean}}
 *          null if the engine is not loaded yet (caller should treat as "unknown",
 *          never as a violation).
 */
export function analyseFace(video, timestampMs) {
  if (!landmarker || !video || video.readyState < 2) return null;

  let result;
  try {
    result = landmarker.detectForVideo(video, timestampMs);
  } catch {
    return null;
  }

  const faceCount = result?.faceLandmarks?.length || 0;
  if (faceCount === 0) {
    return { faceCount: 0, yaw: null, pitch: null, gazeOff: false, poseOff: false };
  }

  let yaw = null;
  let pitch = null;
  const matrix = result.facialTransformationMatrixes?.[0]?.data;
  if (matrix?.length === 16) ({ yaw, pitch } = matrixToEuler(matrix));

  const poseOff = yaw !== null && (
    Math.abs(yaw) > POSE_THRESHOLDS.YAW ||
    pitch > POSE_THRESHOLDS.PITCH_UP ||
    pitch < POSE_THRESHOLDS.PITCH_DOWN
  );

  // Head straight but eyes hard left/right is the sneakier cheat, and head pose
  // alone cannot see it. Require the *outward* blendshape on one eye paired with
  // the *inward* one on the other — that combination only happens on a real
  // sideways saccade, whereas a single high score is often just a blink artefact.
  let gazeOff = false;
  const shapes = result.faceBlendshapes?.[0]?.categories;
  if (shapes?.length) {
    const G = POSE_THRESHOLDS.GAZE;
    const lookLeft = blend(shapes, 'eyeLookOutLeft') > G && blend(shapes, 'eyeLookInRight') > G;
    const lookRight = blend(shapes, 'eyeLookOutRight') > G && blend(shapes, 'eyeLookInLeft') > G;
    gazeOff = lookLeft || lookRight;
  }

  return { faceCount, yaw, pitch, gazeOff, poseOff };
}

/** Frees the singleton. Call on full teardown, not between LSRW pages. */
export function disposeFaceEngine() {
  try { landmarker?.close(); } catch { /* already gone */ }
  landmarker = null;
  loadPromise = null;
}
