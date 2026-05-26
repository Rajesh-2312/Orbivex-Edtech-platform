import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiXMark, HiOutlineSparkles, HiOutlinePaperAirplane,
  HiOutlineBookOpen,
} from 'react-icons/hi2';
import useTutorStore from '../../store/tutorStore';

const STARTER_PROMPTS = [
  'Summarize this lesson in 5 bullet points',
  'Explain the most important concept here',
  'Give me a worked example I can study',
];

export default function TutorChat({ lessonId, lessonTitle }) {
  const open       = useTutorStore((s) => s.open);
  const setOpen    = useTutorStore((s) => s.setOpen);
  const messages   = useTutorStore((s) => s.messagesByLesson[lessonId] || []);
  const loading    = useTutorStore((s) => s.loadingByLesson[lessonId]);
  const sending    = useTutorStore((s) => s.sendingByLesson[lessonId]);
  const loadHistory = useTutorStore((s) => s.loadHistory);
  const send       = useTutorStore((s) => s.send);

  const [input, setInput] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (open && lessonId) loadHistory(lessonId);
  }, [open, lessonId, loadHistory]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, sending]);

  const submit = (e) => {
    e?.preventDefault?.();
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    send(lessonId, text);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
              zIndex: 1100,
            }}
          />
          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            style={{
              position: 'fixed', top: 0, right: 0, height: '100vh',
              width: 'min(440px, 92vw)',
              background: 'var(--bg-secondary, #141414)',
              borderLeft: '1px solid rgba(249,115,22,0.15)',
              boxShadow: '-16px 0 48px rgba(0,0,0,0.6)',
              zIndex: 1101,
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px 18px',
              borderBottom: '1px solid rgba(249,115,22,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'linear-gradient(135deg,#ea580c,#fbbf24)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <HiOutlineSparkles size={18} color="#0a0a0a" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: '700 0.95rem/1.1 var(--font-display)', color: 'var(--text-primary)' }}>
                    Ask Tutor
                  </div>
                  <div style={{
                    font: '400 0.74rem/1.2 var(--font-body)', color: 'var(--text-muted)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    Grounded in: {lessonTitle || 'this lesson'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="btn btn-icon btn-ghost"
                aria-label="Close tutor"
                style={{ display: 'flex' }}
              >
                <HiXMark size={20} />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={listRef}
              style={{
                flex: 1, overflowY: 'auto', padding: '18px',
                display: 'flex', flexDirection: 'column', gap: 14,
              }}
            >
              {loading && messages.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      height: 48, borderRadius: 10,
                      background: 'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.07), rgba(255,255,255,0.04))',
                      backgroundSize: '200% 100%',
                      animation: 'tutorShimmer 1.4s ease-in-out infinite',
                    }} />
                  ))}
                </div>
              )}

              {!loading && messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '12px 6px' }}>
                  <HiOutlineBookOpen size={28} style={{ color: 'var(--brand-400)', marginBottom: 8 }} />
                  <div style={{ font: '600 0.95rem/1.3 var(--font-display)', color: 'var(--text-primary)', marginBottom: 6 }}>
                    Ask anything about this lesson
                  </div>
                  <div style={{ font: '400 0.82rem/1.5 var(--font-body)', color: 'var(--text-muted)', marginBottom: 14 }}>
                    The tutor only uses this lesson's content and cites every claim.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {STARTER_PROMPTS.map((p) => (
                      <button
                        key={p}
                        onClick={() => send(lessonId, p)}
                        disabled={sending}
                        style={{
                          textAlign: 'left',
                          padding: '10px 12px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: 10, color: 'var(--text-secondary)',
                          font: '500 0.84rem/1.3 var(--font-body)',
                          cursor: sending ? 'default' : 'pointer',
                          opacity: sending ? 0.6 : 1,
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <MessageBubble key={m.id} m={m} />
              ))}

              {sending && (
                <div style={{
                  alignSelf: 'flex-start', padding: '10px 14px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12, font: '400 0.82rem/1 var(--font-body)',
                  color: 'var(--text-muted)',
                }}>
                  Tutor is thinking…
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={submit} style={{
              padding: '12px 14px', borderTop: '1px solid rgba(249,115,22,0.12)',
              display: 'flex', alignItems: 'flex-end', gap: 8, background: 'rgba(0,0,0,0.25)',
            }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) submit(e);
                }}
                placeholder="Ask about this lesson…"
                rows={1}
                disabled={sending}
                style={{
                  flex: 1, resize: 'none', maxHeight: 120,
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, color: 'var(--text-primary)',
                  font: '400 0.9rem/1.4 var(--font-body)',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="btn btn-primary"
                style={{
                  padding: '10px 12px',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'linear-gradient(135deg,#f97316,#fbbf24)',
                  border: 'none',
                  opacity: (sending || !input.trim()) ? 0.5 : 1,
                  cursor: (sending || !input.trim()) ? 'default' : 'pointer',
                }}
                aria-label="Send"
              >
                <HiOutlinePaperAirplane size={16} />
              </button>
            </form>

            <style>{`
              @keyframes tutorShimmer {
                0%   { background-position: 200% 0; }
                100% { background-position: -200% 0; }
              }
            `}</style>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function MessageBubble({ m }) {
  const isUser = m.role === 'user';
  return (
    <div style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '88%',
      padding: '10px 14px',
      background: m.isError
        ? 'rgba(248,113,113,0.10)'
        : isUser
          ? 'linear-gradient(135deg,rgba(249,115,22,0.18),rgba(251,191,36,0.10))'
          : 'rgba(255,255,255,0.04)',
      border: m.isError
        ? '1px solid rgba(248,113,113,0.3)'
        : isUser
          ? '1px solid rgba(249,115,22,0.25)'
          : '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12,
      color: m.isError ? '#fca5a5' : 'var(--text-primary)',
      font: '400 0.88rem/1.55 var(--font-body)',
      whiteSpace: 'pre-wrap',
    }}>
      {m.content}
      {!isUser && Array.isArray(m.citations) && m.citations.length > 0 && (
        <div style={{
          marginTop: 10,
          borderTop: '1px dashed rgba(255,255,255,0.08)',
          paddingTop: 8,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {m.citations.map((c) => (
            <div key={`${c.n}-${c.chunk_index}`} style={{
              font: '400 0.74rem/1.45 var(--font-body)',
              color: 'var(--text-muted)',
            }}>
              <span style={{ color: 'var(--brand-400)', fontWeight: 600 }}>[{c.n}]</span>{' '}
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{c.lesson_title}</span>
              {' — '}
              <span style={{ fontStyle: 'italic' }}>"{c.preview}"</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
