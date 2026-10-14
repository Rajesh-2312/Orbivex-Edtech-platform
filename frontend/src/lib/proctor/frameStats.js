/**
 * Frame statistics — the "is the lens covered?" half of proctoring.
 *
 * Deliberately model-free. A closed shutter, taped lens, or hand over the camera
 * is a statistics problem, not a vision problem, so it costs ~0.2ms per frame and
 * keeps working even if the face model fails to load.
 *
 * Everything here is pure apart from the sampler's own canvas, which makes the
 * thresholds testable by handing classifyCover() a hand-built stats object.
 */

// Analysis resolution. 64x48 is far below the camera's native size — we only need
// coarse structure, and downscaling is itself a cheap low-pass that kills sensor noise.
const W = 64;
const H = 48;

export const COVER_THRESHOLDS = {
  DARK_LUMA: 12,        // shutter closed / taped / black cloth
  BRIGHT_LUMA: 243,     // white paper held against the lens
  BRIGHT_STD: 10,       // ...and flat enough to not be a real bright scene
  FLAT_STD: 8,          // structureless field
  FLAT_EDGES: 0.02,     // ...with no edges either — a hand right on the lens
  FROZEN_DELTA: 0.35,   // per-pixel mean change; below this nothing is moving
};

/**
 * Creates a reusable sampler bound to one offscreen canvas.
 *
 * `willReadFrequently` matters here: without it browsers keep the canvas on the
 * GPU and every getImageData becomes a stalling readback, which at 7fps is enough
 * to visibly hitch the page.
 */
export function createFrameSampler() {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let prevGray = null;

  return {
    /**
     * @returns {null|{meanLuma:number, stdDev:number, edgeDensity:number, temporalDelta:number}}
     *          null while the video has no decodable frame yet.
     */
    sample(video) {
      if (!video || video.readyState < 2 || !video.videoWidth) return null;

      ctx.drawImage(video, 0, 0, W, H);
      const { data } = ctx.getImageData(0, 0, W, H);

      const gray = new Float32Array(W * H);
      let sum = 0;
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        // Rec. 601 luma — matches how the eye weights the channels.
        const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        gray[p] = g;
        sum += g;
      }
      const meanLuma = sum / gray.length;

      let variance = 0;
      for (let p = 0; p < gray.length; p++) {
        const d = gray[p] - meanLuma;
        variance += d * d;
      }
      const stdDev = Math.sqrt(variance / gray.length);

      // Edge density: mean absolute neighbour difference, normalised to 0..1.
      // A real scene — face, wall corner, doorway — always has structure. A palm
      // pressed to the lens does not, however bright it happens to be.
      let edgeSum = 0;
      let edgeCount = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const p = y * W + x;
          if (x + 1 < W) { edgeSum += Math.abs(gray[p] - gray[p + 1]); edgeCount++; }
          if (y + 1 < H) { edgeSum += Math.abs(gray[p] - gray[p + W]); edgeCount++; }
        }
      }
      const edgeDensity = edgeCount ? (edgeSum / edgeCount) / 255 : 0;

      // Temporal delta vs the previous sample. A live camera always jitters from
      // sensor noise alone; a frozen image or a looping virtual camera does not.
      let temporalDelta = Number.POSITIVE_INFINITY;
      if (prevGray) {
        let diff = 0;
        for (let p = 0; p < gray.length; p++) diff += Math.abs(gray[p] - prevGray[p]);
        temporalDelta = diff / gray.length;
      }
      prevGray = gray;

      return { meanLuma, stdDev, edgeDensity, temporalDelta };
    },

    reset() { prevGray = null; },
  };
}

/**
 * Classifies a stats object as a covered lens.
 * @returns {null|'camera_covered'|'camera_frozen'}
 */
export function classifyCover(stats) {
  if (!stats) return null;
  const { meanLuma, stdDev, edgeDensity, temporalDelta } = stats;
  const T = COVER_THRESHOLDS;

  if (meanLuma < T.DARK_LUMA) return 'camera_covered';
  if (meanLuma > T.BRIGHT_LUMA && stdDev < T.BRIGHT_STD) return 'camera_covered';

  // The case brightness alone always misses: a skin-toned palm on the lens is
  // neither dark nor bright, just featureless. Needs both signals — a genuinely
  // low-contrast wall behind the student still carries some edge energy.
  if (stdDev < T.FLAT_STD && edgeDensity < T.FLAT_EDGES) return 'camera_covered';

  if (temporalDelta < T.FROZEN_DELTA) return 'camera_frozen';
  return null;
}
