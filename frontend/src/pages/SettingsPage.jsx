import { useState } from 'react';
import { motion } from 'framer-motion';
import PageTransition from '../components/layout/PageTransition';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import useAuthStore from '../store/authStore';
import useUiStore from '../store/uiStore';
import { HiUser, HiIdentification, HiEnvelope, HiAcademicCap, HiBuildingOffice2, HiShieldCheck } from 'react-icons/hi2';

const ROLE_LABELS = { student: 'Student', teacher: 'Educator', admin: 'Administrator' };
const ROLE_COLORS = { student: 'var(--accent-cyan)', teacher: 'var(--accent-emerald)', admin: 'var(--brand-500)' };

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(249,115,22,0.06)' }}>
      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>{value || '—'}</span>
    </div>
  );
}

export default function SettingsPage() {
  const user          = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const addToast      = useUiStore((s) => s.addToast);

  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio]                 = useState(user?.bio || '');
  const [enrollmentNumber, setEnrollmentNumber] = useState(user?.enrollment_number || '');
  const [saving, setSaving]           = useState(false);
  const [emailOptIn, setEmailOptIn]   = useState(user?.notify_email_optin !== false);
  const [emailSaving, setEmailSaving] = useState(false);

  const handleSave = async () => {
    if (!displayName.trim()) { addToast('Display name cannot be empty', 'error'); return; }
    setSaving(true);
    const result = await updateProfile({
      display_name: displayName,
      bio,
      enrollment_number: enrollmentNumber
    });
    if (result.ok) {
      addToast('Profile updated successfully!', 'success');
    } else {
      addToast(result.error || 'Failed to update profile', 'error');
    }
    setSaving(false);
  };

  const toggleEmailOptIn = async () => {
    const next = !emailOptIn;
    setEmailOptIn(next);
    setEmailSaving(true);
    const result = await updateProfile({ notify_email_optin: next });
    setEmailSaving(false);
    if (!result.ok) {
      setEmailOptIn(!next); // revert on failure
      addToast(result.error || 'Failed to update preference', 'error');
    } else {
      addToast(next ? 'Email notifications turned on' : 'Email notifications turned off', 'success');
    }
  };

  const card = { padding: '28px', marginBottom: '20px' };
  const section = { font: '700 0.72rem/1 var(--font-display)', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '18px' };

  return (
    <PageTransition>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 4 }}>Settings</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Manage your account and preferences</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        {/* ── Left: editable profile ── */}
        <div>
          <motion.div className="glass-card-static" style={card} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <p style={section}>Profile Information</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input label="Username" icon={HiUser} value={user?.username || user?.email?.split('@')[0] || ''} disabled />

              <Input
                label="Display Name"
                icon={HiIdentification}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
              />

              <Input
                label="Roll / Enrollment Number"
                icon={HiAcademicCap}
                value={enrollmentNumber}
                onChange={(e) => setEnrollmentNumber(e.target.value)}
                placeholder="Your Roll or Enrollment Number"
              />

              <div className="input-group">
                <label style={{ font: '500 0.82rem/1.4 var(--font-body)', color: 'var(--text-secondary)' }}>Bio</label>
                <textarea
                  className="glass-input"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  rows={4}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <Button variant="primary" onClick={handleSave} loading={saving} style={{ alignSelf: 'flex-start' }}>
                Save Changes
              </Button>
            </div>
          </motion.div>

          {/* ── Notification preferences ── */}
          <motion.div className="glass-card-static" style={card} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <p style={section}>Notifications</p>
            <button
              type="button"
              onClick={toggleEmailOptIn}
              disabled={emailSaving}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '12px 14px', textAlign: 'left',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10, cursor: emailSaving ? 'default' : 'pointer',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '600 0.92rem/1.3 var(--font-display)', color: 'var(--text-primary)' }}>
                  Email me when something needs my attention
                </div>
                <div style={{ font: '400 0.78rem/1.5 var(--font-body)', color: 'var(--text-muted)', marginTop: 4 }}>
                  Grades, new tests, course access, application status. In-app notifications stay on regardless.
                </div>
              </div>
              <span style={{
                width: 40, height: 22, borderRadius: 999, position: 'relative',
                background: emailOptIn ? 'linear-gradient(135deg,#f97316,#fbbf24)' : 'rgba(255,255,255,0.12)',
                transition: 'background 0.2s', flexShrink: 0, marginLeft: 12,
              }}>
                <span style={{
                  position: 'absolute', top: 2, left: emailOptIn ? 20 : 2,
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                }} />
              </span>
            </button>
          </motion.div>
        </div>

        {/* ── Right: account info ── */}
        <div>
          {/* Account overview */}
          <motion.div className="glass-card-static" style={card} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <p style={section}>Account</p>

            <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'var(--gradient-brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                font: '800 1.4rem/1 var(--font-display)', color: 'white',
              }}>
                {(user?.display_name || user?.email || 'U')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{user?.display_name || 'User'}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{user?.email}</div>
              </div>
            </div>

            <InfoRow label="Email" value={user?.email} />
            <InfoRow label="Role" value={
              <span style={{ color: ROLE_COLORS[user?.role] || 'var(--text-primary)' }}>
                {ROLE_LABELS[user?.role] || user?.role}
              </span>
            } />
            <InfoRow label="Member since" value={user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null} />
          </motion.div>

          {/* Institutional info */}
          {(user?.college_id || user?.enrollment_number || user?.hall_ticket_number) && (
            <motion.div className="glass-card-static" style={card} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <p style={section}>Institutional Info</p>
              <InfoRow label="Enrollment No." value={user?.enrollment_number} />
              <InfoRow label="Hall Ticket No." value={user?.hall_ticket_number} />
            </motion.div>
          )}

          {/* Role badge */}
          <motion.div
            style={{
              padding: '16px 20px',
              background: 'rgba(249,115,22,0.07)',
              border: '1px solid rgba(249,115,22,0.15)',
              borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          >
            <HiShieldCheck size={22} style={{ color: 'var(--brand-400)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                {ROLE_LABELS[user?.role] || 'Student'} Access
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {user?.role === 'admin'
                  ? 'Full platform management access'
                  : user?.role === 'teacher'
                  ? 'Create and manage courses & lessons'
                  : 'Enroll in courses, take quizzes, apply to jobs'}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}
