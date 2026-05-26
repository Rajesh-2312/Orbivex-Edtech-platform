import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { HiOutlineSparkles } from 'react-icons/hi2';
import useTutorStore from '../../store/tutorStore';

const SEEN_KEY = 'orbivex.tutor.seenPulse';

export default function TutorToggleButton() {
  const open = useTutorStore((s) => s.open);
  const setOpen = useTutorStore((s) => s.setOpen);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(SEEN_KEY)) {
        setPulse(true);
        sessionStorage.setItem(SEEN_KEY, '1');
        const t = setTimeout(() => setPulse(false), 6000);
        return () => clearTimeout(t);
      }
    } catch { /* sessionStorage unavailable */ }
  }, []);

  if (open) return null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => setOpen(true)}
      aria-label="Ask the AI tutor"
      style={{
        position: 'fixed', right: 24, bottom: 24, zIndex: 900,
        padding: '12px 18px',
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'linear-gradient(135deg,#f97316,#fbbf24)',
        color: '#0a0a0a', fontWeight: 700,
        font: '700 0.88rem/1 var(--font-display)',
        border: 'none', borderRadius: 999,
        boxShadow: '0 14px 36px rgba(249,115,22,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset',
        cursor: 'pointer',
      }}
    >
      <motion.span
        animate={pulse ? { rotate: [0, 12, -8, 0] } : { rotate: 0 }}
        transition={pulse ? { repeat: 2, duration: 0.8 } : { duration: 0.2 }}
        style={{ display: 'inline-flex' }}
      >
        <HiOutlineSparkles size={18} />
      </motion.span>
      Ask Tutor
      {pulse && (
        <motion.span
          initial={{ opacity: 0.4, scale: 1 }}
          animate={{ opacity: 0, scale: 1.7 }}
          transition={{ duration: 1.8, repeat: 2 }}
          style={{
            position: 'absolute', inset: 0, borderRadius: 999,
            background: 'rgba(251,191,36,0.4)', pointerEvents: 'none',
          }}
        />
      )}
    </motion.button>
  );
}
