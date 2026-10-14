import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageTransition from '../../components/layout/PageTransition';
import {
  HiOutlineArrowLeft, HiOutlineArrowPath, HiOutlineCheckCircle,
  HiOutlineXCircle, HiOutlineStar, HiOutlineLightBulb,
  HiOutlineChartBar, HiOutlineSparkles,
} from 'react-icons/hi2';

const SKILL_CFG = {
  listening: { emoji: '🎧', label: 'Listening', color: '#3b82f6', path: '/lsrw/listening' },
  speaking:  { emoji: '🎙️', label: 'Speaking',  color: '#a855f7', path: '/lsrw/speaking' },
  reading:   { emoji: '📖', label: 'Reading',   color: '#10b981', path: '/lsrw/reading' },
  writing:   { emoji: '✍️', label: 'Writing',   color: '#f97316', path: '/lsrw/writing' },
};

function gradeInfo(score) {
  if (score >= 85) return { label: 'Excellent', color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
  if (score >= 70) return { label: 'Good',      color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' };
  if (score >= 55) return { label: 'Average',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
  return              { label: 'Needs Work',    color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
}

function BigRing({ score, color }) {
  const r = 56, stroke = 9, circ = 2 * Math.PI * r;
  const dash = ((score || 0) / 100) * circ;
  return (
    <svg width={136} height={136}>
      <circle cx={68} cy={68} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <circle cx={68} cy={68} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 68 68)" style={{ transition: 'stroke-dasharray 1s ease' }} />
      <text x={68} y={62} textAnchor="middle" fill="white" fontSize={30} fontWeight={800}>{Math.round(score || 0)}</text>
      <text x={68} y={80} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={12}>/ 100</text>
    </svg>
  );
}

function SubBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{label}</span>
        <span style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--text-primary)' }}>{Math.round(value)}</span>
      </div>
      <div style={{ height: 8, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.9, ease: 'easeOut' }}
          style={{ height: '100%', background: color, borderRadius: 99 }} />
      </div>
    </div>
  );
}

