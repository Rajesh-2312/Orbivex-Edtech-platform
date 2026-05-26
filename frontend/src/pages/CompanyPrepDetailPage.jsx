import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  HiOutlineArrowLeft,
  HiOutlineCheckCircle,
  HiOutlineLockClosed,
  HiOutlineClock,
  HiOutlinePlay,
  HiOutlineArrowPath,
  HiOutlineTrophy,
  HiOutlineCloud,
  HiOutlineCloudArrowUp,
  HiOutlineExclamationCircle,
} from 'react-icons/hi2';
import PageTransition from '../components/layout/PageTransition';
import Badge from '../components/ui/Badge';
import { findCompany } from '../lib/companyPrepData';
import api from '../lib/api';

function RoundCard({ round, index, status, color, onOpen }) {
  const isComplete = status === 'complete';
  const isCurrent = status === 'current';
  const isLocked = status === 'locked';

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: isLocked ? 0.55 : 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      style={{ position: 'relative', paddingLeft: 60 }}
    >
      {/* Step circle on the timeline */}
      <div style={{
        position: 'absolute',
        left: 12,
        top: 18,
        width: 40, height: 40,
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isComplete
          ? `linear-gradient(135deg, ${color}, ${color}cc)`
          : isCurrent
            ? 'var(--surface-2)'
            : 'var(--surface-1)',
        border: isCurrent ? `2px solid ${color}` : '2px solid rgba(255,255,255,0.08)',
        font: '700 0.95rem/1 var(--font-display)',
        color: isComplete ? '#fff' : isCurrent ? color : 'var(--text-muted)',
        zIndex: 2,
        boxShadow: isCurrent ? `0 0 0 6px ${color}22` : 'none',
        transition: 'all 0.3s',
      }}>
        {isComplete ? <HiOutlineCheckCircle size={22} /> : isLocked ? <HiOutlineLockClosed size={16} /> : index + 1}
      </div>

      {/* Card */}
      <div className={isCurrent ? 'glass-card' : 'glass-card-static'} style={{
        padding: '20px 22px',
        marginBottom: 18,
        borderColor: isCurrent ? `${color}66` : undefined,
        boxShadow: isCurrent ? `0 8px 30px -12px ${color}55` : undefined,
      }}>
        {/* Title + duration */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
          <h3 style={{
            font: '600 1.05rem/1.3 var(--font-display)',
            color: isLocked ? 'var(--text-muted)' : 'var(--text-primary)',
            margin: 0,
          }}>
            Round {index + 1} — {round.title}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              font: '500 0.75rem/1 var(--font-body)', color: 'var(--text-muted)',
            }}>
              <HiOutlineClock size={13} />
              {round.duration}
            </div>
            {isComplete && <Badge variant="success">Done</Badge>}
            {isCurrent && <Badge variant="primary">Current</Badge>}
          </div>
        </div>

        {/* Summary */}
        <p style={{
          font: '400 0.85rem/1.5 var(--font-body)',
          color: 'var(--text-secondary)',
          margin: '0 0 14px',
        }}>
          {round.summary}
        </p>

        {/* Topics */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: !isLocked ? 16 : 0 }}>
          {round.topics.map((t) => (
            <span key={t} style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: isLocked ? 'rgba(255,255,255,0.03)' : `${color}14`,
              border: `1px solid ${isLocked ? 'rgba(255,255,255,0.06)' : color + '33'}`,
              font: '500 0.72rem/1 var(--font-body)',
              color: isLocked ? 'var(--text-muted)' : color,
            }}>
              {t}
            </span>
          ))}
        </div>

        {/* Action */}
        {!isLocked && (
          <button
            type="button"
            onClick={onOpen}
            className="btn btn-primary"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: isCurrent
                ? `linear-gradient(135deg, ${color}, ${color}cc)`
                : 'rgba(255,255,255,0.05)',
              border: isCurrent ? 'none' : '1px solid rgba(255,255,255,0.1)',
              color: isCurrent ? '#fff' : 'var(--text-secondary)',
            }}
          >
            <HiOutlinePlay size={16} />
            {isComplete ? 'Review topics' : isCurrent ? 'Open this round' : 'Open round'}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function SyncBadge({ state }) {
  const map = {
    loading: { label: 'Loading…', icon: HiOutlineCloudArrowUp, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)', spin: true },
    saving:  { label: 'Saving…',  icon: HiOutlineCloudArrowUp, color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)', spin: true },
    synced:  { label: 'Synced',   icon: HiOutlineCloud,         color: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.35)', spin: false },
    error:   { label: 'Sync failed', icon: HiOutlineExclamationCircle, color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)', spin: false },
  };
  const cfg = map[state] || map.synced;
  const Icon = cfg.icon;
  return (
    <span
      title={state === 'synced' ? 'Progress is saved to your account' : cfg.label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 9px', borderRadius: 999,
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        color: cfg.color, font: '500 0.7rem/1 var(--font-body)',
      }}
    >
      <motion.span
        animate={cfg.spin ? { rotate: 360 } : { rotate: 0 }}
        transition={cfg.spin ? { repeat: Infinity, duration: 1.6, ease: 'linear' } : { duration: 0.2 }}
        style={{ display: 'inline-flex' }}
      >
        <Icon size={12} />
      </motion.span>
      {cfg.label}
    </span>
  );
}

