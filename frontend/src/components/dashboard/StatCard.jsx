import { motion } from 'framer-motion';

export default function StatCard({ icon, value, label, color, index = 0 }) {
  return (
    <motion.div
      className="glass-card stat-card"
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="stat-icon" style={{ background: `${color}20`, color }}>
        {icon}
      </div>
      <motion.div
        className="stat-value"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 + index * 0.1 }}
      >
        {value}
      </motion.div>
      <div className="stat-label">{label}</div>
    </motion.div>
  );
}
