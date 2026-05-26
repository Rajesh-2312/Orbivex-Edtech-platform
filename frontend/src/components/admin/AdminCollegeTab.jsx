import { useState, useEffect } from 'react';
import {
  HiOutlinePlus, HiOutlineTrash, HiOutlinePencilSquare,
  HiOutlineArrowPath, HiOutlineChevronDown, HiOutlineChevronRight,
  HiOutlineCheckCircle, HiOutlineBuildingOffice2, HiOutlineMapPin,
  HiOutlinePhone, HiOutlineAcademicCap, HiOutlineUsers,
} from 'react-icons/hi2';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import api from '../../lib/api';

// ─── Tiny helpers ───────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2);

const inp = {
  width: '100%', padding: '9px 12px',
  background: 'var(--surface-2)', border: '1px solid var(--border-color)',
  borderRadius: '8px', color: 'inherit', fontSize: '0.88rem',
};

function FieldLabel({ children, required }) {
  return (
    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: '5px' }}>
      {children} {required && <span style={{ color: '#ef4444' }}>*</span>}
    </label>
  );
}

function Field({ label, required, children, style }) {
  return (
    <div style={style}>
      <FieldLabel required={required}>{label}</FieldLabel>
      {children}
    </div>
  );
}

// ─── Step indicator ─────────────────────────────────────────────────────────
function StepBar({ step, total, labels }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '24px' }}>
      {labels.map((label, i) => {
        const idx = i + 1;
        const done = idx < step;
        const active = idx === step;
        const color = done ? '#10b981' : active ? '#6366f1' : 'var(--border-color)';
        const textColor = done ? '#10b981' : active ? '#6366f1' : 'var(--text-secondary)';
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < total - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '50%',
                background: done ? '#10b98120' : active ? '#6366f120' : 'var(--surface-2)',
                border: `2px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '0.82rem', color,
              }}>
                {done ? <HiOutlineCheckCircle size={16} /> : idx}
              </div>
              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: textColor, whiteSpace: 'nowrap' }}>{label}</span>
            </div>
            {i < total - 1 && (
              <div style={{ flex: 1, height: '2px', background: done ? '#10b981' : 'var(--border-color)', margin: '0 6px', marginBottom: '18px' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function AdminCollegeTab({ addToast }) {
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCollege, setEditingCollege] = useState(null);
  const [expandedCollege, setExpandedCollege] = useState(null);
  const [branchData, setBranchData] = useState({});      // { collegeId: [...branches with sections] }

  // Wizard step (1 = College Info, 2 = Location & Contact, 3 = Branches & Structure)
  const [step, setStep] = useState(1);

  // ── College form ──
  const emptyForm = () => ({
    name: '', code: '', type: 'private', established_year: '',
    address: '', city: '', state: '', pincode: '',
    principal_email: '', phone: '', website: '',
  });
  const [form, setForm] = useState(emptyForm());

  // ── Branches builder (only for new college creation) ──
  // branches: [{ _id, name, code, hod_name, hod_email, sections: [{_id, section_name, academic_year, passout_year, semester}] }]
  const [branches, setBranches] = useState([]);

  // ── Inline add branch/section for existing college ──
  const [showBranchModal, setShowBranchModal] = useState(null);   // collegeId
  const [showSectionModal, setShowSectionModal] = useState(null); // branchId
  const [branchForm, setBranchForm] = useState({ name: '', code: '', hod_name: '', hod_email: '' });
  const [sectionForm, setSectionForm] = useState({ section_name: '', academic_year: '', passout_year: '', semester: '' });

  useEffect(() => { loadColleges(); }, []);

  const loadColleges = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/colleges');
      setColleges(res.data.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const loadBranches = async (collegeId) => {
    try {
      const res = await api.get(`/admin/colleges/${collegeId}/branches`);
      setBranchData((p) => ({ ...p, [collegeId]: res.data.data || [] }));
    } catch { /* ignore */ }
  };

  const toggleExpand = (cid) => {
    if (expandedCollege === cid) { setExpandedCollege(null); return; }
    setExpandedCollege(cid);
    if (!branchData[cid]) loadBranches(cid);
  };

  // ── Wizard helpers ──────────────────────────────────────────────────────────
  const openCreate = () => {
    setForm(emptyForm());
    setBranches([]);
    setEditingCollege(null);
    setStep(1);
    setShowModal(true);
  };

  const openEdit = (college) => {
    setEditingCollege(college);
    setForm({
      name: college.name || '', code: college.code || '', type: college.type || 'private',
      established_year: college.established_year || '',
      address: college.address || '', city: college.city || '', state: college.state || '', pincode: college.pincode || '',
      principal_email: college.principal_email || '', phone: college.phone || '', website: college.website || '',
    });
    setBranches([]);
    setStep(1);
    setShowModal(true);
  };

  // ── Branch builder helpers ──────────────────────────────────────────────────
  const addBranch = () => setBranches((prev) => [
    ...prev,
    { _id: uid(), name: '', code: '', hod_name: '', hod_email: '', sections: [] },
  ]);

  const updateBranch = (id, key, val) =>
    setBranches((prev) => prev.map((b) => b._id === id ? { ...b, [key]: val } : b));

  const removeBranch = (id) =>
    setBranches((prev) => prev.filter((b) => b._id !== id));

  const addSection = (branchId) =>
    setBranches((prev) => prev.map((b) =>
      b._id === branchId
        ? { ...b, sections: [...b.sections, { _id: uid(), section_name: '', academic_year: '', passout_year: '', semester: '' }] }
        : b
    ));

  const updateSection = (branchId, secId, key, val) =>
    setBranches((prev) => prev.map((b) =>
      b._id === branchId
        ? { ...b, sections: b.sections.map((s) => s._id === secId ? { ...s, [key]: val } : s) }
        : b
    ));

  const removeSection = (branchId, secId) =>
    setBranches((prev) => prev.map((b) =>
      b._id === branchId ? { ...b, sections: b.sections.filter((s) => s._id !== secId) } : b
    ));

  // ── Save ───────────────────────────────────────────────────────────────────
  const saveCollege = async () => {
    if (!form.name.trim() || !form.code.trim()) { addToast('College name and code are required', 'error'); return; }
    setSaving(true);
    try {
      let collegeId;
      if (editingCollege) {
        await api.patch(`/admin/colleges/${editingCollege.id}`, form);
        collegeId = editingCollege.id;
        addToast('College updated', 'success');
      } else {
        const res = await api.post('/admin/colleges', form);
        collegeId = res.data.data.id;
      }

      // Save branches and sections (only on new create, or if branches were added)
      for (const branch of branches) {
        if (!branch.name.trim() || !branch.code.trim()) continue;
        const bRes = await api.post(`/admin/colleges/${collegeId}/branches`, {
          name: branch.name, code: branch.code,
          hod_name: branch.hod_name || null,
          hod_email: branch.hod_email || null,
        });
        const branchId = bRes.data.data.id;
        for (const sec of branch.sections) {
          if (!sec.section_name.trim()) continue;
          await api.post(`/admin/branches/${branchId}/sections`, {
            section_name: sec.section_name,
            academic_year: sec.academic_year || null,
            semester: sec.semester ? parseInt(sec.semester) : null,
          });
        }
      }

      if (!editingCollege) addToast(`College created with ${branches.length} branch${branches.length !== 1 ? 'es' : ''}`, 'success');
      setShowModal(false);
      loadColleges();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save', 'error');
    }
    setSaving(false);
  };

  // ── Existing college branch/section management ─────────────────────────────
  const saveBranch = async (collegeId) => {
    if (!branchForm.name.trim() || !branchForm.code.trim()) { addToast('Name and code required', 'error'); return; }
    try {
      await api.post(`/admin/colleges/${collegeId}/branches`, branchForm);
      addToast('Branch added', 'success');
      setShowBranchModal(null);
      setBranchForm({ name: '', code: '', hod_name: '', hod_email: '' });
      loadBranches(collegeId);
    } catch (err) { addToast(err.response?.data?.error || 'Failed', 'error'); }
  };

  const saveSection = async (branchId) => {
    if (!sectionForm.section_name.trim()) { addToast('Section name required', 'error'); return; }
    try {
      await api.post(`/admin/branches/${branchId}/sections`, {
        section_name: sectionForm.section_name,
        academic_year: sectionForm.academic_year || null,
        semester: sectionForm.semester ? parseInt(sectionForm.semester) : null,
      });
      addToast('Section added', 'success');
      setShowSectionModal(null);
      setSectionForm({ section_name: '', academic_year: '', passout_year: '', semester: '' });
      loadBranches(expandedCollege);
    } catch (err) { addToast(err.response?.data?.error || 'Failed', 'error'); }
  };

  const deleteCollege = async (id, name) => {
    if (!confirm(`Delete "${name}"? All branches and sections will be removed.`)) return;
    try {
      await api.delete(`/admin/colleges/${id}`);
      addToast('College deleted', 'success');
      loadColleges();
    } catch (err) { addToast(err.response?.data?.error || 'Failed', 'error'); }
  };

  const deleteBranch = async (branchId, collegeId) => {
    if (!confirm('Delete this branch and all its sections?')) return;
    try {
      await api.delete(`/admin/branches/${branchId}`);
      addToast('Branch deleted', 'success');
      loadBranches(collegeId);
    } catch (err) { addToast(err.response?.data?.error || 'Failed', 'error'); }
  };

  const deleteSection = async (sectionId, collegeId) => {
    if (!confirm('Delete this section?')) return;
    try {
      await api.delete(`/admin/sections/${sectionId}`);
      addToast('Section deleted', 'success');
      loadBranches(collegeId);
    } catch (err) { addToast(err.response?.data?.error || 'Failed', 'error'); }
  };

  if (loading) return <div className="admin-loading">Loading colleges...</div>;

  const STEPS = ['College Info', 'Location & Contact', 'Branches & Batches'];

  return (
    <>
      {/* ── College list ── */}
      <div className="admin-table-wrap">
        <div className="admin-table-header">
          <h3>{colleges.length} College{colleges.length !== 1 ? 's' : ''}</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="ghost" size="sm" onClick={loadColleges}><HiOutlineArrowPath size={16} /></Button>
            <Button variant="primary" size="sm" onClick={openCreate}><HiOutlinePlus size={16} /> Add College</Button>
          </div>
        </div>

        {colleges.length === 0 && (
          <div className="admin-empty">No colleges yet. Add your first one!</div>
        )}

        {colleges.map((c) => {
          const isExpanded = expandedCollege === c.id;
          const collegeBranches = branchData[c.id] || [];
          return (
            <div key={c.id} style={{
              marginBottom: '12px', borderRadius: '12px', overflow: 'hidden',
              border: '1px solid rgba(99,102,241,0.18)',
              background: 'var(--surface-1)',
            }}>
              {/* College header row */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', cursor: 'pointer' }}
                onClick={() => toggleExpand(c.id)}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <HiOutlineBuildingOffice2 size={20} style={{ color: 'var(--primary-500)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '0.95rem' }}>{c.name}</strong>
                    <span style={{ fontSize: '0.75rem', padding: '1px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>{c.code}</span>
                    <Badge variant={c.type === 'government' ? 'success' : c.type === 'autonomous' ? 'warning' : 'primary'}>{c.type}</Badge>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '3px', flexWrap: 'wrap' }}>
                    {(c.city || c.state) && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <HiOutlineMapPin size={12} /> {[c.city, c.state].filter(Boolean).join(', ')}
                      </span>
                    )}
                    {c.principal_email && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.principal_email}</span>
                    )}
                    {c.established_year && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Est. {c.established_year}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <button className="admin-icon-btn" title="Edit" onClick={() => openEdit(c)}><HiOutlinePencilSquare size={16} /></button>
                  <button className="admin-icon-btn danger" title="Delete" onClick={() => deleteCollege(c.id, c.name)}><HiOutlineTrash size={16} /></button>
                </div>
                <span style={{ color: 'var(--text-secondary)', marginLeft: '4px' }}>
                  {isExpanded ? <HiOutlineChevronDown size={18} /> : <HiOutlineChevronRight size={18} />}
                </span>
              </div>

              {/* Expanded: branches & sections */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border-color)', padding: '16px 18px', background: 'rgba(0,0,0,0.12)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
                      Branches &amp; Sections
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => { setBranchForm({ name: '', code: '', hod_name: '', hod_email: '' }); setShowBranchModal(c.id); }}>
                      <HiOutlinePlus size={14} /> Add Branch
                    </Button>
                  </div>

                  {collegeBranches.length === 0 ? (
                    <div className="text-muted" style={{ fontSize: '0.82rem' }}>No branches yet.</div>
                  ) : (
                    collegeBranches.map((b) => (
                      <div key={b.id} style={{
                        marginBottom: '10px', borderRadius: '10px', overflow: 'hidden',
                        border: '1px solid rgba(99,102,241,0.12)', background: 'var(--surface-2)',
                      }}>
                        {/* Branch header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px' }}>
                          <HiOutlineAcademicCap size={16} style={{ color: 'var(--primary-400,#818cf8)', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{b.name}</span>
                            <span style={{ marginLeft: '6px', fontSize: '0.73rem', background: 'rgba(99,102,241,0.12)', color: 'var(--primary-400,#818cf8)', padding: '1px 7px', borderRadius: '5px', fontWeight: 600 }}>{b.code}</span>
                            {b.hod_name && <span style={{ marginLeft: '10px', fontSize: '0.73rem', color: 'var(--text-secondary)' }}>HOD: {b.hod_name}</span>}
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <Button variant="ghost" size="sm" onClick={() => { setSectionForm({ section_name: '', academic_year: '', passout_year: '', semester: '' }); setShowSectionModal(b.id); }}>
                              <HiOutlinePlus size={13} /> Section
                            </Button>
                            <button className="admin-icon-btn danger" onClick={() => deleteBranch(b.id, c.id)}><HiOutlineTrash size={14} /></button>
                          </div>
                        </div>

                        {/* Sections */}
                        {b.sections && b.sections.length > 0 && (
                          <div style={{ padding: '8px 14px 10px', borderTop: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {b.sections.map((s) => (
                              <div key={s.id} style={{
                                display: 'flex', alignItems: 'center', gap: '4px',
                                padding: '3px 8px 3px 10px', borderRadius: '8px',
                                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                              }}>
                                <HiOutlineUsers size={12} style={{ color: 'var(--primary-400,#818cf8)' }} />
                                <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Sec {s.section_name}</span>
                                {s.academic_year && <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{s.academic_year}</span>}
                                {s.semester && <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>· Sem {s.semester}</span>}
                                <button
                                  className="admin-icon-btn danger"
                                  style={{ padding: '1px', marginLeft: '2px' }}
                                  onClick={() => deleteSection(s.id, c.id)}
                                >
                                  <HiOutlineTrash size={11} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ══════════ COLLEGE WIZARD MODAL ══════════ */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingCollege(null); }}
        title={editingCollege ? `Edit — ${editingCollege.name}` : 'Add New College'}
        size="lg"
      >
        <div>
          {!editingCollege && <StepBar step={step} total={3} labels={STEPS} />}

          {/* ── Step 1: College Info ── */}
          {(step === 1 || editingCollege) && (
            <div>
              {!editingCollege && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Basic identity of the institution.
                </div>
              )}

              {/* Type card selector */}
              <Field label="Institution Type" required>
                <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                  {[
                    { val: 'government', label: 'Government', color: '#10b981' },
                    { val: 'private',    label: 'Private',    color: '#6366f1' },
                    { val: 'autonomous', label: 'Autonomous', color: '#f59e0b' },
                  ].map(({ val, label, color }) => (
                    <button
                      key={val}
                      onClick={() => setForm({ ...form, type: val })}
                      style={{
                        flex: 1, padding: '10px 8px', borderRadius: '10px', cursor: 'pointer',
                        border: `2px solid ${form.type === val ? color : 'var(--border-color)'}`,
                        background: form.type === val ? `${color}15` : 'var(--surface-2)',
                        color: form.type === val ? color : 'var(--text-secondary)',
                        fontWeight: 700, fontSize: '0.82rem', transition: 'all 0.15s',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginTop: '12px' }}>
                <Field label="College Full Name" required>
                  <input style={inp} placeholder="e.g. ABC Engineering College" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <Field label="Short Code" required>
                  <input style={inp} placeholder="e.g. ABCEC" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                <Field label="Established Year">
                  <input style={inp} type="number" placeholder="e.g. 1995" value={form.established_year} onChange={(e) => setForm({ ...form, established_year: parseInt(e.target.value) || '' })} />
                </Field>
                <Field label="Website">
                  <input style={inp} placeholder="https://college.edu.in" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
                </Field>
              </div>
            </div>
          )}

          {/* ── Step 2: Location & Contact ── */}
          {(step === 2 || editingCollege) && (
            <div style={editingCollege ? { marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' } : {}}>
              {editingCollege && (
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  Location &amp; Contact
                </div>
              )}

              <Field label="Address">
                <input style={inp} placeholder="Street address / locality" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '10px' }}>
                <Field label="City">
                  <input style={inp} placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </Field>
                <Field label="State">
                  <input style={inp} placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </Field>
                <Field label="Pincode">
                  <input style={inp} placeholder="6-digit PIN" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                <Field label="Principal Email">
                  <input style={inp} type="email" placeholder="principal@college.edu.in" value={form.principal_email} onChange={(e) => setForm({ ...form, principal_email: e.target.value })} />
                </Field>
                <Field label="Phone">
                  <input style={inp} placeholder="+91 XXXXX XXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </Field>
              </div>
            </div>
          )}

          {/* ── Step 3: Branches & Batches (new college only) ── */}
          {step === 3 && !editingCollege && (
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Add departments / branches and their sections with passout batch years.
                You can also add these later from the college card.
              </div>

              {branches.map((b, bi) => (
                <div key={b._id} style={{
                  marginBottom: '14px', borderRadius: '12px', overflow: 'hidden',
                  border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)',
                }}>
                  {/* Branch row */}
                  <div style={{ padding: '12px 14px', background: 'rgba(99,102,241,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <HiOutlineAcademicCap size={16} style={{ color: 'var(--primary-500)' }} />
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--primary-400,#818cf8)' }}>
                        Branch {bi + 1}
                      </span>
                      <button
                        onClick={() => removeBranch(b._id)}
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex' }}
                      >
                        <HiOutlineTrash size={15} />
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '8px' }}>
                      <div>
                        <FieldLabel required>Department Name</FieldLabel>
                        <input style={inp} placeholder="e.g. Computer Science" value={b.name} onChange={(e) => updateBranch(b._id, 'name', e.target.value)} />
                      </div>
                      <div>
                        <FieldLabel required>Code</FieldLabel>
                        <input style={inp} placeholder="CSE" value={b.code} onChange={(e) => updateBranch(b._id, 'code', e.target.value.toUpperCase())} />
                      </div>
                      <div>
                        <FieldLabel>HOD Name</FieldLabel>
                        <input style={inp} placeholder="Dr. Name" value={b.hod_name} onChange={(e) => updateBranch(b._id, 'hod_name', e.target.value)} />
                      </div>
                      <div>
                        <FieldLabel>HOD Email</FieldLabel>
                        <input style={inp} placeholder="hod@college.edu" value={b.hod_email} onChange={(e) => updateBranch(b._id, 'hod_email', e.target.value)} />
                      </div>
                    </div>
                  </div>

                  {/* Sections */}
                  <div style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
                        Sections &amp; Batches
                      </span>
                      <button
                        onClick={() => addSection(b._id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--primary-400,#818cf8)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                      >
                        <HiOutlinePlus size={13} /> Add Section
                      </button>
                    </div>

                    {b.sections.length === 0 && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '4px 0' }}>
                        No sections yet — click "+ Add Section"
                      </div>
                    )}

                    {b.sections.map((s, si) => (
                      <div key={s._id} style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto',
                        gap: '8px', alignItems: 'end', marginBottom: '8px',
                        padding: '8px 10px', borderRadius: '8px',
                        background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)',
                      }}>
                        <div>
                          <FieldLabel required>Section</FieldLabel>
                          <input style={inp} placeholder="A / B / C" value={s.section_name} onChange={(e) => updateSection(b._id, s._id, 'section_name', e.target.value)} />
                        </div>
                        <div>
                          <FieldLabel>Academic Year</FieldLabel>
                          <input style={inp} placeholder="2024-25" value={s.academic_year} onChange={(e) => updateSection(b._id, s._id, 'academic_year', e.target.value)} />
                        </div>
                        <div>
                          <FieldLabel>Passout Batch Year</FieldLabel>
                          <input style={inp} type="number" placeholder="e.g. 2027" value={s.passout_year} onChange={(e) => updateSection(b._id, s._id, 'passout_year', e.target.value)} />
                        </div>
                        <div>
                          <FieldLabel>Semester</FieldLabel>
                          <select style={inp} value={s.semester} onChange={(e) => updateSection(b._id, s._id, 'semester', e.target.value)}>
                            <option value="">—</option>
                            {[1,2,3,4,5,6,7,8].map((n) => <option key={n} value={n}>Sem {n}</option>)}
                          </select>
                        </div>
                        <button
                          onClick={() => removeSection(b._id, s._id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', paddingBottom: '2px', display: 'flex' }}
                        >
                          <HiOutlineTrash size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <button
                onClick={addBranch}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px',
                  border: '2px dashed rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.04)',
                  color: 'var(--primary-400,#818cf8)', cursor: 'pointer', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  fontSize: '0.85rem', transition: 'all 0.15s',
                }}
              >
                <HiOutlinePlus size={16} /> Add Department / Branch
              </button>
            </div>
          )}

          {/* ── Navigation buttons ── */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            {!editingCollege && step > 1 && (
              <Button variant="ghost" size="lg" style={{ flex: 1 }} onClick={() => setStep(step - 1)}>
                ← Back
              </Button>
            )}
            {!editingCollege && step < 3 && (
              <Button
                variant="primary" size="lg"
                style={{ flex: 1 }}
                onClick={() => {
                  if (step === 1 && (!form.name.trim() || !form.code.trim())) {
                    addToast('College name and code are required', 'error'); return;
                  }
                  setStep(step + 1);
                }}
              >
                Next →
              </Button>
            )}
            {(editingCollege || step === 3) && (
              <Button
                variant="primary" size="lg"
                style={{ flex: 1 }}
                onClick={saveCollege}
                disabled={saving}
              >
                {saving ? 'Saving…' : editingCollege ? 'Update College' : `Create College${branches.length > 0 ? ` + ${branches.length} Branch${branches.length !== 1 ? 'es' : ''}` : ''}`}
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* ── Add Branch modal (existing college) ── */}
      <Modal isOpen={!!showBranchModal} onClose={() => setShowBranchModal(null)} title="Add Branch">
        <div className="admin-form">
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
            <Field label="Department Name" required>
              <input style={inp} placeholder="e.g. Computer Science" value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} />
            </Field>
            <Field label="Code" required>
              <input style={inp} placeholder="CSE" value={branchForm.code} onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
            <Field label="HOD Name">
              <input style={inp} placeholder="Dr. Full Name" value={branchForm.hod_name} onChange={(e) => setBranchForm({ ...branchForm, hod_name: e.target.value })} />
            </Field>
            <Field label="HOD Email">
              <input style={inp} placeholder="hod@college.edu" value={branchForm.hod_email} onChange={(e) => setBranchForm({ ...branchForm, hod_email: e.target.value })} />
            </Field>
          </div>
          <Button variant="primary" size="lg" style={{ width: '100%', marginTop: '16px' }} onClick={() => saveBranch(showBranchModal)}>
            Add Branch
          </Button>
        </div>
      </Modal>

      {/* ── Add Section modal (existing college) ── */}
      <Modal isOpen={!!showSectionModal} onClose={() => setShowSectionModal(null)} title="Add Section">
        <div className="admin-form">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="Section Name" required>
              <input style={inp} placeholder="A / B / C / D" value={sectionForm.section_name} onChange={(e) => setSectionForm({ ...sectionForm, section_name: e.target.value })} />
            </Field>
            <Field label="Semester">
              <select style={inp} value={sectionForm.semester} onChange={(e) => setSectionForm({ ...sectionForm, semester: e.target.value })}>
                <option value="">Select semester</option>
                {[1,2,3,4,5,6,7,8].map((n) => <option key={n} value={n}>Semester {n}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
            <Field label="Academic Year">
              <input style={inp} placeholder="e.g. 2024-25" value={sectionForm.academic_year} onChange={(e) => setSectionForm({ ...sectionForm, academic_year: e.target.value })} />
            </Field>
            <Field label="Passout Batch Year">
              <input style={inp} type="number" placeholder="e.g. 2027" value={sectionForm.passout_year} onChange={(e) => setSectionForm({ ...sectionForm, passout_year: e.target.value })} />
            </Field>
          </div>
          <div style={{
            marginTop: '12px', padding: '10px 12px', borderRadius: '8px',
            background: 'rgba(99,102,241,0.07)', fontSize: '0.75rem', color: 'var(--text-secondary)',
          }}>
            <strong>Tip:</strong> Passout batch year is when this batch graduates (e.g. students joining 2023 with 4-year B.Tech → Passout 2027).
          </div>
          <Button variant="primary" size="lg" style={{ width: '100%', marginTop: '14px' }} onClick={() => saveSection(showSectionModal)}>
            Add Section
          </Button>
        </div>
      </Modal>
    </>
  );
}
