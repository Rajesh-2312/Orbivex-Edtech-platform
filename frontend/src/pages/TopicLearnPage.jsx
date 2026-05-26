import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  HiOutlineArrowLeft,
  HiOutlineBookOpen,
  HiOutlineLightBulb,
  HiOutlineCalculator,
  HiOutlineExclamationTriangle,
  HiOutlineSparkles,
  HiOutlineArrowPath,
  HiOutlineAcademicCap,
} from 'react-icons/hi2';
import PageTransition from '../components/layout/PageTransition';
import { findCompany } from '../lib/companyPrepData';
import api from '../lib/api';
import useAuthStore from '../store/authStore';

function isNotesUseful(n) {
  if (!n || typeof n !== 'object') return false;
  const overview = typeof n.overview === 'string' ? n.overview.trim() : '';
  const kc = Array.isArray(n.key_concepts) ? n.key_concepts.length : 0;
  const fm = Array.isArray(n.formulas) ? n.formulas.length : 0;
  const tips = Array.isArray(n.tips) ? n.tips.length : 0;
  const mistakes = Array.isArray(n.common_mistakes) ? n.common_mistakes.length : 0;
  const exP = n.example?.problem ? String(n.example.problem).trim() : '';
  const exS = n.example?.solution ? String(n.example.solution).trim() : '';
  return overview.length > 10 || kc > 0 || fm > 0 || tips > 0 || mistakes > 0 || !!exP || !!exS;
}

const PACE_LABELS = ['Beginner', 'Easy', 'Standard', 'Advanced', 'Expert'];

