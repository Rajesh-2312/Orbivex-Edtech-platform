import { create } from 'zustand';

// ── Theme ──────────────────────────────────────────────────────────
// Two DARK variants only: 'dark' (warm charcoal, the original) and
// 'night' (cool deep-black). Both keep light text on dark surfaces, so
// every page stays fully legible regardless of the inline colors used.
const THEMES = ['dark', 'night'];

function readStoredTheme() {
  try {
    const t = localStorage.getItem('orbivex-theme');
    if (THEMES.includes(t)) return t;
  } catch { /* localStorage unavailable */ }
  return 'dark';
}

// Apply to <html data-theme="…"> so the CSS overrides in index.css take effect.
function applyTheme(theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
  try { localStorage.setItem('orbivex-theme', theme); } catch { /* ignore */ }
}

const initialTheme = readStoredTheme();
applyTheme(initialTheme); // set before first paint so there is no flash

const useUiStore = create((set) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    if (!THEMES.includes(theme)) return;
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => set((s) => {
    const next = s.theme === 'dark' ? 'night' : 'dark';
    applyTheme(next);
    return { theme: next };
  }),

  sidebarOpen: true,
  sidebarCollapsed: false,
  activeModal: null,
  modalData: null,
  toasts: [],

  // True while a proctored attempt is in progress. Set by useProctor, read by
  // Layout to strip UI that has no business being on screen during an exam —
  // chiefly the AI assistant, which is a cheating vector rather than clutter.
  examMode: false,
  setExamMode: (on) => set({ examMode: !!on }),

  toggleSidebar: () => set((s) => {
    // On mobile (<= 768px): toggle the overlay open/close
    // On desktop: toggle the collapsed state
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      return { sidebarOpen: !s.sidebarOpen };
    }
    return { sidebarCollapsed: !s.sidebarCollapsed };
  }),
  closeSidebar: () => set({ sidebarOpen: false }),
  collapseSidebar: (val) => set({ sidebarCollapsed: val }),

  openModal: (name, data = null) => set({ activeModal: name, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),

  addToast: (message, type = 'info', duration = 4000) => {
    const id = Date.now();
    set((s) => ({
      toasts: [...s.toasts, { id, message, type, duration }],
    }));
    setTimeout(() => {
      set((s) => ({
        toasts: s.toasts.filter((t) => t.id !== id),
      }));
    }, duration);
  },

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export default useUiStore;
