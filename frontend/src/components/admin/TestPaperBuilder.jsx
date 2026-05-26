import { useState, useEffect } from 'react';
import {
  HiOutlinePlus, HiOutlineTrash, HiOutlineMagnifyingGlass,
  HiOutlineChevronDown, HiOutlineChevronRight, HiOutlineAcademicCap,
  HiOutlineBuildingOffice2, HiOutlineArrowDownTray,
} from 'react-icons/hi2';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import api from '../../lib/api';

// Shuffle array and pick first N
function sampleN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

// ─── Topic row (subject → topic → question count + bulk-add) ──────────────
function TopicRow({ subject, topic, topicQuestions, onBulkAdd, alreadyAdded }) {
  const [n, setN] = useState(Math.min(5, topicQuestions.length));
  const easy   = topicQuestions.filter((q) => q.difficulty_level === 'easy').length;
  const medium = topicQuestions.filter((q) => q.difficulty_level === 'medium').length;
  const hard   = topicQuestions.filter((q) => q.difficulty_level === 'hard').length;
  const available = topicQuestions.filter((q) => !alreadyAdded.has(q.id)).length;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 14px',
      borderBottom: '1px solid var(--border-color)',
      flexWrap: 'wrap',
    }}>
      {/* Topic name */}
      <div style={{ flex: 1, minWidth: '140px' }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'capitalize' }}>{topic}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
          {available} available
          {alreadyAdded.size > 0 && topicQuestions.length !== available
            ? ` (${topicQuestions.length - available} already added)`
            : ''}
        </div>
      </div>

      {/* Difficulty breakdown pills */}
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        {easy > 0   && <span style={pill('#10b981')}>E:{easy}</span>}
        {medium > 0 && <span style={pill('#f59e0b')}>M:{medium}</span>}
        {hard > 0   && <span style={pill('#ef4444')}>H:{hard}</span>}
      </div>

      {/* N picker */}
      <input
        type="number"
        min={1}
        max={topicQuestions.length}
        value={n}
        onChange={(e) => setN(Math.min(topicQuestions.length, Math.max(1, parseInt(e.target.value) || 1)))}
        style={{
          width: '52px',
          padding: '5px 6px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          color: 'inherit',
          textAlign: 'center',
          fontSize: '0.85rem',
        }}
      />
      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', flexShrink: 0 }}>of {topicQuestions.length}</span>

      {/* Add button */}
      <button
        onClick={() => onBulkAdd(topicQuestions, n)}
        disabled={available === 0}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '5px 12px',
          borderRadius: '6px',
          border: 'none',
          cursor: available === 0 ? 'not-allowed' : 'pointer',
          background: available === 0 ? 'var(--surface-2)' : 'rgba(99,102,241,0.15)',
          color: available === 0 ? 'var(--text-secondary)' : 'var(--primary-400,#818cf8)',
          fontWeight: 600,
          fontSize: '0.8rem',
          flexShrink: 0,
        }}
      >
        <HiOutlineArrowDownTray size={14} />
        Add {n}
      </button>
    </div>
  );
}

function pill(color) {
  return {
    padding: '1px 7px',
    borderRadius: '999px',
    fontSize: '0.7rem',
    fontWeight: 700,
    background: `${color}22`,
    border: `1px solid ${color}55`,
    color,
  };
}

