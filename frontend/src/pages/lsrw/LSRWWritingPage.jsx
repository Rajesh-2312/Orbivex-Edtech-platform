import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageTransition from '../../components/layout/PageTransition';
import useAuthStore from '../../store/authStore';
import { getWritingPrompts, startWritingSession, evaluateWriting } from '../../lib/lsrwApi';
import {
  HiOutlinePencilSquare, HiOutlineArrowLeft, HiOutlineArrowRight,
  HiOutlineClock, HiOutlinePaperAirplane,
} from 'react-icons/hi2';

const LEVEL_STYLE = {
  beginner:     { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  intermediate: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  advanced:     { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444' },
};

export default function LSRWWritingPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [prompts, setPrompts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [phase, setPhase] = useState('select');
  const [text, setText] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    getWritingPrompts().then(d => setPrompts(d.prompts || []))
      .catch(() => setError('Could not load prompts. LSRW Skills is temporarily unavailable — please try again later.'));
    return () => clearInterval(timerRef.current);
  }, []);

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
          <button onClick={() => navigate('/lsrw')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 14px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem' }}>
            <HiOutlineArrowLeft size={15} /> Back
          </button>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(249,115,22,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HiOutlinePencilSquare size={20} style={{ color: '#f97316' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>✍️ Writing Practice</h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Timed writing — AI grades grammar, coherence & vocabulary</p>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: '#ef4444', fontSize: '0.84rem', marginBottom: 20 }}>
            {error}
          </div>
        )}

        {phase === 'select' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {prompts.map((p, i) => {
              const lvl = LEVEL_STYLE[p.level] || LEVEL_STYLE.beginner;
              return (
                <motion.div key={p.id} className="glass-card" initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  whileHover={{ y: -2, borderColor: 'rgba(249,115,22,0.3)' }}
                  onClick={() => handleSelect(p)}
                  style={{ padding: '20px 22px', cursor: 'pointer', border: '1px solid rgba(249,115,22,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: lvl.bg, color: lvl.color }}>{p.level}</span>
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
      </div>
    </PageTransition>
  );
}
