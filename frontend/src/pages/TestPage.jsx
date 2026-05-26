import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiOutlineClock, HiOutlineChevronLeft, HiOutlineChevronRight,
  HiOutlineCheckCircle, HiOutlineExclamationTriangle,
} from 'react-icons/hi2';
import PageTransition from '../components/layout/PageTransition';
import Skeleton from '../components/ui/Skeleton';
import useUiStore from '../store/uiStore';
import api from '../lib/api';

/* ── Helpers ── */
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function diffColor(level) {
  if (level === 'easy') return 'var(--accent-emerald)';
  if (level === 'hard') return 'var(--accent-rose)';
  return 'var(--accent-amber)';
}

/* ── Question navigator bubble ── */
function QBubble({ index, answered, current, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 34, height: 34, borderRadius: 8,
        border: current
          ? '2px solid var(--brand-500)'
          : answered
            ? '2px solid var(--accent-emerald)'
            : '1px solid rgba(249,115,22,0.2)',
        background: current
          ? 'rgba(249,115,22,0.18)'
          : answered
            ? 'rgba(52,211,153,0.12)'
            : 'rgba(255,255,255,0.03)',
        color: current
          ? 'var(--brand-400)'
          : answered
            ? 'var(--accent-emerald)'
            : 'var(--text-muted)',
        font: `${current ? '700' : '500'} 0.78rem/1 var(--font-display)`,
        cursor: 'pointer',
        transition: 'all 0.15s',
        flexShrink: 0,
      }}
    >
      {index + 1}
    </button>
  );
}

