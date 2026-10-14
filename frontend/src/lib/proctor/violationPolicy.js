/**
 * Violation policy — decides when an observation becomes a terminated attempt.
 *
 * Pure and time-driven: the caller feeds observations plus elapsed milliseconds
 * and gets back a verdict. No DOM, no camera, no React, so the thresholds can be
 * exercised in a test by driving fake time.
 *
 * The single most important property here is that a violation must be *sustained*.
 * Judging individual frames terminates honest students constantly — a hand passing
 * the lens, a glance at the keyboard, or a webcam auto-exposure step is enough.
 */

export const SUSTAIN_MS = 3000;   // continuous violation required to terminate
export const WARN_MS = 1500;      // countdown appears at the halfway point
export const STARTUP_GRACE_MS = 2000;
export const DECAY_RATIO = 0.5;   // clean frames drain the accumulator at half speed

/**
 * Per-reason sustain windows, overriding SUSTAIN_MS.
 *
 * A phone gets a much shorter window than everything else because the cheat it
 * defends against — photographing the question on screen — takes only one to three
 * seconds. A 3s window would reliably miss the exact thing it exists to catch.
 * That is acceptable here in a way it would not be for head pose: a phone in frame
 * is unambiguous, whereas a turned head is ordinary human movement.
 */
export const SUSTAIN_OVERRIDES = { phone_detected: 1200 };

export const REASONS = {
  phone_detected:  'A mobile phone was detected. Phones are not allowed during the attempt.',
  camera_covered:  'Your camera is blocked. Remove anything covering the lens (shutter, tape, or your hand).',
  camera_frozen:   'Your camera feed is not live. Virtual or frozen camera feeds are not allowed.',
  looking_away:    'Keep your face towards the screen. Looking away is not allowed during the attempt.',
  no_face:         'Your face is no longer visible. Stay in front of the camera for the whole attempt.',
  multiple_faces:  'More than one person is visible. You must attempt this alone.',
  tab_switch:      'You left the exam tab. Switching away ends the attempt.',
  window_blur:     'The exam window lost focus. Clicking away ends the attempt.',
  fullscreen_exit: 'You left fullscreen. The attempt must be taken in fullscreen.',
  camera_lost:     'The camera stopped sending video. Check that it is connected and not in use by another app.',
};

/** Discrete, unambiguous events — no sustain window, they fire immediately. */
export const INSTANT_REASONS = new Set(['tab_switch', 'window_blur', 'fullscreen_exit']);

export function reasonMessage(reason) {
  return REASONS[reason] || 'A proctoring rule was broken, so the attempt was ended.';
}

export function createPolicy({
  sustainMs = SUSTAIN_MS,
  warnMs = WARN_MS,
  startupGraceMs = STARTUP_GRACE_MS,
  decayRatio = DECAY_RATIO,
} = {}) {
  /** @type {Map<string, number>} reason → accumulated violating ms */
  const acc = new Map();
  let sinceStart = 0;
  let terminated = null;

  const sustainFor = (reason) => SUSTAIN_OVERRIDES[reason] ?? sustainMs;
  // Keep the warning at the same relative point in every window, so a 1.2s phone
  // rule still gives visible notice rather than terminating out of nowhere.
  const warnFor = (reason) => sustainFor(reason) * (warnMs / sustainMs);

  return {
    /**
     * Advance the state machine.
     *
     * @param activeReasons string[] reasons currently observed this tick
     * @param dtMs          ms since the previous update
     * @returns {{level:'ok'|'warn'|'terminate', reason:string|null, msRemaining:number}}
     */
    update(activeReasons, dtMs) {
      if (terminated) return { level: 'terminate', reason: terminated, msRemaining: 0 };

      sinceStart += dtMs;

      // Webcam auto-exposure is still settling and the model is still warming, so
      // the opening frames are genuinely unreadable. Judging them would fail people
      // before they have done anything.
      if (sinceStart < startupGraceMs) {
        return { level: 'ok', reason: null, msRemaining: sustainMs };
      }


      const active = new Set(activeReasons);

      for (const reason of active) {
        if (INSTANT_REASONS.has(reason)) {
          terminated = reason;
          return { level: 'terminate', reason, msRemaining: 0 };
        }
        acc.set(reason, (acc.get(reason) || 0) + dtMs);
      }

      // Drain reasons that stopped — but drain them *slowly*. A hard reset would
      // hand out a trivial bypass: cover the lens for 2.5s, uncover for one frame,
      // repeat forever, never terminate. Decaying at half speed means repeated
      // near-misses still converge on termination while a single innocent blip
      // clears harmlessly.
      for (const [reason, ms] of acc) {
        if (active.has(reason)) continue;
        const next = ms - dtMs * decayRatio;
        if (next <= 0) acc.delete(reason);
        else acc.set(reason, next);
      }

      // Report on whichever reason is closest to terminating. Compared as a
      // fraction of that reason's own window, not raw milliseconds — with mixed
      // windows raw ms ranks wrongly, e.g. looking_away at 1000/3000ms would
      // outrank a phone at 900/1200ms despite the phone being far closer to firing.
      let worst = null;
      let worstMs = 0;
      let worstRatio = 0;
      for (const [reason, ms] of acc) {
        const ratio = ms / sustainFor(reason);
        if (ratio > worstRatio) { worst = reason; worstMs = ms; worstRatio = ratio; }
      }

      if (!worst) return { level: 'ok', reason: null, msRemaining: sustainMs };

      const sustain = sustainFor(worst);
      if (worstMs >= sustain) {
        terminated = worst;
        return { level: 'terminate', reason: worst, msRemaining: 0 };
      }
      if (worstMs >= warnFor(worst)) {
        return { level: 'warn', reason: worst, msRemaining: Math.max(0, sustain - worstMs) };
      }
      // Building up but not yet worth alarming the student about.
      return { level: 'ok', reason: null, msRemaining: sustain - worstMs };
    },

    /** Terminate immediately, bypassing the sustain window (e.g. camera unplugged). */
    forceTerminate(reason) {
      terminated = terminated || reason;
      return terminated;
    },

    isTerminated: () => !!terminated,
    terminatedReason: () => terminated,
  };
}
