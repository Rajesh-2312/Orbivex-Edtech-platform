import { useEffect, useState } from 'react';
import { HiOutlineTrash, HiOutlinePlus, HiOutlineGlobeAlt } from 'react-icons/hi2';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import api from '../../lib/api';

/**
 * AdminCourseAccessPanel
 * Modal for managing course_access rows on a specific course.
 * Rule: zero rows = public (all students). Any rows = restrict to matching
 * college/branch/section. NULL at any level = wildcard at that level.
 */
export default function AdminCourseAccessPanel({ course, isOpen, onClose, addToast }) {
  const [colleges, setColleges] = useState([]);
  const [branches, setBranches] = useState([]);
  const [sections, setSections] = useState([]);
  const [accessRows, setAccessRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({ college_id: '', branch_id: '', section_id: '' });

  useEffect(() => {
    if (!isOpen || !course) return;
    loadAll();
    setForm({ college_id: '', branch_id: '', section_id: '' });
  }, [isOpen, course]);

  useEffect(() => {
    if (!form.college_id) { setBranches([]); setSections([]); setForm((f) => ({ ...f, branch_id: '', section_id: '' })); return; }
    api.get(`/admin/colleges/${form.college_id}/branches`)
      .then((r) => setBranches(r.data.data || []))
      .catch(() => setBranches([]));
  }, [form.college_id]);

  useEffect(() => {
    const br = branches.find((b) => b.id === form.branch_id);
    setSections(br?.sections || []);
    setForm((f) => ({ ...f, section_id: '' }));
  }, [form.branch_id, branches]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [accessRes, collegesRes] = await Promise.all([
        api.get(`/admin/courses/${course.id}/access`),
        api.get('/admin/colleges'),
      ]);
      setAccessRows(accessRes.data.data || []);
      setColleges(collegesRes.data.data || []);
    } catch (err) {
      addToast?.('Failed to load access data', 'error');
    }
    setLoading(false);
  };

  const addRow = async () => {
    if (!form.college_id && !form.branch_id && !form.section_id) {
      addToast?.('Select at least a college', 'error');
      return;
    }
    try {
      await api.post(`/admin/courses/${course.id}/access`, {
        college_id: form.college_id || null,
        branch_id: form.branch_id || null,
        section_id: form.section_id || null,
      });
      addToast?.('Scope added', 'success');
      setForm({ college_id: '', branch_id: '', section_id: '' });
      loadAll();
    } catch (err) {
      addToast?.(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const removeRow = async (row) => {
    if (!confirm('Remove this access scope?')) return;
    try {
      await api.delete(`/admin/courses/${course.id}/access/${row.id}`);
      addToast?.('Scope removed', 'success');
      loadAll();
    } catch (err) {
      addToast?.('Failed to remove', 'error');
    }
  };

  const scopeLabel = (row) => {
    const parts = [];
    parts.push(row.colleges?.name || (row.college_id ? '(college)' : '*'));
    parts.push(row.branches?.name || (row.branch_id ? '(branch)' : '*'));
    parts.push(row.sections?.section_name || (row.section_id ? '(section)' : '*'));
    return parts.join(' / ');
  };

  if (!course) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Access — ${course.title}`}>
      <div className="admin-form">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 12px',
            background: accessRows.length === 0 ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
            border: `1px solid ${accessRows.length === 0 ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)'}`,
            borderRadius: '8px',
            marginBottom: '16px',
          }}
        >
          <HiOutlineGlobeAlt size={18} />
          <span style={{ fontSize: '13px' }}>
            {accessRows.length === 0
              ? 'Public — visible to all students.'
              : `Restricted — visible only to students matching one of ${accessRows.length} scope(s) below.`}
          </span>
        </div>

        {loading ? (
          <div className="text-muted">Loading...</div>
        ) : (
          <>
            {accessRows.length > 0 && (
              <table className="admin-table" style={{ marginBottom: '16px' }}>
                <thead>
                  <tr>
                    <th>College / Branch / Section</th>
                    <th style={{ width: '80px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accessRows.map((row) => (
                    <tr key={row.id}>
                      <td><Badge variant="primary">{scopeLabel(row)}</Badge></td>
                      <td>
                        <button className="admin-icon-btn danger" onClick={() => removeRow(row)}>
                          <HiOutlineTrash size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ padding: '12px', border: '1px dashed var(--border)', borderRadius: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Add scope</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div>
                  <label className="input-label">College</label>
                  <select className="admin-select" value={form.college_id} onChange={(e) => setForm({ ...form, college_id: e.target.value, branch_id: '', section_id: '' })}>
                    <option value="">— Any —</option>
                    {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Branch</label>
                  <select className="admin-select" value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value, section_id: '' })} disabled={!form.college_id}>
                    <option value="">— Any —</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Section</label>
                  <select className="admin-select" value={form.section_id} onChange={(e) => setForm({ ...form, section_id: e.target.value })} disabled={!form.branch_id}>
                    <option value="">— Any —</option>
                    {sections.map((s) => <option key={s.id} value={s.id}>{s.section_name}</option>)}
                  </select>
                </div>
              </div>
              <Button variant="primary" size="sm" style={{ marginTop: '12px' }} onClick={addRow}>
                <HiOutlinePlus size={14} /> Add Scope
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
