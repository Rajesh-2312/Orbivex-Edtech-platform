import { create } from 'zustand';
import api, { API_URL as API_BASE } from '../lib/api';

/** Parse an SSE byte stream into {event, data} objects via an async iterator. */
async function* parseSSE(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // Frames are separated by a blank line.
    const frames = buffer.split('\n\n');
    buffer = frames.pop() || '';
    for (const frame of frames) {
      let event = null;
      let data = null;
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data = line.slice(5).trim();
      }
      if (event && data !== null) {
        try { yield { event, data: JSON.parse(data) }; } catch { /* skip partial */ }
      }
    }
  }
}

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
    const asstId = 'stream-' + Date.now();
    const asstMsg = { id: asstId, role: 'assistant', content: '', citations: [], streaming: true };

    set((s) => ({
      messagesByLesson: {
        ...s.messagesByLesson,
        [lessonId]: [...(s.messagesByLesson[lessonId] || []), userMsg, asstMsg],
      },
      sendingByLesson: { ...s.sendingByLesson, [lessonId]: true },
    }));

    // Patch the in-flight assistant bubble in place as events arrive.
    const patchAsst = (fn) =>
      set((s) => ({
        messagesByLesson: {
          ...s.messagesByLesson,
          [lessonId]: (s.messagesByLesson[lessonId] || []).map((m) =>
            m.id === asstId ? { ...m, ...fn(m) } : m,
          ),
        },
      }));

    try {
      const token = localStorage.getItem('tb_token');
      const res = await fetch(`${API_BASE}/tutor/lessons/${lessonId}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: message.trim() }),
      });
      if (res.status === 401) {
        localStorage.removeItem('tb_token');
        localStorage.removeItem('tb_user');
        window.location.href = '/login';
        return;
      }
      if (!res.ok || !res.body) throw new Error(`Tutor stream failed (${res.status})`);

      for await (const { event, data } of parseSSE(res)) {
        if (event === 'citations') {
          patchAsst(() => ({ citations: data.citations || [] }));
        } else if (event === 'token') {
          patchAsst((m) => ({ content: m.content + (data.value || '') }));
        } else if (event === 'done') {
          // Reconcile with the server's final text (citation-stripped) and swap
          // the temp id for the persisted row id.
          patchAsst(() => ({
            id: data.assistant_message_id || asstId,
            content: data.answer ?? '',
            citations: data.citations || [],
            lowConfidence: !!data.low_confidence,
            streaming: false,
          }));
        } else if (event === 'error') {
          throw new Error(data.error || 'Tutor failed');
        }
      }

      // Stream ended without a terminal error — ensure the flag clears even if
      // the server never sent 'done'.
      patchAsst((m) => (m.streaming ? { streaming: false } : {}));
      set((s) => ({ sendingByLesson: { ...s.sendingByLesson, [lessonId]: false } }));
    } catch (err) {
      patchAsst((m) => ({
        content: m.content || err.message || 'Tutor failed to respond. Please try again.',
        streaming: false,
        isError: !m.content, // keep partial answer if we got one; else show error styling
      }));
      set((s) => ({ sendingByLesson: { ...s.sendingByLesson, [lessonId]: false } }));
    }
  },

  clear: (lessonId) =>
    set((s) => ({
      messagesByLesson: { ...s.messagesByLesson, [lessonId]: [] },
    })),
}));

export default useTutorStore;
