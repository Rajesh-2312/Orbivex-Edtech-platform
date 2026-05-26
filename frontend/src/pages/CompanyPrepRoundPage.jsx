import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  HiOutlineArrowLeft,
  HiOutlineBookOpen,
  HiOutlineAcademicCap,
  HiOutlineClipboardDocumentCheck,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineChevronRight,
  HiOutlineSparkles,
} from 'react-icons/hi2';
import PageTransition from '../components/layout/PageTransition';
import Badge from '../components/ui/Badge';
import { findCompany } from '../lib/companyPrepData';
import api from '../lib/api';

export default function CompanyPrepRoundPage() {
  const { slug, index } = useParams();
  const navigate = useNavigate();
  const company = useMemo(() => findCompany(slug), [slug]);
  const roundIndex = Number(index);
  const round = company?.rounds?.[roundIndex];

  const [completedRounds, setCompletedRounds] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    api.get(`/company-prep/${company.slug}/progress`)
      .then((res) => {
        if (cancelled) return;
        const list = res.data?.data?.completed || [];
        setCompletedRounds([...list].sort((a, b) => a - b));
      })
      .catch(() => {
        if (!cancelled) setCompletedRounds([]);
      });
    return () => { cancelled = true; };
  }, [company]);

  if (!company || !round) {
    return (
      <PageTransition>
        <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-muted)' }}>
          <h2 style={{ font: '600 1.2rem/1 var(--font-display)', color: 'var(--text-primary)', marginBottom: 12 }}>
            Round not found
          </h2>
          <button className="btn btn-ghost" onClick={() => navigate('/company-prep')}>
            <HiOutlineArrowLeft size={16} /> Back to companies
          </button>
        </div>
      </PageTransition>
    );
  }

  const doneCount = completedRounds.length;
  const isCompleted = completedRounds.includes(roundIndex);
  const isUnlocked = roundIndex <= doneCount; // sequential unlock
  const color = company.color;

  const markComplete = async () => {
    if (busy || isCompleted) return;
    if (!isUnlocked) {
      window.alert('Complete the previous rounds first.');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/company-prep/${company.slug}/progress`, { round_index: roundIndex });
      setCompletedRounds([...completedRounds, roundIndex].sort((a, b) => a - b));
    } catch (err) {
      window.alert('Failed to mark round complete. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageTransition>
      {/* Back link */}
      <button
        type="button"
        onClick={() => navigate(`/company-prep/${company.slug}`)}
        className="btn btn-ghost"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          marginBottom: 20, padding: '6px 12px',
          font: '500 0.85rem/1 var(--font-body)',
        }}
      >
        <HiOutlineArrowLeft size={16} />
        {company.name} roadmap
      </button>

      {/* Round hero */}
      <div className="glass-card-static" style={{
        padding: 28,
        marginBottom: 24,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: -80, right: -80,
          width: 280, height: 280,
          borderRadius: '50%',
          background: color,
          opacity: 0.18,
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', position: 'relative', marginBottom: 14 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            font: '700 1.4rem/1 var(--font-display)', color: '#fff',
            flexShrink: 0,
          }}>
            {roundIndex + 1}
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ font: '500 0.74rem/1 var(--font-body)', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {company.name} · Round {roundIndex + 1} of {company.rounds.length}
            </div>
            <h1 style={{ font: '700 1.5rem/1.2 var(--font-display)', color: 'var(--text-primary)', margin: '0 0 6px' }}>
              {round.title}
            </h1>
            <p style={{ font: '400 0.92rem/1.5 var(--font-body)', color: 'var(--text-secondary)', margin: 0 }}>
              {round.summary}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 10px', borderRadius: 999,
              background: 'rgba(255,255,255,0.04)',
              font: '500 0.78rem/1 var(--font-body)', color: 'var(--text-muted)',
            }}>
              <HiOutlineClock size={14} />
              {round.duration}
            </div>
            {isCompleted && <Badge variant="success">Completed</Badge>}
            {!isCompleted && isUnlocked && <Badge variant="primary">Current</Badge>}
            {!isUnlocked && <Badge variant="warning">Locked</Badge>}
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 10,
          background: `${color}10`,
          border: `1px solid ${color}33`,
          font: '500 0.82rem/1.4 var(--font-body)', color: 'var(--text-secondary)',
        }}>
          <HiOutlineSparkles size={16} style={{ color, flexShrink: 0 }} />
          <span>
            Work through each topic — <strong style={{ color: 'var(--text-primary)' }}>Learn</strong> the concepts,
            then <strong style={{ color: 'var(--text-primary)' }}>Practice</strong> with MCQs. Take the round test when you feel ready.
          </span>
        </div>
      </div>

      {/* Topic cards */}
      <h2 style={{
        font: '700 1.05rem/1 var(--font-display)',
        color: 'var(--text-primary)',
        margin: '0 0 14px',
      }}>
        Topics in this round ({round.topics.length})
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
        {round.topics.map((topic, ti) => (
          <motion.div
            key={topic}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: ti * 0.04 }}
            className="glass-card-static"
            style={{
              padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `${color}1a`,
              border: `1px solid ${color}40`,
              color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              font: '700 0.9rem/1 var(--font-display)',
              flexShrink: 0,
            }}>
              {ti + 1}
            </div>

            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ font: '600 0.95rem/1.3 var(--font-display)', color: 'var(--text-primary)' }}>
                {topic}
              </div>
              <div style={{ font: '400 0.76rem/1 var(--font-body)', color: 'var(--text-muted)', marginTop: 4 }}>
                Learn the concepts → Practice MCQs
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => navigate(`/company-prep/${company.slug}/rounds/${roundIndex}/topics/${ti}/learn`)}
                disabled={!isUnlocked}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 8,
                  background: isUnlocked ? `${color}1a` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isUnlocked ? color + '44' : 'rgba(255,255,255,0.08)'}`,
                  color: isUnlocked ? color : 'var(--text-muted)',
                  cursor: isUnlocked ? 'pointer' : 'not-allowed',
                  font: '600 0.8rem/1 var(--font-body)',
                }}
              >
                <HiOutlineBookOpen size={14} />
                Learn
              </button>
              <button
                type="button"
                onClick={() => navigate(`/company-prep/${company.slug}/rounds/${roundIndex}/topics/${ti}/practice`)}
                disabled={!isUnlocked}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 8,
                  background: isUnlocked ? `linear-gradient(135deg, ${color}, ${color}cc)` : 'rgba(255,255,255,0.04)',
                  border: 'none',
                  color: isUnlocked ? '#fff' : 'var(--text-muted)',
                  cursor: isUnlocked ? 'pointer' : 'not-allowed',
                  font: '600 0.8rem/1 var(--font-body)',
                }}
              >
                <HiOutlineAcademicCap size={14} />
                Practice
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Round test + mark complete */}
      <div className="glass-card-static" style={{ padding: 22, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `${color}1a`, border: `1px solid ${color}44`,
            color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HiOutlineClipboardDocumentCheck size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ font: '600 1rem/1.2 var(--font-display)', color: 'var(--text-primary)', marginBottom: 4 }}>
              Round test
            </div>
            <div style={{ font: '400 0.82rem/1.4 var(--font-body)', color: 'var(--text-secondary)' }}>
              Take the timed test for this round to validate your prep.
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/tests')}
            className="btn btn-ghost"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 16px',
              font: '600 0.85rem/1 var(--font-body)',
            }}
          >
            Browse tests
            <HiOutlineChevronRight size={14} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <button
          type="button"
          onClick={markComplete}
          disabled={busy || isCompleted || !isUnlocked}
          className="btn btn-primary"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 22px',
            background: isCompleted
              ? 'rgba(52,211,153,0.18)'
              : isUnlocked
                ? `linear-gradient(135deg, ${color}, ${color}cc)`
                : 'rgba(255,255,255,0.05)',
            border: isCompleted ? '1px solid rgba(52,211,153,0.45)' : 'none',
            color: isCompleted ? '#34d399' : isUnlocked ? '#fff' : 'var(--text-muted)',
            cursor: (busy || isCompleted || !isUnlocked) ? 'not-allowed' : 'pointer',
            font: '600 0.9rem/1 var(--font-body)',
          }}
        >
          <HiOutlineCheckCircle size={18} />
          {isCompleted
            ? 'Round completed'
            : busy
              ? 'Saving…'
              : isUnlocked
                ? 'Mark round complete'
                : 'Complete previous rounds first'}
        </button>
      </div>
    </PageTransition>
  );
}
