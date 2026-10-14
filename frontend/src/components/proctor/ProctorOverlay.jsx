/**
 * ProctorOverlay — everything the student sees from the proctor.
 *
 * Replaces the picture-in-picture preview that was duplicated across all four
 * LSRW pages, and adds the warning countdown that gives an honest student a
 * chance to correct themselves before the attempt is ended.
 *
 * Spread the useProctor() return straight into it: <ProctorOverlay {...proctor} />
 */
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineExclamationTriangle } from 'react-icons/hi2';
import { reasonMessage } from '../../lib/proctor/violationPolicy';

export default function ProctorOverlay({ videoRef, active, warning, modelReady }) {
  if (!active) return null;

  const warned = !!warning;
  const seconds = warned ? Math.max(1, Math.ceil(warning.msRemaining / 1000)) : 0;

  return (
    <>
      {/* ── Warning banner: what is wrong, and how long they have to fix it ── */}
      <AnimatePresence>
        {warned && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            role="alert"
            aria-live="assertive"
            // Full-width strip rather than a floating card: a centred card lands on
            // top of the page heading and is hard to read in the ~1.5s the student
            // has to correct themselves.
            style={{
              position: 'fixed', top: 0, left: 0, right: 0,
              zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              padding: '12px 20px',
              background: 'rgba(31,10,10,0.97)',
              borderBottom: '2px solid #ef4444',
              boxShadow: '0 6px 30px rgba(0,0,0,0.55)',
              backdropFilter: 'blur(8px)',
            }}>
            <HiOutlineExclamationTriangle size={22} style={{ color: '#ef4444', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#fca5a5', marginBottom: 2 }}>
                Attempt ends in {seconds}s
              </div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.82)', lineHeight: 1.4 }}>
                {reasonMessage(warning.reason)}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Live preview. Border turns red while a violation is building, so the
             student can see it is the camera that is complaining. ── */}
      <div style={{
        position: 'fixed', bottom: 20, right: 20, width: 150,
        borderRadius: 12, overflow: 'hidden',
        border: `2px solid ${warned ? '#ef4444' : 'rgba(59,130,246,0.5)'}`,
        boxShadow: warned ? '0 0 0 4px rgba(239,68,68,0.18), 0 8px 30px rgba(0,0,0,0.5)' : '0 8px 30px rgba(0,0,0,0.5)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        zIndex: 110, background: '#000',
      }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ width: '100%', display: 'block', transform: 'scaleX(-1)' }}
        />
        <div style={{
          position: 'absolute', top: 6, left: 8, display: 'flex', alignItems: 'center', gap: 5,
          fontSize: '0.64rem', fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.8)',
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', background: '#ef4444',
            animation: 'proctorPulse 1.4s ease-in-out infinite',
          }} />
          PROCTORED
        </div>

        {/* Cover detection is live from frame one; only gaze tracking waits on the
            model. Saying so avoids implying the student is unmonitored meanwhile. */}
        {!modelReady && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '3px 6px', fontSize: '0.58rem', fontWeight: 600,
            color: 'rgba(255,255,255,0.85)', background: 'rgba(0,0,0,0.6)', textAlign: 'center',
          }}>
            Loading face tracking…
          </div>
        )}
        <style>{`@keyframes proctorPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      </div>
    </>
  );
}
