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
const { generateCompletion } = require('../config/ai');
const { parseLooseJSON } = require('./json');
const { chunkDocument, buildEmbedText, dedupePath } = require('./chunker');

// ── Text chunking ─────────────────────────────────────────────────────────────

/**
 * Back-compat shim: returns plain strings like the old character slicer did.
 * New code should call chunkDocument() directly — it also returns the heading
 * path and token count, which indexing needs.
 */
function chunkText(text, options = {}) {
  return chunkDocument(text, options).map((c) => c.text);
}

// ── Index a lesson ────────────────────────────────────────────────────────────

async function indexLesson(lesson) {
  const { id, title = '', content_text = '', course_id, course_title = '' } = lesson;
  if (!id) throw new Error('indexLesson: lesson.id required');

  const chunks = chunkDocument(content_text);
  if (!chunks.length) return { indexed: 0 };

  // What gets embedded carries its heading path ("DBMS › Indexing › B-Trees");
  // what gets stored stays clean, because that is what the model is shown and
  // what the student sees in a citation.
  const prefix = [course_title, title].filter(Boolean);
  const embeddings = await embedBatch(
    chunks.map((c) => buildEmbedText(c, prefix)),
    { inputType: 'passage' },
  );

  const rows = chunks.map((chunk, i) => ({
    source_type: 'lesson',
    source_id: id,
    course_id: course_id || null,
    chunk_index: i,
    content_chunk: chunk.text,
    embedding: embeddings[i],
    metadata: {
      lesson_title: title,
      course_title: course_title || null,
      heading_path: chunk.headingPath,
      token_count: chunk.tokenCount,
    },
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

  const embedding = await embedText(question_text, { inputType: 'passage' });

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
 * Ask the cheap tier to score each candidate against the question.
 *
 * Cosine similarity answers "is this about the same topic"; it does not answer
 * "does this actually contain the answer". Reranking a wide candidate set with
 * a small model is the standard fix and is far cheaper than widening the
 * context window.
 *
 * Degrades to the input order on any failure — a broken reranker must never
 * cost the student their answer.
 *
 * @returns {Promise<Array>} chunks with `rerank_score` (0-10), best first
 */
async function rerankChunks(query, chunks, topK) {
  if (chunks.length <= 1) return chunks;

  const passages = chunks
    .map((c, i) => `[${i + 1}] ${String(c.content_chunk || '').slice(0, 400)}`)
    .join('\n\n');

  const prompt = `Rate how well each passage answers the question.
10 = directly and completely answers it. 5 = related but does not answer it. 0 = irrelevant.

Return ONLY JSON, no prose: {"scores":[{"i":1,"s":8},{"i":2,"s":3}]}

QUESTION: ${query}

PASSAGES:
${passages}

JSON:`;

  try {
    const raw = await generateCompletion('standard', prompt, {
      temperature: 0,
      max_tokens: 400,
      timeoutMs: 15_000,
    });

    // Small models often return a bare array instead of {scores:[...]}, and
    // often truncate the final brace — parseLooseJSON handles both.
    const parsed = parseLooseJSON(raw);
    const list = Array.isArray(parsed) ? parsed : (parsed?.scores || []);
    const scores = new Map(
      list
        .map((s) => [Number(s?.i), Number(s?.s)])
        .filter(([i, sc]) => Number.isFinite(i) && Number.isFinite(sc)),
    );
    if (!scores.size) return chunks.slice(0, topK);

    return chunks
      .map((c, i) => ({ ...c, rerank_score: scores.has(i + 1) ? scores.get(i + 1) : null }))
      .sort((a, b) => (b.rerank_score ?? -1) - (a.rerank_score ?? -1))
      .slice(0, topK);
  } catch (err) {
    console.warn(`[rag] rerank failed, using vector order: ${err.message}`);
    return chunks.slice(0, topK);
  }
}

/**
 * Retrieve top-k relevant chunks.
 *
 * Pipeline: hybrid candidate search (vector + full-text, fused with RRF) →
 * optional rerank → relevance filter. Each stage degrades independently, so a
 * missing migration or a dead reranker weakens results without breaking them.
 *
 * Every returned row keeps `similarity` (and `rerank_score` when reranked) so
 * callers can decide to abstain — see `topRelevance`.
 *
 * @param {string} query
 * @param {object} options
 *   source_type  — 'lesson' | 'question' | null (all)
 *   source_id    — restrict to one source document
 *   course_id    — restrict to one course
 *   match_count  — number of results returned (default 5)
 *   threshold    — minimum cosine similarity 0-1 (default 0.3)
 *   hybrid       — fuse full-text with vector search (default true)
 *   rerank       — reorder candidates with the cheap tier (default false;
 *                  measured at ~10x the latency of plain vector search, and it
 *                  has not yet been shown to improve ranking on real content —
 *                  see scripts/rag-eval.js)
 *   min_rerank_score — drop chunks scored below this. Default 0 (drop nothing).
 *                  Set above 0 only with eval evidence: a reranker that filters
 *                  can delete the correct chunk outright, which costs recall,
 *                  whereas a reranker that only reorders cannot.
 */
async function retrieveContext(query, options = {}) {
  const {
    source_type = null,
    source_id   = null,
    course_id   = null,
    match_count = 5,
    threshold   = 0.3,
    hybrid      = true,
    rerank      = false,
    min_rerank_score = 0,
  } = options;

  // Over-fetch so the reranker has something to choose between.
  const candidateCount = rerank || hybrid ? Math.max(20, match_count * 4) : match_count;

  // Degradation ladder: if the embeddings provider is down, fall back to
  // keyword-only full-text search instead of failing the whole turn. Worse
  // results, but the assistant stays useful.
  let queryEmbedding;
  try {
    queryEmbedding = await embedText(query, { inputType: 'query' });
  } catch (err) {
    console.warn(`[rag] embeddings unavailable, degrading to keyword search: ${err.message}`);
    return keywordOnlySearch(query, { source_type, source_id, course_id, match_count });
  }

  let chunks = null;

  if (hybrid) {
    const { data, error } = await supabaseAdmin.rpc('match_content_hybrid', {
      query_embedding: queryEmbedding,
      query_text: query,
      p_source_type: source_type,
      p_source_id: source_id,
      p_course_id: course_id,
      p_match_count: candidateCount,
    });
    // Environments without 2026_07_23_rag_hybrid_search.sql applied fall back
    // to pure vector search rather than failing the request.
    if (error) console.warn(`[rag] hybrid search unavailable, falling back to vector: ${error.message}`);
    else chunks = data;
  }

  if (!chunks) {
    const { data, error } = await supabaseAdmin.rpc('match_content', {
      query_embedding: queryEmbedding,
      p_source_type: source_type,
      p_source_id: source_id,
      p_course_id: course_id,
      p_match_count: candidateCount,
      p_threshold: 0,
    });
    if (error) throw error;
    chunks = data;
  }

  chunks = chunks || [];
  if (!chunks.length) return [];

  if (rerank && chunks.length > 1) {
    chunks = await rerankChunks(query, chunks, match_count);
    if (min_rerank_score > 0) {
      const kept = chunks.filter((c) => (c.rerank_score ?? Infinity) >= min_rerank_score);
      // Never return nothing on the reranker's say-so — that turns a ranking
      // mistake into a total retrieval failure.
      return kept.length ? kept : chunks.slice(0, 1);
    }
    return chunks;
  }

  return chunks.filter((c) => (c.similarity ?? 0) >= threshold).slice(0, match_count);
}

/**
 * Keyword-only retrieval over the FTS column — the fallback when the embeddings
 * provider is unavailable. Uses websearch_to_tsquery so ordinary phrasing works.
 * Rows get no `similarity` (there is no vector comparison), so callers relying
 * on topRelevance will treat these as low-confidence, which is correct: keyword
 * matching is a degraded mode.
 */
async function keywordOnlySearch(query, { source_type, source_id, course_id, match_count = 5 }) {
  let q = supabaseAdmin
    .from('content_embeddings')
    .select('id, source_type, source_id, course_id, chunk_index, content_chunk, metadata')
    .textSearch('content_tsv', query, { type: 'websearch', config: 'english' })
    .limit(match_count);
  if (source_type) q = q.eq('source_type', source_type);
  if (source_id) q = q.eq('source_id', source_id);
  if (course_id) q = q.eq('course_id', course_id);

  const { data, error } = await q;
  if (error) { console.warn(`[rag] keyword fallback failed: ${error.message}`); return []; }
  // An FTS hit means the query terms are present, so assign a modest baseline
  // relevance — above the abstention floor (so we still answer) but low enough
  // to read as degraded confidence. `degraded` lets the UI say so if it wants.
  return (data || []).map((c) => ({ ...c, similarity: 0.35, degraded: true }));
}

/**
 * Best relevance signal available for a result set, normalised to 0-1.
 * Callers use it to decide whether to answer at all.
 *
 * Uses the MAX over chunks, not chunks[0] — hybrid RRF may rank a keyword match
 * first even when a different chunk has the higher vector similarity, and for
 * abstention the question is "is ANY chunk strongly relevant".
 */
function topRelevance(chunks) {
  if (!chunks || !chunks.length) return 0;
  if (typeof chunks[0].rerank_score === 'number') {
    return Math.max(...chunks.map((c) => (c.rerank_score ?? 0) / 10));
  }
  return Math.max(...chunks.map((c) => c.similarity ?? 0));
}

// ── Context formatter for agent prompts ───────────────────────────────────────

function buildContextBlock(chunks) {
  if (!chunks.length) return '';
  return chunks
    .map((c, i) => {
      // Label each source with where it came from — the model cites [n], and a
      // reader following the citation needs more than "source 3".
      const label = dedupePath([c.metadata?.lesson_title, ...(c.metadata?.heading_path || [])]).join(' › ');
      return `[${i + 1}]${label ? ` (${label})` : ''} ${c.content_chunk}`;
    })
    .join('\n\n');
}

module.exports = {
  chunkText,
  indexLesson,
  indexQuestion,
  retrieveContext,
  rerankChunks,
  topRelevance,
  buildContextBlock,
};
