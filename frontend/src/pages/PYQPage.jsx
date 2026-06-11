import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';

const TYPE_LABELS = { long: '10-14 M', short: '5-7 M', program: 'Code', diagram: 'Diagram', problem: 'Math' };
const DIFF_COLORS = {
  Easy:   { bg: 'rgba(34,197,94,0.12)',  text: '#22c55e' },
  Medium: { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24' },
  Hard:   { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444' },
};
const UNI_COLORS = {
  'JNTU':           '#6366f1',
  'VTU':            '#f59e0b',
  'Anna University':'#10b981',
};

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

const S = {
  page: {
    padding: '24px 32px', minHeight: '100vh',
    color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif",
  },
  header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 },
  headerIcon: {
    width: 48, height: 48, borderRadius: 14,
    background: 'linear-gradient(135deg,#8b5cf6,#6366f1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0,
  },
  title:    { fontSize: 26, fontWeight: 700, margin: 0 },
  subtitle: { fontSize: 14, color: 'var(--text-secondary)', margin: '2px 0 0' },
  filters: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14, padding: '16px 20px', marginBottom: 20,
    display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center',
  },
  select: {
    padding: '8px 14px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text-primary)', fontSize: 13, outline: 'none',
    fontFamily: "'Outfit', sans-serif",
  },
  searchInput: {
    flex: 1, minWidth: 200, padding: '8px 14px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text-primary)', fontSize: 13, outline: 'none',
  },
  layout: {
    display: 'grid', gridTemplateColumns: '1fr 400px', gap: 20, alignItems: 'start',
  },
  qCard: (selected) => ({
    background: selected ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
    border: `1px solid ${selected ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.07)'}`,
    borderRadius: 12, padding: '16px 18px', marginBottom: 12,
    cursor: 'pointer', transition: 'all 0.18s',
  }),
  metaRow: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 },
  badge: (color, bg) => ({
    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    color, background: bg, border: `1px solid ${color}30`,
  }),
  questionText: { fontSize: 14, fontWeight: 500, lineHeight: 1.6, margin: 0 },
  panel: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14, overflow: 'hidden',
    position: 'sticky', top: 80,
  },
  panelHeader: {
    padding: '14px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  panelTitle: { fontSize: 15, fontWeight: 600, margin: 0 },
  panelBody: { padding: 20, maxHeight: '75vh', overflowY: 'auto' },
  btn: (v) => ({
    padding: '8px 16px', borderRadius: 8, border: 'none',
    cursor: 'pointer', fontWeight: 600, fontSize: 13,
    fontFamily: "'Outfit', sans-serif",
    background:
      v === 'primary' ? 'linear-gradient(135deg,#8b5cf6,#6366f1)'
      : v === 'bookmark' ? 'rgba(245,158,11,0.15)'
      : 'rgba(255,255,255,0.06)',
    color: v === 'primary' ? '#fff' : v === 'bookmark' ? '#fbbf24' : 'var(--text-secondary)',
    transition: 'opacity 0.18s',
  }),
  hintBox: {
    background: 'rgba(99,102,241,0.06)',
    border: '1px solid rgba(99,102,241,0.2)',
    borderRadius: 10, padding: '12px 14px',
    fontSize: 13, color: 'var(--text-secondary)',
    marginBottom: 14, lineHeight: 1.6,
  },
  explanationBox: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 10, padding: '14px 16px',
    fontSize: 13, lineHeight: 1.8, color: 'var(--text-primary)',
    whiteSpace: 'pre-wrap', marginTop: 14,
  },
  emptyState: {
    textAlign: 'center', padding: '40px 20px',
    color: 'var(--text-secondary)', fontSize: 14,
  },
};

