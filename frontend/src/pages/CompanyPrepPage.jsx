import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  HiOutlineBuildingOffice2,
  HiOutlineArrowRight,
  HiOutlineSparkles,
  HiOutlineCheckCircle,
} from 'react-icons/hi2';
import PageTransition from '../components/layout/PageTransition';
import Badge from '../components/ui/Badge';
import { COMPANIES } from '../lib/companyPrepData';
import api from '../lib/api';

function CompanyTile({ company, progressMap, onClick }) {
  const total = company.rounds.length;
  const done = progressMap[company.slug]?.completed || 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const started = done > 0;
  const finished = done === total;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25 }}
      className="glass-card"
      style={{
        padding: '22px',
        textAlign: 'left',
        cursor: 'pointer',
        border: 'none',
        background: 'var(--surface-1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Brand glow accent */}
      <div style={{
        position: 'absolute',
        top: -40, right: -40,
        width: 140, height: 140,
        borderRadius: '50%',
        background: company.color,
        opacity: 0.18,
        filter: 'blur(40px)',
        pointerEvents: 'none',
      }} />

      {/* Logo + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: `linear-gradient(135deg, ${company.color}, ${company.color}cc)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          font: '700 1.6rem/1 var(--font-display)',
          color: '#fff',
          boxShadow: `0 10px 30px -8px ${company.color}80`,
          flexShrink: 0,
        }}>
          {company.initials}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <Badge variant={company.difficulty.includes('Hard') ? 'danger' : company.difficulty.includes('Easy') ? 'success' : 'warning'}>
            {company.difficulty}
          </Badge>
          {finished ? (
            <Badge variant="success">
              <HiOutlineCheckCircle size={12} style={{ marginRight: 4, verticalAlign: '-2px' }} />
              Mastered
            </Badge>
          ) : started ? (
            <Badge variant="primary">In progress</Badge>
          ) : null}
        </div>
      </div>

      {/* Name + tagline */}
      <div>
        <h3 style={{
          font: '700 1.15rem/1.2 var(--font-display)',
          color: 'var(--text-primary)',
          margin: '0 0 4px',
        }}>
          {company.name}
        </h3>
        <div style={{
          font: '500 0.72rem/1 var(--font-body)',
          color: 'var(--brand-400)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}>
          {company.tier}
        </div>
        <p style={{
          font: '400 0.83rem/1.5 var(--font-body)',
          color: 'var(--text-secondary)',
          margin: 0,
          minHeight: '2.5em',
        }}>
          {company.tagline}
        </p>
      </div>

      {/* Round count + hiring */}
      <div style={{
        display: 'flex',
        gap: '14px',
        font: '400 0.75rem/1 var(--font-body)',
        color: 'var(--text-muted)',
      }}>
        <span>{total} rounds</span>
        <span style={{ opacity: 0.4 }}>•</span>
        <span>{company.hiring}</span>
      </div>

      {/* Progress bar */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          font: '500 0.72rem/1 var(--font-body)',
          color: 'var(--text-muted)',
          marginBottom: 6,
        }}>
          <span>{started ? `${done} / ${total} rounds done` : 'Not started'}</span>
          <span>{pct}%</span>
        </div>
        <div style={{
          height: 6,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${company.color}, ${company.color}aa)`,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* CTA */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        font: '600 0.85rem/1 var(--font-body)',
        color: 'var(--brand-400)',
        marginTop: 'auto',
      }}>
        {started ? 'Continue prep' : 'Start preparing'}
        <HiOutlineArrowRight size={14} />
      </div>
    </motion.button>
  );
}

export default function CompanyPrepPage() {
  const navigate = useNavigate();
  const [progressMap, setProgressMap] = useState({});

  useEffect(() => {
    let cancelled = false;
    api.get('/company-prep/progress')
      .then((res) => {
        if (!cancelled) setProgressMap(res.data?.data || {});
      })
      .catch(() => {
        if (!cancelled) setProgressMap({});
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <PageTransition>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 'var(--radius-md)',
            background: 'var(--gradient-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HiOutlineBuildingOffice2 size={20} color="#fff" />
          </div>
          <h1 style={{ font: '700 1.6rem/1 var(--font-display)', color: 'var(--text-primary)', margin: 0 }}>
            Company Preparation
          </h1>
        </div>
        <p style={{ font: '400 0.88rem/1.4 var(--font-body)', color: 'var(--text-secondary)', margin: 0 }}>
          Pick a target company and follow the round-by-round roadmap to land your placement.
        </p>
      </div>

      {/* Hint banner */}
      <div className="glass-card-static" style={{
        padding: '16px 20px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'rgba(249,115,22,0.04)',
        borderColor: 'rgba(249,115,22,0.18)',
      }}>
        <HiOutlineSparkles size={20} style={{ color: 'var(--brand-400)', flexShrink: 0 }} />
        <div style={{ font: '400 0.85rem/1.5 var(--font-body)', color: 'var(--text-secondary)' }}>
          Each company has a sequential roadmap. Clear one round to unlock the next — your progress is
          synced to your account so you can resume from any device.
        </div>
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
        gap: '18px',
      }}>
        {COMPANIES.map((c) => (
          <CompanyTile
            key={c.slug}
            company={c}
            progressMap={progressMap}
            onClick={() => navigate(`/company-prep/${c.slug}`)}
          />
        ))}
      </div>
    </PageTransition>
  );
}
