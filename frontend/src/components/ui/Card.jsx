import { motion } from 'framer-motion';

export default function Card({ children, hover = true, className = '', onClick, ...props }) {
  return (
    <motion.div
      className={`${hover ? 'glass-card' : 'glass-card-static'} ${className}`}
      whileHover={hover ? { y: -2, boxShadow: '0 0 30px rgba(99,102,241,0.15)' } : {}}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : {}}
      {...props}
    >
      {children}
    </motion.div>
  );
}