/* ── Confirm submit modal ── */
function ConfirmModal({ unanswered, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card"
        style={{ maxWidth: 420, width: '100%', padding: '32px', textAlign: 'center' }}
      >
        <HiOutlineExclamationTriangle size={40} style={{ color: 'var(--accent-amber)', marginBottom: '16px' }} />
        <h3 style={{ font: '700 1.1rem/1.3 var(--font-display)', color: 'var(--text-primary)', marginBottom: '10px' }}>
          Submit Test?
        </h3>
        {unanswered > 0 && (
          <p style={{ font: '400 0.85rem/1.5 var(--font-body)', color: 'var(--accent-amber)', marginBottom: '20px' }}>
            You have {unanswered} unanswered question{unanswered !== 1 ? 's' : ''}.
            These will be marked wrong.
          </p>
        )}
        <p style={{ font: '400 0.85rem/1.5 var(--font-body)', color: 'var(--text-secondary)', marginBottom: '24px' }}>
          Once submitted, you cannot change your answers.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>
            Go Back
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onConfirm}>
            Submit Now
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Main page ── */
export default function TestPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const addToast = useUiStore(s => s.addToast);

  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [started, setStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [current, setCurrent] = useState(0);
  const [responses, setResponses] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);

  /* Load test paper */
  useEffect(() => {
    api.get(`/tests/${id}`).then(r => {
      const data = r.data.data;
      setTest(data);
      // If already in-progress, auto-start
      if (data.submission?.status === 'in_progress') {
        const elapsed = data.submission.started_at
          ? Math.floor((Date.now() - new Date(data.submission.started_at)) / 1000)
          : 0;
        const total = (data.duration_minutes || 60) * 60;
        setTimeLeft(Math.max(0, total - elapsed));
        setStarted(true);
      }
    }).catch(() => {
      addToast('Failed to load test', 'error');
      navigate('/tests');
    }).finally(() => setLoading(false));
  }, [id]);

  /* Countdown timer */
  useEffect(() => {
    if (!started || timeLeft === null) return;
    if (timeLeft <= 0) { handleAutoSubmit(); return; }
    timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [started, timeLeft]);

  const handleStart = async () => {
    setStarting(true);
    try {
      await api.post(`/tests/${id}/start`);
      const total = (test.duration_minutes || 60) * 60;
      setTimeLeft(total);
      setStarted(true);
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to start test', 'error');
    }
    setStarting(false);
  };

  const handleSelect = (questionId, optionIndex) => {
    setResponses(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleAutoSubmit = useCallback(() => {
    clearTimeout(timerRef.current);
    addToast('Time is up! Submitting automatically…', 'warning');
    submitTest();
  }, [responses]);

  const submitTest = async () => {
    setSubmitting(true);
    clearTimeout(timerRef.current);
    try {
      const res = await api.post(`/tests/${id}/submit`, { responses });
      addToast(`Submitted! Score: ${res.data.data.percentage}%`, 'success');
      navigate(`/tests/${id}/result`);
    } catch (err) {
      addToast(err.response?.data?.error || 'Submission failed', 'error');
      setSubmitting(false);
    }
  };

  if (loading) return (
    <PageTransition>
      <Skeleton height="48px" width="50%" style={{ marginBottom: '24px' }} />
      <Skeleton height="360px" />
    </PageTransition>
  );

  if (!test) return null;

  const qs = test.questions || [];
  const answered = Object.keys(responses).filter(k => responses[k] !== null && responses[k] !== undefined).length;
  const unanswered = qs.length - answered;
  const timerWarning = timeLeft !== null && timeLeft < 120;

  /* ── Pre-start screen ── */
  if (!started && test.submission?.status !== 'in_progress') {
    return (
      <PageTransition>
        <div style={{ maxWidth: 580, margin: '0 auto', padding: '32px 0' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card"
            style={{ padding: '40px', textAlign: 'center' }}
          >
            <div style={{
              width: 64, height: 64, borderRadius: 'var(--radius-lg)',
              background: 'var(--gradient-brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <HiOutlineCheckCircle size={30} color="#fff" />
            </div>

            <h2 style={{ font: '700 1.4rem/1.2 var(--font-display)', color: 'var(--text-primary)', margin: '0 0 8px' }}>
              {test.title}
            </h2>
            {test.description && (
              <p style={{ font: '400 0.85rem/1.5 var(--font-body)', color: 'var(--text-secondary)', margin: '0 0 28px' }}>
                {test.description}
              </p>
            )}

            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '12px', marginBottom: '28px', textAlign: 'left',
            }}>
              {[
                ['Questions', qs.length],
                ['Duration', `${test.duration_minutes || '—'} min`],
                ['Total Marks', test.total_marks || '—'],
                ['Passing Score', test.passing_score ? `${test.passing_score}%` : 'Not set'],
              ].map(([label, val]) => (
                <div key={label} style={{
                  background: 'rgba(249,115,22,0.06)',
                  border: '1px solid rgba(249,115,22,0.1)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                }}>
                  <div style={{ font: '400 0.72rem/1 var(--font-body)', color: 'var(--text-muted)', marginBottom: '6px' }}>{label}</div>
                  <div style={{ font: '700 1rem/1 var(--font-display)', color: 'var(--text-primary)' }}>{val}</div>
                </div>
              ))}
            </div>

            <div style={{
              background: 'rgba(251,191,36,0.07)',
              border: '1px solid rgba(251,191,36,0.15)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              font: '400 0.8rem/1.5 var(--font-body)',
              color: 'var(--accent-amber)',
              marginBottom: '28px',
              textAlign: 'left',
            }}>
              Once you start the timer cannot be paused. Make sure you have a stable connection before beginning.
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', fontSize: '0.95rem', padding: '14px' }}
              onClick={handleStart}
              disabled={starting}
            >
              {starting ? 'Starting…' : 'Begin Test'}
            </button>
          </motion.div>
        </div>
      </PageTransition>
    );
  }

  const q = qs[current];

  /* ── Test-taking UI ── */
  return (
    <>
      {showConfirm && (
        <ConfirmModal
          unanswered={unanswered}
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => { setShowConfirm(false); submitTest(); }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--header-height))', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 24px',
          borderBottom: 'var(--border-subtle)',
          background: 'var(--bg-secondary)',
          flexShrink: 0, flexWrap: 'wrap', gap: '10px',
        }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ font: '600 0.95rem/1.2 var(--font-display)', color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>
              {test.title}
            </h2>
            <span style={{ font: '400 0.75rem/1 var(--font-body)', color: 'var(--text-muted)' }}>
              {answered} of {qs.length} answered
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
            {/* Timer */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: 'var(--radius-full)',
              border: `1px solid ${timerWarning ? 'rgba(251,113,133,0.4)' : 'rgba(249,115,22,0.2)'}`,
              background: timerWarning ? 'rgba(225,29,72,0.1)' : 'rgba(249,115,22,0.06)',
              font: '700 0.9rem/1 var(--font-mono)',
              color: timerWarning ? 'var(--accent-rose)' : 'var(--brand-400)',
            }}>
              <HiOutlineClock size={15} />
              {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
            </div>

            <button
              className="btn btn-primary"
              style={{ padding: '8px 20px', fontSize: '0.82rem' }}
              onClick={() => setShowConfirm(true)}
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : 'Submit Test'}
            </button>
          </div>
        </div>

        {/* Body: navigator + question */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Question navigator sidebar */}
          <div style={{
            width: 200, flexShrink: 0,
            borderRight: 'var(--border-subtle)',
            padding: '16px',
            overflowY: 'auto',
            background: 'var(--bg-secondary)',
          }}>
            <div style={{ font: '600 0.65rem/1 var(--font-body)', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
              Questions
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {qs.map((q, i) => (
                <QBubble
                  key={q.question_id}
                  index={i}
                  answered={responses[q.question_id] !== undefined && responses[q.question_id] !== null}
                  current={i === current}
                  onClick={() => setCurrent(i)}
                />
              ))}
            </div>

            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <LegendDot color="var(--accent-emerald)" label="Answered" />
              <LegendDot color="var(--brand-500)" label="Current" />
              <LegendDot color="rgba(255,255,255,0.12)" label="Unanswered" />
            </div>
          </div>

          {/* Question area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
            {q ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={current}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.18 }}
                >
                  {/* Question header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: 'var(--radius-full)',
                      background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)',
                      font: '600 0.72rem/1 var(--font-body)', color: 'var(--brand-400)',
                    }}>
                      Q {current + 1} / {qs.length}
                    </span>
                    <span style={{
                      padding: '4px 10px', borderRadius: 'var(--radius-full)',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      font: '500 0.72rem/1 var(--font-body)', color: 'var(--text-muted)',
                    }}>
                      {q.marks} mark{q.marks !== 1 ? 's' : ''}
                    </span>
                    {q.difficulty_level && (
                      <span style={{
                        padding: '4px 10px', borderRadius: 'var(--radius-full)',
                        background: 'rgba(255,255,255,0.04)', border: `1px solid ${diffColor(q.difficulty_level)}40`,
                        font: '500 0.72rem/1 var(--font-body)', color: diffColor(q.difficulty_level),
                        textTransform: 'capitalize',
                      }}>
                        {q.difficulty_level}
                      </span>
                    )}
                  </div>

                  {/* Question text */}
                  <p style={{
                    font: '500 1.05rem/1.6 var(--font-body)',
                    color: 'var(--text-primary)',
                    marginBottom: '28px',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {q.question_text}
                  </p>

                  {/* MCQ options */}
                  {q.question_type === 'mcq' && Array.isArray(q.answers_json) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {q.answers_json.map((opt, idx) => {
                        const selected = responses[q.question_id] === idx;
                        return (
                          <button
                            key={idx}
                            onClick={() => handleSelect(q.question_id, idx)}
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: '14px',
                              padding: '14px 18px',
                              borderRadius: 'var(--radius-md)',
                              border: selected
                                ? '2px solid var(--brand-500)'
                                : '1px solid rgba(249,115,22,0.12)',
                              background: selected
                                ? 'rgba(249,115,22,0.12)'
                                : 'rgba(255,255,255,0.02)',
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'all 0.15s',
                              width: '100%',
                            }}
                          >
                            <div style={{
                              width: 28, height: 28, borderRadius: '50%',
                              border: selected ? '2px solid var(--brand-500)' : '2px solid rgba(249,115,22,0.25)',
                              background: selected ? 'var(--brand-500)' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0, marginTop: '1px',
                              font: '700 0.72rem/1 var(--font-display)',
                              color: selected ? '#fff' : 'var(--text-muted)',
                              transition: 'all 0.15s',
                            }}>
                              {String.fromCharCode(65 + idx)}
                            </div>
                            <span style={{
                              font: '400 0.9rem/1.5 var(--font-body)',
                              color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                              transition: 'color 0.15s',
                            }}>
                              {opt.text}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Short-answer / descriptive */}
                  {(q.question_type === 'short-answer' || q.question_type === 'descriptive') && (
                    <textarea
                      placeholder="Type your answer here…"
                      value={responses[q.question_id] || ''}
                      onChange={e => handleSelect(q.question_id, e.target.value)}
                      rows={q.question_type === 'descriptive' ? 8 : 3}
                      style={{
                        width: '100%', padding: '14px 16px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(249,115,22,0.15)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        font: '400 0.9rem/1.6 var(--font-body)',
                        resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  )}

                  {/* Prev / Next */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setCurrent(c => Math.max(0, c - 1))}
                      disabled={current === 0}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <HiOutlineChevronLeft size={16} />
                      Previous
                    </button>
                    {current < qs.length - 1 ? (
                      <button
                        className="btn btn-primary"
                        onClick={() => setCurrent(c => c + 1)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        Next
                        <HiOutlineChevronRight size={16} />
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        onClick={() => setShowConfirm(true)}
                        disabled={submitting}
                      >
                        Submit Test
                      </button>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                No questions in this test.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function LegendDot({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
      <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
      <span style={{ font: '400 0.72rem/1 var(--font-body)', color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}
