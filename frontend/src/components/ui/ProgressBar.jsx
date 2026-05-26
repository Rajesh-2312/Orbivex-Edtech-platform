import { motion } from 'framer-motion';

export default function ProgressBar({ value = 0, max = 100, height = 8, showLabel = false, color }) {
  const percentage = Math.min(Math.round((value / max) * 100), 100);

  return (
    <div style={{ width: '100%' }}>
      <div className="progress-bar" style={{ height }}>
        <motion.div
          className="progress-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          style={color ? { background: color } : {}}
        />
      </div>
      {showLabel && (
        <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{value} / {max}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{percentage}%</span>
        </div>
      )}
    </div>
  );
}
