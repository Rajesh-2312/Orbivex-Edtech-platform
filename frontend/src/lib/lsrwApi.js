/**
 * LSRW API — served by the main Orbivex Express backend at /api/lsrw/*
 * No separate FastAPI service needed.
 */
import api from './api';

// ── Content ──────────────────────────────────────────────────
export const getAllContent = () => api.get('/lsrw/content/all').then(r => r.data);

// ── Listening ────────────────────────────────────────────────
export const getListeningPassages = () => api.get('/lsrw/listening/passages').then(r => r.data);
export const startListeningSession = (student_id, content_id) =>
  api.post('/lsrw/listening/start-session', null, { params: { student_id, content_id } }).then(r => r.data);
export const evaluateListening = (data) => api.post('/lsrw/listening/evaluate', data).then(r => r.data);

// ── Speaking ─────────────────────────────────────────────────
export const getSpeakingTopics = () => api.get('/lsrw/speaking/topics').then(r => r.data);
export const startSpeakingSession = (student_id, content_id) =>
  api.post('/lsrw/speaking/start-session', null, { params: { student_id, content_id } }).then(r => r.data);
export const evaluateSpeaking = (data) => api.post('/lsrw/speaking/evaluate', data).then(r => r.data);

// ── Reading ──────────────────────────────────────────────────
export const getReadingPassages = () => api.get('/lsrw/reading/passages').then(r => r.data);
export const startReadingSession = (student_id, content_id) =>
  api.post('/lsrw/reading/start-session', null, { params: { student_id, content_id } }).then(r => r.data);
export const evaluateReading = (data) => api.post('/lsrw/reading/evaluate', data).then(r => r.data);

// ── Writing ──────────────────────────────────────────────────
export const getWritingPrompts = () => api.get('/lsrw/writing/prompts').then(r => r.data);
export const startWritingSession = (student_id, content_id) =>
  api.post('/lsrw/writing/start-session', null, { params: { student_id, content_id } }).then(r => r.data);
export const evaluateWriting = (data) => api.post('/lsrw/writing/evaluate', data).then(r => r.data);

// ── Evaluations ──────────────────────────────────────────────
export const getLSRWProgress = (student_id) =>
  api.get(`/lsrw/evaluations/progress/${student_id}`).then(r => r.data);
export const getLSRWRecent = (student_id) =>
  api.get(`/lsrw/evaluations/recent/${student_id}`).then(r => r.data);
