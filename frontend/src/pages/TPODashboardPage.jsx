import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageTransition from '../components/layout/PageTransition';
import useAuthStore from '../store/authStore';
import api from '../lib/api';
import {
  HiOutlineBuildingOffice2, HiOutlineUsers, HiOutlineChartBar,
  HiOutlineBriefcase, HiOutlineCheckCircle, HiOutlineClock,
  HiOutlineArrowRight, HiOutlineCalendarDays, HiOutlineTrophy,
  HiOutlineDocumentText, HiOutlinePlus, HiOutlineArrowTrendingUp,
} from 'react-icons/hi2';

function StatCard({ icon: Icon, label, value, sub, color, trend }) {
  return (
    <motion.div
      className="glass-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ padding: '22px 24px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={22} style={{ color }} />
        </div>
        {trend !== undefined && (
          <span style={{
            fontSize: '0.72rem', fontWeight: 700,
            color: trend >= 0 ? 'var(--accent-emerald)' : '#ef4444',
            background: trend >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            padding: '3px 8px', borderRadius: 99,
          }}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: 6 }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>
        )}
      </div>
    </motion.div>
  );
}

function QuickAction({ icon: Icon, title, desc, to, color, badge }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <motion.div
        className="glass-card"
        whileHover={{ y: -3 }}
        transition={{ duration: 0.18 }}
        style={{ padding: '20px', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
      >
        {badge && (
          <span style={{
            position: 'absolute', top: 12, right: 12,
            fontSize: '0.65rem', fontWeight: 700, color: '#fff',
            background: 'var(--brand-500)', padding: '2px 8px',
            borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>{badge}</span>
        )}
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
        }}>
          <Icon size={20} style={{ color }} />
        </div>
        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{desc}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12, fontSize: '0.76rem', color, fontWeight: 600 }}>
          Open <HiOutlineArrowRight size={12} />
        </div>
      </motion.div>
    </Link>
  );
}

