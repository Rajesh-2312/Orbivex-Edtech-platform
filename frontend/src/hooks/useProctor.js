/**
 * useProctor — owns the camera, the monitoring loop, and the browser-level guards
 * for one LSRW attempt.
 *
 * Pages call start() from the click that begins the attempt (a user gesture is
 * required for both getUserMedia and requestFullscreen), then render
 * <ProctorOverlay {...proctor} />. Everything else is handled here.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createFrameSampler, classifyCover } from '../lib/proctor/frameStats';
import { loadFaceEngine, analyseFace, isFaceEngineReady } from '../lib/proctor/faceEngine';
import { loadObjectEngine, analyseObjects, isObjectEngineReady } from '../lib/proctor/objectEngine';
import { createPolicy, STARTUP_GRACE_MS, INSTANT_REASONS } from '../lib/proctor/violationPolicy';
import { terminateLSRWSession, logProctorEvents } from '../lib/lsrwApi';
import useUiStore from '../store/uiStore';
import useAssistantStore from '../store/assistantStore';

// ~7fps. Deliberately not requestAnimationFrame: rAF is throttled to ~1fps and
// often paused outright in a background tab, which would freeze the detector at
// exactly the moment a student switches away.
const TICK_MS = 150;

// Object detection runs on every Nth tick — 450ms apart, ~2.2fps.
//
// Measured cost per inference: face ~28ms, object ~97ms (CPU, this machine). At
// every 2nd tick the object detector alone would occupy a third of the main
// thread, which is enough to lag typing in the Writing page's essay box. Every 3rd
// tick brings that to ~21% while still giving between two and three independent
// looks inside the phone rule's 1.2s window.
//
// If lab machines still struggle, the next step is moving inference to a Web
// Worker rather than sampling any less often.
const OBJECT_EVERY_N_TICKS = 3;

export default function useProctor({ skill, sessionId, onTerminate, enabled = true }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const samplerRef = useRef(null);
  const policyRef = useRef(null);
  const timerRef = useRef(null);
  const lastTickRef = useRef(0);
  const armedAtRef = useRef(0);
  const shuttingDownRef = useRef(false);
  const firedRef = useRef(false);
  const eventsRef = useRef([]);
  const warnedReasonsRef = useRef(new Set());
  const tickCountRef = useRef(0);
  const phoneLatchRef = useRef(false);

  // Callbacks live in refs so the loop never needs re-creating (and so a parent
  // re-render can't leave the interval holding a stale closure).
  const onTerminateRef = useRef(onTerminate);
  const sessionIdRef = useRef(sessionId);
  useEffect(() => { onTerminateRef.current = onTerminate; }, [onTerminate]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  const [active, setActive] = useState(false);
  const [modelReady, setModelReady] = useState(isFaceEngineReady());
  const [warning, setWarning] = useState(null);       // { reason, msRemaining }
  const [terminated, setTerminated] = useState(null); // reason

  const flushEvents = useCallback(() => {
    const batch = eventsRef.current;
    if (!batch.length || !sessionIdRef.current) return;
    eventsRef.current = [];
    // Fire-and-forget: an audit write must never block or break the student's UI.
    logProctorEvents(sessionIdRef.current, batch).catch(() => {});
  }, []);

  const releaseHardware = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    samplerRef.current?.reset();
    if (videoRef.current) videoRef.current.srcObject = null;
    // Restore the normal UI (assistant, etc.) — the attempt is over either way.
    useUiStore.getState().setExamMode(false);
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  /** Ends the attempt. Idempotent — several guards can trip in the same tick. */
  const fire = useCallback((reason) => {
    if (firedRef.current) return;
    firedRef.current = true;
    shuttingDownRef.current = true;

    eventsRef.current.push({ reason, severity: 'terminate', at: new Date().toISOString() });
    flushEvents();
    if (sessionIdRef.current) {
      terminateLSRWSession(sessionIdRef.current, reason).catch(() => {});
    }

    releaseHardware();
    exitFullscreen();
    setWarning(null);
    setTerminated(reason);
    setActive(false);
    onTerminateRef.current?.(reason);
  }, [flushEvents, releaseHardware, exitFullscreen]);

  /** Normal, non-violating shutdown: submitted, went back, or unmounted. */
  const stop = useCallback(() => {
    shuttingDownRef.current = true;
    flushEvents();
    releaseHardware();
    exitFullscreen();
    setActive(false);
    setWarning(null);
  }, [flushEvents, releaseHardware, exitFullscreen]);

  const tick = useCallback(() => {
    const policy = policyRef.current;
    const video = videoRef.current;
    if (!policy || shuttingDownRef.current) return;

    const now = performance.now();
    const dt = Math.min(now - lastTickRef.current, 1000); // clamp: tab throttling
    lastTickRef.current = now;

    const reasons = [];

    // The camera track dying (unplugged, grabbed by another app, revoked
    // permission) is terminal on its own — nothing below can be trusted.
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track || track.readyState === 'ended' || !streamRef.current?.active) {
      fire('camera_lost');
      return;
    }

    const stats = samplerRef.current?.sample(video);
    const cover = classifyCover(stats);
    if (cover) reasons.push(cover);

    // Only consult the face model when the lens is clearly unobstructed. A covered
    // camera also yields zero faces, and reporting "no face" there would tell the
    // student to sit still when the real fix is to uncover the lens.
    if (!cover && isFaceEngineReady()) {
      const face = analyseFace(video, now);
      if (face) {
        if (face.faceCount === 0) reasons.push('no_face');
        else if (face.faceCount > 1) reasons.push('multiple_faces');
        else if (face.poseOff || face.gazeOff) reasons.push('looking_away');
      }
    }

    // Phone detection is deliberately independent of the face result. Someone
    // photographing the question is looking straight at the screen with their face
    // plainly visible, so nesting this under any face condition would miss the very
    // case it exists for.
    tickCountRef.current++;
    if (!cover && isObjectEngineReady()) {
      if (tickCountRef.current % OBJECT_EVERY_N_TICKS === 0) {
        const objects = analyseObjects(video, now);
        // A null result means the engine could not read the frame — leave the latch
        // alone rather than treating "unknown" as "no phone".
        if (objects) phoneLatchRef.current = objects.phone;
      }
      // Re-report the latched verdict on skipped ticks. Without this the policy
      // would decay the accumulator on every other tick, roughly doubling the
      // effective window and silently defeating the shorter phone rule.
      if (phoneLatchRef.current) reasons.push('phone_detected');
    }

    const verdict = policy.update(reasons, dt);

    if (verdict.level === 'terminate') { fire(verdict.reason); return; }

    if (verdict.level === 'warn') {
      // One audit row per reason per attempt, not one per tick.
      if (!warnedReasonsRef.current.has(verdict.reason)) {
        warnedReasonsRef.current.add(verdict.reason);
        eventsRef.current.push({ reason: verdict.reason, severity: 'warn', at: new Date().toISOString() });
      }
      setWarning({ reason: verdict.reason, msRemaining: verdict.msRemaining });
    } else {
      setWarning(w => (w ? null : w));
    }
  }, [fire]);

  /**
   * Begins proctoring. Must be called from a user gesture.
   * @returns {Promise<boolean>} false if the camera was denied (page shows its own message).
   */
  const start = useCallback(async () => {
    if (!enabled || streamRef.current) return true;

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch {
      return false;
    }

    streamRef.current = stream;
    samplerRef.current = createFrameSampler();
    policyRef.current = createPolicy();
    shuttingDownRef.current = false;
    firedRef.current = false;
    warnedReasonsRef.current = new Set();
    eventsRef.current = [];
    tickCountRef.current = 0;
    phoneLatchRef.current = false;
    lastTickRef.current = performance.now();
    armedAtRef.current = performance.now();

    setTerminated(null);
    setWarning(null);
    setActive(true);

    // Lock down the surrounding UI for the duration of the attempt, and close the
    // assistant if the student already had it open — hiding the launcher alone
    // would leave an open chat panel sitting there.
    useUiStore.getState().setExamMode(true);
    useAssistantStore.getState().setOpen(false);

    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // Denied or unsupported. Not fatal — the fullscreen guard simply has
      // nothing to watch; every camera-based check still applies.
    }

    // Warm both models in the background. Cover detection is already live and
    // needs no model, so the attempt is never unprotected while these load.
    // Loaded independently: if the object detector fails, face tracking must still
    // come up, and vice versa.
    loadFaceEngine().then(() => setModelReady(true)).catch(() => setModelReady(false));
    loadObjectEngine().catch(() => { /* phone detection unavailable; other rules stand */ });

    timerRef.current = setInterval(tick, TICK_MS);
    return true;
  }, [enabled, tick]);

  // Browser-level guards. Armed only after the startup grace, because the camera
  // permission prompt itself steals focus — arming immediately would terminate
  // every student on their first-ever attempt, before they had done anything.
  useEffect(() => {
    if (!active) return undefined;

    const guard = (reason) => () => {
      if (shuttingDownRef.current || firedRef.current) return;
      if (performance.now() - armedAtRef.current < STARTUP_GRACE_MS) return;
      if (INSTANT_REASONS.has(reason)) fire(reason);
    };

    const onVisibility = () => { if (document.hidden) guard('tab_switch')(); };
    const onBlur = guard('window_blur');
    const onFullscreen = () => { if (!document.fullscreenElement) guard('fullscreen_exit')(); };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, [active, fire]);

  // Keep the preview attached — React can swap the <video> node out from under us
  // when the page changes phase.
  useEffect(() => {
    if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  });

  // Unmount teardown — leaving the page is not a violation.
  useEffect(() => () => {
    shuttingDownRef.current = true;
    flushEvents();
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    // Must clear here too: this path does not go through releaseHardware, and
    // leaving it set would hide the assistant across the rest of the app.
    useUiStore.getState().setExamMode(false);
  }, [flushEvents]);

  return { videoRef, start, stop, active, warning, terminated, modelReady, skill };
}
