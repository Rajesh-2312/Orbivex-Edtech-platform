import { motion } from 'framer-motion';
import { HiOutlineCheckCircle } from 'react-icons/hi2';

export default function RecentActivity({ activities }) {
  if (!activities || activities.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        No recent activity yet. Start learning!
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {activities.map((activity, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px 16px', borderRadius: 'var(--radius-md)',
            transition: 'background 0.2s',
          }}
          whileHover={{ backgroundColor: 'rgba(99,102,241,0.03)' }}
        >
          <HiOutlineCheckCircle size={18} style={{ color: 'var(--accent-emerald)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Completed <strong>{activity.lessons?.title || 'Lesson'}</strong>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {activity.completed_at ? new Date(activity.completed_at).toLocaleDateString() : ''}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
