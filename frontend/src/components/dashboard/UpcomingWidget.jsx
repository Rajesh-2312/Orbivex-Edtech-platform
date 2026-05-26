import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  HiOutlineCalendarDays, HiOutlineClock, HiOutlineArrowRight,
} from 'react-icons/hi2';
import useCalendarStore from '../../store/calendarStore';

const TYPE_COLOR = {
  exam:     '#f87171',
  deadline: '#fbbf24',
  class:    '#60a5fa',
  event:    '#a78bfa',
};

function formatWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now.getTime() + 86400_000);
  if (d.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (sameDay) {
    return `Today · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function UpcomingWidget() {
  const navigate = useNavigate();
  const events = useCalendarStore((s) => s.events);
  const loading = useCalendarStore((s) => s.loading);
  const fetchUpcoming = useCalendarStore((s) => s.fetchUpcoming);

  useEffect(() => { fetchUpcoming(7); }, [fetchUpcoming]);

  const items = events.slice(0, 5);

  return (
    <motion.div
      className="glass-card-static"
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      style={{ padding: '22px 24px', marginBottom: 20 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HiOutlineCalendarDays size={20} style={{ color: 'var(--brand-400)' }} />
          <h3 style={{ font: '700 1rem/1 var(--font-display)', color: 'var(--text-primary)', margin: 0 }}>
            Upcoming this week
          </h3>
        </div>
        <button
          onClick={() => navigate('/calendar')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            font: '500 0.78rem/1 var(--font-body)', color: 'var(--brand-400)',
          }}
        >
          View all <HiOutlineArrowRight size={14} />
        </button>
      </div>

      {loading && (
        <div style={{ color: 'var(--text-muted)', font: '400 0.85rem/1.4 var(--font-body)' }}>
          Loading…
        </div>
      )}

      {!loading && items.length === 0 && (
        <div style={{
          padding: '18px 0', textAlign: 'center',
          color: 'var(--text-muted)', font: '400 0.85rem/1.5 var(--font-body)',
        }}>
          No scheduled events this week.
        </div>
      )}

      {!loading && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((ev) => (
            <button
              key={ev.id}
              onClick={() => ev.action_url && navigate(ev.action_url)}
              disabled={!ev.action_url}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10, textAlign: 'left',
                cursor: ev.action_url ? 'pointer' : 'default',
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: TYPE_COLOR[ev.type] || 'var(--brand-400)',
                boxShadow: `0 0 8px ${TYPE_COLOR[ev.type] || 'var(--brand-400)'}80`,
                flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  font: '600 0.86rem/1.3 var(--font-body)', color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {ev.title}
                </div>
                <div style={{
                  font: '400 0.74rem/1 var(--font-body)', color: 'var(--text-muted)',
                  marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <HiOutlineClock size={12} /> {formatWhen(ev.starts_at)}
                </div>
              </div>
              <span style={{
                font: '600 0.65rem/1 var(--font-body)', color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {ev.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
