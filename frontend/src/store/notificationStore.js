import { create } from 'zustand';
import api from '../lib/api';

const useNotificationStore = create((set, get) => ({
  items: [],
  unreadCount: 0,
  loading: false,
  loaded: false,

  fetch: async ({ unreadOnly = false } = {}) => {
    set({ loading: true });
    try {
      const res = await api.get(`/notifications?limit=20${unreadOnly ? '&unread_only=1' : ''}`);
      const payload = res.data?.data || {};
      set({
        items: payload.items || [],
        unreadCount: payload.unread_count || 0,
        loading: false,
        loaded: true,
      });
    } catch (err) {
      set({ loading: false, loaded: true });
    }
  },

  markRead: async (id) => {
    if (!id) return;
    // Optimistic
    set((s) => ({
      items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
      unreadCount: Math.max(0, s.unreadCount - (s.items.find((n) => n.id === id)?.read ? 0 : 1)),
    }));
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch (err) {
      // best-effort; let next fetch reconcile
    }
  },

  markAllRead: async () => {
    set((s) => ({
      items: s.items.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
    try {
      await api.patch('/notifications/read-all');
    } catch (err) {
      // best-effort
    }
  },

  removeLocal: (id) =>
    set((s) => ({ items: s.items.filter((n) => n.id !== id) })),

  pushFromRealtime: (notif) => {
    if (!notif?.id) return;
    set((s) => {
      // Dedup if we've already received this row
      if (s.items.some((n) => n.id === notif.id)) return s;
      return {
        items: [notif, ...s.items].slice(0, 50),
        unreadCount: s.unreadCount + (notif.read ? 0 : 1),
      };
    });
  },

  reset: () => set({ items: [], unreadCount: 0, loading: false, loaded: false }),
}));

export default useNotificationStore;
