import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  HiOutlineCheckCircle, HiOutlineXCircle,
  HiOutlineArrowLeft, HiOutlineChevronDown, HiOutlineChevronUp,
  HiOutlineTrophy,
} from 'react-icons/hi2';
import PageTransition from '../components/layout/PageTransition';
import Skeleton from '../components/ui/Skeleton';
import api from '../lib/api';

function ScoreRing({ percentage, passed }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (percentage / 100) * circ;
  const color = passed === true
    ? '#34d399'
    : passed === false
      ? '#fb7185'
      : percentage >= 60 ? '#34d399' : '#fb7185';

  return (
    <svg width={140} height={140} viewBox="0 0 140 140">
      <circle cx={70} cy={70} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={12} />
      <circle
        cx={70} cy={70} r={r}
        fill="none"
        stroke={color}
        strokeWidth={12}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        strokeDashoffset={circ / 4}
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text x={70} y={66} textAnchor="middle" fill={color} fontSize={22} fontWeight={700} fontFamily="'Exo 2',sans-serif">
        {percentage}%
      </text>
      <text x={70} y={84} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={11} fontFamily="Outfit,sans-serif">
        Score
      </text>
    </svg>
  );
}

function QuestionRow({ q, index }) {
  const [open, setOpen] = useState(false);
  const correctIdx = (q.answers_json || []).findIndex(a => a.correct === true);
  const studentIdx = q.student_answer !== null && q.student_answer !== undefined
    ? parseInt(q.student_answer)
    : null;

  return (
    <div style={{
      border: q.is_correct === true
        ? '1px solid rgba(52,211,153,0.25)'
        : q.is_correct === false
          ? '1px solid rgba(251,113,133,0.2)'
          : '1px solid rgba(249,115,22,0.1)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      background: 'rgba(255,255,255,0.02)',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'flex-start', gap: '12px',
          padding: '14px 18px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        {/* Status icon */}
        <div style={{ flexShrink: 0, marginTop: 2 }}>
          {q.is_correct === true
            ? <HiOutlineCheckCircle size={18} style={{ color: 'var(--accent-emerald)' }} />
            : q.is_correct === false
              ? <HiOutlineXCircle size={18} style={{ color: 'var(--accent-rose)' }} />
              : <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
          }
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            font: '400 0.72rem/1 var(--font-body)', color: 'var(--text-muted)', marginRight: '8px',
          }}>
            Q{index + 1}
          </span>
          <span style={{
            font: '400 0.88rem/1.5 var(--font-body)', color: 'var(--text-secondary)',
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: open ? 'unset' : 2, WebkitBoxOrient: 'vertical',
          }}>
            {q.question_text}
          </span>
        </div>

        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ font: '500 0.75rem/1 var(--font-body)', color: 'var(--text-muted)' }}>
            {q.is_correct ? `+${q.marks}` : '0'}/{q.marks}
          </span>
          {open
            ? <HiOutlineChevronUp size={15} style={{ color: 'var(--text-muted)' }} />
            : <HiOutlineChevronDown size={15} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 18px 16px 48px' }}>
          {q.question_type === 'mcq' && Array.isArray(q.answers_json) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {q.answers_json.map((opt, idx) => {
                const isCorrect = idx === correctIdx;
                const isStudent = idx === studentIdx;
                let bg = 'transparent';
                let borderColor = 'rgba(255,255,255,0.06)';
                let textColor = 'var(--text-muted)';
                if (isCorrect) { bg = 'rgba(52,211,153,0.08)'; borderColor = 'rgba(52,211,153,0.3)'; textColor = 'var(--accent-emerald)'; }
                else if (isStudent && !isCorrect) { bg = 'rgba(251,113,133,0.08)'; borderColor = 'rgba(251,113,133,0.3)'; textColor = 'var(--accent-rose)'; }

                return (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', borderRadius: 8,
                    border: `1px solid ${borderColor}`, background: bg,
                  }}>
                    <span style={{ font: '600 0.72rem/1 var(--font-display)', color: textColor, minWidth: 18 }}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span style={{ font: '400 0.85rem/1.4 var(--font-body)', color: textColor }}>
                      {opt.text}
                    </span>
                    {isCorrect && <span style={{ marginLeft: 'auto', font: '500 0.7rem/1 var(--font-body)', color: 'var(--accent-emerald)' }}>Correct</span>}
                    {isStudent && !isCorrect && <span style={{ marginLeft: 'auto', font: '500 0.7rem/1 var(--font-body)', color: 'var(--accent-rose)' }}>Your answer</span>}
                  </div>
                );
              })}
            </div>
          )}

          {(q.question_type === 'short-answer' || q.question_type === 'descriptive') && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              font: '400 0.85rem/1.5 var(--font-body)', color: 'var(--text-secondary)',
            }}>
              {q.student_answer || <em style={{ color: 'var(--text-muted)' }}>No answer given</em>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TestResultPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/tests/${id}/my-result`).then(r => {
      setResult(r.data.data);
    }).catch(() => navigate('/tests')).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <PageTransition>
      <Skeleton height="300px" style={{ marginBottom: '24px' }} />
      <Skeleton height="60px" style={{ marginBottom: '8px' }} />
      <Skeleton height="60px" />
    </PageTransition>
  );

  if (!result) return null;

  const { submission, test, questions, percentage, passed } = result;
  const correctCount = questions.filter(q => q.is_correct === true).length;
  const wrongCount = questions.filter(q => q.is_correct === false).length;
  const skippedCount = questions.filter(q => q.is_correct === null).length;

  return (
    <PageTransition>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {/* Back */}
        <button
          className="btn btn-ghost"
          style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
          onClick={() => navigate('/tests')}
        >
          <HiOutlineArrowLeft size={15} />
          Back to Tests
        </button>

        {/* Score card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card"
          style={{ padding: '32px', marginBottom: '24px', textAlign: 'center' }}
        >
          {passed === true && (
            <div style={{ marginBottom: '8px' }}>
              <HiOutlineTrophy size={32} style={{ color: 'var(--gold)', filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.5))' }} />
            </div>
          )}

          <h2 style={{ font: '700 1.3rem/1.2 var(--font-display)', color: 'var(--text-primary)', margin: '0 0 4px' }}>
            {test?.title}
          </h2>
          <p style={{ font: '400 0.8rem/1 var(--font-body)', color: 'var(--text-muted)', marginBottom: '28px' }}>
            Submitted {submission.submitted_at
              ? new Date(submission.submitted_at).toLocaleString()
              : '—'}
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <ScoreRing percentage={percentage} passed={passed} />
          </div>

          {passed !== null && (
            <div style={{
              display: 'inline-block',
              padding: '6px 20px', borderRadius: 'var(--radius-full)',
              background: passed ? 'rgba(52,211,153,0.12)' : 'rgba(251,113,133,0.12)',
              border: `1px solid ${passed ? 'rgba(52,211,153,0.3)' : 'rgba(251,113,133,0.3)'}`,
              font: '600 0.82rem/1 var(--font-body)',
              color: passed ? 'var(--accent-emerald)' : 'var(--accent-rose)',
              marginBottom: '24px',
            }}>
              {passed ? 'Passed' : 'Failed'}
            </div>
          )}

          {/* Stats row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0', flexWrap: 'wrap' }}>
            {[
              { label: 'Marks', value: `${submission.obtained_marks}/${submission.total_marks}`, color: 'var(--brand-400)' },
              { label: 'Correct', value: correctCount, color: 'var(--accent-emerald)' },
              { label: 'Wrong', value: wrongCount, color: 'var(--accent-rose)' },
              { label: 'Skipped', value: skippedCount, color: 'var(--text-muted)' },
            ].map((s, i, arr) => (
              <div key={s.label} style={{
                flex: '1 1 80px', padding: '16px 12px',
                borderRight: i < arr.length - 1 ? 'var(--border-subtle)' : 'none',
              }}>
                <div style={{ font: `700 1.2rem/1 var(--font-display)`, color: s.color, marginBottom: '4px' }}>
                  {s.value}
                </div>
                <div style={{ font: '400 0.72rem/1 var(--font-body)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Question review */}
        <h3 style={{ font: '600 1rem/1 var(--font-display)', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Question Review
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {questions.map((q, i) => (
            <QuestionRow key={q.question_id} q={q} index={i} />
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
