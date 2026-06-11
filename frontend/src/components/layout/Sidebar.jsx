import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  HiOutlineHome, HiOutlineBookOpen, HiOutlineChartBar,
  HiOutlineBriefcase, HiOutlineCog6Tooth, HiArrowRightOnRectangle,
  HiOutlineShieldCheck, HiOutlineClipboardDocumentList,
  HiOutlineBuildingOffice2, HiOutlineCalendarDays, HiOutlineLanguage,
  HiOutlineUserGroup, HiOutlineDocumentChartBar, HiOutlineSparkles,
  HiOutlineCommandLine, HiOutlineDocumentText,
  HiOutlinePuzzlePiece, HiOutlineArchiveBox, HiOutlineBell,
} from 'react-icons/hi2';
import useAuthStore from '../../store/authStore';
import useUiStore from '../../store/uiStore';
import { useNotifications } from '../../hooks/useRealtime';

const navItems = [
  { path: '/dashboard',    label: 'Dashboard',    Icon: HiOutlineHome },
  { path: '/courses',      label: 'Courses',      Icon: HiOutlineBookOpen },
  { path: '/tests',        label: 'Tests',        Icon: HiOutlineClipboardDocumentList },
  { path: '/calendar',     label: 'Calendar',     Icon: HiOutlineCalendarDays },
  { path: '/progress',     label: 'Progress',     Icon: HiOutlineChartBar },
  { path: '/jobs',         label: 'Jobs',         Icon: HiOutlineBriefcase },
  { path: '/company-prep', label: 'Company Prep', Icon: HiOutlineBuildingOffice2 },
  // ── Placement Tools ────────────────────────────────────────
  { path: '/coding',       label: 'DSA Practice', Icon: HiOutlineCommandLine },
  { path: '/resume',       label: 'Resume Builder',Icon: HiOutlineDocumentText },
  { path: '/skill-gap',    label: 'Skill Gap',    Icon: HiOutlinePuzzlePiece },
  { path: '/pyq',          label: 'PYQ Bank',     Icon: HiOutlineArchiveBox },
  // ── Other ──────────────────────────────────────────────────
  { path: '/lsrw',         label: 'LSRW Skills',  Icon: HiOutlineLanguage },
  { path: '/my-placement', label: 'My Placement', Icon: HiOutlineSparkles },
  { path: '/settings',     label: 'Settings',     Icon: HiOutlineCog6Tooth },
];

const tpoItems = [
  { path: '/placement',           label: 'TPO Dashboard',  Icon: HiOutlineShieldCheck },
  { path: '/placement/drives',    label: 'Drives',         Icon: HiOutlineBriefcase },
  { path: '/placement/profiles',  label: 'Student Profiles', Icon: HiOutlineUserGroup },
  { path: '/placement/analytics', label: 'Analytics',      Icon: HiOutlineDocumentChartBar },
];

const adminItems = [
  { path: '/admin', label: 'Admin Panel', Icon: HiOutlineShieldCheck },
];

/* Inline SVG planet logo matching the Orbivex brand */
function PlanetIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="pg" cx="38%" cy="32%" r="65%">
          <stop offset="0%"  stopColor="#ffb347" />
          <stop offset="45%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#7c2d12" />
        </radialGradient>
        <linearGradient id="rg1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#fbbf24" stopOpacity="0.9" />
          <stop offset="50%"  stopColor="#f97316" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id="rg2" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%"   stopColor="#fbbf24" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#ea580c" stopOpacity="0.1" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Orbit ring back */}
      <ellipse cx="20" cy="20" rx="18" ry="5.5" stroke="url(#rg2)" strokeWidth="1.5" fill="none" opacity="0.5"/>
      {/* Planet body */}
      <circle cx="20" cy="20" r="11" fill="url(#pg)" filter="url(#glow)"/>
      {/* Shine */}
      <ellipse cx="16" cy="16" rx="4" ry="2.5" fill="white" opacity="0.18" transform="rotate(-20 16 16)"/>
      {/* Orbit ring front */}
      <ellipse cx="20" cy="20" rx="18" ry="5.5" stroke="url(#rg1)" strokeWidth="1.8" fill="none"
        strokeDasharray="28 8" strokeDashoffset="0">
        <animateTransform attributeName="transform" type="rotate" from="0 20 20" to="360 20 20" dur="6s" repeatCount="indefinite"/>
      </ellipse>
    </svg>
  );
}

