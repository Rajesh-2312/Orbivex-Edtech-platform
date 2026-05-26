import { useState, useEffect } from 'react';
import {
  HiOutlinePlus, HiOutlineTrash, HiOutlinePencilSquare,
  HiOutlineArrowPath, HiOutlineCpuChip,
} from 'react-icons/hi2';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import AgentConfigPanel from './AgentConfigPanel';
import api from '../../lib/api';

export default function AdminEducatorTab({ addToast }) {
  const [educators, setEducators] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [branches, setBranches] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showAgentPanel, setShowAgentPanel] = useState(null);
  const [showAssignCourseModal, setShowAssignCourseModal] = useState(null);
  const [form, setForm] = useState({
    email: '', display_name: '', password: '', college_id: '', branch_id: '', section_id: '',
    qualification: '', specialization: '', experience_years: '',
  });
  const [courseAssign, setCourseAssign] = useState({ course_id: '', section_id: '', academic_year: '' });

  useEffect(() => { loadEducators(); loadColleges(); loadCourses(); }, []);

  const loadEducators = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/educators');
      setEducators(res.data.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const loadColleges = async () => {
    try {
      const res = await api.get('/admin/colleges');
      setColleges(res.data.data || []);
    } catch { /* ignore */ }
  };

  const loadBranches = async (collegeId) => {
    if (!collegeId) { setBranches([]); return; }
    try {
      const res = await api.get(`/admin/colleges/${collegeId}/branches`);
      setBranches(res.data.data || []);
    } catch { /* ignore */ }
  };

  const loadCourses = async () => {
    try {
      const res = await api.get('/admin/courses');
      setCourses(res.data.data || []);
    } catch { /* ignore */ }
  };

  const resetForm = () => setForm({
    email: '', display_name: '', password: '', college_id: '', branch_id: '', section_id: '',
    qualification: '', specialization: '', experience_years: '',
  });

  const saveEducator = async () => {
    if (!form.email.trim() || !form.display_name.trim()) {
      addToast('Email and name are required', 'error'); return;
    }
    try {
      await api.post('/admin/educators', form);
      addToast('Educator created', 'success');
      setShowModal(false);
      resetForm();
      loadEducators();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const deleteEducator = async (id) => {
    if (!confirm('Delete this educator?')) return;
    try {
      await api.delete(`/admin/educators/${id}`);
      addToast('Educator deleted', 'success');
      loadEducators();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const toggleActive = async (id, currentStatus) => {
    try {
      await api.patch(`/admin/educators/${id}`, { is_active: !currentStatus });
      addToast(currentStatus ? 'Educator deactivated' : 'Educator activated', 'success');
      loadEducators();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const assignCourse = async (educatorId) => {
    if (!courseAssign.course_id) { addToast('Select a course', 'error'); return; }
    try {
      await api.post(`/admin/educators/${educatorId}/assign-course`, courseAssign);
      addToast('Course assigned', 'success');
      setShowAssignCourseModal(null);
      setCourseAssign({ course_id: '', section_id: '', academic_year: '' });
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  if (loading) return <div className="admin-loading">Loading educators...</div>;

  return (
    <>
      <div className="admin-table-wrap">
        <div className="admin-table-header">
          <h3>{educators.length} Educators</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="ghost" size="sm" onClick={loadEducators}><HiOutlineArrowPath size={16} /></Button>
            <Button variant="primary" size="sm" onClick={() => { resetForm(); setShowModal(true); }}><HiOutlinePlus size={16} /> Add Educator</Button>
          </div>
        </div>

        {educators.map((ed) => (
          <div key={ed.id} className="glass-card-static" style={{ marginBottom: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong>{ed.profiles?.display_name || ed.profiles?.username || '—'}</strong>
                  <Badge variant={ed.is_active ? 'success' : 'danger'}>{ed.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
                <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                  {[ed.qualification, ed.specialization, ed.experience_years ? `${ed.experience_years} yrs exp` : ''].filter(Boolean).join(' · ')}
                </div>
                {ed.colleges?.name && (
                  <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                    {ed.colleges.name} {ed.branches?.name ? `/ ${ed.branches.name}` : ''}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="admin-icon-btn" title="Assign Course" onClick={() => setShowAssignCourseModal(ed.id)}>
                  <HiOutlinePlus size={16} />
                </button>
                <button className="admin-icon-btn" title="Agent Config" onClick={() => setShowAgentPanel(showAgentPanel === ed.id ? null : ed.id)}>
                  <HiOutlineCpuChip size={16} />
                </button>
                <button
                  className={`admin-status-btn ${ed.is_active ? 'published' : 'draft'}`}
                  style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                  onClick={() => toggleActive(ed.id, ed.is_active)}
                >
                  {ed.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button className="admin-icon-btn danger" title="Delete" onClick={() => deleteEducator(ed.id)}>
                  <HiOutlineTrash size={16} />
                </button>
              </div>
            </div>

            {showAgentPanel === ed.id && <AgentConfigPanel educatorId={ed.id} addToast={addToast} />}
          </div>
        ))}

        {educators.length === 0 && <div className="admin-empty">No educators yet</div>}
      </div>

      {/* Add Educator Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Educator">
        <div className="admin-form">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input label="Email" placeholder="educator@college.edu" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Display Name" placeholder="Full name" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          </div>
          <Input label="Password" placeholder="Leave blank for default (Teacher@123)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={{ marginTop: '12px' }} />

          <div style={{ marginTop: '12px' }}>
            <label className="input-label">College</label>
            <select className="admin-select" value={form.college_id} onChange={(e) => { setForm({ ...form, college_id: e.target.value, branch_id: '' }); loadBranches(e.target.value); }}>
              <option value="">Select college...</option>
              {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <div>
              <label className="input-label">Branch</label>
              <select className="admin-select" value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
                <option value="">Select branch...</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
              </select>
            </div>
            <Input label="Qualification" placeholder="e.g. PhD, MTech" value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <Input label="Specialization" placeholder="e.g. Machine Learning" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
            <Input label="Experience (years)" type="number" placeholder="e.g. 5" value={form.experience_years} onChange={(e) => setForm({ ...form, experience_years: parseInt(e.target.value) || '' })} />
          </div>

          <Button variant="primary" size="lg" style={{ width: '100%', marginTop: '20px' }} onClick={saveEducator}>Create Educator</Button>
        </div>
      </Modal>

      {/* Assign Course Modal */}
      <Modal isOpen={!!showAssignCourseModal} onClose={() => setShowAssignCourseModal(null)} title="Assign Course">
        <div className="admin-form">
          <div>
            <label className="input-label">Course</label>
            <select className="admin-select" value={courseAssign.course_id} onChange={(e) => setCourseAssign({ ...courseAssign, course_id: e.target.value })}>
              <option value="">Select course...</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <Input label="Academic Year" placeholder="e.g. 2024-2025" value={courseAssign.academic_year} onChange={(e) => setCourseAssign({ ...courseAssign, academic_year: e.target.value })} style={{ marginTop: '12px' }} />
          <Button variant="primary" size="lg" style={{ width: '100%', marginTop: '20px' }} onClick={() => assignCourse(showAssignCourseModal)}>Assign Course</Button>
        </div>
      </Modal>
    </>
  );
}