export default function LSRWResultPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  if (!state?.result) { navigate('/lsrw'); return null; }

  const { result, skill, topic } = state;
  const cfg = SKILL_CFG[skill] || SKILL_CFG.reading;
  const grade = gradeInfo(result.score);

  // Normalise sub_scores: backend may return nested sub_scores or flat dimension fields
  const subScores = result.sub_scores || (() => {
    const candidates = ['pronunciation','fluency','grammar','vocabulary','content_relevance','coherence','task_achievement','word_count_score'];
    const flat = {};
    candidates.forEach(k => { if (result[k] != null) flat[k] = result[k]; });
    return Object.keys(flat).length ? flat : null;
  })();
  const subEntries = Object.entries(subScores || {});

  // Normalise question results field name
  const questionResults = result.question_results || result.per_question || [];

  return (
    <PageTransition>
      <div style={{ padding: '28px', maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={() => navigate('/lsrw')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 14px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem' }}>
              <HiOutlineArrowLeft size={15} /> LSRW Hub
            </button>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {cfg.emoji} {cfg.label} Results
            </h1>
          </div>
          <button onClick={() => navigate(cfg.path)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600 }}>
            <HiOutlineArrowPath size={15} /> Try Again
          </button>
        </div>

        {/* Score Hero */}
        <motion.div className="glass-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          style={{ padding: '28px 32px', marginBottom: 20, border: `1px solid ${cfg.color}28`, display: 'flex', alignItems: 'center', gap: 32, background: `linear-gradient(135deg, ${cfg.color}0a, transparent)` }}>
          <BigRing score={result.score} color={cfg.color} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', background: grade.bg, borderRadius: 99, marginBottom: 12 }}>
              <HiOutlineSparkles size={14} style={{ color: grade.color }} />
              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: grade.color }}>{grade.label}</span>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{result.feedback}</p>
            {result.transcript && (
              <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)' }}>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>📝 YOUR TRANSCRIPT</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>"{result.transcript}"</p>
                {result.words_per_minute && <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>~{result.words_per_minute} words/minute</p>}
              </div>
            )}
          </div>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* Sub-scores */}
          <motion.div className="glass-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <HiOutlineChartBar size={18} style={{ color: 'var(--text-muted)' }} />
              <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>Skill Breakdown</h3>
            </div>
            {subEntries.map(([k, v]) => <SubBar key={k} label={k} value={v} color={cfg.color} />)}
          </motion.div>

          {/* Strengths (writing) OR Tips (speaking) */}
          <motion.div className="glass-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            style={{ padding: '22px 24px' }}>
            {result.strengths && result.strengths.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <HiOutlineStar size={18} style={{ color: '#f59e0b' }} />
                  <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>What You Did Well</h3>
                </div>
                {result.strengths.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                    <HiOutlineCheckCircle size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: 1 }} />
                    <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s}</p>
                  </div>
                ))}
              </>
            )}
            {result.suggestions && result.suggestions.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <HiOutlineLightBulb size={18} style={{ color: '#f59e0b' }} />
                  <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>Improvement Tips</h3>
                </div>
                {result.suggestions.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: `${cfg.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.72rem', fontWeight: 700, color: cfg.color }}>{i+1}</div>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s}</p>
                  </div>
                ))}
              </>
            )}
            {!result.strengths?.length && !result.suggestions?.length && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.84rem', textAlign: 'center', padding: '20px 0' }}>
                <HiOutlineSparkles size={28} style={{ marginBottom: 10, opacity: 0.4 }} />
                AI feedback included in the evaluation above
              </div>
            )}
          </motion.div>
        </div>

        {/* Writing corrections */}
        {result.corrections && result.corrections.length > 0 && (
          <motion.div className="glass-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ padding: '22px 24px', marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 18px', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              ✏️ Grammar & Style Corrections
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {result.corrections.map((c, i) => (
                <div key={i} style={{ padding: '14px 16px', background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.12)', borderRadius: 12 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ padding: '3px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, fontSize: '0.82rem', color: '#ef4444', textDecoration: 'line-through' }}>{c.original}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>→</span>
                    <span style={{ padding: '3px 10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6, fontSize: '0.82rem', color: '#10b981', fontWeight: 600 }}>{c.suggestion}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.reason}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Q&A breakdown (reading, listening) */}
        {questionResults.length > 0 && (
          <motion.div className="glass-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ padding: '22px 24px', marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 18px', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>Question-by-Question Breakdown</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {questionResults.map((qr, i) => {
                const passed = (qr.score ?? (qr.correct ? 100 : 0)) >= 60;
                return (
                  <div key={i} style={{ padding: '14px 16px', background: passed ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${passed ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`, borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem', margin: 0 }}>Q{i+1}. {qr.question}</p>
                      <span style={{ fontWeight: 800, fontSize: '1.05rem', color: passed ? '#10b981' : '#ef4444', flexShrink: 0, marginLeft: 12 }}>{passed ? '✓' : '✗'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                      {passed ? <HiOutlineCheckCircle size={15} style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }} /> : <HiOutlineXCircle size={15} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />}
                      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}><strong>Your answer:</strong> {qr.student_answer || qr.answer}</p>
                    </div>
                    {!passed && qr.correct_answer && <p style={{ margin: '0 0 4px 23px', fontSize: '0.82rem', color: '#10b981' }}><strong>Correct:</strong> {qr.correct_answer}</p>}
                    {qr.explanation && <p style={{ margin: '4px 0 0 23px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>{qr.explanation}</p>}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Footer — provider comes from the response; failover means it is not always the primary. */}
        {result.model_used && (
          <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'rgba(255,255,255,0.18)', marginTop: 8 }}>
            Evaluated by <span style={{ fontFamily: 'monospace' }}>{result.model_used}</span>
            {result.provider_used ? ` via ${result.provider_used}` : ''}
          </p>
        )}
      </div>
    </PageTransition>
  );
}
