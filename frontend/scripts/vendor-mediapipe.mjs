/**
 * Copies the MediaPipe WASM runtime out of node_modules and into public/ so the
 * proctoring engine loads entirely from our own origin.
 *
 * Exams must keep working when a college network blocks external hosts, and a
 * CDN hiccup mid-attempt would terminate innocent students — so nothing here is
 * ever fetched at runtime. Runs on postinstall so the vendored copy cannot drift
 * from the installed @mediapipe/tasks-vision version.
 *
 * The face_landmarker.task model itself is committed (see public/mediapipe/);
 * it is not published to npm, so it is downloaded once by hand:
 *   https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
 */
import { existsSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const dest = join(root, 'public', 'mediapipe', 'wasm');

if (!existsSync(src)) {
  // Not an error: `npm install --omit=dev` or a partial install can run
  // postinstall before the package lands. Fail quietly rather than break install.
  console.warn('[vendor-mediapipe] @mediapipe/tasks-vision not present — skipped.');
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
let n = 0;
for (const file of readdirSync(src)) {
  copyFileSync(join(src, file), join(dest, file));
  n++;
}
console.log(`[vendor-mediapipe] copied ${n} runtime files → public/mediapipe/wasm/`);
