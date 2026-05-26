import { motion } from 'framer-motion';

export default function Button({ children, variant = 'primary', size = 'md', loading, disabled, className = '', ...props }) {
  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';
  const variantClass = `btn-${variant}`;

  return (
    <motion.button
      className={`btn ${variantClass} ${sizeClass} ripple ${className}`}
      disabled={disabled || loading}
      whileTap={{ scale: 0.97 }}
      {...props}
    >
      {loading && <span className="spinner" style={{ width: 18, height: 18 }} />}
      {children}
    </motion.button>
  );
}
