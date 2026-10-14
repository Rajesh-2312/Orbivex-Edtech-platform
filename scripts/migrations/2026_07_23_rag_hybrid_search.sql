-- ═══════════════════════════════════════════════════════════════════
-- Orbivex — Hybrid retrieval for RAG (Phase 1)
-- Migration: 2026_07_23_rag_hybrid_search.sql
--
-- 1. Full-text search column + GIN index on content_embeddings.
-- 2. match_content_hybrid() — vector + keyword fused with Reciprocal
--    Rank Fusion. Pure vector search misses exact identifiers (error
--    codes, function names, "Section 4.2"); FTS catches those and RRF
--    merges the two rankings without tuning a weight.
-- 3. Repairs match_course_chunks(), left behind at 768 dims over the
--    legacy lesson_embeddings table while everything else moved to
--    1024-dim content_embeddings.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Full-text column ──────────────────────────────────────────────
ALTER TABLE public.content_embeddings
  ADD COLUMN IF NOT EXISTS content_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content_chunk, ''))) STORED;

CREATE INDEX IF NOT EXISTS content_embeddings_tsv
  ON public.content_embeddings USING gin (content_tsv);

-- ── 2. Hybrid search ─────────────────────────────────────────────────
-- NOTE: the vector and FTS candidate sets each query content_embeddings
-- directly rather than a shared filtered CTE. A CTE referenced more than
-- once is materialised, which would stop the planner from using the HNSW
-- index and turn every search into a sequential scan.
DROP FUNCTION IF EXISTS public.match_content_hybrid(vector, text, text, uuid, uuid, int, int);

CREATE OR REPLACE FUNCTION public.match_content_hybrid(
  query_embedding VECTOR(1024),
  query_text      TEXT    DEFAULT NULL,
  p_source_type   TEXT    DEFAULT NULL,
  p_source_id     UUID    DEFAULT NULL,
  p_course_id     UUID    DEFAULT NULL,
  p_match_count   INT     DEFAULT 20,
  p_rrf_k         INT     DEFAULT 60
)
RETURNS TABLE (
  id            BIGINT,
  source_type   TEXT,
  source_id     UUID,
  course_id     UUID,
  chunk_index   INT,
  content_chunk TEXT,
  metadata      JSONB,
  similarity    FLOAT,
  vector_rank   INT,
  text_rank     INT,
  rrf_score     FLOAT
)
LANGUAGE SQL STABLE
AS $$
  WITH vec AS (
    SELECT
      ce.id,
      ROW_NUMBER() OVER (ORDER BY ce.embedding <=> query_embedding)::INT AS rank,
      (1 - (ce.embedding <=> query_embedding))::FLOAT AS similarity
    FROM public.content_embeddings ce
    WHERE (p_source_type IS NULL OR ce.source_type = p_source_type)
      AND (p_source_id   IS NULL OR ce.source_id   = p_source_id)
      AND (p_course_id   IS NULL OR ce.course_id   = p_course_id)
    ORDER BY ce.embedding <=> query_embedding
    LIMIT p_match_count * 3
  ),
  fts AS (
    SELECT
      ce.id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank_cd(ce.content_tsv, websearch_to_tsquery('english', query_text)) DESC
      )::INT AS rank
    FROM public.content_embeddings ce
    WHERE query_text IS NOT NULL
      AND length(trim(query_text)) > 0
      AND ce.content_tsv @@ websearch_to_tsquery('english', query_text)
      AND (p_source_type IS NULL OR ce.source_type = p_source_type)
      AND (p_source_id   IS NULL OR ce.source_id   = p_source_id)
      AND (p_course_id   IS NULL OR ce.course_id   = p_course_id)
    ORDER BY ts_rank_cd(ce.content_tsv, websearch_to_tsquery('english', query_text)) DESC
    LIMIT p_match_count * 3
  ),
  fused AS (
    SELECT
      COALESCE(vec.id, fts.id) AS id,
      vec.rank                 AS vector_rank,
      fts.rank                 AS text_rank,
      vec.similarity,
      COALESCE(1.0 / (p_rrf_k + vec.rank), 0.0)
        + COALESCE(1.0 / (p_rrf_k + fts.rank), 0.0) AS rrf_score
    FROM vec
    FULL OUTER JOIN fts ON fts.id = vec.id
  )
  SELECT
    ce.id,
    ce.source_type,
    ce.source_id,
    ce.course_id,
    ce.chunk_index,
    ce.content_chunk,
    ce.metadata,
    COALESCE(f.similarity, 0.0)::FLOAT AS similarity,
    f.vector_rank,
    f.text_rank,
    f.rrf_score::FLOAT
  FROM fused f
  JOIN public.content_embeddings ce ON ce.id = f.id
  ORDER BY f.rrf_score DESC
  LIMIT p_match_count;
$$;

-- ── 3. Repair match_course_chunks ────────────────────────────────────
-- Was: vector(768) over lesson_embeddings. Everything else is 1024-dim
-- over content_embeddings, so this returned nothing usable.
DROP FUNCTION IF EXISTS public.match_course_chunks(vector, uuid, int);

CREATE OR REPLACE FUNCTION public.match_course_chunks(
  query_embedding VECTOR(1024),
  match_course_id UUID,
  match_count     INT DEFAULT 5
)
RETURNS TABLE (
  lesson_id     UUID,
  lesson_title  TEXT,
  chunk_index   INT,
  content_chunk TEXT,
  similarity    FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    ce.source_id                 AS lesson_id,
    ce.metadata->>'lesson_title' AS lesson_title,
    ce.chunk_index,
    ce.content_chunk,
    (1 - (ce.embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.content_embeddings ce
  WHERE ce.source_type = 'lesson'
    AND ce.course_id = match_course_id
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
$$;
