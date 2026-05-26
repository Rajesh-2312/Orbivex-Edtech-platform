import { create } from 'zustand';
import api from '../lib/api';

const useTutorStore = create((set, get) => ({
  // Map<lessonId, Array<{id, role, content, citations?}>>
  messagesByLesson: {},
  loadingByLesson: {},
  sendingByLesson: {},
  open: false,
  activeLessonId: null,

  toggleOpen: () => set((s) => ({ open: !s.open })),
  setOpen: (val) => set({ open: !!val }),
  setActiveLesson: (lessonId) => set({ activeLessonId: lessonId }),

  loadHistory: async (lessonId) => {
    if (!lessonId) return;
    set((s) => ({ loadingByLesson: { ...s.loadingByLesson, [lessonId]: true } }));
    try {
      const res = await api.get(`/tutor/lessons/${lessonId}/history`);
      const items = (res.data?.data || []).map((m) => ({
        id: m.id, role: m.role, content: m.content, citations: m.citations,
      }));
      set((s) => ({
        messagesByLesson: { ...s.messagesByLesson, [lessonId]: items },
        loadingByLesson: { ...s.loadingByLesson, [lessonId]: false },
      }));
    } catch (err) {
      set((s) => ({ loadingByLesson: { ...s.loadingByLesson, [lessonId]: false } }));
    }
  },

  send: async (lessonId, message) => {
    if (!lessonId || !message?.trim()) return;
    const userMsg = { id: 'tmp-' + Date.now(), role: 'user', content: message.trim() };
    set((s) => ({
      messagesByLesson: {
        ...s.messagesByLesson,
        [lessonId]: [...(s.messagesByLesson[lessonId] || []), userMsg],
      },
      sendingByLesson: { ...s.sendingByLesson, [lessonId]: true },
    }));

    try {
      const res = await api.post(`/tutor/lessons/${lessonId}/chat`, { message });
      const payload = res.data?.data || {};
      const asstMsg = {
        id: payload.assistant_message_id || 'a-' + Date.now(),
        role: 'assistant',
        content: payload.answer || '',
        citations: payload.citations || [],
      };
      set((s) => ({
        messagesByLesson: {
          ...s.messagesByLesson,
          [lessonId]: [...(s.messagesByLesson[lessonId] || []), asstMsg],
        },
        sendingByLesson: { ...s.sendingByLesson, [lessonId]: false },
      }));
    } catch (err) {
      const errMsg = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: err.response?.data?.error || 'Tutor failed to respond. Please try again.',
        citations: [],
        isError: true,
      };
      set((s) => ({
        messagesByLesson: {
          ...s.messagesByLesson,
          [lessonId]: [...(s.messagesByLesson[lessonId] || []), errMsg],
        },
        sendingByLesson: { ...s.sendingByLesson, [lessonId]: false },
      }));
    }
  },

  clear: (lessonId) =>
    set((s) => ({
      messagesByLesson: { ...s.messagesByLesson, [lessonId]: [] },
    })),
}));

export default useTutorStore;
