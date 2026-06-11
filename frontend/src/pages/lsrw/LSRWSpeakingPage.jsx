import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageTransition from '../../components/layout/PageTransition';
import useAuthStore from '../../store/authStore';
import { getSpeakingTopics, startSpeakingSession, evaluateSpeaking } from '../../lib/lsrwApi';
import {
  HiOutlineMicrophone, HiOutlineStopCircle, HiOutlineArrowLeft,
  HiOutlineArrowRight, HiOutlinePlay,
} from 'react-icons/hi2';

const LEVEL_STYLE = {
  beginner:     { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  intermediate: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  advanced:     { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444' },
};

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

export default function LSRWSpeakingPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [topics, setTopics] = useState([]);
  const [selected, setSelected] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [phase, setPhase] = useState('select');
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');

  useEffect(() => {
    getSpeakingTopics().then(d => setTopics(d.topics || []))
      .catch(() => setError('Could not load topics. LSRW Skills is temporarily unavailable — please try again later.'));
    return () => {
      clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      recognitionRef.current?.stop();
    };
  }, []);

  const handleSelect = async (topic) => {
    setError('');
    try {
      const session = await startSpeakingSession(user.id, topic.id);
      setSelected(topic); setSessionId(session.session_id); setPhase('prepare');
    } catch (e) {
      setError(`Could not start session: ${e?.response?.data?.error || e.message}`);
    }
  };

  const startRecording = async () => {
    chunksRef.current = [];
    transcriptRef.current = '';
    setTranscript('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recorder.ondataavailable = e => chunksRef.current.push(e.data);
      recorder.start(250);
      recorderRef.current = recorder;

      if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.onresult = (event) => {
          let final = '';
          for (let i = 0; i < event.results.length; i++) {
            if (event.results[i].isFinal) final += event.results[i][0].transcript + ' ';
          }
          transcriptRef.current = final.trim();
          setTranscript(final.trim());
        };
        recognition.onerror = () => {};
        recognition.start();
        recognitionRef.current = recognition;
      }

      setPhase('recording'); setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch {
      setError('Microphone access was denied. Please allow it in your browser settings.');
    }
  };

  const stopAndEvaluate = async () => {
    clearInterval(timerRef.current);
    recorderRef.current?.stop();
    recognitionRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    setPhase('processing');
    await new Promise(r => setTimeout(r, 800));
    try {
      const result = await evaluateSpeaking({
        topic_prompt: selected.prompt,
        transcript: transcriptRef.current || null,
        duration_seconds: seconds,
        student_id: user.id,
        session_id: sessionId,
      });
      navigate('/lsrw/result', { state: { result, skill: 'speaking', topic: selected } });
    } catch (e) {
      setError('Evaluation failed. Please try again.'); setPhase('prepare');
    }
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <PageTransition>
      <div style={{ padding: '28px', maxWidth: 800, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <button onClick={() => navigate('/lsrw')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 14px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem' }}>
            <HiOutlineArrowLeft size={15} /> Back
          </button>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HiOutlineMicrophone size={20} style={{ color: '#a855f7' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>🎙️ Speaking Practice</h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Speak on a topic — AI scores fluency, pronunciation & grammar</p>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: '#ef4444', fontSize: '0.84rem', marginBottom: 20 }}>
            {error}
          </div>
        )}

        {phase === 'select' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {topics.map((t, i) => {
              const lvl = LEVEL_STYLE[t.level] || LEVEL_STYLE.beginner;
              return (
                <motion.div key={t.id} className="glass-card" initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  whileHover={{ y: -2, borderColor: 'rgba(168,85,247,0.3)' }}
                  onClick={() => handleSelect(t)}
                  style={{ padding: '20px 22px', cursor: 'pointer', border: '1px solid rgba(168,85,247,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: lvl.bg, color: lvl.color }}>{t.level}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>⏱ {t.duration_seconds}s target</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: 5 }}>{t.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{t.prompt}</div>
                    </div>
                    <HiOutlineArrowRight size={18} style={{ color: '#a855f7', flexShrink: 0, marginLeft: 16 }} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {(phase === 'prepare' || phase === 'recording' || phase === 'processing') && selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Topic prompt */}
            <div className="glass-card" style={{ padding: '20px 24px', marginBottom: 20, border: '1px solid rgba(168,85,247,0.15)' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>SPEAKING TOPIC</p>
              <p style={{ fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>{selected.prompt}</p>
              <p style={{ fontSize: '0.75rem', color: 'rgba(168,85,247,0.6)', marginTop: 8 }}>Target duration: {selected.duration_seconds} seconds</p>
            </div>

            <div className="glass-card" style={{ padding: 32, textAlign: 'center' }}>
              {phase === 'prepare' && (
                <>
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(168,85,247,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                    <HiOutlineMicrophone size={32} style={{ color: '#a855f7' }} />
                  </div>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>Read the topic above, then press record when ready.</p>
                  {SpeechRecognitionAPI
                    ? <p style={{ color: 'rgba(168,85,247,0.7)', fontSize: '0.78rem', marginBottom: 24 }}>🎤 Live transcription enabled — speak clearly in English</p>
                    : <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: 24 }}>Transcription unavailable in this browser — duration will be used for scoring</p>
                  }
                  <button onClick={startRecording} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 32px', background: '#a855f7', border: 'none', borderRadius: 14, color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
                    <HiOutlinePlay size={18} /> Start Recording
                  </button>
                </>
              )}

              {phase === 'recording' && (
                <>
                  <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 18px' }}>
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(239,68,68,0.2)', animation: 'ping 1.2s ease-in-out infinite' }} />
                    <div style={{ position: 'relative', width: 80, height: 80, borderRadius: '50%', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <HiOutlineMicrophone size={32} style={{ color: 'white' }} />
                    </div>
                  </div>
                  <div style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>{fmt(seconds)}</div>
                  <div style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.85rem', marginBottom: transcript ? 12 : 28 }}>● Recording...</div>
                  {transcript && (
                    <div style={{ marginBottom: 20, padding: '10px 14px', background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)', borderRadius: 10, textAlign: 'left' }}>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>LIVE TRANSCRIPT</p>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>{transcript}</p>
                    </div>
                  )}
                  <button onClick={stopAndEvaluate} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 32px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 14, color: '#ef4444', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
                    <HiOutlineStopCircle size={18} /> Stop &amp; Evaluate
                  </button>
                  <style>{`@keyframes ping { 0%,100%{transform:scale(1);opacity:0.6} 50%{transform:scale(1.5);opacity:0} }`}</style>
                </>
              )}

              {phase === 'processing' && (
                <>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', border: '4px solid rgba(168,85,247,0.2)', borderTopColor: '#a855f7', animation: 'spin 0.8s linear infinite', margin: '0 auto 18px' }} />
                  <p style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Evaluating your speech...</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem', marginTop: 6 }}>Checking pronunciation, fluency, vocabulary &amp; grammar</p>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}
