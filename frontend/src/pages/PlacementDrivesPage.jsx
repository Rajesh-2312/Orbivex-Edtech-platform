import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PageTransition from '../components/layout/PageTransition';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import useAuthStore from '../store/authStore';
import useUiStore from '../store/uiStore';
import api from '../lib/api';
import {
  HiOutlineBriefcase, HiOutlinePlus, HiOutlineTrash, HiOutlinePencilSquare,
  HiOutlineUsers, HiOutlineCheckCircle, HiOutlineClock, HiOutlineXCircle,
  HiOutlineArrowRight, HiOutlineBuildingOffice2, HiOutlineCurrencyRupee,
  HiOutlineCalendarDays, HiOutlineDocumentText, HiOutlineUserPlus,
  HiOutlineChevronDown, HiOutlineChevronUp, HiOutlineFunnel,
} from 'react-icons/hi2';

const STATUS_COLORS = {
  scheduled: { color: 'var(--accent-cyan)',    bg: 'rgba(6,182,212,0.1)'   },
  ongoing:   { color: 'var(--accent-emerald)', bg: 'rgba(16,185,129,0.1)'  },
  completed: { color: 'var(--text-muted)',     bg: 'rgba(255,255,255,0.05)'},
  cancelled: { color: '#ef4444',               bg: 'rgba(239,68,68,0.1)'   },
};

const ROUND_PRESETS = ['Aptitude Test', 'Group Discussion', 'Technical Interview', 'HR Interview', 'Coding Round'];

