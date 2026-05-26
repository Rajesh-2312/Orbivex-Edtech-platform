import { create } from 'zustand';
import api from '../lib/api';
import { supabase } from '../lib/supabase';
import useNotificationStore from './notificationStore';
import useUiStore from './uiStore';

// Module-scope handle to the Realtime channel so we can unsubscribe cleanly.
let notifChannel = null;

async function attachRealtime(userId, accessToken, refreshToken) {
  if (!userId || !accessToken) return;
  try {
    // Make the supabase JS client carry the user's identity so RLS
    // policies on `notifications` (which require auth.uid() = user_id)
    // permit Realtime broadcasts.
    if (refreshToken) {
      await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    } else {
      // Best-effort if refresh_token isn't available — Realtime still picks
      // up the JWT from setAuth for socket header.
      supabase.realtime.setAuth(accessToken);
    }

    if (notifChannel) {
      try { await supabase.removeChannel(notifChannel); } catch {}
      notifChannel = null;
    }

    notifChannel = supabase
      .channel('notif:' + userId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + userId },
        (payload) => {
          const row = payload?.new;
          if (!row) return;
          try {
            useNotificationStore.getState().pushFromRealtime(row);
            useUiStore.getState().addToast(row.title || 'New notification', 'info');
          } catch (e) {
            // never crash the socket handler
          }
        }
      )
      .subscribe();
  } catch (err) {
    console.warn('[realtime] notifications channel failed:', err?.message);
  }
}

async function detachRealtime() {
  try {
    if (notifChannel) {
      await supabase.removeChannel(notifChannel);
      notifChannel = null;
    }
    await supabase.auth.signOut().catch(() => {});
  } catch {}
}

const useAuthStore = create((set, get) => ({
  user:          JSON.parse(localStorage.getItem('tb_user') || 'null'),
  token:         localStorage.getItem('tb_token') || null,
  refreshToken:  localStorage.getItem('tb_refresh') || null,
  loading:       false,
  error:         null,

  signup: async (email, password, display_name) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post('/auth/signup', { email, password, display_name });
      const { token, refresh_token, user } = res.data.data;
      localStorage.setItem('tb_token', token);
      if (refresh_token) localStorage.setItem('tb_refresh', refresh_token);
      localStorage.setItem('tb_user', JSON.stringify(user));
      set({ user, token, refreshToken: refresh_token || null, loading: false });
      attachRealtime(user.id, token, refresh_token);
      useNotificationStore.getState().reset();
      useNotificationStore.getState().fetch();
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Signup failed', loading: false });
      return false;
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, refresh_token, user } = res.data.data;
      localStorage.setItem('tb_token', token);
      if (refresh_token) localStorage.setItem('tb_refresh', refresh_token);
      localStorage.setItem('tb_user', JSON.stringify(user));
      set({ user, token, refreshToken: refresh_token || null, loading: false });
      attachRealtime(user.id, token, refresh_token);
      useNotificationStore.getState().reset();
      useNotificationStore.getState().fetch();
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Invalid email or password', loading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('tb_token');
    localStorage.removeItem('tb_refresh');
    localStorage.removeItem('tb_user');
    detachRealtime();
    useNotificationStore.getState().reset();
    set({ user: null, token: null, refreshToken: null });
  },

  clearError: () => set({ error: null }),

  fetchProfile: async () => {
    try {
      const res = await api.get('/auth/me');
      const user = res.data.data;
      localStorage.setItem('tb_user', JSON.stringify(user));
      set({ user });

      // Re-attach Realtime in case page reload lost the socket.
      const state = get();
      if (state.token) attachRealtime(user.id, state.token, state.refreshToken);
    } catch {
      get().logout();
    }
  },

  updateProfile: async (fields) => {
    set({ loading: true });
    try {
      const res = await api.patch('/auth/profile', fields);
      const updated = res.data.data;
      const user = { ...get().user, ...updated };
      localStorage.setItem('tb_user', JSON.stringify(user));
      set({ user, loading: false });
      return { ok: true };
    } catch (err) {
      set({ loading: false });
      return { ok: false, error: err.response?.data?.error || 'Update failed' };
    }
  },
}));

export default useAuthStore;
