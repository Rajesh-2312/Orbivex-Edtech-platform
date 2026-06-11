import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageTransition from '../../components/layout/PageTransition';
import useAuthStore from '../../store/authStore';
import { getListeningPassages, startListeningSession, evaluateListening } from '../../lib/lsrwApi';
import {
  HiOutlineSpeakerWave, HiOutlinePlay, HiOutlinePause,
  HiOutlineArrowLeft, HiOutlineArrowRight, HiOutlineCheckCircle,
} from 'react-icons/hi2';

const LEVEL_STYLE = {
  beginner:     { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  intermediate: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  advanced:     { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444' },
};

export default function LSRWListeningPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [passages, setPassages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [phase, setPhase] = useState('select'); // select | listening | answering | processing
  const [answers, setAnswers] = useState({});
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const utteranceRef = useRef(null);

  useEffect(() => {
    getListeningPassages().then(d => setPassages(d.passages || []))
      .catch(() => setError('Could not load passages. LSRW Skills is temporarily unavailable — please try again later.'));
  }, []);

  const handleSelect = async (passage) => {
    setError('');
    try {
      const session = await startListeningSession(user.id, passage.id);
      setSelected(passage);
      setSessionId(session.session_id);
      setAnswers(Object.fromEntries(passage.questions.map((_, i) => [i, ''])));
      setPhase('listening');
    } catch (e) {
      setError(`Could not start session: ${e?.response?.data?.detail || e.message}`);
    }
  };

  const playAudio = () => {
    if (!selected) return;
    if (playing) { window.speechSynthesis.cancel(); setPlaying(false); return; }
    const utterance = new SpeechSynthesisUtterance(selected.text);
    utterance.rate = 0.85; utterance.lang = 'en-US';
    const total = selected.text.length;
    utterance.onboundary = e => setProgress(Math.round((e.charIndex / total) * 100));
    utterance.onend = () => { setPlaying(false); setProgress(100); };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setPlaying(true);
  };

  const handleSubmit = async () => {
    const allAnswered = selected.questions.every((_, i) => answers[i]?.trim());
    if (!allAnswered) { setError('Please answer all questions before submitting.'); return; }
    setPhase('processing');
    try {
      const result = await evaluateListening({
        passage_text: selected.text,
        questions: selected.questions,
        student_answers: selected.questions.map((_, i) => answers[i]),
        student_id: user.id,
        session_id: sessionId,
      });
      navigate('/lsrw/result', { state: { result, skill: 'listening', topic: selected } });
    } catch (e) {
      setError('Evaluation failed. Please try again.');
      setPhase('answering');
    }
  };

  return (
    <PageTransition>
      <div style={{ padding: '28px', maxWidth: 800, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <button onClick={() => navigate('/lsrw')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 14px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem' }}>
            <HiOutlineArrowLeft size={15} /> Back
          </button>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HiOutlineSpeakerWave size={20} style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>🎧 Listening Practice</h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Listen carefully, then answer comprehension questions</p>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: '#ef4444', fontSize: '0.84rem', marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* SELECT PASSAGE */}
        {phase === 'select' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {passages.map((p, i) => {
              const lvl = LEVEL_STYLE[p.level] || LEVEL_STYLE.beginner;
              return (
                <motion.div key={p.id} className="glass-card" initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  whileHover={{ y: -2, borderColor: 'rgba(59,130,246,0.3)' }}
                  onClick={() => handleSelect(p)}
                  style={{ padding: '20px 22px', cursor: 'pointer', border: '1px solid rgba(59,130,246,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: lvl.bg, color: lvl.color }}>{p.level}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⏱ ~{p.duration_seconds}s · {p.questions.length} questions</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: 5 }}>{p.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{p.text.substring(0, 110)}...</div>
                    </div>
                    <HiOutlineArrowRight size={18} style={{ color: '#3b82f6', flexShrink: 0, marginLeft: 16 }} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* LISTENING PHASE */}
        {phase === 'listening' && selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="glass-card" style={{ padding: 28, marginBottom: 16, textAlign: 'center' }}>
              <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: 6 }}>{selected.title}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 24 }}>{selected.questions.length} questions • Listen carefully before proceeding</p>

              <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
                <HiOutlineSpeakerWave size={36} style={{ color: '#3b82f6', marginBottom: 14 }} />
                {/* Progress bar */}
                <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99, marginBottom: 16, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#3b82f6', borderRadius: 99, width: `${progress}%`, transition: 'width 0.4s' }} />
                </div>
                <button onClick={playAudio} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: '#3b82f6', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
                  {playing ? <><HiOutlinePause size={18} /> Pause</> : <><HiOutlinePlay size={18} /> {progress > 0 ? 'Replay' : 'Play Audio'}</>}
                </button>
                <p style={{ marginTop: 12, fontSize: '0.75rem', color: 'rgba(59,130,246,0.6)' }}>🔊 Browser text-to-speech</p>
              </div>

              <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 10, fontSize: '0.78rem', color: '#f59e0b', textAlign: 'left' }}>
                💡 Tip: Listen at least twice. Do not look at the text. Answer from memory.
              </div>
            </div>
            <button onClick={() => setPhase('answering')} style={{ width: '100%', padding: '14px', background: '#3b82f6', border: 'none', borderRadius: 14, color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
              I've Listened — Answer Questions →
            </button>
          </motion.div>
        )}

        {/* ANSWERING PHASE */}
        {phase === 'answering' && selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <button onClick={() => setPhase('listening')} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.82rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
              <HiOutlineArrowLeft size={14} /> Replay the audio
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              {selected.questions.map((q, i) => (
                <div key={i} className="glass-card" style={{ padding: '20px 22px' }}>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, fontSize: '0.92rem' }}>Q{i+1}. {q}</p>
                  <textarea rows={3} value={answers[i] || ''} onChange={e => setAnswers(a => ({ ...a, [i]: e.target.value }))}
                    placeholder="Type your answer here..."
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: '0.85rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
            <button onClick={handleSubmit} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', border: 'none', borderRadius: 14, color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
              Submit for AI Evaluation
            </button>
          </motion.div>
        )}

        {/* PROCESSING */}
        {phase === 'processing' && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', border: '4px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
            <p style={{ color: 'var(--text-primary)', fontWeight: 700 }}>AI is evaluating your comprehension...</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem', marginTop: 6 }}>Checking accuracy, inference, and detail retention</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
