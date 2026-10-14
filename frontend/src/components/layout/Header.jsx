import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HiBars3, HiBell, HiXMark, HiOutlineMoon, HiOutlineSparkles } from 'react-icons/hi2';
import useAuthStore from '../../store/authStore';
import useUiStore from '../../store/uiStore';
import useNotificationStore from '../../store/notificationStore';

const PAGE_LABELS = {
  '/dashboard':     'Dashboard',
  '/courses':       'Courses',
  '/progress':      'Progress',
  '/jobs':          'Job Board',
  '/settings':      'Settings',
  '/ai-studio':     'AI Studio',
  '/admin':         'Admin Panel',
  '/calendar':      'Calendar',
  '/notifications': 'Notifications',
};

const TYPE_ICON = {
  grade: '🎯',
  application_status: '💼',
  course_access: '📚',
  test_published: '📝',
  course_complete: '🏆',
  tutor_reply: '✨',
  calendar_event: '🗓️',
};

function timeAgo(iso) {
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.floor((now - then) / 1000);
  if (s < 60)   return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Header() {
  const user          = useAuthStore((s) => s.user);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const theme         = useUiStore((s) => s.theme);
  const toggleTheme   = useUiStore((s) => s.toggleTheme);
  const location      = useLocation();
  const navigate      = useNavigate();

  const items       = useNotificationStore((s) => s.items);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const loaded      = useNotificationStore((s) => s.loaded);
  const fetchAll    = useNotificationStore((s) => s.fetch);
  const markRead    = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  const pageLabel = PAGE_LABELS[location.pathname] || 'Orbivex';
  const initial   = (user?.display_name || user?.email || 'U')[0].toUpperCase();

  useEffect(() => {
    if (user && !loaded) fetchAll();
  }, [user, loaded, fetchAll]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifOpen]);

  const onClickItem = (n) => {
    if (!n.read) markRead(n.id);
    if (n.action_url) {
      setNotifOpen(false);
      navigate(n.action_url);
    }
  };

  return (
    <header className="header">
      {/* Left — breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          className="btn btn-icon btn-ghost"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          style={{ display: 'flex' }}
        >
          <HiBars3 size={20} />
        </button>

        <div className="header-breadcrumb">
          <span style={{ color: 'var(--brand-500)', fontSize: '0.9rem' }}>◎</span>
          <span style={{ color: 'var(--text-muted)' }}>/</span>
          <span className="page-title">{pageLabel}</span>
        </div>
      </div>

      {/* Right — actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

        {/* Theme toggle — Dark (warm) ⇄ Night (cool black) */}
        <button
          className="btn btn-icon btn-ghost"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to Night theme' : 'Switch to Dark theme'}
          title={theme === 'dark' ? 'Night theme' : 'Dark theme'}
          style={{ display: 'flex' }}
        >
          {theme === 'dark' ? <HiOutlineMoon size={19} /> : <HiOutlineSparkles size={19} />}
        </button>

        {/* Notification Bell */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            className="btn btn-icon btn-ghost"
            aria-label="Notifications"
            onClick={() => setNotifOpen(!notifOpen)}
            style={{ position: 'relative', display: 'flex' }}
          >
            <HiBell size={19} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                minWidth: 16, height: 16, padding: '0 4px',
                borderRadius: 8,
                background: 'linear-gradient(135deg,#f97316,#fbbf24)',
                color: '#0a0a0a',
                font: '700 0.65rem/1 var(--font-display)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                border: '1.5px solid var(--bg-primary, #0a0a0a)',
                boxShadow: '0 0 6px rgba(249,115,22,0.7)',
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: 360, maxHeight: 460, overflowY: 'auto',
              background: 'var(--bg-secondary)',
              border: '1px solid rgba(249,115,22,0.12)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
              zIndex: 1000,
              animation: 'notifSlideIn 0.2s ease',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px 10px',
                borderBottom: '1px solid rgba(249,115,22,0.08)',
              }}>
                <span style={{ font: '600 0.92rem/1 var(--font-display)', color: 'var(--text-primary)' }}>
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      font: '500 0.72rem/1 var(--font-body)', color: 'var(--brand-400)',
                      padding: '4px 8px', borderRadius: 6,
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {items.length === 0 ? (
                <div style={{
                  padding: '32px 16px', textAlign: 'center',
                  color: 'var(--text-muted)', font: '400 0.85rem/1.5 var(--font-body)',
                }}>
                  <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>🔔</div>
                  No notifications yet
                </div>
              ) : (
                <div style={{ padding: '6px 0' }}>
                  {items.slice(0, 8).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => onClickItem(n)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%',
                        padding: '10px 16px',
                        background: n.read ? 'transparent' : 'rgba(249,115,22,0.04)',
                        borderLeft: n.read ? '3px solid transparent' : '3px solid var(--brand-500)',
                        border: 'none', textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: 2 }}>
                        {TYPE_ICON[n.type] || '🔔'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          font: `${n.read ? '400' : '600'} 0.84rem/1.4 var(--font-body)`,
                          color: n.read ? 'var(--text-secondary)' : 'var(--text-primary)',
                        }}>
                          {n.title}
                        </div>
                        {n.message && (
                          <div style={{
                            font: '400 0.76rem/1.4 var(--font-body)',
                            color: 'var(--text-muted)', marginTop: 2,
                          }}>
                            {n.message}
                          </div>
                        )}
                        <div style={{
                          font: '400 0.68rem/1 var(--font-body)',
                          color: 'var(--text-muted)', marginTop: 4,
                        }}>
                          {timeAgo(n.created_at)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div style={{ padding: '8px 16px 12px', borderTop: '1px solid rgba(249,115,22,0.08)' }}>
                <button
                  onClick={() => { setNotifOpen(false); navigate('/notifications'); }}
                  style={{
                    width: '100%', padding: '8px 12px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 8, color: 'var(--text-secondary)',
                    font: '500 0.78rem/1 var(--font-body)', cursor: 'pointer',
                  }}
                >
                  See all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="header-user-pill">
          <div className="header-avatar">{initial}</div>
          <div>
            <div className="header-user-name">
              {user?.display_name || user?.email?.split('@')[0] || 'User'}
            </div>
            <div className="header-user-role">{user?.role || 'student'}</div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes notifSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </header>
  );
}
