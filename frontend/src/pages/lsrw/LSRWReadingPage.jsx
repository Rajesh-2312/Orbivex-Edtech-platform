import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageTransition from '../../components/layout/PageTransition';
import useAuthStore from '../../store/authStore';
import { getReadingPassages, startReadingSession, evaluateReading } from '../../lib/lsrwApi';
import {
  HiOutlineBookOpen, HiOutlineArrowLeft, HiOutlineArrowRight,
  HiOutlineCamera, HiOutlineVideoCamera,
} from 'react-icons/hi2';

const LEVEL_STYLE = {
  beginner:     { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  intermediate: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  advanced:     { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444' },
};
const TYPE_STYLE = {
  comprehension: { bg: 'rgba(59,130,246,0.1)',  color: '#3b82f6' },
  inference:     { bg: 'rgba(168,85,247,0.1)',  color: '#a855f7' },
  vocabulary:    { bg: 'rgba(249,115,22,0.1)',  color: '#f97316' },
  main_idea:     { bg: 'rgba(16,185,129,0.1)',  color: '#10b981' },
};

export default function LSRWReadingPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [passages, setPassages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [phase, setPhase] = useState('select');
  const [answers, setAnswers] = useState({});
  const [readingStart, setReadingStart] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    getReadingPassages().then(d => setPassages(d.passages || []))
      .catch(() => setError('Could not load passages. LSRW Skills is temporarily unavailable — please try again later.'));
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOn(true);
    } catch { setCameraOn(false); }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setCameraOn(false);
  };

  const handleSelect = async (passage) => {
    setError('');
    try {
      const session = await startReadingSession(user.id, passage.id);
      setSelected(passage); setSessionId(session.session_id);
      setReadingStart(Date.now());
      setAnswers(Object.fromEntries(passage.questions.map(q => [q.id, ''])));
      setPhase('reading');
      await startCamera();
    } catch (e) {
      setError(`Could not start session: ${e?.response?.data?.detail || e.message}`);
    }
  };

  const handleSubmit = async () => {
    const elapsed = Math.round((Date.now() - readingStart) / 1000);
    setPhase('processing'); stopCamera();
    try {
      const result = await evaluateReading({
        passage: selected.passage,
        questions: selected.questions,
        student_answers: answers,
        reading_time_seconds: elapsed,
        student_id: user.id,
        session_id: sessionId,
      });
      navigate('/lsrw/result', { state: { result, skill: 'reading', topic: selected } });
    } catch (e) {
      setError('Evaluation failed. Please try again.'); setPhase('answering');
    }
  };

  return (
    <PageTransition>
      <div style={{ padding: '28px', maxWidth: 960, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <button onClick={() => { stopCamera(); navigate('/lsrw'); }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 14px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem' }}>
            <HiOutlineArrowLeft size={15} /> Back
          </button>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HiOutlineBookOpen size={20} style={{ color: '#10b981' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>📖 Reading Practice</h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Read the passage and answer comprehension questions</p>
          </div>
          {cameraOn && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
              <video ref={videoRef} autoPlay muted playsInline style={{ width: 80, height: 56, borderRadius: 10, objectFit: 'cover', border: '1px solid rgba(16,185,129,0.3)' }} />
              <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
            </div>
          )}
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: '#ef4444', fontSize: '0.84rem', marginBottom: 20 }}>
            {error}
          </div>
        )}

        {phase === 'select' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {passages.map((p, i) => {
              const lvl = LEVEL_STYLE[p.level] || LEVEL_STYLE.beginner;
              return (
                <motion.div key={p.id} className="glass-card" initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  whileHover={{ y: -2, borderColor: 'rgba(16,185,129,0.3)' }}
                  onClick={() => handleSelect(p)}
                  style={{ padding: '20px 22px', cursor: 'pointer', border: '1px solid rgba(16,185,129,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: lvl.bg, color: lvl.color }}>{p.level}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.questions.length} questions</span>
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

        {phase === 'reading' && selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20 }}>
            <div>
              <div className="glass-card" style={{ padding: '28px 30px', marginBottom: 16 }}>
                <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: 4 }}>{selected.title}</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 20 }}>Read carefully — questions will follow</p>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.85, fontSize: '0.92rem' }}>{selected.passage}</p>
              </div>
              <button onClick={() => setPhase('answering')} style={{ width: '100%', padding: '14px', background: '#10b981', border: 'none', borderRadius: 14, color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
                I've Read It — Answer Questions →
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="glass-card" style={{ padding: '18px 20px', border: '1px solid rgba(16,185,129,0.15)' }}>
                <p style={{ fontWeight: 700, fontSize: '0.85rem', color: '#10b981', marginBottom: 12 }}>📖 Reading Tips</p>
                {['Read at least twice', 'Note key facts & dates', 'Identify the main idea', 'Look for cause & effect'].map(tip => (
                  <p key={tip} style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6, display: 'flex', gap: 6 }}>
                    <span style={{ color: '#10b981' }}>•</span> {tip}
                  </p>
                ))}
              </div>
              {cameraOn && (
                <div className="glass-card" style={{ padding: 14, textAlign: 'center' }}>
                  <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', borderRadius: 10, objectFit: 'cover' }} />
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8 }}>📷 Reading session active</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {phase === 'answering' && selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <button onClick={() => setPhase('reading')} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontSize: '0.82rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
              <HiOutlineArrowLeft size={14} /> Re-read the passage
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              {selected.questions.map((q, i) => {
                const typ = TYPE_STYLE[q.question_type] || TYPE_STYLE.comprehension;
                return (
                  <div key={q.id} className="glass-card" style={{ padding: '20px 22px' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: typ.bg, color: typ.color }}>{q.question_type}</span>
                    </div>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, fontSize: '0.92rem' }}>Q{i+1}. {q.question}</p>
                    <textarea rows={3} value={answers[q.id] || ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                      placeholder="Type your answer here..."
                      style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: '0.85rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                );
              })}
            </div>
            <button onClick={handleSubmit} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 14, color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
              Submit for AI Evaluation
            </button>
          </motion.div>
        )}

        {phase === 'processing' && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', border: '4px solid rgba(16,185,129,0.2)', borderTopColor: '#10b981', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
            <p style={{ color: 'var(--text-primary)', fontWeight: 700 }}>AI is evaluating your reading...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
