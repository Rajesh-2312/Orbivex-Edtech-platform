import { create } from 'zustand';

const useUiStore = create((set) => ({
  sidebarOpen: true,
  sidebarCollapsed: false,
  activeModal: null,
  modalData: null,
  toasts: [],

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