export default function TopicLearnPage() {
  const { slug, index, topicIdx } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const company = useMemo(() => findCompany(slug), [slug]);
  const roundIndex = Number(index);
  const round = company?.rounds?.[roundIndex];
  const topic = round?.topics?.[Number(topicIdx)];

  const userRole = useAuthStore((s) => s.user?.role);
  const canSeed = userRole === 'admin' || userRole === 'teacher';

  const initialPace = Number(searchParams.get('pace')) >= 1 && Number(searchParams.get('pace')) <= 5
    ? Number(searchParams.get('pace'))
    : 3;
  const [pace, setPace] = useState(initialPace);

  const [notes, setNotes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const color = company?.color || 'var(--brand-400)';

  const loadPool = useCallback(() => {
    if (!company || !topic) return;
    setErrorMsg('');
    setNotes(null);
    setLoading(true);
    api.get(`/company-prep/${company.slug}/rounds/${roundIndex}/topics/${encodeURIComponent(topic)}/notes?pace=${pace}`)
      .then((res) => {
        const payload = res.data?.data || {};
        setNotes(isNotesUseful(payload.notes) ? payload.notes : null);
      })
      .catch((err) => {
        setErrorMsg(err.response?.data?.error || 'Failed to load notes from the pool.');
      })
      .finally(() => setLoading(false));
  }, [company, topic, roundIndex, pace]);

  const generateNotes = () => {
    if (!company || !topic || seeding) return;
    setSeeding(true);
    setErrorMsg('');
    api.post(`/company-prep/${company.slug}/rounds/${roundIndex}/topics/${encodeURIComponent(topic)}/notes/seed?pace=${pace}`)
      .then((res) => {
        const payload = res.data?.data || {};
        setNotes(isNotesUseful(payload.notes) ? payload.notes : null);
      })
      .catch((err) => {
        setErrorMsg(err.response?.data?.error || 'Failed to generate notes. Make sure the AI model is pulled in Ollama.');
      })
      .finally(() => setSeeding(false));
  };

  // Persist the chosen pace in the URL so reloads keep state.
  useEffect(() => {
    const current = searchParams.get('pace');
    if (String(pace) !== current) {
      const next = new URLSearchParams(searchParams);
      next.set('pace', String(pace));
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pace]);

  useEffect(() => {
    loadPool();
  }, [loadPool]);

  if (!company || !round || !topic) {
    return (
      <PageTransition>
        <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-muted)' }}>
          <h2 style={{ font: '600 1.2rem/1 var(--font-display)', color: 'var(--text-primary)', marginBottom: 12 }}>
            Topic not found
          </h2>
          <button className="btn btn-ghost" onClick={() => navigate('/company-prep')}>
            <HiOutlineArrowLeft size={16} /> Back to companies
          </button>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <button
        type="button"
        onClick={() => navigate(`/company-prep/${company.slug}/rounds/${roundIndex}`)}
        className="btn btn-ghost"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          marginBottom: 16, padding: '6px 12px',
          font: '500 0.85rem/1 var(--font-body)',
        }}
      >
        <HiOutlineArrowLeft size={16} />
        Back to round
      </button>

      <div style={{ marginBottom: 18 }}>
        <div style={{ font: '500 0.74rem/1 var(--font-body)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          {company.name} · {round.title}
        </div>
        <h1 style={{ font: '700 1.6rem/1.2 var(--font-display)', color: 'var(--text-primary)', margin: 0 }}>
          {topic}
        </h1>
        <p style={{ font: '400 0.85rem/1.4 var(--font-body)', color: 'var(--text-muted)', margin: '6px 0 0' }}>
          Pre-seeded study notes for this topic. Pick a pace to match your prep level.
        </p>
      </div>

      {/* Pace selector */}
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18,
        padding: '4px 0',
      }}>
        {PACE_LABELS.map((label, i) => {
          const value = i + 1;
          const active = pace === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setPace(value)}
              style={{
                padding: '6px 14px', borderRadius: 999,
                background: active ? `linear-gradient(135deg, ${color}, ${color}cc)` : 'rgba(255,255,255,0.04)',
                color: active ? '#0a0a0a' : 'var(--text-secondary)',
                border: '1px solid ' + (active ? 'transparent' : 'rgba(255,255,255,0.08)'),
                font: '600 0.78rem/1 var(--font-body)',
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <span style={{
                width: 16, height: 16, borderRadius: '50%',
                background: active ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                font: '700 0.7rem/16px var(--font-display)', textAlign: 'center',
                color: active ? '#0a0a0a' : 'var(--text-muted)',
              }}>{value}</span>
              {label}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div className="glass-card-static" style={{ padding: 32, textAlign: 'center' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.6, ease: 'linear' }}
            style={{ display: 'inline-block', marginBottom: 10 }}
          >
            <HiOutlineSparkles size={26} style={{ color }} />
          </motion.div>
          <div style={{ font: '500 0.9rem/1.3 var(--font-body)', color: 'var(--text-muted)' }}>
            Reading from the notes pool…
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && errorMsg && (
        <div className="glass-card-static" style={{
          padding: 22, marginBottom: 14,
          border: '1px solid rgba(248,113,113,0.35)',
          background: 'rgba(248,113,113,0.06)',
          textAlign: 'center',
        }}>
          <HiOutlineExclamationTriangle size={26} style={{ color: '#f87171', marginBottom: 6 }} />
          <div style={{ font: '500 0.86rem/1.4 var(--font-body)', color: '#fca5a5' }}>{errorMsg}</div>
        </div>
      )}

      {/* Notes unavailable */}
      {!loading && !notes && !errorMsg && (
        <div className="glass-card-static" style={{ padding: 30, textAlign: 'center' }}>
          <HiOutlineSparkles size={32} style={{ color, marginBottom: 8 }} />
          <div style={{ font: '600 1rem/1.3 var(--font-display)', color: 'var(--text-primary)', marginBottom: 6 }}>
            {canSeed
              ? 'No notes are available for this topic yet.'
              : 'Study notes are not available for this topic yet.'}
          </div>
          <div style={{ font: '400 0.85rem/1.5 var(--font-body)', color: 'var(--text-muted)', marginBottom: 18, maxWidth: 480, margin: '0 auto 18px' }}>
            {canSeed
              ? 'Generate notes now, or return later once they have been prepared.'
              : 'Please check back later or ask your educator to add notes for this topic.'}
          </div>
          {canSeed && (
            <button
              type="button"
              onClick={generateNotes}
              disabled={seeding}
              className="btn btn-primary"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '10px 18px',
                background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                border: 'none',
                font: '600 0.85rem/1 var(--font-body)',
                opacity: seeding ? 0.6 : 1,
              }}
            >
              <motion.span
                animate={seeding ? { rotate: 360 } : { rotate: 0 }}
                transition={seeding ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : { duration: 0.2 }}
                style={{ display: 'inline-flex' }}
              >
                <HiOutlineSparkles size={14} />
              </motion.span>
              {seeding ? 'Generating notes…' : 'Generate notes'}
            </button>
          )}
        </div>
      )}

      {/* Notes */}
      {!loading && notes && !errorMsg && (
        <>
          <Section icon={HiOutlineBookOpen} title="Overview" color={color}>
            <p style={{ font: '400 0.92rem/1.6 var(--font-body)', color: 'var(--text-secondary)', margin: 0 }}>
              {notes.overview || '—'}
            </p>
          </Section>

          {Array.isArray(notes.key_concepts) && notes.key_concepts.length > 0 && (
            <Section icon={HiOutlineAcademicCap} title="Key Concepts" color={color}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {notes.key_concepts.map((kc, i) => (
                  <div key={i} style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ font: '600 0.88rem/1.3 var(--font-display)', color: 'var(--text-primary)', marginBottom: 4 }}>
                      {kc.concept}
                    </div>
                    <div style={{ font: '400 0.84rem/1.5 var(--font-body)', color: 'var(--text-secondary)' }}>
                      {kc.explanation}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {Array.isArray(notes.formulas) && notes.formulas.length > 0 && (
            <Section icon={HiOutlineCalculator} title="Formulas & Rules" color={color}>
              <ul style={{ margin: 0, padding: '0 0 0 18px', color: 'var(--text-secondary)' }}>
                {notes.formulas.map((f, i) => (
                  <li key={i} style={{ font: '400 0.88rem/1.6 var(--font-mono, monospace)', marginBottom: 6 }}>
                    {f}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {notes.example && (notes.example.problem || notes.example.solution) && (
            <Section icon={HiOutlineSparkles} title="Worked Example" color={color}>
              <div style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: `${color}10`,
                border: `1px solid ${color}30`,
                marginBottom: 10,
              }}>
                <div style={{ font: '600 0.78rem/1 var(--font-body)', color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Problem
                </div>
                <div style={{ font: '400 0.9rem/1.5 var(--font-body)', color: 'var(--text-primary)' }}>
                  {notes.example.problem}
                </div>
              </div>
              <div style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ font: '600 0.78rem/1 var(--font-body)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Solution
                </div>
                <div style={{ font: '400 0.88rem/1.6 var(--font-body)', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                  {notes.example.solution}
                </div>
              </div>
            </Section>
          )}

          {Array.isArray(notes.tips) && notes.tips.length > 0 && (
            <Section icon={HiOutlineLightBulb} title="Tips" color="#34d399">
              <ul style={{ margin: 0, padding: '0 0 0 18px', color: 'var(--text-secondary)' }}>
                {notes.tips.map((t, i) => (
                  <li key={i} style={{ font: '400 0.88rem/1.6 var(--font-body)', marginBottom: 4 }}>{t}</li>
                ))}
              </ul>
            </Section>
          )}

          {Array.isArray(notes.common_mistakes) && notes.common_mistakes.length > 0 && (
            <Section icon={HiOutlineExclamationTriangle} title="Common Mistakes" color="#fbbf24">
              <ul style={{ margin: 0, padding: '0 0 0 18px', color: 'var(--text-secondary)' }}>
                {notes.common_mistakes.map((t, i) => (
                  <li key={i} style={{ font: '400 0.88rem/1.6 var(--font-body)', marginBottom: 4 }}>{t}</li>
                ))}
              </ul>
            </Section>
          )}

          <div style={{
            display: 'flex', justifyContent: canSeed ? 'space-between' : 'flex-end', alignItems: 'center',
            gap: 12, flexWrap: 'wrap', marginTop: 20,
          }}>
            {canSeed && (
              <button
                type="button"
                onClick={generateNotes}
                disabled={seeding}
                className="btn btn-ghost"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '10px 16px',
                  font: '500 0.84rem/1 var(--font-body)',
                  opacity: seeding ? 0.6 : 1,
                }}
              >
                <motion.span
                  animate={seeding ? { rotate: 360 } : { rotate: 0 }}
                  transition={seeding ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : { duration: 0.2 }}
                  style={{ display: 'inline-flex' }}
                >
                  <HiOutlineSparkles size={14} />
                </motion.span>
                {seeding ? 'Regenerating notes…' : 'Regenerate notes'}
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate(`/company-prep/${company.slug}/rounds/${roundIndex}/topics/${topicIdx}/practice`)}
              className="btn btn-primary"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '10px 18px',
                background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                border: 'none',
                font: '600 0.88rem/1 var(--font-body)',
              }}
            >
              <HiOutlineAcademicCap size={16} />
              Practice this topic
            </button>
          </div>
        </>
      )}
    </PageTransition>
  );
}

function Section({ icon: Icon, title, color, children }) {
  return (
    <div className="glass-card-static" style={{ padding: '18px 22px', marginBottom: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
      }}>
        <Icon size={18} style={{ color }} />
        <h3 style={{
          font: '700 0.95rem/1 var(--font-display)',
          color: 'var(--text-primary)',
          margin: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}
