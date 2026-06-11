import { useState, useEffect } from 'react';
import {
  HiOutlinePlus, HiOutlineTrash, HiOutlineArrowPath,
  HiOutlineDocumentCheck, HiOutlineClipboardDocumentList,
  HiOutlineEye, HiOutlineSparkles, HiOutlineChevronDown,
  HiOutlineChevronRight, HiOutlineAcademicCap, HiOutlineBuildingOffice2,
} from 'react-icons/hi2';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import TestPaperBuilder from './TestPaperBuilder';
import api from '../../lib/api';

// ─── Collapsible section wrapper ───────────────────────────────────────────
function CollapsibleSection({ icon, title, count, badge, defaultOpen = true, children, accentColor = 'var(--primary-500)' }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      marginBottom: '16px',
      border: `1px solid rgba(${accentColor === 'var(--primary-500)' ? '99,102,241' : '245,158,11'},0.25)`,
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '14px 18px',
          background: `rgba(${accentColor === 'var(--primary-500)' ? '99,102,241' : '245,158,11'},0.07)`,
          border: 'none',
          cursor: 'pointer',
          color: 'inherit',
          textAlign: 'left',
        }}
      >
        <span style={{ color: accentColor, display: 'flex' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '1rem', flex: 1 }}>{title}</span>
        <Badge variant={accentColor === 'var(--primary-500)' ? 'primary' : 'warning'}>{count} question{count !== 1 ? 's' : ''}</Badge>
        {badge}
        <span style={{ color: 'var(--text-secondary)', marginLeft: '4px' }}>
          {open ? <HiOutlineChevronDown size={18} /> : <HiOutlineChevronRight size={18} />}
        </span>
      </button>
      {open && <div style={{ padding: '0' }}>{children}</div>}
    </div>
  );
}

