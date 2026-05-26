import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  HiChevronLeft, HiChevronRight, HiOutlineCalendarDays,
  HiOutlineClock,
} from 'react-icons/hi2';
import PageTransition from '../components/layout/PageTransition';
import useCalendarStore from '../store/calendarStore';

const TYPE_COLOR = {
  exam:     '#f87171',
  deadline: '#fbbf24',
  class:    '#60a5fa',
  event:    '#a78bfa',
};
const TYPE_LABEL = {
  exam: 'Exam', deadline: 'Deadline', class: 'Class', event: 'Event',
};
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); }
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const events    = useCalendarStore((s) => s.events);
  const loading   = useCalendarStore((s) => s.loading);
  const fetchCal  = useCalendarStore((s) => s.fetch);

  const [cursor, setCursor]   = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());

  // Compute the 42-cell window (6 weeks × 7 days) that the grid shows.
  const gridStart = useMemo(() => {
    const first = startOfMonth(cursor);
    const d = new Date(first);
    d.setDate(d.getDate() - d.getDay()); // back up to Sunday
    return d;
  }, [cursor]);

  const gridEnd = useMemo(() => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + 42);
    return d;
  }, [gridStart]);

  useEffect(() => {
    fetchCal(gridStart.toISOString(), gridEnd.toISOString());
  }, [gridStart, gridEnd, fetchCal]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      const d = new Date(ev.starts_at);
      if (Number.isNaN(d.getTime())) continue;
      const key = d.toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    }
    return map;
  }, [events]);

  const daysOfMonth = useMemo(() => {
    const out = [];
    const d = new Date(gridStart);
    for (let i = 0; i < 42; i++) {
      out.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }, [gridStart]);

  const selectedDayEvents = eventsByDay.get(selected.toDateString()) || [];

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const shiftMonth = (delta) => {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + delta);
    setCursor(startOfMonth(next));
  };

  const jumpToday = () => {
    const today = new Date();
    setCursor(startOfMonth(today));
    setSelected(today);
  };

  return (
    <PageTransition>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0 }}>Calendar</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
            Tests, deadlines, and scheduled classes for your section
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => shiftMonth(-1)} className="btn btn-icon btn-ghost" aria-label="Previous month">
            <HiChevronLeft size={18} />
          </button>
          <div style={{
            font: '700 0.95rem/1 var(--font-display)', color: 'var(--text-primary)',
            minWidth: 150, textAlign: 'center',
          }}>{monthLabel}</div>
          <button onClick={() => shiftMonth(1)} className="btn btn-icon btn-ghost" aria-label="Next month">
            <HiChevronRight size={18} />
          </button>
          <button onClick={jumpToday} className="btn btn-ghost" style={{ padding: '6px 12px', font: '500 0.82rem/1 var(--font-body)' }}>
            Today
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
        {/* Month grid */}
        <motion.div
          className="glass-card-static"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          style={{ padding: 18 }}
        >
          {/* Weekday header */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 8,
          }}>
            {WEEKDAYS.map((w) => (
              <div key={w} style={{
                font: '600 0.7rem/1 var(--font-body)', color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                textAlign: 'center', padding: '6px 0',
              }}>{w}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {daysOfMonth.map((day) => {
              const inMonth = day.getMonth() === cursor.getMonth();
              const today = isSameDay(day, new Date());
              const isSel = isSameDay(day, selected);
              const dayEvents = eventsByDay.get(day.toDateString()) || [];
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelected(day)}
                  style={{
                    minHeight: 78, padding: 8, textAlign: 'left',
                    background: isSel ? 'rgba(249,115,22,0.08)' : 'rgba(255,255,255,0.02)',
                    border: today ? '1px solid var(--brand-500)' : '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 8, cursor: 'pointer',
                    opacity: inMonth ? 1 : 0.4,
                    display: 'flex', flexDirection: 'column', gap: 4,
                    transition: 'background 0.15s ease',
                  }}
                >
                  <div style={{
                    font: today ? '700 0.85rem/1 var(--font-display)' : '500 0.82rem/1 var(--font-body)',
                    color: today ? 'var(--brand-400)' : 'var(--text-primary)',
                  }}>
                    {day.getDate()}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {dayEvents.slice(0, 4).map((ev, i) => (
                      <span key={ev.id + ':' + i} style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: TYPE_COLOR[ev.type] || 'var(--brand-400)',
                        boxShadow: `0 0 4px ${TYPE_COLOR[ev.type] || 'var(--brand-400)'}90`,
                      }} />
                    ))}
                    {dayEvents.length > 4 && (
                      <span style={{ font: '500 0.62rem/1 var(--font-body)', color: 'var(--text-muted)' }}>
                        +{dayEvents.length - 4}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Agenda sidebar */}
        <motion.div
          className="glass-card-static"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          style={{ padding: '18px 20px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <HiOutlineCalendarDays size={18} style={{ color: 'var(--brand-400)' }} />
            <h3 style={{ margin: 0, font: '700 0.95rem/1 var(--font-display)' }}>
              {selected.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </h3>
          </div>

          {loading && <div style={{ color: 'var(--text-muted)' }}>Loading…</div>}

          {!loading && selectedDayEvents.length === 0 && (
            <div style={{ font: '400 0.85rem/1.5 var(--font-body)', color: 'var(--text-muted)' }}>
              Nothing scheduled.
            </div>
          )}

          {!loading && selectedDayEvents.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {selectedDayEvents.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => ev.action_url && navigate(ev.action_url)}
                  disabled={!ev.action_url}
                  style={{
                    padding: '10px 12px', borderRadius: 10, textAlign: 'left',
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${TYPE_COLOR[ev.type] || 'rgba(255,255,255,0.06)'}30`,
                    cursor: ev.action_url ? 'pointer' : 'default',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: TYPE_COLOR[ev.type] || 'var(--brand-400)',
                    }} />
                    <span style={{
                      font: '600 0.66rem/1 var(--font-body)', color: 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>
                      {TYPE_LABEL[ev.type] || ev.type}
                    </span>
                  </div>
                  <div style={{ font: '600 0.9rem/1.3 var(--font-display)', color: 'var(--text-primary)', marginBottom: 4 }}>
                    {ev.title}
                  </div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    font: '400 0.76rem/1 var(--font-body)', color: 'var(--text-muted)',
                  }}>
                    <HiOutlineClock size={12} />
                    {new Date(ev.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {ev.ends_at && ' — ' + new Date(ev.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {ev.description && (
                    <div style={{ font: '400 0.8rem/1.5 var(--font-body)', color: 'var(--text-secondary)', marginTop: 6 }}>
                      {ev.description}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </PageTransition>
  );
}
