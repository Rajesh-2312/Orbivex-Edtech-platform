-- ─────────────────────────────────────────────────────────────
-- Migration: question_bank.source CHECK constraint widen
-- Date: 2026-05-11
-- Purpose: The 2026_05_10 migration was applied to the live DB while
--   its source CHECK still only allowed three values
--   ('manual','ai-generated','past-year-llm'). The pyqAgent now writes
--   'placement-style-llm', which violates the old constraint and causes
--   every insert to fail with `question_bank_source_check`.
--
--   PostgreSQL's ALTER TABLE ADD COLUMN IF NOT EXISTS does NOT update
--   an existing column's CHECK constraint on re-run, so we explicitly
--   drop and recreate the constraint here. Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.question_bank
  DROP CONSTRAINT IF EXISTS question_bank_source_check;

ALTER TABLE public.question_bank
  ADD CONSTRAINT question_bank_source_check
  CHECK (source IN ('manual', 'ai-generated', 'past-year-llm', 'placement-style-llm'));

COMMIT;

-- Verification (run separately, not part of the transaction):
--   SELECT pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conname = 'question_bank_source_check';
-- Expected: CHECK ((source = ANY (ARRAY['manual'::text, 'ai-generated'::text, 'past-year-llm'::text, 'placement-style-llm'::text])))
