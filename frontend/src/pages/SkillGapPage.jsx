import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';

const SUBJECTS = ['Data Structures', 'Algorithms', 'OOP / Java', 'DBMS', 'OS & Networks'];

const ACCURACY_COLOR = (pct) =>
  pct >= 70 ? '#22c55e' : pct >= 40 ? '#fbbf24' : '#ef4444';

const S = {
  page: {
    padding: '24px 32px',
    minHeight: '100vh',
    color: 'var(--text-primary)',
    fontFamily: "'Outfit', sans-serif",
  },
  header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 },
  headerIcon: {
    width: 48, height: 48, borderRadius: 14,
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 24, flexShrink: 0,
  },
  title:    { fontSize: 26, fontWeight: 700, margin: 0 },
  subtitle: { fontSize: 14, color: 'var(--text-secondary)', margin: '2px 0 0' },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14, overflow: 'hidden', marginBottom: 20,
  },
  cardHeader: {
    padding: '14px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  cardTitle: { fontSize: 15, fontWeight: 600, margin: 0 },
  cardBody: { padding: 24 },
  btn: (v) => ({
    padding: '10px 20px', borderRadius: 10, border: 'none',
    cursor: 'pointer', fontWeight: 600, fontSize: 14,
    fontFamily: "'Outfit', sans-serif", transition: 'opacity 0.18s',
    background:
      v === 'primary' ? 'linear-gradient(135deg,#f59e0b,#d97706)'
      : v === 'ghost'  ? 'rgba(255,255,255,0.06)'
      : 'rgba(245,158,11,0.15)',
    color: v === 'primary' ? '#fff' : v === 'ghost' ? 'var(--text-secondary)' : '#fbbf24',
  }),
  subjectPill: (active) => ({
    padding: '8px 18px', borderRadius: 20, cursor: 'pointer',
    border: `1px solid ${active ? '#f59e0b' : 'rgba(255,255,255,0.1)'}`,
    background: active ? 'rgba(245,158,11,0.2)' : 'transparent',
    color: active ? '#fbbf24' : 'var(--text-secondary)',
    fontSize: 13, fontWeight: 500, transition: 'all 0.18s',
  }),
  optionBtn: (selected, correct, show) => ({
    width: '100%', padding: '12px 16px', borderRadius: 10, marginBottom: 8,
    border: `1px solid ${
      show && correct === true ? '#22c55e'
      : show && correct === false && selected ? '#ef4444'
      : selected ? '#f59e0b'
      : 'rgba(255,255,255,0.1)'
    }`,
    background: show && correct === true ? 'rgba(34,197,94,0.1)'
      : show && correct === false && selected ? 'rgba(239,68,68,0.1)'
      : selected ? 'rgba(245,158,11,0.1)'
      : 'rgba(255,255,255,0.03)',
    color: 'var(--text-primary)',
    cursor: 'pointer', textAlign: 'left',
    fontSize: 14, fontFamily: "'Outfit', sans-serif",
    transition: 'all 0.18s',
  }),
  progressBar: {
    height: 8, borderRadius: 4,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden', marginTop: 8,
  },
  progressFill: (pct, color) => ({
    height: '100%', width: `${pct}%`,
    background: color, borderRadius: 4, transition: 'width 0.6s ease',
  }),
  scoreCircle: (score) => ({
    width: 120, height: 120, borderRadius: '50%',
    border: `6px solid ${ACCURACY_COLOR(score)}`,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: `${ACCURACY_COLOR(score)}15`,
    flexShrink: 0,
  }),
};

