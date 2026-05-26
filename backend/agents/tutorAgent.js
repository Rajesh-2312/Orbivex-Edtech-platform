const { generateCompletion } = require('../config/ollama');
const { supabaseAdmin } = require('../config/supabase');
const { embedText } = require('./embed');

const TUTOR_MODEL = process.env.OLLAMA_TUTOR_MODEL
  || process.env.OLLAMA_DEFAULT_MODEL
  || 'qwen2.5:1.5b';

const MAX_CHUNKS = 5;
const MAX_HISTORY_TURNS = 6;
const ANSWER_MAX_TOKENS = 800;

function buildPrompt({ lessonTitle, chunks, history, question }) {
  const sources = chunks
    .map((c, i) => `[${i + 1}] (Lesson: ${c.lesson_title})\n${c.content_chunk}`)
    .join('\n\n');

  const historyText = (history || [])
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
    .join('\n');

  return `You are an Orbivex study tutor for an Indian engineering student.
You ONLY answer using the SOURCES below from the lesson "${lessonTitle}".
If the answer is not present in the sources, say so plainly and suggest what the student should look up in the lesson.
Be concise (max ~150 words), use simple language, and end each fact with a bracketed citation like [1] or [2].

SOURCES:
${sources}

${historyText ? `RECENT CONVERSATION:\n${historyText}\n` : ''}STUDENT QUESTION:
${question}

ANSWER (cite sources with [n]):`;
}

async function answer({ lessonId, userId, message, history }) {
  if (!lessonId || !message) throw new Error('lessonId and message are required');

  // 1. Embed the question
  const qvec = await embedText(message);

  // 2. ANN search top-k chunks within this lesson
  const { data: chunks, error: rpcErr } = await supabaseAdmin.rpc('match_lesson_chunks', {
    query_embedding: qvec,
    match_lesson_id: lessonId,
    match_count: MAX_CHUNKS,
  });
  if (rpcErr) throw rpcErr;

  // 3. Refuse politely if no chunks (lesson not indexed yet)
  if (!chunks || chunks.length === 0) {
    return {
      answer: "I don't have this lesson's content indexed yet. Please ask your educator to refresh the lesson, or try again after a moment.",
      citations: [],
    };
  }

  // Resolve lesson title from the first match (all chunks share the same lesson here)
  const lessonTitle = chunks[0].lesson_title || 'this lesson';

  // 4. Generate grounded answer — Ollama only (forceOllama)
  const prompt = buildPrompt({ lessonTitle, chunks, history, question: message });
  const raw = await generateCompletion(TUTOR_MODEL, prompt, {
    temperature: 0.3,
    max_tokens: ANSWER_MAX_TOKENS,
    timeoutMs: 90_000,
    format: null,           // prose, not JSON
    forceOllama: true,      // predictable cost; no NVIDIA quota burn
    cache: false,           // every student turn is unique
  });

  const text = String(raw || '').trim();

  // 5. Build citation payload from the chunks the model saw
  const citations = chunks.map((c, i) => ({
    n: i + 1,
    lesson_id: c.lesson_id,
    lesson_title: c.lesson_title,
    chunk_index: c.chunk_index,
    preview: String(c.content_chunk || '').slice(0, 180),
    similarity: typeof c.similarity === 'number' ? Number(c.similarity.toFixed(3)) : null,
  }));

  return { answer: text, citations };
}

module.exports = { answer, TUTOR_MODEL };