export default function CompanyPrepDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const company = useMemo(() => findCompany(slug), [slug]);
  const [completed, setCompleted] = useState([]);
  const [busy, setBusy] = useState(false);
  // 'loading' on initial fetch, 'synced' once it lands, 'saving' during a write,
  // 'error' if a request fails. Drives the SyncBadge next to the progress bar.
  const [syncState, setSyncState] = useState('loading');

  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    setSyncState('loading');
    api.get(`/company-prep/${company.slug}/progress`)
      .then((res) => {
        if (cancelled) return;
        const list = res.data?.data?.completed || [];
        setCompleted([...list].sort((a, b) => a - b));
        setSyncState('synced');
      })
      .catch(() => {
        if (cancelled) return;
        setCompleted([]);
        setSyncState('error');
      });
    return () => { cancelled = true; };
  }, [company]);

  if (!company) {
    return (
      <PageTransition>
        <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-muted)' }}>
          <h2 style={{ font: '600 1.2rem/1 var(--font-display)', color: 'var(--text-primary)', marginBottom: 12 }}>
            Company not found
          </h2>
          <button className="btn btn-ghost" onClick={() => navigate('/company-prep')}>
            <HiOutlineArrowLeft size={16} /> Back to companies
          </button>
        </div>
      </PageTransition>
    );
  }

  const total = company.rounds.length;
  const doneCount = completed.length;
  const pct = Math.round((doneCount / total) * 100);
  const finished = doneCount === total;

  const openRound = (idx) => {
    navigate(`/company-prep/${company.slug}/rounds/${idx}`);
  };

  const reset = async () => {
    if (busy) return;
    if (!window.confirm(`Reset your progress for ${company.name}?`)) return;
    setBusy(true);
    setSyncState('saving');
    const prev = completed;
    setCompleted([]);
    try {
      await api.delete(`/company-prep/${company.slug}/progress`);
      setSyncState('synced');
    } catch {
      setCompleted(prev);
      setSyncState('error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageTransition>
      {/* Back link */}
      <button
        type="button"
        onClick={() => navigate('/company-prep')}
        className="btn btn-ghost"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          marginBottom: 20, padding: '6px 12px',
          font: '500 0.85rem/1 var(--font-body)',
        }}
      >
        <HiOutlineArrowLeft size={16} />
        All companies
      </button>

      {/* Hero */}
      <div className="glass-card-static" style={{
        padding: '28px',
        marginBottom: 28,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: -80, right: -80,
          width: 280, height: 280,
          borderRadius: '50%',
          background: company.color,
          opacity: 0.18,
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
          <div style={{
            width: 80, height: 80, borderRadius: 18,
            background: `linear-gradient(135deg, ${company.color}, ${company.color}cc)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            font: '700 2.2rem/1 var(--font-display)', color: '#fff',
            boxShadow: `0 16px 40px -12px ${company.color}90`,
            flexShrink: 0,
          }}>
            {company.initials}
          </div>

          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
              <h1 style={{ font: '700 1.7rem/1 var(--font-display)', color: 'var(--text-primary)', margin: 0 }}>
                {company.name}
              </h1>
              <Badge variant="primary">{company.tier}</Badge>
              <Badge variant={company.difficulty.includes('Hard') ? 'danger' : company.difficulty.includes('Easy') ? 'success' : 'warning'}>
                {company.difficulty}
              </Badge>
            </div>
            <p style={{ font: '400 0.92rem/1.5 var(--font-body)', color: 'var(--text-secondary)', margin: '0 0 6px' }}>
              {company.tagline}
            </p>
            <div style={{ font: '400 0.78rem/1 var(--font-body)', color: 'var(--text-muted)' }}>
              {total} rounds · {company.hiring}
            </div>
          </div>

          {finished && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '16px 20px',
              borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.05))',
              border: '1px solid rgba(34,197,94,0.4)',
            }}>
              <HiOutlineTrophy size={32} style={{ color: '#34d399' }} />
              <div style={{ font: '700 0.85rem/1 var(--font-display)', color: '#34d399', marginTop: 6 }}>
                Roadmap complete!
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 22 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
            font: '500 0.78rem/1 var(--font-body)',
            color: 'var(--text-muted)', marginBottom: 8,
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              Progress: {doneCount} of {total} rounds
              <SyncBadge state={syncState} />
            </span>
            <span>{pct}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5 }}
              style={{
                height: '100%',
                background: `linear-gradient(90deg, ${company.color}, ${company.color}aa)`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Roadmap */}
      <div style={{ position: 'relative', paddingBottom: 16 }}>
        {/* Vertical line behind step circles */}
        <div style={{
          position: 'absolute',
          left: 32,
          top: 24,
          bottom: 24,
          width: 2,
          background: 'linear-gradient(180deg, rgba(249,115,22,0.4), rgba(249,115,22,0.05))',
          zIndex: 1,
        }} />

        {company.rounds.map((round, idx) => {
          let status = 'locked';
          if (idx < doneCount) status = 'complete';
          else if (idx === doneCount) status = 'current';

          return (
            <RoundCard
              key={idx}
              round={round}
              index={idx}
              status={status}
              color={company.color}
              onOpen={() => openRound(idx)}
            />
          );
        })}
      </div>

      {/* Reset action */}
      {doneCount > 0 && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button type="button" onClick={reset} className="btn btn-ghost" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            font: '500 0.82rem/1 var(--font-body)', color: 'var(--text-muted)',
          }}>
            <HiOutlineArrowPath size={14} />
            Reset progress
          </button>
        </div>
      )}
    </PageTransition>
  );
}
