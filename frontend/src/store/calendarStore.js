import { create } from 'zustand';
import api from '../lib/api';

const useCalendarStore = create((set) => ({
  events: [],
  loading: false,
  range: { from: null, to: null },

  fetch: async (from, to) => {
    set({ loading: true });
    try {
      const qs = [];
      if (from) qs.push(`from=${encodeURIComponent(from)}`);
      if (to)   qs.push(`to=${encodeURIComponent(to)}`);
      const res = await api.get(`/calendar${qs.length ? '?' + qs.join('&') : ''}`);
      const payload = res.data?.data || {};
      set({
        events: payload.items || [],
        range: { from: payload.from || from, to: payload.to || to },
        loading: false,
      });
    } catch (err) {
      set({ loading: false });
    }
  },

  fetchUpcoming: async (days = 7) => {
    set({ loading: true });
    try {
      const res = await api.get(`/calendar/upcoming?days=${days}`);
      const payload = res.data?.data || {};
      set({
        events: payload.items || [],
        range: { from: payload.from, to: payload.to },
        loading: false,
      });
    } catch (err) {
      set({ loading: false });
    }
  },
}));

export default useCalendarStore;