function DriveRow({ drive }) {
  const statusColor = {
    scheduled: 'var(--accent-cyan)',
    ongoing: 'var(--accent-emerald)',
    completed: 'var(--text-muted)',
    cancelled: '#ef4444',
  };
  return (
    <Link to="/placement/drives" style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '12px 16px',
        background: 'rgba(249,115,22,0.04)',
        border: '1px solid rgba(249,115,22,0.08)',
        borderRadius: 10, marginBottom: 8, cursor: 'pointer',
        transition: 'background 0.2s',
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 9,
          background: 'rgba(249,115,22,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: '0.95rem', color: 'var(--brand-400)',
          flexShrink: 0,
        }}>
          {drive.company_name?.[0] || '?'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
            {drive.company_name}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {drive.job_role} · {new Date(drive.drive_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </div>
        </div>
        <span style={{
          fontSize: '0.68rem', fontWeight: 700, padding: '3px 10px',
          borderRadius: 99, textTransform: 'capitalize',
          color: statusColor[drive.status] || 'var(--text-muted)',
          background: `${statusColor[drive.status]}18` || 'rgba(255,255,255,0.05)',
        }}>
          {drive.status}
        </span>
      </div>
    </Link>
  );
}

export default function TPODashboardPage() {
  const user = useAuthStore(s => s.user);
  const [stats, setStats] = useState(null);
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const collegeId = user?.college_id;
    Promise.all([
      api.get(`/analytics/placement${collegeId ? `?college_id=${collegeId}` : ''}`),
      api.get(`/drives?upcoming=true${collegeId ? `&college_id=${collegeId}` : ''}`),
    ])
      .then(([analyticsRes, drivesRes]) => {
        setStats(analyticsRes.data?.data?.summary || null);
        setDrives((drivesRes.data?.data || []).slice(0, 5));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const quickActions = [
    {
      icon: HiOutlinePlus, title: 'Schedule Drive',
      desc: 'Add a new campus placement drive with eligibility criteria',
      to: '/placement/drives', color: 'var(--brand-500)', badge: 'New',
    },
    {
      icon: HiOutlineUsers, title: 'Student Profiles',
      desc: 'View placement readiness scores for all your students',
      to: '/placement/profiles', color: 'var(--accent-emerald)',
    },
    {
      icon: HiOutlineChartBar, title: 'Placement Report',
      desc: 'Branch-wise analytics and NAAC-ready PDF export',
      to: '/placement/analytics', color: 'var(--accent-violet)',
    },
    {
      icon: HiOutlineDocumentText, title: 'Offer Letters',
      desc: 'Record and track all offer letters for placed students',
      to: '/placement/drives', color: 'var(--accent-cyan)',
    },
    {
      icon: HiOutlineCalendarDays, title: 'Drive Calendar',
      desc: 'View all scheduled drives on a timeline',
      to: '/placement/drives', color: '#f59e0b',
    },
    {
      icon: HiOutlineTrophy, title: 'Top Recruiters',
      desc: 'Companies with highest offer counts this season',
      to: '/placement/analytics', color: '#a78bfa',
    },
  ];

  return (
    <PageTransition>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: 'var(--gradient-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HiOutlineBriefcase size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              TPO Dashboard
            </h1>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Training &amp; Placement Officer — {user?.display_name || user?.username}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 16, marginBottom: 28,
      }}>
        <StatCard
          icon={HiOutlineUsers}
          label="Total Students"
          value={loading ? '—' : (stats?.total_students ?? 0).toLocaleString()}
          sub="in your college"
          color="var(--brand-500)"
        />
        <StatCard
          icon={HiOutlineCheckCircle}
          label="Placed Students"
          value={loading ? '—' : (stats?.placed_students ?? 0).toLocaleString()}
          sub={`${stats?.placement_pct ?? 0}% placement rate`}
          color="var(--accent-emerald)"
          trend={stats?.placement_pct ?? undefined}
        />
        <StatCard
          icon={HiOutlineBuildingOffice2}
          label="Drives Conducted"
          value={loading ? '—' : (stats?.total_drives ?? 0).toLocaleString()}
          sub="this season"
          color="var(--accent-cyan)"
        />
        <StatCard
          icon={HiOutlineArrowTrendingUp}
          label="Avg Package"
          value={loading ? '—' : stats?.avg_ctc ? `₹${stats.avg_ctc} LPA` : '—'}
          sub={stats?.max_ctc ? `Highest: ₹${stats.max_ctc} LPA` : 'No offers yet'}
          color="#f59e0b"
        />
        <StatCard
          icon={HiOutlineClock}
          label="Total Offers"
          value={loading ? '—' : (stats?.total_offers ?? 0).toLocaleString()}
          sub="offer letters issued"
          color="var(--accent-violet)"
        />
      </div>

      {/* Quick Actions */}
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>
        Quick Actions
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 14, marginBottom: 32,
      }}>
        {quickActions.map(a => <QuickAction key={a.title} {...a} />)}
      </div>

      {/* Upcoming Drives */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Upcoming Drives
            </h2>
            <Link to="/placement/drives" style={{ fontSize: '0.78rem', color: 'var(--brand-400)', fontWeight: 600 }}>
              View all →
            </Link>
          </div>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading…</div>
          ) : drives.length === 0 ? (
            <div className="glass-card-static" style={{ padding: '20px', textAlign: 'center' }}>
              <HiOutlineCalendarDays size={28} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No upcoming drives</div>
              <Link to="/placement/drives" style={{ fontSize: '0.8rem', color: 'var(--brand-400)', fontWeight: 600 }}>
                Schedule one →
              </Link>
            </div>
          ) : (
            drives.map(d => <DriveRow key={d.id} drive={d} />)
          )}
        </div>

        {/* Placement snapshot */}
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
            Placement Snapshot
          </h2>
          <div className="glass-card-static" style={{ padding: '20px' }}>
            {loading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading…</div>
            ) : !stats ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                No placement data yet. Schedule your first drive to get started.
              </div>
            ) : (
              <>
                {/* Placement % ring */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
                  <svg width={90} height={90}>
                    <circle cx={45} cy={45} r={36} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7} />
                    <circle
                      cx={45} cy={45} r={36} fill="none"
                      stroke="var(--brand-500)" strokeWidth={7}
                      strokeDasharray={`${(stats.placement_pct / 100) * 226} 226`}
                      strokeLinecap="round"
                      transform="rotate(-90 45 45)"
                      style={{ transition: 'stroke-dasharray 1s ease' }}
                    />
                    <text x={45} y={50} textAnchor="middle" fill="white" fontSize={15} fontWeight={800}>
                      {stats.placement_pct}%
                    </text>
                  </svg>
                  <div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{stats.placed_students}</strong> students placed out of <strong style={{ color: 'var(--text-primary)' }}>{stats.total_students}</strong>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {stats.total_offers} offer letters · {stats.total_drives} drives
                    </div>
                  </div>
                </div>

                {/* Package info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Avg Package', value: stats.avg_ctc ? `₹${stats.avg_ctc} LPA` : '—', color: 'var(--accent-emerald)' },
                    { label: 'Highest Package', value: stats.max_ctc ? `₹${stats.max_ctc} LPA` : '—', color: '#f59e0b' },
                  ].map(item => (
                    <div key={item.label} style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 10, padding: '12px 14px',
                    }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: item.color }}>{item.value}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>{item.label}</div>
                    </div>
                  ))}
                </div>

                <Link to="/placement/analytics" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  marginTop: 16, fontSize: '0.8rem', color: 'var(--brand-400)', fontWeight: 600,
                  textDecoration: 'none',
                }}>
                  View full report <HiOutlineArrowRight size={13} />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