// ─── Compact question row ───────────────────────────────────────────────────
function QuestionRow({ q, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const opts = q.answers_json?.options || [];
  const correct = q.answers_json?.correct;
  return (
    <>
      <tr
        onClick={() => setExpanded((e) => !e)}
        style={{ cursor: 'pointer' }}
      >
        <td style={{ maxWidth: '380px' }}>
          <div style={{ fontWeight: 500 }}>
            {q.question_text.substring(0, 80)}{q.question_text.length > 80 ? '…' : ''}
          </div>
        </td>
        <td><Badge variant="primary">{q.question_type}</Badge></td>
        <td>
          <Badge variant={q.difficulty_level === 'hard' ? 'danger' : q.difficulty_level === 'medium' ? 'warning' : 'success'}>
            {q.difficulty_level}
          </Badge>
        </td>
        <td>
          <button className="admin-icon-btn danger" onClick={(e) => { e.stopPropagation(); onDelete(q.id); }}>
            <HiOutlineTrash size={16} />
          </button>
        </td>
      </tr>
      {expanded && opts.length > 0 && (
        <tr>
          <td colSpan={6} style={{ background: 'rgba(0,0,0,0.15)', padding: '10px 18px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: q.answers_json?.explanation ? '6px' : 0 }}>
              {opts.map((opt, i) => (
                <span
                  key={i}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    background: i === correct ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${i === correct ? 'rgba(16,185,129,0.5)' : 'var(--border-color)'}`,
                    color: i === correct ? '#10b981' : 'inherit',
                    fontWeight: i === correct ? 600 : 400,
                  }}
                >
                  {String.fromCharCode(65 + i)}. {opt}
                </span>
              ))}
            </div>
            {q.answers_json?.explanation && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                <strong>Explanation:</strong> {q.answers_json.explanation}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Question mini-table ────────────────────────────────────────────────────
function QuestionTable({ questions, onDelete }) {
  if (questions.length === 0) return (
    <div className="admin-empty" style={{ padding: '20px' }}>No questions yet</div>
  );
  return (
    <table className="admin-table" style={{ margin: 0, borderRadius: 0 }}>
      <thead>
        <tr>
          <th>Question</th>
          <th>Type</th>
          <th>Difficulty</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {questions.map((q) => (
          <QuestionRow key={q.id} q={q} onDelete={onDelete} />
        ))}
      </tbody>
    </table>
  );
}

// ─── Topic block inside a subject ─────────────────────────────────────────
function TopicBlock({ topic, questions, onDelete }) {
  const [open, setOpen] = useState(true);
  const easy   = questions.filter((q) => q.difficulty_level === 'easy').length;
  const medium = questions.filter((q) => q.difficulty_level === 'medium').length;
  const hard   = questions.filter((q) => q.difficulty_level === 'hard').length;

  function pill(color, label) {
    return (
      <span style={{
        padding: '1px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700,
        background: `${color}22`, border: `1px solid ${color}55`, color,
      }}>{label}</span>
    );
  }

  return (
    <div style={{ borderTop: '1px solid var(--border-color)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
          padding: '9px 18px', background: 'rgba(99,102,241,0.03)',
          border: 'none', cursor: 'pointer', color: 'inherit', textAlign: 'left',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.82rem', textTransform: 'capitalize', flex: 1, color: 'var(--text-primary)' }}>
          {topic}
        </span>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {easy > 0   && pill('#10b981', `E:${easy}`)}
          {medium > 0 && pill('#f59e0b', `M:${medium}`)}
          {hard > 0   && pill('#ef4444', `H:${hard}`)}
        </div>
        <span style={{
          fontSize: '0.72rem', padding: '1px 8px', borderRadius: '999px', marginLeft: '4px',
          background: 'rgba(99,102,241,0.12)', color: 'var(--primary-400,#818cf8)', fontWeight: 600,
        }}>
          {questions.length} Q
        </span>
        <span style={{ color: 'var(--text-secondary)', marginLeft: '2px' }}>
          {open ? <HiOutlineChevronDown size={15} /> : <HiOutlineChevronRight size={15} />}
        </span>
      </button>
      {open && <QuestionTable questions={questions} onDelete={onDelete} />}
    </div>
  );
}

// ─── Subject block (groups topics) ─────────────────────────────────────────
function SubjectBlock({ subject, topicMap, onDelete }) {
  const [open, setOpen] = useState(true);
  const total = Object.values(topicMap).flat().length;
  const topics = Object.keys(topicMap).sort();
  return (
    <div style={{ border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', marginBottom: '10px', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
          padding: '12px 16px', background: 'rgba(99,102,241,0.08)',
          border: 'none', cursor: 'pointer', color: 'inherit', textAlign: 'left',
        }}
      >
        <HiOutlineAcademicCap size={18} style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: '0.9rem', flex: 1 }}>{subject}</span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
          {topics.length} topic{topics.length !== 1 ? 's' : ''}
        </span>
        <span style={{
          fontSize: '0.75rem', padding: '2px 10px', borderRadius: '999px',
          background: 'rgba(99,102,241,0.15)', color: 'var(--primary-400,#818cf8)', fontWeight: 600,
        }}>
          {total} Q
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>
          {open ? <HiOutlineChevronDown size={16} /> : <HiOutlineChevronRight size={16} />}
        </span>
      </button>
      {open && topics.map((t) => (
        <TopicBlock key={t} topic={t} questions={topicMap[t]} onDelete={onDelete} />
      ))}
    </div>
  );
}

export default function AdminTestTab({ addToast }) {
  const [activeSubTab, setActiveSubTab] = useState('questions');
  const [questions, setQuestions] = useState([]);
  const [testPapers, setTestPapers] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  // collapsed company groups
  const [collapsedCompanies, setCollapsedCompanies] = useState({});

  // Question form
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [questionForm, setQuestionForm] = useState({
    course_id: '', question_text: '', question_type: 'mcq', difficulty_level: 'medium',
    category: 'technical', test_type: 'academic', company_name: '', answers_json: { options: ['', '', '', ''], correct: 0, explanation: '' },
  });

  // Test paper form
  const [showTestModal, setShowTestModal] = useState(false);
  const [testForm, setTestForm] = useState({
    college_id: '', branch_id: '', section_id: '', course_id: '', title: '', description: '',
    test_type: 'academic', company_name: '', total_marks: '', duration_minutes: '', passing_score: '',
  });
  const [testBranches, setTestBranches] = useState([]);
  const [testSections, setTestSections] = useState([]);

  // AI Generation
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lessons, setLessons] = useState([]);
  const [genForm, setGenForm] = useState({
    mode: 'lesson',
    lesson_id: '', course_id: '', college_id: '',
    content: '', num_questions: 10, difficulty_level: 'medium',
    category: 'technical', test_type: 'academic', company_name: '',
  });
  const [genResult, setGenResult] = useState(null);
  const [genProgress, setGenProgress] = useState(0);
  const [genError, setGenError] = useState(null);

  // Builder / Results
  const [showBuilder, setShowBuilder] = useState(null);
  const [showResults, setShowResults] = useState(null);
  const [results, setResults] = useState([]);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [qRes, tRes, cRes, crRes, lRes] = await Promise.allSettled([
      api.get('/admin/question-bank'),
      api.get('/admin/test-papers'),
      api.get('/admin/colleges'),
      api.get('/admin/courses'),
      api.get('/admin/lessons'),
    ]);
    if (qRes.status === 'fulfilled') setQuestions(qRes.value.data.data || []);
    if (tRes.status === 'fulfilled') setTestPapers(tRes.value.data.data || []);
    if (cRes.status === 'fulfilled') setColleges(cRes.value.data.data || []);
    if (crRes.status === 'fulfilled') setCourses(crRes.value.data.data || []);
    if (lRes.status === 'fulfilled') setLessons(lRes.value.data.data || []);
    setLoading(false);
  };

  // ─── Derived data ───────────────────────────────────────────────────────────
  const academicQuestions = questions.filter((q) => q.test_type === 'academic');
  const companyQuestions  = questions.filter((q) => q.test_type === 'company-specific');

  // Group company questions by company_name (normalised to lowercase for grouping)
  const byCompany = companyQuestions.reduce((acc, q) => {
    const key = (q.company_name || 'Unknown').trim();
    if (!acc[key]) acc[key] = [];
    acc[key].push(q);
    return acc;
  }, {});
  const companyNames = Object.keys(byCompany).sort();

  // ─── AI Generation ──────────────────────────────────────────────────────────
  const generateQuestions = async () => {
    if (genForm.mode === 'lesson' && !genForm.lesson_id) {
      addToast('Select a lesson', 'error'); return;
    }
    if (genForm.mode === 'custom' && (!genForm.content || genForm.content.trim().length < 50)) {
      addToast('Provide at least 50 characters of content', 'error'); return;
    }

    setGenerating(true);
    setGenResult(null);
    setGenError(null);
    setGenProgress(0);

    const target = genForm.num_questions;
    const estPerQ = 4500;
    const startedAt = Date.now();
    const cap = target - 0.5;
    const tick = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const expected = Math.min(cap, (elapsed / estPerQ));
      setGenProgress((p) => Math.min(cap, Math.max(p, expected)));
    }, 250);

    try {
      let res;
      if (genForm.mode === 'lesson') {
        res = await api.post('/admin/question-bank/generate-from-lesson', {
          lesson_id: genForm.lesson_id,
          college_id: genForm.college_id || null,
          num_questions: genForm.num_questions,
          difficulty_level: genForm.difficulty_level,
          category: genForm.category,
          test_type: genForm.test_type,
          company_name: genForm.test_type === 'company-specific' ? genForm.company_name : null,
        });
      } else {
        res = await api.post('/admin/question-bank/generate', {
          content: genForm.content,
          course_id: genForm.course_id || null,
          college_id: genForm.college_id || null,
          num_questions: genForm.num_questions,
          difficulty_level: genForm.difficulty_level,
          category: genForm.category,
          test_type: genForm.test_type,
          company_name: genForm.test_type === 'company-specific' ? genForm.company_name : null,
        });
      }
      const result = res.data.data;
      setGenProgress(target);
      setGenResult(result);
      addToast(`Generated ${result.generated} questions, saved ${result.saved} to bank`, 'success');
      await loadAll();
      setTimeout(() => setShowGenerateModal(false), 900);
    } catch (err) {
      const raw = err.response?.data?.error || err.message || 'AI generation failed';
      let hint = null;
      if (/more system memory|requires more/i.test(raw)) {
        hint = 'The AI service is under heavy load right now. Please try again in a moment — if it keeps happening, contact Orbivex support.';
      } else if (/model .* not found|pull model/i.test(raw)) {
        hint = 'The AI service is still warming up. Please try again shortly, or contact Orbivex support if it continues.';
      } else if (/ECONNREFUSED|ollama|fetch failed/i.test(raw)) {
        hint = 'The AI service is temporarily unavailable. Please try again in a moment — our team is notified automatically.';
      } else if (/invalid quiz format|JSON/i.test(raw)) {
        hint = 'The AI returned an unexpected response. Please try again, or generate fewer questions at a time.';
      }
      setGenError({ message: raw, hint });
      addToast(raw, 'error');
    } finally {
      clearInterval(tick);
      setGenerating(false);
    }
  };

  // ─── Question CRUD ──────────────────────────────────────────────────────────
  const resetQuestionForm = () => setQuestionForm({
    course_id: '', question_text: '', question_type: 'mcq', difficulty_level: 'medium',
    category: 'technical', test_type: 'academic', company_name: '', answers_json: { options: ['', '', '', ''], correct: 0, explanation: '' },
  });

  const saveQuestion = async () => {
    if (!questionForm.question_text.trim()) { addToast('Question text is required', 'error'); return; }
    try {
      await api.post('/admin/question-bank', questionForm);
      addToast('Question added', 'success');
      setShowQuestionModal(false);
      resetQuestionForm();
      loadAll();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const deleteQuestion = async (id) => {
    if (!confirm('Delete this question?')) return;
    try {
      await api.delete(`/admin/question-bank/${id}`);
      addToast('Question deleted', 'success');
      loadAll();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const updateOption = (idx, value) => {
    const opts = [...questionForm.answers_json.options];
    opts[idx] = value;
    setQuestionForm({ ...questionForm, answers_json: { ...questionForm.answers_json, options: opts } });
  };

  // ─── Test Papers ────────────────────────────────────────────────────────────
  const resetTestForm = () => {
    setTestForm({ college_id: '', branch_id: '', section_id: '', course_id: '', title: '', description: '',
      test_type: 'academic', company_name: '', total_marks: '', duration_minutes: '', passing_score: '' });
    setTestBranches([]);
    setTestSections([]);
  };

  const onTestCollegeChange = async (collegeId) => {
    setTestForm((f) => ({ ...f, college_id: collegeId, branch_id: '', section_id: '' }));
    setTestBranches([]);
    setTestSections([]);
    if (!collegeId) return;
    try {
      const res = await api.get(`/admin/colleges/${collegeId}/branches`);
      setTestBranches(res.data.data || []);
    } catch { /* ignore */ }
  };

  const onTestBranchChange = (branchId) => {
    setTestForm((f) => ({ ...f, branch_id: branchId, section_id: '' }));
    const branch = testBranches.find((b) => b.id === branchId);
    setTestSections(branch?.sections || []);
  };

  const saveTestPaper = async () => {
    if (!testForm.title.trim()) { addToast('Test title is required', 'error'); return; }
    if (!testForm.college_id)   { addToast('Select a college', 'error'); return; }
    if (!testForm.total_marks)  { addToast('Total marks is required', 'error'); return; }
    if (!testForm.duration_minutes) { addToast('Duration is required', 'error'); return; }
    // Convert empty strings to null for UUID / numeric fields — PostgreSQL rejects ''
    const payload = {
      ...testForm,
      branch_id:        testForm.branch_id        || null,
      section_id:       testForm.section_id       || null,
      course_id:        testForm.course_id        || null,
      company_name:     testForm.company_name     || null,
      passing_score:    testForm.passing_score    || null,
      total_marks:      testForm.total_marks      || null,
      duration_minutes: testForm.duration_minutes || null,
    };
    try {
      await api.post('/admin/test-papers', payload);
      addToast('Test paper created', 'success');
      setShowTestModal(false);
      resetTestForm();
      loadAll();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const publishTest = async (id) => {
    try {
      await api.post(`/admin/test-papers/${id}/publish`);
      addToast('Test published', 'success');
      loadAll();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const deleteTest = async (id) => {
    if (!confirm('Delete this test paper?')) return;
    try {
      await api.delete(`/admin/test-papers/${id}`);
      addToast('Test deleted', 'success');
      loadAll();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const viewResults = async (id) => {
    try {
      const res = await api.get(`/admin/test-papers/${id}/results`);
      setResults(res.data.data || []);
      setShowResults(id);
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  if (loading) return <div className="admin-loading">Loading...</div>;

  // ── Shared style helpers for the test-paper form ──
  const inputStyle = {
    width: '100%', padding: '8px 12px',
    background: 'var(--surface-2)', border: '1px solid var(--border-color)',
    borderRadius: '8px', color: 'inherit', fontSize: '0.9rem',
  };
  const sectionStyle = (color) => ({
    padding: '14px 16px', borderRadius: '12px', marginBottom: '12px',
    background: `${color}09`, border: `1px solid ${color}25`,
  });
  const sectionLabel = {
    display: 'flex', alignItems: 'center', gap: '7px',
    fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase',
    letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '10px',
  };
  const sectionDot = (color) => ({
    width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0,
  });

  return (
    <>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button className={`admin-tab ${activeSubTab === 'questions' ? 'active' : ''}`} onClick={() => setActiveSubTab('questions')}>
          <HiOutlineClipboardDocumentList size={16} /> Question Bank ({questions.length})
        </button>
        <button className={`admin-tab ${activeSubTab === 'tests' ? 'active' : ''}`} onClick={() => setActiveSubTab('tests')}>
          <HiOutlineDocumentCheck size={16} /> Test Papers ({testPapers.length})
        </button>
      </div>

      {/* ─── QUESTION BANK ─── */}
      {activeSubTab === 'questions' && (
        <div>
          {/* Toolbar */}
          <div className="admin-table-header" style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>{questions.length} Questions in Bank</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="ghost" size="sm" onClick={loadAll}><HiOutlineArrowPath size={16} /></Button>
              <Button variant="ghost" size="sm" onClick={() => { setGenResult(null); setShowGenerateModal(true); }}>
                <HiOutlineSparkles size={16} /> AI Generate
              </Button>
              <Button variant="primary" size="sm" onClick={() => { resetQuestionForm(); setShowQuestionModal(true); }}>
                <HiOutlinePlus size={16} /> Add Question
              </Button>
            </div>
          </div>

          {questions.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              background: 'var(--surface-2)',
              borderRadius: '12px',
              border: '1px dashed var(--border-color)',
            }}>
              <HiOutlineClipboardDocumentList size={48} style={{ color: 'var(--text-secondary)', marginBottom: '12px' }} />
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>No questions in bank yet</div>
              <div className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
                Use AI Generate to create questions from lesson content, or add them manually.
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <Button variant="ghost" size="sm" onClick={() => { setGenResult(null); setShowGenerateModal(true); }}>
                  <HiOutlineSparkles size={16} /> AI Generate
                </Button>
                <Button variant="primary" size="sm" onClick={() => { resetQuestionForm(); setShowQuestionModal(true); }}>
                  <HiOutlinePlus size={16} /> Add Manually
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* ── Block 1: Academic (Subject → Topic hierarchy) ── */}
              <CollapsibleSection
                icon={<HiOutlineAcademicCap size={22} />}
                title="Academic"
                count={academicQuestions.length}
                accentColor="var(--primary-500)"
                defaultOpen={true}
              >
                {(() => {
                  // Group academic questions by subject (course title) → topic (category)
                  const subjectMap = {};
                  academicQuestions.forEach((q) => {
                    const subject = q.courses?.title || 'General';
                    const topic   = (q.category || 'general').toLowerCase();
                    if (!subjectMap[subject]) subjectMap[subject] = {};
                    if (!subjectMap[subject][topic]) subjectMap[subject][topic] = [];
                    subjectMap[subject][topic].push(q);
                  });
                  const subjects = Object.keys(subjectMap).sort();
                  return subjects.length === 0
                    ? <div className="admin-empty" style={{ padding: '20px' }}>No academic questions yet</div>
                    : (
                      <div style={{ padding: '12px' }}>
                        {subjects.map((s) => (
                          <SubjectBlock key={s} subject={s} topicMap={subjectMap[s]} onDelete={deleteQuestion} />
                        ))}
                      </div>
                    );
                })()}
              </CollapsibleSection>

              {/* ── Block 2: Company Specific ── */}
              <CollapsibleSection
                icon={<HiOutlineBuildingOffice2 size={22} />}
                title="Company Specific"
                count={companyQuestions.length}
                accentColor="var(--warning-500, #f59e0b)"
                defaultOpen={true}
              >
                {companyNames.length === 0 ? (
                  <div className="admin-empty" style={{ padding: '20px' }}>No company-specific questions yet</div>
                ) : (
                  companyNames.map((company) => {
                    const qs = byCompany[company];
                    const isOpen = !collapsedCompanies[company];
                    return (
                      <div key={company} style={{ borderTop: '1px solid var(--border-color)' }}>
                        {/* Company header */}
                        <button
                          onClick={() => setCollapsedCompanies((prev) => ({ ...prev, [company]: !prev[company] }))}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 18px',
                            background: 'rgba(245,158,11,0.04)',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'inherit',
                            textAlign: 'left',
                          }}
                        >
                          <span style={{ color: '#f59e0b', display: 'flex' }}>
                            <HiOutlineBuildingOffice2 size={16} />
                          </span>
                          <span style={{ fontWeight: 600, flex: 1 }}>{company}</span>
                          <span style={{
                            fontSize: '0.78rem',
                            padding: '2px 10px',
                            borderRadius: '999px',
                            background: 'rgba(245,158,11,0.15)',
                            color: '#f59e0b',
                            fontWeight: 600,
                          }}>
                            {qs.length} question{qs.length !== 1 ? 's' : ''}
                          </span>
                          <span style={{ color: 'var(--text-secondary)', marginLeft: '4px' }}>
                            {isOpen ? <HiOutlineChevronDown size={16} /> : <HiOutlineChevronRight size={16} />}
                          </span>
                        </button>

                        {/* Company questions table */}
                        {isOpen && (
                          <QuestionTable questions={qs} onDelete={deleteQuestion} />
                        )}
                      </div>
                    );
                  })
                )}
              </CollapsibleSection>
            </>
          )}
        </div>
      )}

      {/* ─── TEST PAPERS ─── */}
      {activeSubTab === 'tests' && (
        <div className="admin-table-wrap">
          <div className="admin-table-header">
            <h3>{testPapers.length} Test Papers</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="ghost" size="sm" onClick={loadAll}><HiOutlineArrowPath size={16} /></Button>
              <Button variant="primary" size="sm" onClick={() => { resetTestForm(); setShowTestModal(true); }}>
                <HiOutlinePlus size={16} /> Create Test
              </Button>
            </div>
          </div>

          {testPapers.map((t) => (
            <div key={t.id} className="glass-card-static" style={{ padding: '16px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong>{t.title}</strong>
                    <Badge variant={t.status === 'completed' ? 'success' : t.status === 'active' ? 'warning' : t.status === 'scheduled' ? 'primary' : 'danger'}>{t.status}</Badge>
                    <Badge variant={t.test_type === 'company-specific' ? 'warning' : 'primary'}>{t.test_type}{t.company_name ? ` — ${t.company_name}` : ''}</Badge>
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                    {t.colleges?.name || '—'} · {t.courses?.title || 'No course'} · {t.total_marks || '—'} marks · {t.duration_minutes || '—'} min
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <Button variant="ghost" size="sm" onClick={() => setShowBuilder(showBuilder === t.id ? null : t.id)}>
                    <HiOutlinePlus size={14} /> Questions
                  </Button>
                  {!t.is_published && (
                    <Button variant="primary" size="sm" onClick={() => publishTest(t.id)}>Publish</Button>
                  )}
                  <button className="admin-icon-btn" title="Results" onClick={() => viewResults(t.id)}><HiOutlineEye size={16} /></button>
                  <button className="admin-icon-btn danger" title="Delete" onClick={() => deleteTest(t.id)}><HiOutlineTrash size={16} /></button>
                </div>
              </div>

              {showBuilder === t.id && (
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <TestPaperBuilder testPaperId={t.id} addToast={addToast} onClose={() => setShowBuilder(null)} />
                </div>
              )}
            </div>
          ))}

          {testPapers.length === 0 && <div className="admin-empty">No test papers yet</div>}
        </div>
      )}

      {/* ─── Add Question Modal ─── */}
      <Modal isOpen={showQuestionModal} onClose={() => setShowQuestionModal(false)} title="Add Question">
        <div className="admin-form">
          <div>
            <label className="input-label">Question Text</label>
            <textarea className="admin-textarea" rows={3} placeholder="Enter the question..." value={questionForm.question_text} onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <div>
              <label className="input-label">Question Type</label>
              <select className="admin-select" value={questionForm.question_type} onChange={(e) => setQuestionForm({ ...questionForm, question_type: e.target.value })}>
                <option value="mcq">MCQ</option>
                <option value="short-answer">Short Answer</option>
                <option value="descriptive">Descriptive</option>
                <option value="code">Code</option>
              </select>
            </div>
            <div>
              <label className="input-label">Difficulty</label>
              <select className="admin-select" value={questionForm.difficulty_level} onChange={(e) => setQuestionForm({ ...questionForm, difficulty_level: e.target.value })}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="input-label">Category</label>
              <select className="admin-select" value={questionForm.category} onChange={(e) => setQuestionForm({ ...questionForm, category: e.target.value })}>
                <option value="technical">Technical</option>
                <option value="non-technical">Non-technical</option>
                <option value="aptitude">Aptitude</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <div>
              <label className="input-label">Test Type</label>
              <select className="admin-select" value={questionForm.test_type} onChange={(e) => setQuestionForm({ ...questionForm, test_type: e.target.value })}>
                <option value="academic">Academic</option>
                <option value="company-specific">Company-specific</option>
              </select>
            </div>
            {questionForm.test_type === 'company-specific' && (
              <Input label="Company Name" placeholder="e.g. TCS, Infosys" value={questionForm.company_name} onChange={(e) => setQuestionForm({ ...questionForm, company_name: e.target.value })} />
            )}
          </div>

          <div style={{ marginTop: '12px' }}>
            <label className="input-label">Course</label>
            <select className="admin-select" value={questionForm.course_id} onChange={(e) => setQuestionForm({ ...questionForm, course_id: e.target.value })}>
              <option value="">No course</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>

          {questionForm.question_type === 'mcq' && (
            <div style={{ marginTop: '12px' }}>
              <label className="input-label">Options</label>
              {questionForm.answers_json.options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <input
                    type="radio"
                    name="correct"
                    checked={questionForm.answers_json.correct === i}
                    onChange={() => setQuestionForm({ ...questionForm, answers_json: { ...questionForm.answers_json, correct: i } })}
                    style={{ accentColor: 'var(--primary-500)' }}
                  />
                  <input
                    type="text"
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    style={{ flex: 1, padding: '6px 10px', background: 'var(--surface-2)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'inherit' }}
                  />
                </div>
              ))}
              <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '4px' }}>Select the correct answer with the radio button</div>
            </div>
          )}

          <div style={{ marginTop: '12px' }}>
            <label className="input-label">Explanation (optional)</label>
            <textarea className="admin-textarea" rows={2} placeholder="Explain the correct answer..." value={questionForm.answers_json.explanation} onChange={(e) => setQuestionForm({ ...questionForm, answers_json: { ...questionForm.answers_json, explanation: e.target.value } })} />
          </div>

          <Button variant="primary" size="lg" style={{ width: '100%', marginTop: '20px' }} onClick={saveQuestion}>Add Question</Button>
        </div>
      </Modal>

      {/* ─── Create Test Paper Modal ─── */}
      <Modal isOpen={showTestModal} onClose={() => { setShowTestModal(false); resetTestForm(); }} title="Create Test Paper" size="lg">
        <div className="admin-form">

          {/* ── Section 1: Test Identity ── */}
          <div style={sectionStyle('#6366f1')}>
            <div style={sectionLabel}>
              <span style={sectionDot('#6366f1')} />
              Test Identity
            </div>
            <div>
              <label className="input-label">
                Test Title <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Java Mid-Term Exam — Semester 3"
                value={testForm.title}
                onChange={(e) => setTestForm({ ...testForm, title: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div style={{ marginTop: '10px' }}>
              <label className="input-label">Description / Instructions</label>
              <textarea
                className="admin-textarea"
                rows={2}
                placeholder="Instructions for students — exam rules, allowed materials, etc."
                value={testForm.description}
                onChange={(e) => setTestForm({ ...testForm, description: e.target.value })}
              />
            </div>
          </div>

          {/* ── Section 2: Target Audience ── */}
          <div style={sectionStyle('#06b6d4')}>
            <div style={sectionLabel}>
              <span style={sectionDot('#06b6d4')} />
              Target Audience
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label className="input-label">College <span style={{ color: '#ef4444' }}>*</span></label>
                <select className="admin-select" value={testForm.college_id} onChange={(e) => onTestCollegeChange(e.target.value)}>
                  <option value="">Select college…</option>
                  {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Branch / Department</label>
                <select
                  className="admin-select"
                  value={testForm.branch_id}
                  onChange={(e) => onTestBranchChange(e.target.value)}
                  disabled={!testForm.college_id || testBranches.length === 0}
                >
                  <option value="">All branches</option>
                  {testBranches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Section</label>
                <select
                  className="admin-select"
                  value={testForm.section_id}
                  onChange={(e) => setTestForm({ ...testForm, section_id: e.target.value })}
                  disabled={!testForm.branch_id || testSections.length === 0}
                >
                  <option value="">All sections</option>
                  {testSections.map((s) => <option key={s.id} value={s.id}>{s.section_name} {s.academic_year ? `(${s.academic_year})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Course / Subject</label>
                <select className="admin-select" value={testForm.course_id} onChange={(e) => setTestForm({ ...testForm, course_id: e.target.value })}>
                  <option value="">All courses</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
            </div>
            {testForm.college_id && !testForm.branch_id && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                No branch selected — test will be visible to the entire college.
              </div>
            )}
          </div>

          {/* ── Section 3: Test Category ── */}
          <div style={sectionStyle('#8b5cf6')}>
            <div style={sectionLabel}>
              <span style={sectionDot('#8b5cf6')} />
              Test Category
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {[
                { value: 'academic', label: 'Academic', sub: 'University / internal exams', color: '#6366f1' },
                { value: 'company-specific', label: 'Company Specific', sub: 'Placement & mock tests', color: '#f59e0b' },
              ].map(({ value, label, sub, color }) => (
                <button
                  key={value}
                  onClick={() => setTestForm({ ...testForm, test_type: value, company_name: '' })}
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: `2px solid ${testForm.test_type === value ? color : 'var(--border-color)'}`,
                    background: testForm.test_type === value ? `${color}18` : 'var(--surface-2)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: testForm.test_type === value ? color : 'var(--text-primary)' }}>{label}</div>
                  <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{sub}</div>
                </button>
              ))}
            </div>
            {testForm.test_type === 'company-specific' && (
              <div style={{ marginTop: '10px' }}>
                <label className="input-label">Company Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  placeholder="e.g. TCS, Infosys, Google, Wipro"
                  value={testForm.company_name}
                  onChange={(e) => setTestForm({ ...testForm, company_name: e.target.value })}
                  style={inputStyle}
                />
              </div>
            )}
          </div>

          {/* ── Section 4: Marks & Time ── */}
          <div style={sectionStyle('#10b981')}>
            <div style={sectionLabel}>
              <span style={sectionDot('#10b981')} />
              Marks &amp; Time
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label className="input-label">Total Marks <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="number" min="1" placeholder="e.g. 100"
                  value={testForm.total_marks}
                  onChange={(e) => setTestForm({ ...testForm, total_marks: parseInt(e.target.value) || '' })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="input-label">Duration <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number" min="1" placeholder="e.g. 60"
                    value={testForm.duration_minutes}
                    onChange={(e) => setTestForm({ ...testForm, duration_minutes: parseInt(e.target.value) || '' })}
                    style={{ ...inputStyle, paddingRight: '40px' }}
                  />
                  <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>min</span>
                </div>
              </div>
              <div>
                <label className="input-label">
                  Passing Score
                  {testForm.total_marks && testForm.passing_score
                    ? <span style={{ marginLeft: '6px', color: '#10b981', fontWeight: 600 }}>
                        ({Math.round((testForm.passing_score / testForm.total_marks) * 100)}%)
                      </span>
                    : null}
                </label>
                <input
                  type="number" min="0" placeholder="e.g. 40"
                  value={testForm.passing_score}
                  onChange={(e) => setTestForm({ ...testForm, passing_score: parseInt(e.target.value) || '' })}
                  style={inputStyle}
                />
              </div>
            </div>
            {testForm.total_marks && testForm.duration_minutes ? (
              <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '16px' }}>
                <span>⏱ {testForm.duration_minutes} min total</span>
                <span>· ~{Math.round(testForm.duration_minutes / testForm.total_marks * 60)} sec per mark</span>
                {testForm.passing_score ? <span>· Pass at {testForm.passing_score}/{testForm.total_marks}</span> : null}
              </div>
            ) : null}
          </div>

          {/* ── Summary preview ── */}
          {(testForm.title || testForm.college_id) && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.15)',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
            }}>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>Summary</strong>
              {testForm.title && <div>📋 <strong>{testForm.title}</strong></div>}
              <div>
                🏫 {colleges.find((c) => c.id === testForm.college_id)?.name || '—'}
                {testForm.branch_id ? ` › ${testBranches.find((b) => b.id === testForm.branch_id)?.name || ''}` : ' (all branches)'}
                {testForm.section_id ? ` › Sec ${testSections.find((s) => s.id === testForm.section_id)?.section_name || ''}` : ''}
              </div>
              {testForm.course_id && <div>📚 {courses.find((c) => c.id === testForm.course_id)?.title}</div>}
              <div>🏷 {testForm.test_type === 'company-specific' ? `Company — ${testForm.company_name || 'TBD'}` : 'Academic'}</div>
              {testForm.total_marks && testForm.duration_minutes && (
                <div>⚡ {testForm.total_marks} marks · {testForm.duration_minutes} min{testForm.passing_score ? ` · Pass: ${testForm.passing_score}` : ''}</div>
              )}
            </div>
          )}

          <Button variant="primary" size="lg" style={{ width: '100%', marginTop: '16px' }} onClick={saveTestPaper}>
            Create Test Paper
          </Button>
        </div>
      </Modal>

      {/* ─── Results Modal ─── */}
      <Modal isOpen={!!showResults} onClose={() => setShowResults(null)} title="Test Results">
        <div>
          {results.length === 0 ? (
            <div className="admin-empty">No submissions yet</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Enrollment #</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.profiles?.display_name || '—'}</strong></td>
                    <td className="text-muted">{r.profiles?.enrollment_number || '—'}</td>
                    <td>{r.obtained_marks ?? '—'} / {r.total_marks ?? '—'}</td>
                    <td><Badge variant={r.status === 'evaluated' ? 'success' : r.status === 'submitted' ? 'warning' : 'primary'}>{r.status}</Badge></td>
                    <td className="text-muted">{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>

      {/* ─── AI Generate Questions Modal ─── */}
      <Modal isOpen={showGenerateModal} onClose={() => { setShowGenerateModal(false); setGenError(null); }} title="AI Question Generator">
        <div className="admin-form">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '12px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
            <HiOutlineSparkles size={20} style={{ color: 'var(--primary-500)' }} />
            <span style={{ fontSize: '0.85rem' }}>
              Generate MCQ questions using Orbivex AI and save them directly to the Question Bank. Academic questions go under the <strong>Academic</strong> block; company-specific questions appear under the matching <strong>company name</strong>.
            </span>
          </div>

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button className={`admin-tab ${genForm.mode === 'lesson' ? 'active' : ''}`} onClick={() => setGenForm({ ...genForm, mode: 'lesson' })}>
              From Lesson
            </button>
            <button className={`admin-tab ${genForm.mode === 'custom' ? 'active' : ''}`} onClick={() => setGenForm({ ...genForm, mode: 'custom' })}>
              Custom Content
            </button>
          </div>

          {genForm.mode === 'lesson' ? (
            <>
              <div>
                <label className="input-label">Select Lesson</label>
                <select className="admin-select" value={genForm.lesson_id} onChange={(e) => setGenForm({ ...genForm, lesson_id: e.target.value })}>
                  <option value="">Choose a lesson...</option>
                  {lessons.map((l) => (
                    <option key={l.id} value={l.id}>{l.title} {l.courses?.title ? `(${l.courses.title})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                The lesson's content text will be used to generate questions. Make sure the lesson has substantial content.
              </div>
            </>
          ) : (
            <div>
              <label className="input-label">Content to generate questions from</label>
              <textarea
                className="admin-textarea"
                rows={6}
                placeholder="Paste lesson content, notes, or any educational text here (min 50 characters)..."
                value={genForm.content}
                onChange={(e) => setGenForm({ ...genForm, content: e.target.value })}
              />
              <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                {genForm.content.length} characters {genForm.content.length < 50 ? '(need at least 50)' : ''}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <div>
              <label className="input-label">Number of Questions</label>
              <input
                type="number"
                min="1"
                max="50"
                value={genForm.num_questions}
                onChange={(e) => setGenForm({ ...genForm, num_questions: Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) })}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'inherit' }}
              />
            </div>
            <div>
              <label className="input-label">Difficulty</label>
              <select className="admin-select" value={genForm.difficulty_level} onChange={(e) => setGenForm({ ...genForm, difficulty_level: e.target.value })}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <div>
              <label className="input-label">Category</label>
              <select className="admin-select" value={genForm.category} onChange={(e) => setGenForm({ ...genForm, category: e.target.value })}>
                <option value="technical">Technical</option>
                <option value="non-technical">Non-technical</option>
                <option value="aptitude">Aptitude</option>
              </select>
            </div>
            <div>
              <label className="input-label">Test Type</label>
              <select className="admin-select" value={genForm.test_type} onChange={(e) => setGenForm({ ...genForm, test_type: e.target.value })}>
                <option value="academic">Academic</option>
                <option value="company-specific">Company-specific</option>
              </select>
            </div>
          </div>

          {genForm.test_type === 'company-specific' && (
            <Input
              label="Company Name"
              placeholder="e.g. TCS, Infosys, Google"
              value={genForm.company_name}
              onChange={(e) => setGenForm({ ...genForm, company_name: e.target.value })}
              style={{ marginTop: '12px' }}
            />
          )}

          {genForm.mode === 'custom' && (
            <div style={{ marginTop: '12px' }}>
              <label className="input-label">Course (optional)</label>
              <select className="admin-select" value={genForm.course_id} onChange={(e) => setGenForm({ ...genForm, course_id: e.target.value })}>
                <option value="">No course</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          )}

          <div style={{ marginTop: '12px' }}>
            <label className="input-label">College (optional)</label>
            <select className="admin-select" value={genForm.college_id} onChange={(e) => setGenForm({ ...genForm, college_id: e.target.value })}>
              <option value="">No college</option>
              {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Generation result */}
          {genResult && (
            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <strong style={{ color: 'var(--success-500)' }}>Generation Complete</strong>
              <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                {genResult.lesson_title && <div>Lesson: <strong>{genResult.lesson_title}</strong></div>}
                {genResult.course_title && <div>Course: {genResult.course_title}</div>}
                <div>Generated: {genResult.generated} questions</div>
                <div>Saved to bank: <strong>{genResult.saved}</strong> questions</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Questions are now visible in the {genForm.test_type === 'company-specific' ? `"${genForm.company_name || 'Company Specific'}" block` : '"Academic" block'} below.
                </div>
              </div>
            </div>
          )}

          {genError && (
            <div style={{
              marginTop: '16px',
              padding: '14px 16px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ color: '#fb7185', display: 'block', marginBottom: '6px' }}>Generation failed</strong>
                  <div style={{ fontSize: '0.85rem', wordBreak: 'break-word', color: 'var(--text-primary)' }}>
                    {genError.message}
                  </div>
                  {genError.hint && (
                    <div style={{ fontSize: '0.78rem', marginTop: '8px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {genError.hint}
                    </div>
                  )}
                </div>
                <button onClick={() => setGenError(null)} className="admin-icon-btn" style={{ flexShrink: 0 }} aria-label="Dismiss error">✕</button>
              </div>
            </div>
          )}

          {generating && (() => {
            const total = genForm.num_questions;
            const done = Math.min(total, Math.floor(genProgress));
            const plateaued = genProgress >= total - 0.5;
            const pct = Math.min(100, Math.round((genProgress / total) * 100));
            return (
              <div style={{
                marginTop: '20px',
                padding: '16px',
                border: '1px solid rgba(255, 122, 0, 0.25)',
                borderRadius: '12px',
                background: 'rgba(255, 122, 0, 0.06)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <span className="spinner" style={{ width: '14px', height: '14px', border: '2px solid rgba(255,122,0,0.3)', borderTop: '2px solid var(--primary-500)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    {plateaued ? 'Saving to question bank…' : 'Generating questions'}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {done} / {total} · {pct}%
                  </span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: 'var(--gradient-hero)',
                    transition: 'width 250ms ease-out',
                    boxShadow: '0 0 12px rgba(255,122,0,0.5)',
                  }} />
                </div>
                <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '8px' }}>
                  {plateaued
                    ? 'Model finished — writing questions into the bank. Almost done.'
                    : 'AI model is thinking — this can take ~4–6 seconds per question depending on your hardware.'}
                </div>
              </div>
            );
          })()}

          <Button
            variant="primary"
            size="lg"
            style={{ width: '100%', marginTop: '20px' }}
            onClick={generateQuestions}
            disabled={generating}
          >
            {generating ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                Working… please keep this open
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <HiOutlineSparkles size={18} />
                Generate {genForm.num_questions} Questions & Save to Bank
              </span>
            )}
          </Button>
        </div>
      </Modal>
    </>
  );
}