export default function Sidebar() {
  const user    = useAuthStore((s) => s.user);
  const logout  = useAuthStore((s) => s.logout);
  const { sidebarOpen, sidebarCollapsed, closeSidebar } = useUiStore();
  const navigate = useNavigate();

  const [unreadCount, setUnreadCount] = useState(0);
  useNotifications(user?.id, () => setUnreadCount((n) => n + 1));

  const handleLogout = () => { logout(); navigate('/login'); };

  const isAdmin = user?.role === 'admin';
  const isTPOorTeacher = ['tpo', 'teacher'].includes(user?.role);

  // Build nav based on role — no duplicates
  const items = isAdmin
    ? [...navItems, ...tpoItems, ...adminItems]
    : isTPOorTeacher
    ? [...navItems, ...tpoItems]
    : navItems;

  return (
    <>
      {/* Mobile backdrop overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={closeSidebar}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 99,
            display: 'none',
          }}
        />
      )}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${sidebarOpen ? 'open' : ''}`}>
      {/* Logo */}
      <div className="logo">
        <div className="logo-planet">
          <PlanetIcon />
        </div>
        <div className="logo-wordmark">
          <div style={{ display: 'flex' }}>
            <span className="orbi">ORBI</span>
            <span className="vex">VEX</span>
          </div>
          <span className="tagline">Your World. Our Orbit.</span>
        </div>
      </div>

      {/* User quick-info */}
      {user && !sidebarCollapsed && (
        <div style={{
          margin: '0 4px 16px',
          padding: '10px 12px',
          background: 'rgba(249,115,22,0.06)',
          border: '1px solid rgba(249,115,22,0.1)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg,#ea580c,#fbbf24)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            font: '700 0.8rem/1 var(--font-display)', color: 'white', flexShrink: 0,
          }}>
            {(user.display_name || user.email || 'U')[0].toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: '600 0.82rem/1.2 var(--font-body)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.display_name || user.email?.split('@')[0]}
            </div>
            <div style={{ font: '400 0.68rem/1.2 var(--font-body)', color: 'var(--brand-400)', textTransform: 'capitalize', marginTop: 2 }}>
              {user.role}
            </div>
          </div>
        </div>
      )}

      {/* Section label */}
      {!sidebarCollapsed && (
        <div style={{ font: '600 0.65rem/1 var(--font-body)', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 14px 8px' }}>
          Navigation
        </div>
      )}

      {/* Navigation */}
      <nav className="sidebar-nav">
        {items.map(({ path, label, Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            title={label}
          >
            <Icon className="nav-link-icon" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {/* Notifications bell with live unread badge */}
        <NavLink
          to="/notifications"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          title="Notifications"
          style={{ position: 'relative' }}
          onClick={() => setUnreadCount(0)}
        >
          <HiOutlineBell className="nav-link-icon" />
          <span>Notifications</span>
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: 6, right: 10,
              background: '#f97316', color: '#fff',
              fontSize: '0.6rem', fontWeight: 700,
              padding: '1px 5px', borderRadius: 99,
              lineHeight: 1.4, minWidth: 16, textAlign: 'center',
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </NavLink>

        <button
          className="nav-link"
          onClick={handleLogout}
          style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', color: 'var(--text-muted)' }}
          title="Logout"
        >
          <HiArrowRightOnRectangle className="nav-link-icon" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
    </>
  );
}
