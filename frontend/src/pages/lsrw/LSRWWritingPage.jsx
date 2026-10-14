import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageTransition from '../../components/layout/PageTransition';
import ProctorOverlay from '../../components/proctor/ProctorOverlay';
import useProctor from '../../hooks/useProctor';
import useAuthStore from '../../store/authStore';
import { getWritingPool, startWritingSession, evaluateWriting } from '../../lib/lsrwApi';
import {
  HiOutlinePencilSquare, HiOutlineArrowLeft, HiOutlineArrowRight,
  HiOutlineClock, HiOutlinePaperAirplane, HiOutlineVideoCamera,
} from 'react-icons/hi2';

const LEVELS = [
  { key: 'beginner',     label: 'Beginner',     color: '#10b981', bg: 'rgba(16,185,129,0.12)', emoji: '🌱', blurb: 'Personal & descriptive · ~150 words' },
  { key: 'intermediate', label: 'Intermediate', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', emoji: '⚡', blurb: 'Opinion & discussion · ~250 words' },
  { key: 'advanced',     label: 'Advanced',     color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  emoji: '🚀', blurb: 'Analytical & argumentative · ~400 words' },
];
const LEVEL_STYLE = Object.fromEntries(LEVELS.map(l => [l.key, { bg: l.bg, color: l.color }]));
const PROMPTS_PER_LEVEL = 30;

export default function LSRWWritingPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  // phase: levels | list | writing
  const [phase, setPhase] = useState('levels');
  const [activeLevel, setActiveLevel] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [cameraReq, setCameraReq] = useState(false);
  const [selected, setSelected] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [text, setText] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef(null);

  // Strict proctoring: a covered lens, a turned head, a second face, a tab
  // switch, or leaving fullscreen ends the attempt and discards the essay.
  const proctor = useProctor({
    skill: 'writing',
    sessionId,
    onTerminate: (reason) => {
      clearInterval(timerRef.current);
      navigate('/lsrw', { state: { terminated: { reason, skill: 'Writing' } } });
    },
  });

  // Stop the countdown if the page unmounts mid-attempt; the proctor releases
  // the camera itself.
  useEffect(() => () => clearInterval(timerRef.current), []);

  // ── Open a level: request camera, then load its 30 prompts ──
  const openLevel = async (level) => {
    setError('');
    setCameraReq(true);
    const granted = await proctor.start();
    if (!granted) {
      setCameraReq(false);
      setError('📷 Camera access is required to start Writing Practice. Please allow the camera and try again.');
      return;
    }
    setCameraReq(false);
    setActiveLevel(level);
    setPhase('list');
    setPoolLoading(true);
    setPrompts([]);
    try {
      const d = await getWritingPool(level.key);
      setPrompts(d.prompts || []);
    } catch (e) {
      setError('Could not load prompts for this level. Please go back and try again.');
    } finally {
      setPoolLoading(false);
    }
  };

  const backToLevels = () => {
    clearInterval(timerRef.current);
    proctor.stop();
    setPhase('levels');
    setActiveLevel(null);
    setPrompts([]);
    setSelected(null);
    setText('');
    setError('');
  };

  useEffect(() => {
    if (phase === 'writing' && selected) {
      const limit = selected.time_limit_minutes * 60;
      setTimeLeft(limit); setElapsed(0);
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) { clearInterval(timerRef.current); handleSubmit(true); return 0; }
          return t - 1;
        });
        setElapsed(e => e + 1);
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const handleSelect = async (prompt) => {
    setError(''); setText('');
    try {
      const session = await startWritingSession(user.id, prompt.id);
      setSelected(prompt); setSessionId(session.session_id); setPhase('writing');
    } catch (e) {
      setError(`Could not start session: ${e?.response?.data?.detail || e.message}`);
    }
  };

  const handleSubmit = async (timeUp = false) => {
    clearInterval(timerRef.current);
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 10 && !timeUp) { setError('Please write at least 10 words before submitting.'); return; }
    setSubmitting(true);
    try {
      const result = await evaluateWriting({
        prompt: selected.prompt,
        student_text: text || '(No text submitted — time expired)',
        time_taken_seconds: elapsed,
        target_word_count: selected.target_word_count,
        student_id: user.id,
        session_id: sessionId,
      });
      proctor.stop();
      navigate('/lsrw/result', { state: { result, skill: 'writing', topic: selected } });
    } catch (e) {
      setError('Evaluation failed. Please try again.'); setSubmitting(false);
    }
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const timeWarning = timeLeft < 60 && timeLeft > 0;
  const progressPct = selected ? Math.min((wordCount / selected.target_word_count) * 100, 100) : 0;

  return (
    <PageTransition>
      <div style={{ padding: '28px', maxWidth: 860, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <button
            onClick={() => (phase === 'levels' ? navigate('/lsrw') : phase === 'list' ? backToLevels() : setPhase('list'))}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 14px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem' }}>
            <HiOutlineArrowLeft size={15} /> Back
          </button>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(249,115,22,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HiOutlinePencilSquare size={20} style={{ color: '#f97316' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>✍️ Writing Practice</h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {phase === 'levels' ? 'Choose a level — each has 30 writing prompts' : 'Timed writing — AI grades grammar, coherence & vocabulary'}
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
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', margin: '14px 0 2px' }}>{PROMPTS_PER_LEVEL}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>writing prompts</div>
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

        {/* ── PROMPT LIST (30 items for the chosen level) ── */}
        {phase === 'list' && activeLevel && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '4px 12px', borderRadius: 99, background: activeLevel.bg, color: activeLevel.color }}>{activeLevel.emoji} {activeLevel.label}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{prompts.length} prompts</span>
            </div>

            {poolLoading ? (
              <div style={{ textAlign: 'center', padding: '70px 0' }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', border: '4px solid rgba(249,115,22,0.2)', borderTopColor: '#f97316', animation: 'spin 0.8s linear infinite', margin: '0 auto 18px' }} />
                <p style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Preparing {PROMPTS_PER_LEVEL} writing prompts…</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 6 }}>Generating fresh {activeLevel.label.toLowerCase()} prompts with AI</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {prompts.map((p, i) => {
              const lvl = LEVEL_STYLE[p.level] || LEVEL_STYLE.beginner;
              return (
                <motion.div key={p.id} className="glass-card" initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.4) }}
                  whileHover={{ y: -2, borderColor: 'rgba(249,115,22,0.3)' }}
                  onClick={() => handleSelect(p)}
                  style={{ padding: '20px 22px', cursor: 'pointer', border: '1px solid rgba(249,115,22,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: lvl.bg, color: lvl.color }}>Prompt {i + 1}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⏱ {p.time_limit_minutes} min · 📝 {p.target_word_count} words</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: 5 }}>{p.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{p.prompt.substring(0, 120)}...</div>
                    </div>
                    <HiOutlineArrowRight size={18} style={{ color: '#f97316', flexShrink: 0, marginLeft: 16 }} />
                  </div>
                </motion.div>
              );
            })}
          </div>
            )}
          </div>
        )}

        {phase === 'writing' && selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Prompt + timer bar */}
            <div className="glass-card" style={{ padding: '18px 22px', marginBottom: 16, border: `1px solid ${timeWarning ? 'rgba(239,68,68,0.3)' : 'rgba(249,115,22,0.15)'}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>WRITING PROMPT</p>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>{selected.prompt}</p>
                </div>
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <HiOutlineClock size={16} style={{ color: timeWarning ? '#ef4444' : 'var(--text-muted)' }} />
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.4rem', color: timeWarning ? '#ef4444' : 'var(--text-primary)' }}>{fmt(timeLeft)}</span>
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>remaining</p>
                </div>
              </div>
            </div>

            {/* Word progress */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Word count</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: wordCount >= selected.target_word_count ? '#10b981' : 'var(--text-primary)' }}>
                {wordCount} / {selected.target_word_count}
              </span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 99, marginBottom: 14, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: wordCount >= selected.target_word_count ? '#10b981' : '#f97316', borderRadius: 99, width: `${progressPct}%`, transition: 'width 0.3s' }} />
            </div>

            {/* Textarea */}
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Start writing here..."
              rows={14}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14,
                padding: '16px 18px', color: 'var(--text-primary)',
                fontSize: '0.92rem', lineHeight: 1.75, resize: 'vertical',
                outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(249,115,22,0.4)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Write naturally. Do not copy-paste.</p>
              <button onClick={() => handleSubmit(false)} disabled={submitting || wordCount < 10}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 28px', background: submitting || wordCount < 10 ? 'rgba(249,115,22,0.3)' : '#f97316', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: submitting || wordCount < 10 ? 'not-allowed' : 'pointer' }}>
                <HiOutlinePaperAirplane size={16} />
                {submitting ? 'Evaluating...' : 'Submit'}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── LIVE PROCTORING ── */}
        <ProctorOverlay {...proctor} />
      </div>
    </PageTransition>
  );
}
