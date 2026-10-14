/**
 * Shared MediaPipe WASM runtime.
 *
 * Both proctoring engines (face landmarks, object detection) used to resolve their
 * own fileset, which instantiated the ~11.7MB vision WASM module twice. Beyond the
 * wasted memory, the two runtimes contend badly: measured on a CPU-only browser,
 * object detection ran at ~408ms per frame alongside a separately-loaded face
 * engine, versus ~105ms in isolation.
 *
 * FilesetResolver is designed to back several tasks, so it is resolved once here
 * and shared. Concurrent callers await the same in-flight promise.
 */
import { FilesetResolver } from '@mediapipe/tasks-vision';

// Served from our own origin — nothing in proctoring is fetched from a CDN, so a
// blocked or flaky network cannot disarm an exam.
const WASM_PATH = '/mediapipe/wasm';

let filesetPromise = null;

export function getVisionFileset() {
  if (!filesetPromise) {
    filesetPromise = FilesetResolver.forVisionTasks(WASM_PATH);
    // A failed load must not poison the singleton — let the next caller retry.
    filesetPromise.catch(() => { filesetPromise = null; });
  }
  return filesetPromise;
}
