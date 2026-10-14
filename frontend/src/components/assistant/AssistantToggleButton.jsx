import { motion } from 'framer-motion';
import { HiOutlineBolt } from 'react-icons/hi2';
import useAssistantStore from '../../store/assistantStore';

/**
 * Global launcher for the platform assistant. Sits above the lesson tutor's
 * button (bottom: 84) so both can coexist on a lesson page without overlap.
 */
export default function AssistantToggleButton() {
  const open = useAssistantStore((s) => s.open);
  const setOpen = useAssistantStore((s) => s.setOpen);

  if (open) return null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => setOpen(true)}
      aria-label="Open Orbivex Assistant"
      style={{
        position: 'fixed', right: 24, bottom: 84, zIndex: 899,
        padding: '12px 18px', display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'linear-gradient(135deg,#6366f1,#a855f7)', color: '#fff', fontWeight: 700,
        font: '700 0.88rem/1 var(--font-display)', border: 'none', borderRadius: 999,
        boxShadow: '0 14px 36px rgba(99,102,241,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset',
        cursor: 'pointer',
      }}
    >
      <HiOutlineBolt size={18} />
      Assistant
    </motion.button>
  );
}