/* ─── DRIVE CARD ─────────────────────────────────────────── */
function DriveCard({ drive, onSelect, onEdit, onDelete, isTPO }) {
  const sc = STATUS_COLORS[drive.status] || STATUS_COLORS.scheduled;
  const eligible = drive.drive_eligible_students?.[0]?.count ?? drive.drive_eligible_students?.length ?? '—';
  const offers   = drive.drive_offers?.[0]?.count ?? drive.drive_offers?.length ?? 0;

  return (
    <motion.div
      className="glass-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ padding: '20px', cursor: 'pointer' }}
      onClick={() => onSelect(drive)}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--brand-500), var(--brand-600))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '1.1rem', color: '#fff', flexShrink: 0,
          }}>
            {drive.company_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
              {drive.company_name}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {drive.job_role} · {drive.drive_type}
            </div>
          </div>
        </div>
        <span style={{
          fontSize: '0.68rem', fontWeight: 700, padding: '4px 10px', borderRadius: 99,
          textTransform: 'capitalize', color: sc.color, background: sc.bg,
        }}>
          {drive.status}
        </span>
      </div>

      {/* Meta */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {[
          { icon: HiOutlineCalendarDays, label: new Date(drive.drive_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
          { icon: HiOutlineCurrencyRupee, label: drive.ctc_min ? `₹${drive.ctc_min}–${drive.ctc_max || drive.ctc_min} LPA` : 'CTC not disclosed' },
          { icon: HiOutlineUsers, label: `${eligible} eligible` },
          { icon: HiOutlineDocumentText, label: `${offers} offer${offers !== 1 ? 's' : ''}` },
        ].map(({ icon: Icon, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <Icon size={14} style={{ flexShrink: 0 }} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--brand-400)', fontWeight: 600 }}>
          Manage drive <HiOutlineArrowRight size={13} />
        </div>
        {isTPO && (
          <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
            <button onClick={() => onEdit(drive)} style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: 'var(--text-secondary)',
            }}>
              <HiOutlinePencilSquare size={14} />
            </button>
            <button onClick={() => onDelete(drive.id)} style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
              borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: '#ef4444',
            }}>
              <HiOutlineTrash size={14} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── DRIVE DETAIL MODAL ─────────────────────────────────── */
function DriveDetailModal({ drive, onClose, isTPO, addToast }) {
  const [tab, setTab] = useState('eligible');
  const [eligible, setEligible] = useState([]);
  const [rounds, setRounds]     = useState([]);
  const [offers, setOffers]     = useState([]);
  const [roundResults, setRoundResults] = useState({});
  const [loading, setLoading]   = useState(true);
  const [addingRound, setAddingRound] = useState(false);
  const [newRound, setNewRound] = useState({ round_name: '', round_date: '' });
  const [offerForm, setOfferForm] = useState({ student_id: '', ctc: '', job_role: '', offer_date: '' });
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [addingEligible, setAddingEligible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [elRes, rndRes, offerRes] = await Promise.all([
        api.get(`/drives/${drive.id}/eligible`),
        api.get(`/drives/${drive.id}/rounds`),
        api.get(`/drives/${drive.id}/offers`),
      ]);
      setEligible(elRes.data?.data || []);
      setRounds(rndRes.data?.data || []);
      setOffers(offerRes.data?.data || []);

      // Load round results for each round
      const resultsMap = {};
      for (const r of rndRes.data?.data || []) {
        const res = await api.get(`/drives/${drive.id}/rounds/${r.id}/results`);
        resultsMap[r.id] = res.data?.data || [];
      }
      setRoundResults(resultsMap);
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, [drive.id]);

  useEffect(() => { load(); }, [load]);

  const handleAddRound = async () => {
    if (!newRound.round_name) return;
    try {
      await api.post(`/drives/${drive.id}/rounds`, newRound);
      addToast({ type: 'success', message: 'Round added' });
      setAddingRound(false);
      setNewRound({ round_name: '', round_date: '' });
      load();
    } catch { addToast({ type: 'error', message: 'Failed to add round' }); }
  };

  const handleAutoAdd = async () => {
    try {
      const res = await api.post(`/drives/${drive.id}/eligible`, {
        auto: true, college_id: drive.college_id,
        branch_id: drive.branch_id || undefined,
      });
      addToast({ type: 'success', message: `Added ${res.data?.data?.added || 0} students` });
      load();
    } catch { addToast({ type: 'error', message: 'Failed to add students' }); }
  };

  const handleShortlist = async (roundId, studentId, status) => {
    try {
      await api.post(`/drives/${drive.id}/rounds/${roundId}/results`, {
        results: [{ student_id: studentId, status }],
      });
      addToast({ type: 'success', message: `Marked as ${status}` });
      load();
    } catch { addToast({ type: 'error', message: 'Failed to update' }); }
  };

  const handleRecordOffer = async () => {
    if (!offerForm.student_id || !offerForm.ctc) {
      addToast({ type: 'error', message: 'Student and CTC are required' });
      return;
    }
    setSubmittingOffer(true);
    try {
      await api.post(`/drives/${drive.id}/offers`, {
        offers: [{ ...offerForm, ctc: parseFloat(offerForm.ctc) }],
      });
      addToast({ type: 'success', message: 'Offer recorded!' });
      setOfferForm({ student_id: '', ctc: '', job_role: '', offer_date: '' });
      load();
    } catch { addToast({ type: 'error', message: 'Failed to record offer' }); }
    finally { setSubmittingOffer(false); }
  };

  const TABS = [
    { key: 'eligible', label: `Eligible (${eligible.length})` },
    { key: 'rounds',   label: `Rounds (${rounds.length})` },
    { key: 'offers',   label: `Offers (${offers.length})` },
  ];

  return (
    <Modal isOpen onClose={onClose} title={`${drive.company_name} — ${drive.job_role}`} size="xl">
      {/* Drive meta */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { label: new Date(drive.drive_date).toLocaleDateString('en-IN', { dateStyle: 'medium' }), icon: HiOutlineCalendarDays },
          { label: drive.drive_type, icon: HiOutlineBuildingOffice2 },
          { label: drive.ctc_min ? `₹${drive.ctc_min}–${drive.ctc_max || drive.ctc_min} LPA` : 'CTC TBD', icon: HiOutlineCurrencyRupee },
          { label: `Min CGPA: ${drive.eligibility_cgpa || 0}`, icon: HiOutlineCheckCircle },
        ].map(({ label, icon: Icon }) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '5px 10px', fontSize: '0.78rem', color: 'var(--text-secondary)',
          }}>
            <Icon size={13} /> {label}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '7px 12px', borderRadius: 8, border: 'none',
            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
            background: tab === t.key ? 'var(--brand-500)' : 'transparent',
            color: tab === t.key ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Loading…</div>
      ) : (
        <>
          {/* ELIGIBLE STUDENTS TAB */}
          {tab === 'eligible' && (
            <div>
              {isTPO && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <Button size="sm" onClick={handleAutoAdd}>
                    <HiOutlineUserPlus size={14} style={{ marginRight: 6 }} /> Auto-add eligible students
                  </Button>
                </div>
              )}
              {eligible.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No students added yet. Click "Auto-add" to add all eligible students.
                </div>
              ) : (
                <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                  {eligible.map(e => (
                    <div key={e.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 9, marginBottom: 6,
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                          {e.student?.display_name || e.student?.username}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {e.student?.enrollment_number} · {e.student?.branches?.name}
                        </div>
                      </div>
                      <Badge variant={e.registered ? 'success' : 'warning'}>
                        {e.registered ? 'Registered' : 'Not registered'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ROUNDS TAB */}
          {tab === 'rounds' && (
            <div>
              {isTPO && (
                <div style={{ marginBottom: 16 }}>
                  {!addingRound ? (
                    <Button size="sm" onClick={() => setAddingRound(true)}>
                      <HiOutlinePlus size={14} style={{ marginRight: 6 }} /> Add Round
                    </Button>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Round Name</label>
                        <select
                          value={newRound.round_name}
                          onChange={e => setNewRound(p => ({ ...p, round_name: e.target.value }))}
                          style={{
                            width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
                            color: 'var(--text-primary)', borderRadius: 8, padding: '9px 12px', fontSize: '0.85rem',
                          }}
                        >
                          <option value="">Select preset…</option>
                          {ROUND_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <Input
                        label="Date" type="date"
                        value={newRound.round_date}
                        onChange={e => setNewRound(p => ({ ...p, round_date: e.target.value }))}
                        style={{ flex: 1, minWidth: 140 }}
                      />
                      <Button size="sm" onClick={handleAddRound}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAddingRound(false)}>Cancel</Button>
                    </div>
                  )}
                </div>
              )}

              {rounds.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No rounds defined yet.
                </div>
              ) : (
                rounds.map((rnd, idx) => {
                  const results = roundResults[rnd.id] || [];
                  const shortlisted = results.filter(r => r.status === 'shortlisted').length;
                  const appeared = results.filter(r => r.status !== 'absent').length;
                  return (
                    <div key={rnd.id} style={{
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10, padding: '14px 16px', marginBottom: 10,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            Round {idx + 1}: {rnd.round_name}
                          </div>
                          {rnd.round_date && (
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              {new Date(rnd.round_date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {shortlisted}/{appeared} shortlisted
                        </div>
                      </div>

                      {/* Quick shortlist from eligible students */}
                      {isTPO && eligible.length > 0 && (
                        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                          {eligible.map(e => {
                            const result = results.find(r => r.student_id === e.student_id);
                            return (
                              <div key={e.id} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
                              }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                  {e.student?.display_name || e.student?.username}
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 6 }}>
                                    {e.student?.enrollment_number}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  {['shortlisted', 'eliminated', 'absent'].map(s => (
                                    <button key={s} onClick={() => handleShortlist(rnd.id, e.student_id, s)} style={{
                                      padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                      fontSize: '0.68rem', fontWeight: 600,
                                      background: result?.status === s
                                        ? (s === 'shortlisted' ? 'var(--accent-emerald)' : s === 'eliminated' ? '#ef4444' : 'var(--text-muted)')
                                        : 'rgba(255,255,255,0.07)',
                                      color: result?.status === s ? '#fff' : 'var(--text-secondary)',
                                    }}>
                                      {s[0].toUpperCase() + s.slice(1)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* OFFERS TAB */}
          {tab === 'offers' && (
            <div>
              {isTPO && (
                <div style={{
                  background: 'rgba(249,115,22,0.04)', border: '1px solid rgba(249,115,22,0.12)',
                  borderRadius: 10, padding: '16px', marginBottom: 16,
                }}>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)', marginBottom: 12 }}>
                    Record New Offer
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Student</label>
                      <select
                        value={offerForm.student_id}
                        onChange={e => setOfferForm(p => ({ ...p, student_id: e.target.value }))}
                        style={{
                          width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
                          color: 'var(--text-primary)', borderRadius: 8, padding: '9px 12px', fontSize: '0.85rem',
                        }}
                      >
                        <option value="">Select student…</option>
                        {eligible.map(e => (
                          <option key={e.student_id} value={e.student_id}>
                            {e.student?.display_name || e.student?.username} ({e.student?.enrollment_number})
                          </option>
                        ))}
                      </select>
                    </div>
                    <Input label="CTC (LPA)" type="number" placeholder="e.g. 6.5"
                      value={offerForm.ctc}
                      onChange={e => setOfferForm(p => ({ ...p, ctc: e.target.value }))}
                    />
                    <Input label="Job Role" placeholder="e.g. Software Engineer"
                      value={offerForm.job_role}
                      onChange={e => setOfferForm(p => ({ ...p, job_role: e.target.value }))}
                    />
                    <Input label="Offer Date" type="date"
                      value={offerForm.offer_date}
                      onChange={e => setOfferForm(p => ({ ...p, offer_date: e.target.value }))}
                    />
                  </div>
                  <Button style={{ marginTop: 12 }} onClick={handleRecordOffer} loading={submittingOffer}>
                    Record Offer Letter
                  </Button>
                </div>
              )}

              {offers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No offers recorded yet.
                </div>
              ) : (
                offers.map(o => (
                  <div key={o.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', borderRadius: 9, marginBottom: 8,
                    background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.12)',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {o.student?.display_name || o.student?.username}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {o.job_role} · {o.student?.enrollment_number}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--accent-emerald)' }}>
                        ₹{o.ctc} LPA
                      </div>
                      <Badge variant={o.status === 'accepted' ? 'success' : o.status === 'declined' ? 'danger' : 'primary'}>
                        {o.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

/* ─── CREATE DRIVE MODAL ─────────────────────────────────── */
function CreateDriveModal({ onClose, onCreated, addToast }) {
  const user = useAuthStore(s => s.user);
  const [form, setForm] = useState({
    company_name: '', job_role: '', drive_date: '', drive_type: 'on-campus',
    job_type: 'full-time', location: '', ctc_min: '', ctc_max: '',
    description: '', eligibility_cgpa: '', eligibility_batch: '',
    eligibility_backlogs: '', college_id: user?.college_id || '',
  });
  const [saving, setSaving] = useState(false);

  const field = (key) => ({
    value: form[key],
    onChange: e => setForm(p => ({ ...p, [key]: e.target.value })),
  });

  const handleSave = async () => {
    if (!form.company_name || !form.job_role || !form.drive_date || !form.college_id) {
      addToast({ type: 'error', message: 'Company, job role, date, and college are required' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        ctc_min: form.ctc_min ? parseFloat(form.ctc_min) : null,
        ctc_max: form.ctc_max ? parseFloat(form.ctc_max) : null,
        eligibility_cgpa: form.eligibility_cgpa ? parseFloat(form.eligibility_cgpa) : 0,
        eligibility_backlogs: form.eligibility_backlogs ? parseInt(form.eligibility_backlogs) : 999,
      };
      await api.post('/drives', payload);
      addToast({ type: 'success', message: 'Drive scheduled successfully!' });
      onCreated();
      onClose();
    } catch (e) {
      addToast({ type: 'error', message: e.response?.data?.error || 'Failed to create drive' });
    } finally { setSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title="Schedule New Placement Drive" size="lg">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Input label="Company Name *" placeholder="e.g. Infosys" {...field('company_name')} />
        <Input label="Job Role *" placeholder="e.g. Software Engineer" {...field('job_role')} />
        <Input label="Drive Date *" type="date" {...field('drive_date')} />
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Drive Type</label>
          <select {...field('drive_type')} style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, padding: '9px 12px', fontSize: '0.85rem' }}>
            <option value="on-campus">On-Campus</option>
            <option value="off-campus">Off-Campus</option>
            <option value="pool">Pool Campus</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Job Type</label>
          <select {...field('job_type')} style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, padding: '9px 12px', fontSize: '0.85rem' }}>
            <option value="full-time">Full-Time</option>
            <option value="internship">Internship</option>
            <option value="ppo">PPO</option>
          </select>
        </div>
        <Input label="Location" placeholder="e.g. Hyderabad / Remote" {...field('location')} />
        <Input label="CTC Min (LPA)" type="number" placeholder="e.g. 4.5" {...field('ctc_min')} />
        <Input label="CTC Max (LPA)" type="number" placeholder="e.g. 8.0" {...field('ctc_max')} />
        <Input label="Min CGPA" type="number" placeholder="e.g. 6.0" {...field('eligibility_cgpa')} />
        <Input label="Max Backlogs Allowed" type="number" placeholder="e.g. 0 (no backlogs)" {...field('eligibility_backlogs')} />
        <Input label="Eligible Batch Year" placeholder="e.g. 2025" {...field('eligibility_batch')} />
      </div>
      <div style={{ marginTop: 14 }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Description / Notes</label>
        <textarea
          {...field('description')}
          placeholder="Any additional information for students…"
          rows={3}
          style={{
            width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', borderRadius: 8, padding: '9px 12px', fontSize: '0.85rem',
            resize: 'vertical', boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} loading={saving}>Schedule Drive</Button>
      </div>
    </Modal>
  );
}

/* ─── MAIN PAGE ──────────────────────────────────────────── */
export default function PlacementDrivesPage() {
  const user = useAuthStore(s => s.user);
  const addToast = useUiStore(s => s.addToast);
  const isTPO = ['admin', 'tpo'].includes(user?.role);

  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDrive, setSelectedDrive] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = user?.college_id ? `?college_id=${user.college_id}` : '';
      const res = await api.get(`/drives${params}`);
      setDrives(res.data?.data || []);
    } catch { setDrives([]); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this drive? This cannot be undone.')) return;
    try {
      await api.delete(`/drives/${id}`);
      addToast({ type: 'success', message: 'Drive deleted' });
      load();
    } catch { addToast({ type: 'error', message: 'Failed to delete drive' }); }
  };

  const filtered = statusFilter === 'all' ? drives : drives.filter(d => d.status === statusFilter);

  const STATUS_FILTERS = ['all', 'scheduled', 'ongoing', 'completed', 'cancelled'];

  return (
    <PageTransition>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: 'var(--gradient-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HiOutlineBriefcase size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Placement Drives
            </h1>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {drives.length} drive{drives.length !== 1 ? 's' : ''} · {drives.filter(d => d.status === 'scheduled').length} upcoming
            </p>
          </div>
        </div>
        {isTPO && (
          <Button onClick={() => setShowCreate(true)}>
            <HiOutlinePlus size={16} style={{ marginRight: 6 }} /> Schedule Drive
          </Button>
        )}
      </div>

      {/* Status filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
            fontSize: '0.78rem', fontWeight: 600, textTransform: 'capitalize',
            background: statusFilter === s ? 'var(--brand-500)' : 'rgba(255,255,255,0.06)',
            color: statusFilter === s ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.15s',
          }}>
            {s === 'all' ? `All (${drives.length})` : `${s} (${drives.filter(d => d.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Drive grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Loading drives…</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card-static" style={{ padding: '40px', textAlign: 'center' }}>
          <HiOutlineBriefcase size={36} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            No drives found
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 18 }}>
            {isTPO ? 'Schedule your first campus drive to get started.' : 'No placement drives are available for you right now.'}
          </div>
          {isTPO && (
            <Button onClick={() => setShowCreate(true)}>
              <HiOutlinePlus size={15} style={{ marginRight: 6 }} /> Schedule First Drive
            </Button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 16 }}>
          {filtered.map(d => (
            <DriveCard
              key={d.id} drive={d}
              onSelect={setSelectedDrive}
              onEdit={setSelectedDrive}
              onDelete={handleDelete}
              isTPO={isTPO}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {selectedDrive && (
        <DriveDetailModal
          drive={selectedDrive}
          onClose={() => setSelectedDrive(null)}
          isTPO={isTPO}
          addToast={addToast}
        />
      )}
      {showCreate && (
        <CreateDriveModal
          onClose={() => setShowCreate(false)}
          onCreated={load}
          addToast={addToast}
        />
      )}
    </PageTransition>
  );
}
