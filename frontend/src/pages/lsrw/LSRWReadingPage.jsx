import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageTransition from '../../components/layout/PageTransition';
import ProctorOverlay from '../../components/proctor/ProctorOverlay';
import useProctor from '../../hooks/useProctor';
import useAuthStore from '../../store/authStore';
import { getReadingPool, startReadingSession, evaluateReading } from '../../lib/lsrwApi';
import {
  HiOutlineBookOpen, HiOutlineArrowLeft, HiOutlineArrowRight,
  HiOutlineCheckCircle, HiOutlineVideoCamera,
} from 'react-icons/hi2';

const LEVELS = [
  { key: 'beginner',     label: 'Beginner',     color: '#10b981', bg: 'rgba(16,185,129,0.12)', emoji: '🌱', blurb: 'Everyday topics · simple vocabulary' },
  { key: 'intermediate', label: 'Intermediate', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', emoji: '⚡', blurb: 'General knowledge · moderate vocabulary' },
  { key: 'advanced',     label: 'Advanced',     color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  emoji: '🚀', blurb: 'Abstract & technical · rich vocabulary' },
];
const LEVEL_STYLE = Object.fromEntries(LEVELS.map(l => [l.key, { bg: l.bg, color: l.color }]));
const PASSAGES_PER_LEVEL = 30;
const TYPE_STYLE = {
  comprehension: { bg: 'rgba(59,130,246,0.1)',  color: '#3b82f6' },
  inference:     { bg: 'rgba(168,85,247,0.1)',  color: '#a855f7' },
  vocabulary:    { bg: 'rgba(249,115,22,0.1)',  color: '#f97316' },
  main_idea:     { bg: 'rgba(16,185,129,0.1)',  color: '#10b981' },
};
const OPT_LABELS = ['A', 'B', 'C', 'D'];

export default function LSRWReadingPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  // phase: levels | list | reading | answering | processing
  const [phase, setPhase] = useState('levels');
  const [activeLevel, setActiveLevel] = useState(null);
  const [passages, setPassages] = useState([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [cameraReq, setCameraReq] = useState(false);
  const [selected, setSelected] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [readingStart, setReadingStart] = useState(null);
  const [error, setError] = useState('');

  // Strict proctoring: a covered lens, a turned head, a second face, a tab
  // switch, or leaving fullscreen ends the attempt and discards the answers.
  const proctor = useProctor({
    skill: 'reading',
    sessionId,
    onTerminate: (reason) => navigate('/lsrw', { state: { terminated: { reason, skill: 'Reading' } } }),
  });

  // ── Open a level: request camera, then load its 30 passages ──
  const openLevel = async (level) => {
    setError('');
    setCameraReq(true);
    const granted = await proctor.start();
    if (!granted) {
      setCameraReq(false);
      setError('📷 Camera access is required to start Reading Practice. Please allow the camera and try again.');
      return;
    }
    setCameraReq(false);
    setActiveLevel(level);
    setPhase('list');
    setPoolLoading(true);
    setPassages([]);
    try {
      const d = await getReadingPool(level.key);
      setPassages(d.passages || []);
    } catch (e) {
      setError('Could not load passages for this level. Please go back and try again.');
    } finally {
      setPoolLoading(false);
    }
  };

  const backToLevels = () => {
    proctor.stop();
    setPhase('levels');
    setActiveLevel(null);
    setPassages([]);
    setSelected(null);
    setError('');
  };

  const handleSelect = async (passage) => {
    setError('');
    try {
      const session = await startReadingSession(user.id, passage.id);
      setSelected(passage);
      setSessionId(session.session_id);
      setReadingStart(Date.now());
      setAnswers(Object.fromEntries(passage.questions.map(q => [q.id, ''])));
      setPhase('reading');
    } catch (e) {
      setError(`Could not start session: ${e?.response?.data?.error || e.message}`);
    }
  };

  const handleSubmit = async () => {
    const unanswered = selected.questions.filter(q => !answers[q.id]);
    if (unanswered.length) { setError('Please answer all questions before submitting.'); return; }
    const elapsed = Math.round((Date.now() - readingStart) / 1000);
    setPhase('processing');
    try {
      const result = await evaluateReading({
        passage_id: selected.id,
        student_answers: answers,
        time_taken_seconds: elapsed,
        student_id: user.id,
        session_id: sessionId,
      });
      proctor.stop();
      navigate('/lsrw/result', { state: { result, skill: 'reading', topic: selected } });
    } catch (e) {
      setError('Evaluation failed. Please try again.'); setPhase('answering');
    }
  };

  return (
    <PageTransition>
      <div style={{ padding: '28px', maxWidth: 960, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <button
            onClick={() => (phase === 'levels' ? navigate('/lsrw') : phase === 'list' ? backToLevels() : setPhase('list'))}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 14px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem' }}>
            <HiOutlineArrowLeft size={15} /> Back
          </button>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HiOutlineBookOpen size={20} style={{ color: '#10b981' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>📖 Reading Practice</h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {phase === 'levels' ? 'Choose a level — each has 30 reading passages' : 'Read the passage and answer MCQ comprehension questions'}
            </p>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: '#ef4444', fontSize: '0.84rem', marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* ── LEVEL CARDS ── */}
        {phase === 'levels' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 18 }}>
            {LEVELS.map((lvl, i) => (
              <motion.div key={lvl.key} className="glass-card"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                whileHover={{ y: -4, borderColor: lvl.color }}
                onClick={() => !cameraReq && openLevel(lvl)}
                style={{ padding: '26px 22px', cursor: cameraReq ? 'wait' : 'pointer', border: `1px solid ${lvl.bg}`, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 0%, ${lvl.bg}, transparent 70%)`, pointerEvents: 'none' }} />
                <div style={{ fontSize: '2.4rem', marginBottom: 10 }}>{lvl.emoji}</div>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '4px 12px', borderRadius: 99, background: lvl.bg, color: lvl.color }}>{lvl.label}</span>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', margin: '14px 0 2px' }}>{PASSAGES_PER_LEVEL}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>reading passages</div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: 16 }}>{lvl.blurb}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: lvl.color, fontWeight: 600 }}>
                  <HiOutlineVideoCamera size={14} /> Camera required
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {cameraReq && (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            📷 Requesting camera access… please click <b>Allow</b> in your browser.
          </div>
        )}

        {/* ── PASSAGE LIST (30 items for the chosen level) ── */}
        {phase === 'list' && activeLevel && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '4px 12px', borderRadius: 99, background: activeLevel.bg, color: activeLevel.color }}>{activeLevel.emoji} {activeLevel.label}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{passages.length} passages</span>
            </div>

            {poolLoading ? (
              <div style={{ textAlign: 'center', padding: '70px 0' }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', border: '4px solid rgba(16,185,129,0.2)', borderTopColor: '#10b981', animation: 'spin 0.8s linear infinite', margin: '0 auto 18px' }} />
                <p style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Preparing {PASSAGES_PER_LEVEL} reading passages…</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 6 }}>Generating fresh {activeLevel.label.toLowerCase()} passages with AI</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {passages.map((p, i) => {
                  const lvl = LEVEL_STYLE[p.level] || LEVEL_STYLE.beginner;
                  return (
                    <motion.div key={p.id} className="glass-card" initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.4) }}
                      whileHover={{ y: -2, borderColor: 'rgba(16,185,129,0.3)' }}
                      onClick={() => handleSelect(p)}
                      style={{ padding: '20px 22px', cursor: 'pointer', border: '1px solid rgba(16,185,129,0.1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: lvl.bg, color: lvl.color }}>Passage {i + 1}</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>📖 {p.read_time_minutes} min · {p.questions.length} MCQ</span>
                          </div>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: 5 }}>{p.title}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{p.passage.substring(0, 110)}...</div>
                        </div>
                        <HiOutlineArrowRight size={18} style={{ color: '#10b981', flexShrink: 0, marginLeft: 16 }} />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* READING PHASE */}
        {phase === 'reading' && selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="glass-card" style={{ padding: '28px 30px', marginBottom: 20 }}>
              <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: 4 }}>{selected.title}</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 20 }}>Read carefully — questions follow. You may scroll back to re-read.</p>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.85, fontSize: '0.92rem' }}>{selected.passage}</p>
            </div>
            <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 10, fontSize: '0.78rem', color: '#f59e0b', marginBottom: 16 }}>
              💡 Tip: Read at least twice. Note key facts, dates and cause-effect relationships.
            </div>
            <button onClick={() => setPhase('answering')} style={{ width: '100%', padding: '14px', background: '#10b981', border: 'none', borderRadius: 14, color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
              I've Read It — Answer Questions →
            </button>
          </motion.div>
        )}

        {/* ANSWERING PHASE */}
        {phase === 'answering' && selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <button onClick={() => setPhase('reading')} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontSize: '0.82rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
              <HiOutlineArrowLeft size={14} /> Re-read the passage
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
              {selected.questions.map((q, qi) => {
                const typ = TYPE_STYLE[q.question_type] || TYPE_STYLE.comprehension;
                const selected_ans = answers[q.id] || '';
                return (
                  <div key={q.id} className="glass-card" style={{ padding: '20px 22px' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: typ.bg, color: typ.color }}>{q.question_type}</span>
                    </div>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14, fontSize: '0.92rem' }}>Q{qi + 1}. {q.question}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {q.opts.map((opt, oi) => {
                        const label = OPT_LABELS[oi];
                        const active = selected_ans === label;
                        return (
                          <button key={label} onClick={() => setAnswers(a => ({ ...a, [q.id]: label }))}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                              background: active ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${active ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`,
                              borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%',
                            }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                              background: active ? '#10b981' : 'rgba(255,255,255,0.06)',
                              border: `2px solid ${active ? '#10b981' : 'rgba(255,255,255,0.12)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.78rem', fontWeight: 700,
                              color: active ? 'white' : 'var(--text-muted)',
                            }}>
                              {active ? <HiOutlineCheckCircle size={15} /> : label}
                            </div>
                            <span style={{ fontSize: '0.88rem', color: active ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: active ? 600 : 400 }}>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={handleSubmit} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 14, color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
              Submit for Evaluation
            </button>
          </motion.div>
        )}

        {/* PROCESSING */}
        {phase === 'processing' && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', border: '4px solid rgba(16,185,129,0.2)', borderTopColor: '#10b981', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
            <p style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Scoring your answers...</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem', marginTop: 6 }}>Generating feedback on your comprehension</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── LIVE PROCTORING ── */}
        <ProctorOverlay {...proctor} />
      </div>
    </PageTransition>
  );
}
