import { AnimatePresence, motion } from 'framer-motion';
import useUiStore from '../../store/uiStore';
import { HiCheckCircle, HiExclamationCircle, HiInformationCircle, HiExclamationTriangle } from 'react-icons/hi2';

const icons = {
  success: HiCheckCircle,
  error: HiExclamationCircle,
  info: HiInformationCircle,
  warning: HiExclamationTriangle,
};

export default function Toast() {
  const { toasts, removeToast } = useUiStore();

  return (
    <div className="toast-container">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type] || icons.info;
          return (
            <motion.div
              key={toast.id}
              className={`toast toast-${toast.type}`}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => removeToast(toast.id)}
            >
              <Icon size={20} />
              <span>{toast.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
