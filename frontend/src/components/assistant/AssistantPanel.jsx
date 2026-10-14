import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiXMark, HiOutlineSparkles, HiOutlinePaperAirplane,
  HiOutlineWrenchScrewdriver, HiOutlineCheckCircle, HiOutlineBolt,
} from 'react-icons/hi2';
import useAssistantStore from '../../store/assistantStore';
import FeedbackBar from '../tutor/FeedbackBar';

const STARTERS = [
  'How am I doing so far?',
  'What courses am I enrolled in?',
  'Give me easy coding problems on arrays',
  'Explain how pointers work in C',
];

const TOOL_LABELS = {
  get_my_progress: 'Checked your progress',
  list_my_courses: 'Looked up your courses',
  search_lessons: 'Searched your lessons',
  get_skill_gap: 'Reviewed your skill gaps',
  get_coding_problems: 'Found practice problems',
  enroll_in_course: 'Prepared enrolment',
};

export default function AssistantPanel() {
  const open = useAssistantStore((s) => s.open);
  const setOpen = useAssistantStore((s) => s.setOpen);
  const messages = useAssistantStore((s) => s.messages);
  const sending = useAssistantStore((s) => s.sending);
  const send = useAssistantStore((s) => s.send);

  const [input, setInput] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending]);

  const submit = (e) => {
    e?.preventDefault?.();
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    send(text);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100 }}
          />
          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            style={{
              position: 'fixed', top: 0, right: 0, height: '100vh', width: 'min(460px, 94vw)',
              background: 'var(--bg-secondary, #141414)', borderLeft: '1px solid rgba(249,115,22,0.15)',
              boxShadow: '-16px 0 48px rgba(0,0,0,0.6)', zIndex: 1101,
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px 18px', borderBottom: '1px solid rgba(249,115,22,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'linear-gradient(135deg,#ea580c,#fbbf24)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <HiOutlineBolt size={18} color="#0a0a0a" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: '700 0.95rem/1.1 var(--font-display)', color: 'var(--text-primary)' }}>
                    Orbivex Assistant
                  </div>
                  <div style={{ font: '400 0.74rem/1.2 var(--font-body)', color: 'var(--text-muted)' }}>
                    Asks your data · acts on your account
                  </div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="btn btn-icon btn-ghost" aria-label="Close assistant" style={{ display: 'flex' }}>
                <HiXMark size={20} />
              </button>
            </div>

            {/* Messages */}
            <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '12px 6px' }}>
                  <HiOutlineSparkles size={28} style={{ color: 'var(--brand-400)', marginBottom: 8 }} />
                  <div style={{ font: '600 0.95rem/1.3 var(--font-display)', color: 'var(--text-primary)', marginBottom: 6 }}>
                    Ask me about your learning — or ask me to do something
                  </div>
                  <div style={{ font: '400 0.82rem/1.5 var(--font-body)', color: 'var(--text-muted)', marginBottom: 14 }}>
                    I can check your progress, search your lessons, find practice, and enroll you in courses (with your OK first).
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {STARTERS.map((p) => (
                      <button key={p} onClick={() => send(p)} disabled={sending} style={{
                        textAlign: 'left', padding: '10px 12px', background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
                        color: 'var(--text-secondary)', font: '500 0.84rem/1.3 var(--font-body)',
                        cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1,
                      }}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => <MessageBubble key={m.id} m={m} />)}
            </div>

            {/* Input */}
            <form onSubmit={submit} style={{
              padding: '12px 14px', borderTop: '1px solid rgba(249,115,22,0.12)',
              display: 'flex', alignItems: 'flex-end', gap: 8, background: 'rgba(0,0,0,0.25)',
            }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submit(e); }}
                placeholder="Ask anything, or tell me what to do…"
                rows={1}
                disabled={sending}
                style={{
                  flex: 1, resize: 'none', maxHeight: 120, padding: '10px 12px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, color: 'var(--text-primary)', font: '400 0.9rem/1.4 var(--font-body)', outline: 'none',
                }}
              />
              <button type="submit" disabled={sending || !input.trim()} className="btn btn-primary" style={{
                padding: '10px 12px', display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'linear-gradient(135deg,#f97316,#fbbf24)', border: 'none',
                opacity: (sending || !input.trim()) ? 0.5 : 1, cursor: (sending || !input.trim()) ? 'default' : 'pointer',
              }} aria-label="Send">
                <HiOutlinePaperAirplane size={16} />
              </button>
            </form>

            <style>{`
              @keyframes asstBlink { 50% { opacity: 0; } }
              @keyframes asstPulse { 0%,100% { opacity:0.3; transform:translateY(0);} 50% { opacity:1; transform:translateY(-3px);} }
            `}</style>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function MessageBubble({ m }) {
  const isUser = m.role === 'user';
  const confirmActive = m.confirm && !m.confirm.dismissed;

  return (
    <div style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '90%', padding: '10px 14px',
      background: m.isError ? 'rgba(248,113,113,0.10)'
        : isUser ? 'linear-gradient(135deg,rgba(249,115,22,0.18),rgba(251,191,36,0.10))'
        : 'rgba(255,255,255,0.04)',
      border: m.isError ? '1px solid rgba(248,113,113,0.3)'
        : isUser ? '1px solid rgba(249,115,22,0.25)' : '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12, color: m.isError ? '#fca5a5' : 'var(--text-primary)',
      font: '400 0.88rem/1.55 var(--font-body)', whiteSpace: 'pre-wrap',
    }}>
      {/* Tool badges */}
      {!isUser && Array.isArray(m.tools) && m.tools.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: m.content ? 8 : 0 }}>
          {m.tools.map((t, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px',
              background: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.2)',
              borderRadius: 999, font: '600 0.7rem/1 var(--font-body)', color: 'var(--brand-400)',
            }}>
              <HiOutlineWrenchScrewdriver size={11} />
              {TOOL_LABELS[t.name] || t.name}
            </span>
          ))}
        </div>
      )}

      {/* Live status line while thinking / running tools */}
      {!isUser && m.status && !m.content && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
          <span style={{ display: 'inline-flex', gap: 4 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{
                width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)',
                animation: `asstPulse 1.2s ease-in-out ${i * 0.18}s infinite`,
              }} />
            ))}
          </span>
          {m.status}
        </span>
      )}

      {m.content}
      {m.streaming && m.content && (
        <span style={{
          display: 'inline-block', width: 7, height: 15, marginLeft: 2, verticalAlign: 'middle',
          background: 'var(--brand-400)', borderRadius: 1, animation: 'asstBlink 1s step-start infinite',
        }} />
      )}

      {/* Confirmation card for a proposed write */}
      {confirmActive && <ConfirmCard m={m} />}

      {/* Lesson citations */}
      {!isUser && Array.isArray(m.citations) && m.citations.length > 0 && (
        <div style={{ marginTop: 10, borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {m.citations.map((c) => (
            <div key={`${c.n}`} style={{ font: '400 0.74rem/1.45 var(--font-body)', color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--brand-400)', fontWeight: 600 }}>[{c.n}]</span>{' '}
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{c.lesson_title}</span>
              {' — '}<span style={{ fontStyle: 'italic' }}>"{(c.preview || '').slice(0, 90)}…"</span>
            </div>
          ))}
        </div>
      )}

      {/* Rate the answer — but not a bare confirmation prompt. */}
      {!isUser && !m.isError && !m.streaming && m.content && !confirmActive && (
        <FeedbackBar messageId={m.id} lowConfidence={m.lowConfidence} />
      )}
    </div>
  );
}

function ConfirmCard({ m }) {
  const confirmAction = useAssistantStore((s) => s.confirmAction);
  const dismissConfirm = useAssistantStore((s) => s.dismissConfirm);
  const c = m.confirm;

  if (c.done) {
    return (
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, color: '#4ade80', font: '600 0.8rem/1.3 var(--font-body)' }}>
        <HiOutlineCheckCircle size={16} /> Done{c.result?.title ? ` — enrolled in ${c.result.title}` : ''}.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.22)', borderRadius: 10 }}>
      <div style={{ font: '600 0.82rem/1.4 var(--font-body)', color: 'var(--text-primary)', marginBottom: 8 }}>
        {c.summary || 'Confirm this action?'}
      </div>
      {c.error && <div style={{ color: '#fca5a5', font: '400 0.76rem/1.4 var(--font-body)', marginBottom: 8 }}>{c.error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => confirmAction(m.id, c)} disabled={c.running} style={{
          padding: '6px 14px', background: 'linear-gradient(135deg,#f97316,#fbbf24)', color: '#0a0a0a',
          border: 'none', borderRadius: 8, font: '700 0.78rem/1 var(--font-display)', cursor: c.running ? 'default' : 'pointer', opacity: c.running ? 0.6 : 1,
        }}>
          {c.running ? 'Working…' : 'Confirm'}
        </button>
        <button onClick={() => dismissConfirm(m.id)} disabled={c.running} style={{
          padding: '6px 14px', background: 'transparent', color: 'var(--text-secondary)',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, font: '600 0.78rem/1 var(--font-body)', cursor: 'pointer',
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
