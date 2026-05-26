import { useState, useEffect } from 'react';
import {
  HiOutlinePlus, HiOutlineTrash, HiOutlinePencilSquare,
  HiOutlineArrowPath, HiOutlineArrowUpTray,
} from 'react-icons/hi2';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import BulkImportModal from './BulkImportModal';
import api from '../../lib/api';

export default function AdminStudentTab({ addToast }) {
  const [students, setStudents] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [branches, setBranches] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [filterCollege, setFilterCollege] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [form, setForm] = useState({
    email: '', display_name: '', password: '', college_id: '', branch_id: '', section_id: '',
    enrollment_number: '', hall_ticket_number: '', semester: '', admission_year: '', phone_number: '',
  });

  useEffect(() => { loadStudents(); loadColleges(); }, []);

  const loadStudents = async (college_id, branch_id) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (college_id || filterCollege) params.set('college_id', college_id || filterCollege);
      if (branch_id || filterBranch) params.set('branch_id', branch_id || filterBranch);
      const res = await api.get(`/admin/students?${params}`);
      setStudents(res.data.data || []);
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
    if (!collegeId) { setBranches([]); setSections([]); return; }
    try {
      const res = await api.get(`/admin/colleges/${collegeId}/branches`);
      const data = res.data.data || [];
      setBranches(data);
      setSections(data.flatMap((b) => (b.sections || []).map((s) => ({ ...s, branchName: b.name }))));
    } catch { /* ignore */ }
  };

  const resetForm = () => setForm({
    email: '', display_name: '', password: '', college_id: '', branch_id: '', section_id: '',
    enrollment_number: '', hall_ticket_number: '', semester: '', admission_year: '', phone_number: '',
  });

  const saveStudent = async () => {
    if (!editingStudent && (!form.email.trim() || !form.display_name.trim())) {
      addToast('Email and name are required', 'error'); return;
    }
    try {
      if (editingStudent) {
        const { email, password, ...updates } = form;
        await api.patch(`/admin/students/${editingStudent.id}`, updates);
        addToast('Student updated', 'success');
      } else {
        await api.post('/admin/students', form);
        addToast('Student created', 'success');
      }
      setShowModal(false);
      setEditingStudent(null);
      resetForm();
      loadStudents();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const editStudent = (s) => {
    setEditingStudent(s);
    setForm({
      email: '', display_name: s.display_name || '', password: '', college_id: s.college_id || '',
      branch_id: s.branch_id || '', section_id: s.section_id || '',
      enrollment_number: s.enrollment_number || '', hall_ticket_number: s.hall_ticket_number || '',
      semester: s.semester || '', admission_year: s.admission_year || '', phone_number: s.phone_number || '',
    });
    if (s.college_id) loadBranches(s.college_id);
    setShowModal(true);
  };

  const deleteStudent = async (id, name) => {
    if (!confirm(`Delete student "${name}"?`)) return;
    try {
      await api.delete(`/admin/students/${id}`);
      addToast('Student deleted', 'success');
      loadStudents();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const toggleActive = async (id, currentStatus) => {
    try {
      await api.post(`/admin/students/${id}/activate`, { is_active: !currentStatus });
      addToast(currentStatus ? 'Student deactivated' : 'Student activated', 'success');
      loadStudents();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const handleBulkImport = async (data, fileName) => {
    try {
      const res = await api.post('/admin/students/bulk-import', {
        students: data,
        college_id: filterCollege || null,
        file_name: fileName,
      });
      const result = res.data.data;
      addToast(`Imported: ${result.successful} successful, ${result.failed} failed`, result.failed > 0 ? 'warning' : 'success');
      setShowBulkModal(false);
      loadStudents();
    } catch (err) {
      addToast(err.response?.data?.error || 'Import failed', 'error');
    }
  };

  const handleCollegeChange = (collegeId) => {
    setForm({ ...form, college_id: collegeId, branch_id: '', section_id: '' });
    loadBranches(collegeId);
  };

  if (loading) return <div className="admin-loading">Loading students...</div>;

  return (
    <>
      <div className="admin-table-wrap">
        <div className="admin-table-header">
          <h3>{students.length} Students</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select className="admin-select" style={{ width: '160px' }} value={filterCollege} onChange={(e) => { setFilterCollege(e.target.value); loadStudents(e.target.value); }}>
              <option value="">All Colleges</option>
              {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Button variant="ghost" size="sm" onClick={() => loadStudents()}><HiOutlineArrowPath size={16} /></Button>
            <Button variant="ghost" size="sm" onClick={() => setShowBulkModal(true)}><HiOutlineArrowUpTray size={16} /> Bulk Import</Button>
            <Button variant="primary" size="sm" onClick={() => { resetForm(); setEditingStudent(null); setShowModal(true); }}><HiOutlinePlus size={16} /> Add Student</Button>
          </div>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email / Username</th>
              <th>College</th>
              <th>Branch</th>
              <th>Enrollment #</th>
              <th>Hall Ticket</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.display_name || '—'}</strong></td>
                <td className="text-muted">{s.username || '—'}</td>
                <td className="text-muted">{s.colleges?.name || '—'}</td>
                <td className="text-muted">{s.branches?.name || '—'}</td>
                <td className="text-muted">{s.enrollment_number || '—'}</td>
                <td className="text-muted">{s.hall_ticket_number || '—'}</td>
                <td>
                  <button
                    className={`admin-status-btn ${s.is_active !== false ? 'published' : 'draft'}`}
                    onClick={() => toggleActive(s.id, s.is_active !== false)}
                  >
                    {s.is_active !== false ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="admin-icon-btn" title="Edit" onClick={() => editStudent(s)}><HiOutlinePencilSquare size={16} /></button>
                    <button className="admin-icon-btn danger" title="Delete" onClick={() => deleteStudent(s.id, s.display_name)}><HiOutlineTrash size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {students.length === 0 && <div className="admin-empty">No students found</div>}
      </div>

      {/* Student Form Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingStudent(null); }} title={editingStudent ? 'Edit Student' : 'Add Student'}>
        <div className="admin-form">
          {!editingStudent && (
            <>
              <Input label="Email" placeholder="student@college.edu" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input label="Password" placeholder="Leave blank for default (Student@123)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={{ marginTop: '12px' }} />
            </>
          )}
          <Input label="Display Name" placeholder="Full name" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} style={{ marginTop: editingStudent ? 0 : '12px' }} />

          <div style={{ marginTop: '12px' }}>
            <label className="input-label">College</label>
            <select className="admin-select" value={form.college_id} onChange={(e) => handleCollegeChange(e.target.value)}>
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
            <div>
              <label className="input-label">Section</label>
              <select className="admin-select" value={form.section_id} onChange={(e) => setForm({ ...form, section_id: e.target.value })}>
                <option value="">Select section...</option>
                {sections.filter((s) => !form.branch_id || branches.find((b) => b.id === form.branch_id)?.sections?.some((sec) => sec.id === s.id)).map((s) => (
                  <option key={s.id} value={s.id}>{s.section_name} {s.academic_year ? `(${s.academic_year})` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <Input label="Enrollment Number" placeholder="e.g. E001" value={form.enrollment_number} onChange={(e) => setForm({ ...form, enrollment_number: e.target.value })} />
            <Input label="Hall Ticket Number" placeholder="e.g. CSE-A-001" value={form.hall_ticket_number} onChange={(e) => setForm({ ...form, hall_ticket_number: e.target.value })} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <Input label="Semester" type="number" placeholder="1-8" value={form.semester} onChange={(e) => setForm({ ...form, semester: parseInt(e.target.value) || '' })} />
            <Input label="Admission Year" type="number" placeholder="e.g. 2022" value={form.admission_year} onChange={(e) => setForm({ ...form, admission_year: parseInt(e.target.value) || '' })} />
            <Input label="Phone" placeholder="Phone number" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
          </div>

          <Button variant="primary" size="lg" style={{ width: '100%', marginTop: '20px' }} onClick={saveStudent}>
            {editingStudent ? 'Update Student' : 'Create Student'}
          </Button>
        </div>
      </Modal>

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onImport={handleBulkImport}
        title="Bulk Import Students"
        requiredFields={['enrollment_number', 'first_name', 'last_name', 'email']}
        sampleRow="enrollment_number,first_name,last_name,email,phone,branch_code,section,hall_ticket_number,semester,admission_year"
      />
    </>
  );
}
