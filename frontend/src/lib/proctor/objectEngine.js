/**
 * Object engine — the "is there a phone in frame?" half of proctoring.
 *
 * Exists because the face engine is structurally blind to the most common cheat:
 * a student photographing the question on screen. To take that photo they look
 * *at* the screen, so head pose and gaze both read as perfectly normal. The only
 * observable signal is the phone itself.
 *
 * EfficientDet-Lite0 (int8, 4.4MB) via MediaPipe ObjectDetector — the same package
 * that already provides FaceLandmarker, so this adds no dependency. Served from our
 * own origin like every other proctoring asset; nothing is fetched from a CDN.
 */
import { ObjectDetector } from '@mediapipe/tasks-vision';
import { getVisionFileset } from './mediapipeFileset';

const MODEL_PATH = '/mediapipe/efficientdet_lite0.tflite';

// Exact string from the model's embedded COCO labelmap. Verified against the
// .tflite metadata — a mismatch here would silently detect nothing at all, which
// is the worst possible failure mode for a rule people are relying on.
export const PHONE_LABEL = 'cell phone';

// Raise this if a wallet, TV remote, or calculator ever trips a real student —
// those are the objects most easily confused with a phone at webcam distance.
export const PHONE_SCORE_THRESHOLD = 0.45;

let loadPromise = null;
let detector = null;

export function loadObjectEngine() {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const fileset = await getVisionFileset();
    const baseOptions = { modelAssetPath: MODEL_PATH };

    const options = {
      runningMode: 'VIDEO',
      scoreThreshold: PHONE_SCORE_THRESHOLD,
      // Discards the other 79 COCO classes inside the model's own postprocessing:
      // cheaper than filtering afterwards, and no other class can ever leak into
      // a termination.
      categoryAllowlist: [PHONE_LABEL],
      maxResults: 3,
    };

    // CPU, deliberately — not GPU-first like the face engine.
    //
    // Measured in this project (headless Chrome, same frames, warmup discarded):
    //   int8    CPU  94ms   GPU 414ms
    //   float32 CPU 115ms   GPU 387ms
    //
    // EfficientDet-Lite is small enough that the per-frame texture upload and
    // readback dominate the actual convolutions, so the GPU delegate loses badly.
    // CPU is also the predictable choice across the range of hardware in a college
    // lab, and predictability matters more than peak speed in a monitoring loop.
    detector = await ObjectDetector.createFromOptions(fileset, {
      ...options,
      baseOptions: { ...baseOptions, delegate: 'CPU' },
    });
    return detector;
  })();

  loadPromise.catch(() => { loadPromise = null; });
  return loadPromise;
}

export function isObjectEngineReady() {
  return !!detector;
}

/**
 * Runs one detection pass.
 *
 * @param video       the live <video> element
 * @param timestampMs monotonically increasing (MediaPipe rejects going backwards)
 * @returns {null|{phone: boolean, score: number}} null when the engine is not
 *          loaded — the caller must treat that as *unknown*, never as a violation.
 */
export function analyseObjects(video, timestampMs) {
  if (!detector || !video || video.readyState < 2) return null;

  let result;
  try {
    result = detector.detectForVideo(video, timestampMs);
  } catch {
    return null;
  }

  let score = 0;
  for (const d of result?.detections || []) {
    for (const c of d.categories || []) {
      if (c.categoryName === PHONE_LABEL && c.score > score) score = c.score;
    }
  }
  return { phone: score >= PHONE_SCORE_THRESHOLD, score };
}

/** Frees the singleton. Call on full teardown, not between LSRW pages. */
export function disposeObjectEngine() {
  try { detector?.close(); } catch { /* already gone */ }
  detector = null;
  loadPromise = null;
}
