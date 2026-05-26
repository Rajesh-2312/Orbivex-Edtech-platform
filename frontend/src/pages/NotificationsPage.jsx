import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiBell, HiCheckCircle } from 'react-icons/hi2';
import PageTransition from '../components/layout/PageTransition';
import useNotificationStore from '../store/notificationStore';

const TYPE_LABEL = {
  grade:              'Grades',
  application_status: 'Applications',
  course_access:      'Courses',
  test_published:     'Tests',
  course_complete:    'Achievements',
  tutor_reply:        'Tutor',
  calendar_event:     'Calendar',
};
const TYPE_COLOR = {
  grade:              '#34d399',
  application_status: '#60a5fa',
  course_access:      '#f97316',
  test_published:     '#f87171',
  course_complete:    '#fbbf24',
  tutor_reply:        '#a78bfa',
  calendar_event:     '#60a5fa',
};
const FILTERS = [
  { key: 'all',                label: 'All' },
  { key: 'grade',              label: 'Grades' },
  { key: 'test_published',     label: 'Tests' },
  { key: 'course_access',      label: 'Courses' },
  { key: 'application_status', label: 'Jobs' },
];

function timeAgo(iso) {
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.floor((now - then) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsPage() {
  const navigate    = useNavigate();
  const items       = useNotificationStore((s) => s.items);
  const loading     = useNotificationStore((s) => s.loading);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const fetchAll    = useNotificationStore((s) => s.fetch);
  const markRead    = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = filter === 'all' ? items : items.filter((n) => n.type === filter);

  const onClick = (n) => {
    if (!n.read) markRead(n.id);
    if (n.action_url) navigate(n.action_url);
  };

  return (
    <PageTransition>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0 }}>Notifications</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="btn btn-ghost"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px' }}
          >
            <HiCheckCircle size={16} /> Mark all read
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '6px 14px', borderRadius: 999,
              background: filter === f.key ? 'linear-gradient(135deg,#f97316,#fbbf24)' : 'rgba(255,255,255,0.04)',
              color: filter === f.key ? '#0a0a0a' : 'var(--text-secondary)',
              border: '1px solid ' + (filter === f.key ? 'transparent' : 'rgba(255,255,255,0.08)'),
              font: '600 0.78rem/1 var(--font-body)',
              cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>Loading…</div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="glass-card-static" style={{ padding: 36, textAlign: 'center' }}>
          <HiBell size={28} style={{ color: 'var(--text-muted)', marginBottom: 10 }} />
          <div style={{ font: '600 1rem/1.3 var(--font-display)', color: 'var(--text-primary)', marginBottom: 4 }}>
            Nothing here yet
          </div>
          <div style={{ font: '400 0.85rem/1.5 var(--font-body)', color: 'var(--text-muted)' }}>
            You'll see updates about grades, courses, jobs, and tests as they happen.
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((n) => (
            <motion.button
              key={n.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              onClick={() => onClick(n)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '14px 16px', textAlign: 'left',
                background: n.read ? 'rgba(255,255,255,0.02)' : 'rgba(249,115,22,0.06)',
                border: '1px solid ' + (n.read ? 'rgba(255,255,255,0.05)' : 'rgba(249,115,22,0.18)'),
                borderRadius: 12, cursor: 'pointer',
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: TYPE_COLOR[n.type] || 'var(--brand-400)',
                boxShadow: `0 0 6px ${TYPE_COLOR[n.type] || 'var(--brand-400)'}90`,
                marginTop: 6, flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{
                    font: '600 0.65rem/1 var(--font-body)', color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    {TYPE_LABEL[n.type] || 'Update'}
                  </span>
                  <span style={{ font: '400 0.7rem/1 var(--font-body)', color: 'var(--text-muted)' }}>
                    {timeAgo(n.created_at)}
                  </span>
                </div>
                <div style={{
                  font: (n.read ? '500' : '700') + ' 0.92rem/1.3 var(--font-display)',
                  color: 'var(--text-primary)', marginBottom: n.message ? 4 : 0,
                }}>
                  {n.title}
                </div>
                {n.message && (
                  <div style={{
                    font: '400 0.84rem/1.5 var(--font-body)', color: 'var(--text-secondary)',
                  }}>
                    {n.message}
                  </div>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </PageTransition>
  );
}