export default function PYQPage() {
  const [questions,    setQs]         = useState([]);
  const [meta,         setMeta]       = useState({ subjects: [], universities: [], years: [] });
  const [selected,     setSelected]   = useState(null);
  const [explanation,  setExplan]     = useState('');
  const [explaining,   setExplaining] = useState(false);
  const [bookmarks,    setBookmarks]  = useState(new Set());
  const [loading,      setLoading]    = useState(true);
  const [activeTab,    setActiveTab]  = useState('browse'); // browse | bookmarks
  const [bkList,       setBkList]     = useState([]);

  const [filters, setFilters] = useState({
    subject: '', university: '', year: '', type: '', difficulty: '', search: '',
  });

  // ── Load metadata ───────────────────────────────────────────
  useEffect(() => {
    api.get('/pyq/subjects').then(r => setMeta(r.data.data || {})).catch(() => {});
    api.get('/pyq/bookmarks').then(r => {
      const bks = r.data.data?.bookmarks || [];
      setBookmarks(new Set(bks.map(b => b.question_hash)));
      setBkList(bks);
    }).catch(() => {});
  }, []);

  // ── Load questions ──────────────────────────────────────────
  const fetchQs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
      const res = await api.get(`/pyq/questions?${params}&limit=50`);
      setQs(res.data.data?.questions || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchQs(); }, [fetchQs]);

  const selectQ = (q) => {
    setSelected(q);
    setExplan('');
  };

  const getExplanation = async () => {
    if (!selected || explaining) return;
    setExplaining(true);
    try {
      const res = await api.post('/pyq/explain', {
        question: selected.question,
        subject: selected.subject,
        answer_hint: selected.answer_hint,
        marks: selected.marks,
      });
      setExplan(res.data.data?.explanation || '');
    } catch (e) {
      setExplan('Explanation is temporarily unavailable. Please try again in a moment.');
    } finally {
      setExplaining(false);
    }
  };

  const toggleBookmark = async (q) => {
    const hash = hashStr(q.question);
    const isBookmarked = bookmarks.has(hash);
    try {
      if (isBookmarked) {
        await api.delete(`/pyq/bookmark/${hash}`);
        setBookmarks(b => { const n = new Set(b); n.delete(hash); return n; });
        setBkList(prev => prev.filter(b => b.question_hash !== hash));
      } else {
        await api.post('/pyq/bookmark', {
          question_hash: hash,
          subject: q.subject,
          question: q.question,
          university: q.university,
          year: q.year,
        });
        setBookmarks(b => new Set([...b, hash]));
        setBkList(prev => [{ question_hash: hash, ...q }, ...prev]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: f[k] === v ? '' : v }));

  const displayQs = activeTab === 'bookmarks'
    ? bkList.map(b => ({ id: b.question_hash, ...b }))
    : questions;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.headerIcon}>📚</div>
        <div>
          <h1 style={S.title}>PYQ Bank</h1>
          <p style={S.subtitle}>JNTU · VTU · Anna University — Previous Year Questions with AI explanations</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          {['browse', 'bookmarks'].map(t => (
            <button key={t}
              style={{
                padding: '8px 18px', borderRadius: 10,
                cursor: 'pointer', fontWeight: 600, fontSize: 13,
                fontFamily: "'Outfit', sans-serif",
                background: activeTab === t ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)',
                color: activeTab === t ? '#a78bfa' : 'var(--text-secondary)',
                border: `1px solid ${activeTab === t ? '#8b5cf6' : 'transparent'}`,
              }}
              onClick={() => setActiveTab(t)}
            >
              {t === 'browse' ? '📋 Browse' : `🔖 Bookmarks (${bookmarks.size})`}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      {activeTab === 'browse' && (
        <div style={S.filters}>
          <input
            style={S.searchInput}
            placeholder="🔍 Search questions…"
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && fetchQs()}
          />
          <select style={S.select} value={filters.subject} onChange={e => setFilters(f => ({ ...f, subject: e.target.value }))}>
            <option value="">All Subjects</option>
            {meta.subjects?.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select style={S.select} value={filters.university} onChange={e => setFilters(f => ({ ...f, university: e.target.value }))}>
            <option value="">All Universities</option>
            {meta.universities?.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <select style={S.select} value={filters.year} onChange={e => setFilters(f => ({ ...f, year: e.target.value }))}>
            <option value="">All Years</option>
            {meta.years?.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select style={S.select} value={filters.difficulty} onChange={e => setFilters(f => ({ ...f, difficulty: e.target.value }))}>
            <option value="">All Difficulty</option>
            {['Easy','Medium','Hard'].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}

      {/* Main layout */}
      <div style={S.layout}>
        {/* Question List */}
        <div>
          {loading ? (
            <div style={S.emptyState}>Loading questions…</div>
          ) : displayQs.length === 0 ? (
            <div style={S.emptyState}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📖</div>
              <p>{activeTab === 'bookmarks' ? 'No bookmarks yet. Bookmark questions while browsing.' : 'No questions match your filters.'}</p>
            </div>
          ) : (
            displayQs.map(q => {
              const hash = hashStr(q.question);
              const isSelected = selected?.id === q.id || selected?.question === q.question;
              return (
                <motion.div
                  key={q.id || hash}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={S.qCard(isSelected)}
                  onClick={() => selectQ(q)}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                >
                  <div style={S.metaRow}>
                    {q.university && (
                      <span style={S.badge(UNI_COLORS[q.university] || '#6366f1', `${UNI_COLORS[q.university] || '#6366f1'}15`)}>
                        {q.university}
                      </span>
                    )}
                    {q.year && q.semester && (
                      <span style={S.badge('var(--text-secondary)', 'rgba(255,255,255,0.06)')}>
                        {q.semester} {q.year}
                      </span>
                    )}
                    {q.subject && (
                      <span style={S.badge('#a5b4fc', 'rgba(99,102,241,0.12)')}>{q.subject}</span>
                    )}
                    {q.difficulty && (
                      <span style={S.badge(DIFF_COLORS[q.difficulty]?.text, DIFF_COLORS[q.difficulty]?.bg)}>
                        {q.difficulty}
                      </span>
                    )}
                    {q.marks && (
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>
                        [{q.marks} marks]
                      </span>
                    )}
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}
                      onClick={e => { e.stopPropagation(); toggleBookmark(q); }}
                    >
                      {bookmarks.has(hash) ? '🔖' : '🔘'}
                    </button>
                  </div>
                  <p style={S.questionText}>{q.question}</p>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Detail panel */}
        <div style={S.panel}>
          {selected ? (
            <>
              <div style={S.panelHeader}>
                <p style={S.panelTitle}>📋 Question Detail</p>
                <button
                  style={S.btn('bookmark')}
                  onClick={() => toggleBookmark(selected)}
                >
                  {bookmarks.has(hashStr(selected.question)) ? '🔖 Bookmarked' : '🔘 Bookmark'}
                </button>
              </div>
              <div style={S.panelBody}>
                <div style={S.metaRow}>
                  {selected.university && <span style={S.badge(UNI_COLORS[selected.university] || '#6366f1', `${UNI_COLORS[selected.university] || '#6366f1'}15`)}>{selected.university}</span>}
                  {selected.year && <span style={S.badge('var(--text-secondary)', 'rgba(255,255,255,0.06)')}>{selected.semester} {selected.year}</span>}
                  {selected.subject && <span style={S.badge('#a5b4fc', 'rgba(99,102,241,0.12)')}>{selected.subject}</span>}
                  {selected.marks && <span style={S.badge('#fbbf24', 'rgba(251,191,36,0.12)')}>{selected.marks} marks</span>}
                </div>

                <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.6, margin: '0 0 16px' }}>
                  {selected.question}
                </p>

                {selected.unit && (
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
                    Unit {selected.unit} · {selected.type === 'program' ? '💻 Program question' : selected.type === 'diagram' ? '📊 Diagram question' : '✍️ Theory question'}
                  </p>
                )}

                {/* Hint */}
                {selected.answer_hint && (
                  <div style={S.hintBox}>
                    <strong style={{ display: 'block', marginBottom: 6, color: '#a5b4fc', fontSize: 12 }}>
                      💡 Key Points (Examiner's Notes)
                    </strong>
                    {selected.answer_hint}
                  </div>
                )}

                {/* AI Explanation */}
                <button
                  style={{ ...S.btn('primary'), width: '100%', padding: '11px 18px' }}
                  onClick={getExplanation}
                  disabled={explaining}
                >
                  {explaining ? '🤖 Generating detailed answer…' : '🤖 Get AI Full Explanation'}
                </button>

                {explanation && (
                  <div style={S.explanationBox}>
                    <strong style={{ display: 'block', marginBottom: 10, color: '#a5b4fc', fontSize: 12 }}>
                      🤖 AI Model Answer
                    </strong>
                    {explanation}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ ...S.emptyState, padding: '40px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📖</div>
              <p>Click a question to view details and get AI explanation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
