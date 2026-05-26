const { supabaseAdmin } = require('../config/supabase');
const { embedBatch } = require('../agents/embed');

const TARGET_CHARS = 500;
const OVERLAP_CHARS = 50;

function chunkText(text) {
  const clean = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!clean) return [];

  // Split on sentence boundaries, then greedily pack into ~TARGET_CHARS windows
  // with a small overlap so chunk boundaries don't slice an answer in half.
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);

  const chunks = [];
  let buf = '';
  for (const s of sentences) {
    if (!buf) {
      buf = s;
      continue;
    }
    if ((buf.length + 1 + s.length) <= TARGET_CHARS) {
      buf += ' ' + s;
    } else {
      chunks.push(buf);
      const tail = buf.slice(Math.max(0, buf.length - OVERLAP_CHARS));
      buf = tail + ' ' + s;
    }
  }
  if (buf) chunks.push(buf);

  // Hard-cap any single chunk that came from a giant unsplit run.
  const out = [];
  for (const c of chunks) {
    if (c.length <= TARGET_CHARS * 2) { out.push(c); continue; }
    for (let i = 0; i < c.length; i += TARGET_CHARS) {
      out.push(c.slice(i, i + TARGET_CHARS));
    }
  }
  return out;
}

async function reindexLesson(lessonId) {
  if (!lessonId) return { skipped: true, reason: 'no_lesson_id' };

  const { data: lesson, error: lessonErr } = await supabaseAdmin
    .from('lessons')
    .select('id, content_text')
    .eq('id', lessonId)
    .single();
  if (lessonErr || !lesson) {
    return { skipped: true, reason: 'lesson_not_found' };
  }

  const chunks = chunkText(lesson.content_text);
  if (!chunks.length) {
    await supabaseAdmin.from('lesson_embeddings').delete().eq('lesson_id', lessonId);
    return { skipped: true, reason: 'empty_content', chunks: 0 };
  }

  const vectors = await embedBatch(chunks);

  // Replace existing chunks atomically-ish (delete then insert).
  const { error: delErr } = await supabaseAdmin
    .from('lesson_embeddings')
    .delete()
    .eq('lesson_id', lessonId);
  if (delErr) throw delErr;

  const rows = chunks.map((content_chunk, idx) => ({
    lesson_id: lessonId,
    chunk_index: idx,
    content_chunk,
    embedding: vectors[idx],
  }));

  const { error: insErr } = await supabaseAdmin.from('lesson_embeddings').insert(rows);
  if (insErr) throw insErr;

  return { skipped: false, chunks: rows.length };
}

module.exports = { reindexLesson, chunkText };