export default function TestPaperBuilder({ testPaperId, addToast, onClose }) {
  const [selected, setSelected] = useState([]);  // questions added to paper
  const [bankQuestions, setBankQuestions] = useState([]);
  const [mode, setMode] = useState('topic'); // 'topic' | 'search'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [collapsedSubjects, setCollapsedSubjects] = useState({});

  useEffect(() => { loadBank(); }, [filterType, filterDifficulty]);

  const loadBank = async () => {
    try {
      const params = new URLSearchParams();
      if (filterType)       params.set('test_type', filterType);
      if (filterDifficulty) params.set('difficulty_level', filterDifficulty);
      const res = await api.get(`/admin/question-bank?${params}`);
      setBankQuestions(res.data.data || []);
    } catch { /* ignore */ }
  };

  // ─── Selection helpers ───────────────────────────────────────────────────
  const alreadyAdded = new Set(selected.map((q) => q.question_id));

  const addOne = (q) => {
    if (alreadyAdded.has(q.id)) { addToast('Already added', 'warning'); return; }
    setSelected((prev) => [
      ...prev,
      { question_id: q.id, question_text: q.question_text, question_type: q.question_type,
        difficulty_level: q.difficulty_level, marks: 1, sort_order: prev.length + 1 },
    ]);
  };

  const bulkAdd = (pool, n) => {
    const fresh = pool.filter((q) => !alreadyAdded.has(q.id));
    const picked = sampleN(fresh, n);
    if (picked.length === 0) { addToast('All questions from this topic already added', 'warning'); return; }
    setSelected((prev) => [
      ...prev,
      ...picked.map((q, i) => ({
        question_id: q.id, question_text: q.question_text, question_type: q.question_type,
        difficulty_level: q.difficulty_level, marks: 1, sort_order: prev.length + i + 1,
      })),
    ]);
    addToast(`Added ${picked.length} question${picked.length !== 1 ? 's' : ''}`, 'success');
  };

  const remove = (qId) => setSelected((prev) => prev.filter((q) => q.question_id !== qId));
  const updateMarks = (qId, marks) =>
    setSelected((prev) => prev.map((q) => q.question_id === qId ? { ...q, marks: parseInt(marks) || 1 } : q));

  const save = async () => {
    if (selected.length === 0) { addToast('Add at least one question', 'error'); return; }
    try {
      await api.post(`/admin/test-papers/${testPaperId}/add-questions`, {
        questions: selected.map((q, i) => ({ question_id: q.question_id, marks: q.marks, sort_order: i + 1 })),
      });
      addToast(`${selected.length} questions saved to test`, 'success');
      if (onClose) onClose();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  // ─── Group by subject (course) → topic (category) ───────────────────────
  const subjectMap = bankQuestions.reduce((acc, q) => {
    const subject = q.courses?.title || 'General';
    const topic   = (q.category || 'general').toLowerCase();
    if (!acc[subject]) acc[subject] = {};
    if (!acc[subject][topic]) acc[subject][topic] = [];
    acc[subject][topic].push(q);
    return acc;
  }, {});

  // Separate academic vs company-specific for the topic view
  const academicSubjects = {};
  const companySubjects  = {};
  bankQuestions.forEach((q) => {
    const subject = q.courses?.title || 'General';
    const topic   = (q.category || 'general').toLowerCase();
    if (q.test_type === 'company-specific') {
      const key = q.company_name || 'Unknown';
      if (!companySubjects[key]) companySubjects[key] = {};
      if (!companySubjects[key][topic]) companySubjects[key][topic] = [];
      companySubjects[key][topic].push(q);
    } else {
      if (!academicSubjects[subject]) academicSubjects[subject] = {};
      if (!academicSubjects[subject][topic]) academicSubjects[subject][topic] = [];
      academicSubjects[subject][topic].push(q);
    }
  });

  const toggleSubject = (key) =>
    setCollapsedSubjects((p) => ({ ...p, [key]: !p[key] }));

  // ─── Filtered list for search mode ──────────────────────────────────────
  const filtered = bankQuestions.filter((q) =>
    !searchTerm || q.question_text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalMarks = selected.reduce((s, q) => s + (q.marks || 0), 0);

  // ─── SubjectBlock component (inline) ─────────────────────────────────────
  const SubjectBlock = ({ subjectName, topicMap, accentRgb = '99,102,241', companyMode = false }) => {
    const totalQ = Object.values(topicMap).flat().length;
    const isOpen = !collapsedSubjects[subjectName];
    return (
      <div style={{ border: `1px solid rgba(${accentRgb},0.2)`, borderRadius: '10px', marginBottom: '10px', overflow: 'hidden' }}>
        <button
          onClick={() => toggleSubject(subjectName)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 14px', background: `rgba(${accentRgb},0.07)`,
            border: 'none', cursor: 'pointer', color: 'inherit', textAlign: 'left',
          }}
        >
          {companyMode
            ? <HiOutlineBuildingOffice2 size={16} style={{ color: `rgb(${accentRgb})`, flexShrink: 0 }} />
            : <HiOutlineAcademicCap    size={16} style={{ color: `rgb(${accentRgb})`, flexShrink: 0 }} />}
          <span style={{ fontWeight: 700, fontSize: '0.88rem', flex: 1 }}>{subjectName}</span>
          <span style={{
            fontSize: '0.72rem', padding: '1px 8px', borderRadius: '999px',
            background: `rgba(${accentRgb},0.15)`, color: `rgb(${accentRgb})`, fontWeight: 600,
          }}>
            {totalQ} Q
          </span>
          {isOpen ? <HiOutlineChevronDown size={15} style={{ color: 'var(--text-secondary)' }} />
                  : <HiOutlineChevronRight size={15} style={{ color: 'var(--text-secondary)' }} />}
        </button>
        {isOpen && Object.entries(topicMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([topic, qs]) => (
            <TopicRow
              key={topic}
              subject={subjectName}
              topic={topic}
              topicQuestions={qs}
              onBulkAdd={bulkAdd}
              alreadyAdded={alreadyAdded}
            />
          ))}
      </div>
    );
  };

  return (
    <div>
      {/* ─── Selected Questions ─── */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h4 style={{ margin: 0 }}>Selected Questions ({selected.length})</h4>
          <Badge variant="primary">Total: {totalMarks} marks</Badge>
        </div>

        {selected.length === 0 ? (
          <div className="text-muted" style={{ fontSize: '0.85rem' }}>
            No questions yet. Use topic picker or search below to add questions.
          </div>
        ) : (
          <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            {selected.map((q, i) => (
              <div key={q.question_id} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 12px', borderBottom: i < selected.length - 1 ? '1px solid var(--border-color)' : 'none',
              }}>
                <span className="text-muted" style={{ minWidth: '22px', fontSize: '0.78rem' }}>{i + 1}.</span>
                <span style={{ flex: 1, fontSize: '0.82rem' }}>
                  {q.question_text.substring(0, 80)}{q.question_text.length > 80 ? '…' : ''}
                </span>
                <Badge variant={q.difficulty_level === 'hard' ? 'danger' : q.difficulty_level === 'medium' ? 'warning' : 'success'}>
                  {q.difficulty_level || 'med'}
                </Badge>
                <input
                  type="number" min="1" value={q.marks}
                  onChange={(e) => updateMarks(q.question_id, e.target.value)}
                  style={{
                    width: '46px', background: 'var(--surface-2)', border: '1px solid var(--border-color)',
                    borderRadius: '6px', padding: '3px', color: 'inherit', textAlign: 'center', fontSize: '0.82rem',
                  }}
                />
                <span className="text-muted" style={{ fontSize: '0.72rem' }}>mk</span>
                <button className="admin-icon-btn danger" onClick={() => remove(q.question_id)}>
                  <HiOutlineTrash size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Mode toggle ─── */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
          <button
            className={`admin-tab ${mode === 'topic' ? 'active' : ''}`}
            onClick={() => setMode('topic')}
          >
            By Topic
          </button>
          <button
            className={`admin-tab ${mode === 'search' ? 'active' : ''}`}
            onClick={() => setMode('search')}
          >
            Search / Browse
          </button>
        </div>

        {/* ─── TOPIC PICKER ─── */}
        {mode === 'topic' && (
          <div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
              Expand a subject, then set how many questions to pull from each topic. Questions are randomly sampled.
            </p>

            {/* Academic subjects */}
            {Object.keys(academicSubjects).length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Academic
                </div>
                {Object.entries(academicSubjects)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([subject, topicMap]) => (
                    <SubjectBlock key={subject} subjectName={subject} topicMap={topicMap} accentRgb="99,102,241" />
                  ))}
              </div>
            )}

            {/* Company-specific subjects */}
            {Object.keys(companySubjects).length > 0 && (
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Company Specific
                </div>
                {Object.entries(companySubjects)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([company, topicMap]) => (
                    <SubjectBlock key={company} subjectName={company} topicMap={topicMap} accentRgb="245,158,11" companyMode />
                  ))}
              </div>
            )}

            {Object.keys(academicSubjects).length === 0 && Object.keys(companySubjects).length === 0 && (
              <div className="text-muted" style={{ textAlign: 'center', padding: '20px', fontSize: '0.85rem' }}>
                No questions in bank yet. Generate or add questions from the Question Bank tab.
              </div>
            )}
          </div>
        )}

        {/* ─── SEARCH / BROWSE ─── */}
        {mode === 'search' && (
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <HiOutlineMagnifyingGlass size={15} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text" placeholder="Search questions..."
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: '100%', padding: '7px 8px 7px 30px', background: 'var(--surface-2)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'inherit', fontSize: '0.85rem' }}
                />
              </div>
              <select className="admin-select" style={{ width: '120px' }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="">All Types</option>
                <option value="academic">Academic</option>
                <option value="company-specific">Company</option>
              </select>
              <select className="admin-select" style={{ width: '110px' }} value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}>
                <option value="">All Levels</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              {filtered.map((q, i) => (
                <div key={q.id} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 12px',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--border-color)' : 'none',
                  background: alreadyAdded.has(q.id) ? 'rgba(99,102,241,0.05)' : 'transparent',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem' }}>{q.question_text.substring(0, 100)}{q.question_text.length > 100 ? '…' : ''}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {q.courses?.title || '—'} · {q.category || '—'}
                    </div>
                  </div>
                  <Badge variant={q.difficulty_level === 'hard' ? 'danger' : q.difficulty_level === 'medium' ? 'warning' : 'success'}>
                    {q.difficulty_level}
                  </Badge>
                  <button
                    className="admin-icon-btn"
                    title={alreadyAdded.has(q.id) ? 'Already added' : 'Add'}
                    onClick={() => addOne(q)}
                    disabled={alreadyAdded.has(q.id)}
                    style={{ color: alreadyAdded.has(q.id) ? 'var(--text-secondary)' : undefined }}
                  >
                    <HiOutlinePlus size={16} />
                  </button>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="text-muted" style={{ textAlign: 'center', padding: '20px', fontSize: '0.85rem' }}>No questions found</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Save ─── */}
      <Button
        variant="primary" size="lg"
        style={{ width: '100%', marginTop: '16px' }}
        onClick={save}
        disabled={selected.length === 0}
      >
        Save {selected.length} Question{selected.length !== 1 ? 's' : ''} ({totalMarks} marks) to Test
      </Button>
    </div>
  );
}