export default function SkillGapPage() {
  const [step, setStep]       = useState('intro');    // intro | test | results
  const [subjects, setSubjs]  = useState([...SUBJECTS]);
  const [questions, setQs]    = useState([]);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [prevResult, setPrev] = useState(null);

  // Load previous result
  useEffect(() => {
    api.get('/skillgap/result').then(res => {
      if (res.data.data?.result) setPrev(res.data.data.result);
    }).catch(() => {});
  }, []);

  const startTest = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/skillgap/questions?subjects=${subjects.join(',')}`);
      setQs(res.data.data?.questions || []);
      setAnswers({});
      setCurrent(0);
      setStep('test');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const selectAnswer = (qId, option) => {
    setAnswers(a => ({ ...a, [qId]: option }));
  };

  const nextQuestion = () => {
    if (current < questions.length - 1) setCurrent(c => c + 1);
  };

  const prevQuestion = () => {
    if (current > 0) setCurrent(c => c - 1);
  };

  const submitTest = async () => {
    setLoading(true);
    try {
      const res = await api.post('/skillgap/analyze', { answers });
      setResult(res.data.data);
      setStep('results');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const answered = Object.keys(answers).length;
  const progress = questions.length > 0 ? (answered / questions.length) * 100 : 0;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.headerIcon}>🎯</div>
        <div>
          <h1 style={S.title}>Skill Gap Analyzer</h1>
          <p style={S.subtitle}>Diagnose your technical weaknesses &amp; get an AI-personalized study plan</p>
        </div>
        {step !== 'intro' && (
          <button style={{ ...S.btn('ghost'), marginLeft: 'auto' }} onClick={() => setStep('intro')}>
            ← Back
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* ── INTRO ─────────────────────────────────────────────── */}
        {step === 'intro' && (
          <motion.div key="intro"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          >
            {/* Previous result banner */}
            {prevResult && (
              <div style={{
                ...S.card, border: '1px solid rgba(245,158,11,0.3)',
                background: 'rgba(245,158,11,0.05)', marginBottom: 20,
              }}>
                <div style={S.cardBody}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={S.scoreCircle(prevResult.score)}>
                      <span style={{ fontSize: 26, fontWeight: 700, color: ACCURACY_COLOR(prevResult.score) }}>
                        {prevResult.score}%
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Last score</span>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Your Previous Analysis</p>
                      {prevResult.weak_topics?.length > 0 && (
                        <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--text-secondary)' }}>
                          Weak areas: <span style={{ color: '#ef4444' }}>{prevResult.weak_topics.join(', ')}</span>
                        </p>
                      )}
                      {prevResult.strong_topics?.length > 0 && (
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                          Strong areas: <span style={{ color: '#22c55e' }}>{prevResult.strong_topics.join(', ')}</span>
                        </p>
                      )}
                    </div>
                    <button style={{ ...S.btn('primary'), marginLeft: 'auto' }}
                      onClick={() => { setResult(prevResult); setStep('results'); }}>
                      View Study Plan →
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div style={S.card}>
              <div style={S.cardHeader}><p style={S.cardTitle}>📝 Select Subjects to Test</p></div>
              <div style={S.cardBody}>
                <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: 14 }}>
                  Choose which subjects to include in your diagnostic test (5 questions each).
                  The AI will analyze your results and create a personalized 4-week study plan.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                  {SUBJECTS.map(s => (
                    <button key={s}
                      style={S.subjectPill(subjects.includes(s))}
                      onClick={() => setSubjs(prev =>
                        prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                      )}
                    >{s}</button>
                  ))}
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: 10,
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.2)',
                  marginBottom: 20,
                }}>
                  <div>
                    <strong style={{ color: '#fbbf24' }}>{subjects.length * 5} questions</strong>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}> · approximately {subjects.length * 2} minutes</span>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>MCQ format · AI scored</span>
                </div>
                <button
                  style={{ ...S.btn('primary'), width: '100%', padding: '13px 20px', fontSize: 15 }}
                  onClick={startTest}
                  disabled={subjects.length === 0 || loading}
                >
                  {loading ? 'Loading questions…' : `🚀 Start Diagnostic (${subjects.length * 5} Q)`}
                </button>
              </div>
            </div>

            {/* What you get */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
              {[
                { icon: '🎯', title: 'Pinpoint Weaknesses', desc: 'Know exactly which topics drag down your placement score' },
                { icon: '🗓️', title: '4-Week Study Plan', desc: 'AI-generated week-by-week plan tailored to your gaps' },
                { icon: '🏆', title: 'Track Improvement', desc: 'Re-take anytime to see how far you\'ve come' },
              ].map(item => (
                <div key={item.title} style={{
                  ...S.card, marginBottom: 0, padding: 20, textAlign: 'center',
                }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>{item.icon}</div>
                  <p style={{ fontWeight: 600, margin: '0 0 6px', fontSize: 14 }}>{item.title}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── TEST ──────────────────────────────────────────────── */}
        {step === 'test' && questions.length > 0 && (
          <motion.div key="test"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          >
            {/* Progress */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Question {current + 1} of {questions.length}
                </span>
                <span style={{ color: '#fbbf24' }}>{answered} answered</span>
              </div>
              <div style={S.progressBar}>
                <div style={S.progressFill(progress, 'linear-gradient(90deg,#f59e0b,#d97706)')} />
              </div>
            </div>

            {/* Question Card */}
            <AnimatePresence mode="wait">
              <motion.div key={current}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div style={S.card}>
                  <div style={S.cardHeader}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 6, fontSize: 12,
                      background: 'rgba(245,158,11,0.15)', color: '#fbbf24',
                      border: '1px solid rgba(245,158,11,0.2)',
                    }}>
                      {questions[current]?.subject}
                    </span>
                  </div>
                  <div style={S.cardBody}>
                    <p style={{ fontSize: 17, fontWeight: 600, margin: '0 0 24px', lineHeight: 1.5 }}>
                      {questions[current]?.question}
                    </p>
                    {questions[current]?.options.map(opt => (
                      <button
                        key={opt}
                        style={S.optionBtn(answers[questions[current].id] === opt, false, false)}
                        onClick={() => selectAnswer(questions[current].id, opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <button style={S.btn('ghost')} onClick={prevQuestion} disabled={current === 0}>
                ← Previous
              </button>
              <div style={{ display: 'flex', gap: 6 }}>
                {questions.map((_, i) => (
                  <div key={i} onClick={() => setCurrent(i)} style={{
                    width: 10, height: 10, borderRadius: '50%', cursor: 'pointer',
                    background: i === current ? '#f59e0b'
                      : answers[questions[i]?.id] ? '#22c55e'
                      : 'rgba(255,255,255,0.15)',
                    transition: 'background 0.2s',
                  }} />
                ))}
              </div>
              {current < questions.length - 1 ? (
                <button style={S.btn('primary')} onClick={nextQuestion}>
                  Next →
                </button>
              ) : (
                <button
                  style={S.btn('primary')}
                  onClick={submitTest}
                  disabled={loading}
                >
                  {loading ? '🤖 Analyzing…' : '🎯 Submit & Analyze'}
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* ── RESULTS ───────────────────────────────────────────── */}
        {step === 'results' && result && (
          <motion.div key="results"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          >
            {/* Score + AI Analysis */}
            <div style={S.card}>
              <div style={S.cardBody}>
                <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={S.scoreCircle(result.score)}>
                    <span style={{ fontSize: 32, fontWeight: 700, color: ACCURACY_COLOR(result.score) }}>
                      {result.score}%
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Overall</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>
                      {result.score >= 70 ? '🏆 Strong Foundation!' : result.score >= 40 ? '📈 Room to Grow' : '🚀 Let\'s Build Your Base'}
                    </h2>
                    {result.ai_analysis && (
                      <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, margin: '0 0 14px' }}>
                        {result.ai_analysis}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {result.weak_topics?.slice(0, 3).map(w => (
                        <span key={w.topic} style={{
                          padding: '4px 12px', borderRadius: 20, fontSize: 12,
                          background: 'rgba(239,68,68,0.1)', color: '#f87171',
                          border: '1px solid rgba(239,68,68,0.2)',
                        }}>⬇ {w.topic} ({w.accuracy}%)</span>
                      ))}
                      {result.strong_topics?.slice(0, 3).map(s => (
                        <span key={s.topic} style={{
                          padding: '4px 12px', borderRadius: 20, fontSize: 12,
                          background: 'rgba(34,197,94,0.1)', color: '#4ade80',
                          border: '1px solid rgba(34,197,94,0.2)',
                        }}>⬆ {s.topic} ({s.accuracy}%)</span>
                      ))}
                    </div>
                  </div>
                  <button style={S.btn('primary')} onClick={() => setStep('intro')}>
                    Retake Test
                  </button>
                </div>
              </div>
            </div>

            {/* Topic breakdown */}
            {result.topic_stats && (
              <div style={S.card}>
                <div style={S.cardHeader}><p style={S.cardTitle}>📊 Topic Breakdown</p></div>
                <div style={S.cardBody}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
                    {Object.entries(result.topic_stats).map(([topic, stats]) => {
                      const pct = Math.round(stats.correct / stats.total * 100);
                      return (
                        <div key={topic}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                            <span style={{ fontWeight: 500 }}>{topic}</span>
                            <span style={{ color: ACCURACY_COLOR(pct) }}>{pct}%</span>
                          </div>
                          <div style={S.progressBar}>
                            <div style={S.progressFill(pct, ACCURACY_COLOR(pct))} />
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                            {stats.correct}/{stats.total} correct
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 4-Week Study Plan */}
            {result.study_plan?.weekly_plan && (
              <div style={S.card}>
                <div style={S.cardHeader}>
                  <p style={S.cardTitle}>🗓️ Your Personalized Study Plan</p>
                  {result.study_plan.estimated_weeks_to_ready && (
                    <span style={{ fontSize: 13, color: '#fbbf24' }}>
                      ~{result.study_plan.estimated_weeks_to_ready} weeks to placement-ready
                    </span>
                  )}
                </div>
                <div style={S.cardBody}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                    {result.study_plan.weekly_plan.map((week, i) => (
                      <div key={i} style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 12, padding: '16px',
                        borderLeft: `3px solid ${['#6366f1','#f59e0b','#22c55e','#ef4444'][i % 4]}`,
                      }}>
                        <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 13 }}>
                          Week {week.week}: {week.focus}
                        </p>
                        {week.goals?.map((g, gi) => (
                          <p key={gi} style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-secondary)' }}>
                            ✓ {g}
                          </p>
                        ))}
                        {week.resources?.length > 0 && (
                          <div style={{ marginTop: 8, fontSize: 11, color: '#a5b4fc' }}>
                            📚 {week.resources.join(' · ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {result.study_plan.quick_wins?.length > 0 && (
                    <div style={{
                      marginTop: 20, padding: '16px', borderRadius: 12,
                      background: 'rgba(34,197,94,0.06)',
                      border: '1px solid rgba(34,197,94,0.2)',
                    }}>
                      <p style={{ fontWeight: 600, margin: '0 0 10px', color: '#4ade80', fontSize: 14 }}>
                        ⚡ Quick Wins (Do this week)
                      </p>
                      {result.study_plan.quick_wins.map((qw, i) => (
                        <p key={i} style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--text-secondary)' }}>
                          → {qw}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
