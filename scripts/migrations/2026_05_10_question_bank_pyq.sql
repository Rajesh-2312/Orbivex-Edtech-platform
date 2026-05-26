-- ─────────────────────────────────────────────────────────────
-- Migration: question_bank PYQ (past-year question) sourcing
-- Date: 2026-05-10
-- Purpose: Distinguish real past-year placement questions (sourced
--   by the new pyqAgent) from AI-generated quizAgent output, and
--   add a job table so admins can trigger / observe seed runs.
--
-- New columns on question_bank:
--   source       — 'manual' | 'ai-generated' | 'past-year-llm' | 'placement-style-llm'
--   year_source  — placement year (2000..2100) for PYQ rows
--
-- Note on `source` values:
--   past-year-llm        — verbatim past-year MCQs extracted from web (future,
--                          requires a search-API key like Tavily/Serper).
--   placement-style-llm  — Ollama-generated placement-style MCQs in a company's
--                          recruitment-test pattern. No internet dependency.
--                          This is what the current pyqAgent produces.
--
-- New table:
--   pyq_jobs     — async PYQ seed-job tracking
--
-- Backfill assumption (documented for future maintainers):
--   Every existing row with test_type='company-specific' was inserted
--   by `generateQuestionsForSet` (backend/routes/companyPrep.js) which
--   calls quizAgent. There is no other code path today that writes
--   company-specific rows, so we mark them all 'ai-generated'. If
--   anyone has manually POSTed via /admin/question-bank with
--   test_type='company-specific', those rows will be misclassified —
--   re-tag them by hand if needed.
-- ─────────────────────────────────────────────────────────────

BEGIN;

-- 1. New columns on question_bank
ALTER TABLE public.question_bank
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'
  CHECK (source IN ('manual', 'ai-generated', 'past-year-llm', 'placement-style-llm'));

ALTER TABLE public.question_bank
  ADD COLUMN IF NOT EXISTS year_source SMALLINT
  CHECK (year_source IS NULL OR year_source BETWEEN 2000 AND 2100);

COMMENT ON COLUMN public.question_bank.source IS
  'Origin of the question: manual=admin-entered, ai-generated=quizAgent, past-year-llm=verbatim PYQ from web extraction, placement-style-llm=Ollama-generated company-style placement MCQ.';
COMMENT ON COLUMN public.question_bank.year_source IS
  'Placement year for past-year (PYQ) questions, e.g. 2023. NULL otherwise.';

-- 2. Backfill: every existing company-specific row came from quizAgent.
UPDATE public.question_bank
SET source = 'ai-generated'
WHERE source = 'manual'
  AND test_type = 'company-specific';

-- 3. Index for PYQ-first retrieval in the practice GET endpoint.
CREATE INDEX IF NOT EXISTS idx_question_bank_company_topic_source
  ON public.question_bank (company_name, topic, source)
  WHERE company_name IS NOT NULL AND topic IS NOT NULL;

-- 4. pyq_jobs — async seed-job tracking.
CREATE TABLE IF NOT EXISTS public.pyq_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  topic TEXT NOT NULL,
  years SMALLINT[] NOT NULL,
  target_count INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'partial', 'cancelled')),
  inserted INTEGER NOT NULL DEFAULT 0,
  attempted INTEGER NOT NULL DEFAULT 0,
  log JSONB NOT NULL DEFAULT '[]'::jsonb,
  error TEXT,
  triggered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancel_requested BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ
);

ALTER TABLE public.pyq_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pyq_jobs readable by authenticated" ON public.pyq_jobs;
CREATE POLICY "pyq_jobs readable by authenticated"
  ON public.pyq_jobs FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "pyq_jobs admin write" ON public.pyq_jobs;
CREATE POLICY "pyq_jobs admin write"
  ON public.pyq_jobs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pyq_jobs_company_topic
  ON public.pyq_jobs (company_name, topic, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pyq_jobs_status
  ON public.pyq_jobs (status)
  WHERE status IN ('queued', 'running');

COMMIT;
