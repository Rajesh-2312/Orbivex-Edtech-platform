import { create } from 'zustand';
import { API_URL as API_BASE } from '../lib/api';


/** Parse an SSE byte stream into {event, data} objects. */
async function* parseSSE(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
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
        try { yield { event, data: JSON.parse(data) }; } catch { /* partial */ }
      }
    }
  }
}

/**
 * The platform assistant conversation. Unlike the lesson tutor, a message here
 * can carry a live status line ("Checking your progress…"), tool-run badges,
 * and a pending write the student must confirm.
 */
const useAssistantStore = create((set, get) => ({
  open: false,
  messages: [],            // { id, role, content, citations, tools, status, streaming, confirm, isError }
  sending: false,
  sessionId: null,

  toggle: () => set((s) => ({ open: !s.open })),
  setOpen: (v) => set({ open: !!v }),

  patch: (id, fn) =>
    set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, ...fn(m) } : m)) })),

  send: async (message) => {
    const text = String(message || '').trim();
    if (!text || get().sending) return;

    const userMsg = { id: 'u-' + Date.now(), role: 'user', content: text };
    const asstId = 'a-' + Date.now();
    const asstMsg = { id: asstId, role: 'assistant', content: '', citations: [], tools: [], status: 'Thinking…', streaming: true };
    set((s) => ({ messages: [...s.messages, userMsg, asstMsg], sending: true }));

    const patch = (fn) => get().patch(asstId, fn);

    try {
      const token = localStorage.getItem('tb_token');
      const res = await fetch(`${API_BASE}/assistant/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message: text, session_id: get().sessionId }),
      });
      if (res.status === 401) {
        localStorage.removeItem('tb_token'); localStorage.removeItem('tb_user');
        window.location.href = '/login';
        return;
      }
      if (!res.ok || !res.body) throw new Error(`Assistant failed (${res.status})`);

      for await (const { event, data } of parseSSE(res)) {
        if (event === 'status') patch(() => ({ status: data.value }));
        else if (event === 'tool') patch((m) => ({ tools: [...m.tools, { name: data.name, ok: data.ok }] }));
        else if (event === 'citations') patch(() => ({ citations: data.citations || [] }));
        else if (event === 'confirm') patch(() => ({ confirm: { name: data.name, args: data.args, summary: data.summary } }));
        else if (event === 'token') patch((m) => ({ content: m.content + (data.value || ''), status: null }));
        else if (event === 'done') {
          patch(() => ({
            id: data.assistant_message_id || asstId,
            content: data.answer ?? '',
            citations: data.citations || [],
            lowConfidence: !!data.low_confidence,
            status: null,
            streaming: false,
          }));
          if (data.session_id) set({ sessionId: data.session_id });
        } else if (event === 'error') throw new Error(data.error || 'Assistant failed');
      }

      patch((m) => (m.streaming ? { streaming: false, status: null } : {}));
      set({ sending: false });
    } catch (err) {
      patch((m) => ({
        content: m.content || err.message || 'The assistant failed to respond. Please try again.',
        streaming: false, status: null, isError: !m.content,
      }));
      set({ sending: false });
    }
  },

  /** Approve a pending write (e.g. enrolment) the assistant proposed. */
  confirmAction: async (messageId, confirm) => {
    const token = localStorage.getItem('tb_token');
    get().patch(messageId, () => ({ confirm: { ...confirm, running: true } }));
    try {
      const res = await fetch(`${API_BASE}/assistant/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ name: confirm.name, args: confirm.args }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.success === false) throw new Error(body.error || 'Action failed');
      get().patch(messageId, () => ({ confirm: { ...confirm, done: true, result: body.data } }));
    } catch (err) {
      get().patch(messageId, () => ({ confirm: { ...confirm, error: err.message } }));
    }
  },

  dismissConfirm: (messageId) =>
    get().patch(messageId, (m) => ({ confirm: { ...m.confirm, dismissed: true } })),
}));

export default useAssistantStore;
