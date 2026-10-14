import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageTransition from '../../components/layout/PageTransition';
import ProctorOverlay from '../../components/proctor/ProctorOverlay';
import useProctor from '../../hooks/useProctor';
import useAuthStore from '../../store/authStore';
import { getSpeakingPool, startSpeakingSession, evaluateSpeaking } from '../../lib/lsrwApi';
import {
  HiOutlineMicrophone, HiOutlineStopCircle, HiOutlineArrowLeft,
  HiOutlinePlay, HiOutlineVideoCamera,
} from 'react-icons/hi2';

const LEVELS = [
  { key: 'beginner',     label: 'Beginner',     color: '#10b981', bg: 'rgba(16,185,129,0.12)', emoji: '🌱', blurb: 'Everyday personal topics' },
  { key: 'intermediate', label: 'Intermediate', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', emoji: '⚡', blurb: 'Opinion & general-knowledge topics' },
  { key: 'advanced',     label: 'Advanced',     color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  emoji: '🚀', blurb: 'Analytical & argumentative topics' },
];
const TOPICS_PER_LEVEL = 30;

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

export default function LSRWSpeakingPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);

  // phase: levels | list | prepare | recording | processing
  const [phase, setPhase] = useState('levels');
  const [activeLevel, setActiveLevel] = useState(null);
  const [topics, setTopics] = useState([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [cameraReq, setCameraReq] = useState(false);

  const [selected, setSelected] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioStreamRef = useRef(null);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');

  // Speaking holds a microphone stream and a SpeechRecognition instance on top of
  // the proctor's camera. All three have to go, or the mic indicator stays lit
  // after the attempt has already ended.
  const stopRecordingHardware = () => {
    clearInterval(timerRef.current);
    try { recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop(); } catch { /* already stopped */ }
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
    audioStreamRef.current?.getTracks().forEach(t => t.stop());
    audioStreamRef.current = null;
  };

  // Strict proctoring: a covered lens, a turned head, a second face, a tab
  // switch, or leaving fullscreen ends the attempt and discards the recording.
  const proctor = useProctor({
    skill: 'speaking',
    sessionId,
    onTerminate: (reason) => {
      stopRecordingHardware();
      navigate('/lsrw', { state: { terminated: { reason, skill: 'Speaking' } } });
    },
  });

  // Clean up the recording hardware on unmount; the proctor handles the camera.
  useEffect(() => () => stopRecordingHardware(), []);

  // ── Open a level: request camera, then load its 30 topics ──
  const openLevel = async (level) => {
    setError('');
    setCameraReq(true);
    const granted = await proctor.start();
    if (!granted) {
      setCameraReq(false);
      setError('📷 Camera access is required to start Speaking Practice. Please allow the camera and try again.');
      return;
    }
    setCameraReq(false);
    setActiveLevel(level);
    setPhase('list');
    setPoolLoading(true);
    setTopics([]);
    try {
      const d = await getSpeakingPool(level.key);
      setTopics(d.topics || []);
    } catch (e) {
      setError('Could not load topics for this level. Please go back and try again.');
    } finally {
      setPoolLoading(false);
    }
  };

  const backToLevels = () => {
    stopRecordingHardware();
    proctor.stop();
    setPhase('levels');
    setActiveLevel(null);
    setTopics([]);
    setSelected(null);
    setTranscript('');
    setSeconds(0);
    setError('');
  };

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
      audioStreamRef.current = stream;
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
    audioStreamRef.current?.getTracks().forEach(t => t.stop());
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
      proctor.stop();
      navigate('/lsrw/result', { state: { result, skill: 'speaking', topic: selected } });
    } catch (e) {
      setError('Evaluation failed. Please try again.'); setPhase('prepare');
    }
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <PageTransition>
      <div style={{ padding: '28px', maxWidth: 860, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <button
            onClick={() => (phase === 'levels' ? navigate('/lsrw') : phase === 'list' ? backToLevels() : setPhase('list'))}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 14px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem' }}>
            <HiOutlineArrowLeft size={15} /> Back
          </button>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HiOutlineMicrophone size={20} style={{ color: '#a855f7' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>🎙️ Speaking Practice</h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {phase === 'levels' ? 'Choose a level — each has 30 speaking topics' : 'Speak on a topic — AI scores fluency, pronunciation & grammar'}
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
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', margin: '14px 0 2px' }}>{TOPICS_PER_LEVEL}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>speaking topics</div>
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

        {/* ── TOPIC LIST (30 items for the chosen level) ── */}
        {phase === 'list' && activeLevel && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '4px 12px', borderRadius: 99, background: activeLevel.bg, color: activeLevel.color }}>{activeLevel.emoji} {activeLevel.label}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{topics.length} topics</span>
            </div>

            {poolLoading ? (
              <div style={{ textAlign: 'center', padding: '70px 0' }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', border: '4px solid rgba(168,85,247,0.2)', borderTopColor: '#a855f7', animation: 'spin 0.8s linear infinite', margin: '0 auto 18px' }} />
                <p style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Preparing {TOPICS_PER_LEVEL} speaking topics…</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 6 }}>Generating fresh {activeLevel.label.toLowerCase()} topics with AI</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14 }}>
                {topics.map((t, i) => (
                  <motion.div key={t.id} className="glass-card"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.4) }}
                    whileHover={{ y: -2, borderColor: 'rgba(168,85,247,0.3)' }}
                    onClick={() => handleSelect(t)}
                    style={{ padding: '16px 18px', cursor: 'pointer', border: '1px solid rgba(168,85,247,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>Topic {i + 1} · ⏱ {t.duration_seconds}s target</div>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                      </div>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(168,85,247,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <HiOutlineMicrophone size={16} style={{ color: '#a855f7' }} />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PREPARE / RECORDING / PROCESSING ── */}
        {(phase === 'prepare' || phase === 'recording' || phase === 'processing') && selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
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

        {/* ── LIVE PROCTORING ── */}
        <ProctorOverlay {...proctor} />
      </div>
    </PageTransition>
  );
}
