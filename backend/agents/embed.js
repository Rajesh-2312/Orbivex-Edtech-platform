const axios = require('axios');
const http = require('http');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
const KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '10m';
const EMBED_DIM = 768; // nomic-embed-text native

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 32 });

async function embedText(text) {
  const clean = String(text || '').trim();
  if (!clean) throw new Error('embedText: empty input');

  const res = await axios.post(
    `${OLLAMA_URL}/api/embeddings`,
    { model: EMBED_MODEL, prompt: clean, keep_alive: KEEP_ALIVE },
    { timeout: 30_000, httpAgent }
  );

  const vec = res?.data?.embedding;
  if (!Array.isArray(vec) || vec.length !== EMBED_DIM) {
    throw new Error(`embed: unexpected vector shape (got ${Array.isArray(vec) ? vec.length : typeof vec}, want ${EMBED_DIM})`);
  }
  return vec;
}

async function embedBatch(texts, { batchSize = 16 } = {}) {
  const out = new Array(texts.length);
  for (let i = 0; i < texts.length; i += batchSize) {
    const slice = texts.slice(i, i + batchSize);
    const vecs = await Promise.all(slice.map((t) => embedText(t)));
    for (let j = 0; j < vecs.length; j++) out[i + j] = vecs[j];
  }
  return out;
}

module.exports = { embedText, embedBatch, EMBED_DIM, EMBED_MODEL };
