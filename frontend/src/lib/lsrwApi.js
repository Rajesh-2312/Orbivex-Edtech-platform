/**
 * LSRW API — served by the main Orbivex Express backend at /api/lsrw/*
 * No separate FastAPI service needed.
 */
import api from './api';

// ── Content ──────────────────────────────────────────────────
export const getAllContent = () => api.get('/lsrw/content/all').then(r => r.data);

// ── Listening ────────────────────────────────────────────────
export const getListeningPassages = () => api.get('/lsrw/listening/passages').then(r => r.data);
export const getListeningPool = (level) => api.get(`/lsrw/listening/pool/${level}`).then(r => r.data);
export const startListeningSession = (student_id, content_id) =>
  api.post('/lsrw/listening/start-session', {}, { params: { student_id, content_id } }).then(r => r.data);
export const evaluateListening = (data) => api.post('/lsrw/listening/evaluate', data).then(r => r.data);

// ── Speaking ─────────────────────────────────────────────────
export const getSpeakingTopics = () => api.get('/lsrw/speaking/topics').then(r => r.data);
export const getSpeakingPool = (level) => api.get(`/lsrw/speaking/pool/${level}`).then(r => r.data);
export const startSpeakingSession = (student_id, content_id) =>
  api.post('/lsrw/speaking/start-session', {}, { params: { student_id, content_id } }).then(r => r.data);
export const evaluateSpeaking = (data) => api.post('/lsrw/speaking/evaluate', data).then(r => r.data);

// ── Reading ──────────────────────────────────────────────────
export const getReadingPassages = () => api.get('/lsrw/reading/passages').then(r => r.data);
export const getReadingPool = (level) => api.get(`/lsrw/reading/pool/${level}`).then(r => r.data);
export const startReadingSession = (student_id, content_id) =>
  api.post('/lsrw/reading/start-session', {}, { params: { student_id, content_id } }).then(r => r.data);
export const evaluateReading = (data) => api.post('/lsrw/reading/evaluate', data).then(r => r.data);

// ── Writing ──────────────────────────────────────────────────
export const getWritingPrompts = () => api.get('/lsrw/writing/prompts').then(r => r.data);
export const getWritingPool = (level) => api.get(`/lsrw/writing/pool/${level}`).then(r => r.data);
export const startWritingSession = (student_id, content_id) =>
  api.post('/lsrw/writing/start-session', {}, { params: { student_id, content_id } }).then(r => r.data);
export const evaluateWriting = (data) => api.post('/lsrw/writing/evaluate', data).then(r => r.data);

// ── Proctoring ───────────────────────────────────────────────
// Both are best-effort: the attempt has already ended in the browser by the time
// these are called, so a failed request must never surface to the student.
export const terminateLSRWSession = (session_id, reason) =>
  api.post(`/lsrw/session/${session_id}/terminate`, { reason }).then(r => r.data);

export const logProctorEvents = (session_id, events) =>
  api.post(`/lsrw/session/${session_id}/proctor-events`, { events }).then(r => r.data);

// ── Evaluations ──────────────────────────────────────────────
export const getLSRWProgress = (student_id) =>
  api.get(`/lsrw/evaluations/progress/${student_id}`).then(r => r.data);
export const getLSRWRecent = (student_id) =>
  api.get(`/lsrw/evaluations/recent/${student_id}`).then(r => r.data);

// Download the student's full LSRW attempt history as a CSV (opens in Excel).
// Fetched as an authenticated blob, then saved via a temporary link so the
// JWT is sent (a plain <a href> could not attach it).
export const downloadLSRWResults = async (student_id) => {
  const res = await api.get(`/lsrw/evaluations/export/${student_id}`, { responseType: 'blob' });
  const disposition = res.headers['content-disposition'] || '';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match ? match[1] : `lsrw-results-${new Date().toISOString().slice(0, 10)}.csv`;

  const url = window.URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};
