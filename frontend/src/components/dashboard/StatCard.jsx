import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

/* Animated count-up for numeric values; passes strings through untouched */
function CountUp({ value }) {
  const ref = useRef(null);
  const numeric = typeof value === 'number' || /^\d+$/.test(String(value));
  useEffect(() => {
    if (!numeric || !ref.current) return;
    const target = Number(value);
    let frame; const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / 900, 1);
      ref.current.textContent = Math.round((1 - Math.pow(1 - p, 3)) * target).toLocaleString('en-IN');
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, numeric]);

  if (!numeric) return <>{value}</>;
  return <span ref={ref}>0</span>;
}

export default function StatCard({ icon, value, label, color, index = 0 }) {
  return (
    <motion.div
      className="glass-card stat-card"
      style={{ '--stat-color': color }}
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
    >
      <span className="stat-accent" />
      <div className="stat-icon" style={{ background: `${color}20`, color }}>
        {icon}
      </div>
      <div className="stat-value">
        <CountUp value={value} />
      </div>
      <div className="stat-label">{label}</div>
    </motion.div>
  );
}
