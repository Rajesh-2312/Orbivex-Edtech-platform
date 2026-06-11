/**
 * Orbivex RAG — unified retrieval-augmented generation helper
 *
 * Provides:
 *   retrieveContext(query, options)  — top-k semantic chunks from content_embeddings
 *   indexLesson(lesson)              — chunk + embed + upsert a lesson
 *   indexQuestion(question)          — embed + upsert a question_bank row
 *   buildContextBlock(chunks)        — format chunks into a prompt-ready string
 *
 * Vector table: content_embeddings (pgvector)
 * RPC:          match_content (defined in migration)
 */

const { embedText, embedBatch } = require('../agents/embed');
const { supabaseAdmin } = require('../config/supabase');

const CHUNK_SIZE   = 400;  // characters per chunk
const CHUNK_OVERLAP = 80;  // characters overlap between chunks

// ── Text chunking ─────────────────────────────────────────────────────────────

function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + size).trim());
    start += size - overlap;
  }
  return chunks.filter(Boolean);
}

// ── Index a lesson ────────────────────────────────────────────────────────────

async function indexLesson(lesson) {
  const { id, title = '', content_text = '', course_id } = lesson;
  if (!id) throw new Error('indexLesson: lesson.id required');

  const body = `${title}\n\n${content_text}`.trim();
  const chunks = chunkText(body);
  if (!chunks.length) return { indexed: 0 };

  const embeddings = await embedBatch(chunks);

  const rows = chunks.map((chunk, i) => ({
    source_type: 'lesson',
    source_id: id,
    course_id: course_id || null,
    chunk_index: i,
    content_chunk: chunk,
    embedding: embeddings[i],
    metadata: { lesson_title: title },
  }));

  // Delete stale chunks for this lesson before reinserting
  await supabaseAdmin
    .from('content_embeddings')
    .delete()
    .eq('source_type', 'lesson')
    .eq('source_id', id);

  const { error } = await supabaseAdmin.from('content_embeddings').insert(rows);
  if (error) throw error;

  return { indexed: rows.length };
}

// ── Index a question_bank row ─────────────────────────────────────────────────

async function indexQuestion(question) {
  const { id, question_text = '', category, test_type, company_name } = question;
  if (!id) throw new Error('indexQuestion: question.id required');

  const embedding = await embedText(question_text);

  await supabaseAdmin
    .from('content_embeddings')
    .delete()
    .eq('source_type', 'question')
    .eq('source_id', id);

  const { error } = await supabaseAdmin.from('content_embeddings').insert({
    source_type: 'question',
    source_id: id,
    chunk_index: 0,
    content_chunk: question_text,
    embedding,
    metadata: { category, test_type, company_name },
  });
  if (error) throw error;

  return { indexed: 1 };
}

// ── Semantic retrieval ────────────────────────────────────────────────────────

/**
 * Retrieve top-k semantically similar chunks.
 *
 * @param {string} query
 * @param {object} options
 *   source_type  — 'lesson' | 'question' | null (all)
 *   source_id    — restrict to one source document
 *   course_id    — restrict to one course
 *   match_count  — number of results (default 5)
 *   threshold    — minimum similarity 0-1 (default 0.3)
 */
async function retrieveContext(query, options = {}) {
  const {
    source_type = null,
    source_id   = null,
    course_id   = null,
    match_count = 5,
    threshold   = 0.3,
  } = options;

  const queryEmbedding = await embedText(query);

  const { data: chunks, error } = await supabaseAdmin.rpc('match_content', {
    query_embedding: queryEmbedding,
    p_source_type: source_type,
    p_source_id: source_id,
    p_course_id: course_id,
    p_match_count: match_count,
    p_threshold: threshold,
  });

  if (error) throw error;
  return chunks || [];
}

// ── Context formatter for agent prompts ───────────────────────────────────────

function buildContextBlock(chunks) {
  if (!chunks.length) return '';
  return chunks
    .map((c, i) => `[${i + 1}] ${c.metadata?.lesson_title ? `(${c.metadata.lesson_title}) ` : ''}${c.content_chunk}`)
    .join('\n\n');
}

module.exports = {
  chunkText,
  indexLesson,
  indexQuestion,
  retrieveContext,
  buildContextBlock,
};
