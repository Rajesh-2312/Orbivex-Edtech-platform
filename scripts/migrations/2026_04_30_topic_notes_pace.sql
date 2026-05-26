-- ─────────────────────────────────────────────────────────────
-- Migration: topic_notes_pace
-- Date: 2026-04-30
-- Purpose: Add pace_level (1-5) so each topic can hold up to 5
--   AI-generated variants — students pick their learning pace
--   and the Learn page serves the matching variant.
-- ─────────────────────────────────────────────────────────────

BEGIN;

-- Add pace_level. Default 3 = Standard so any pre-existing rows stay valid.
ALTER TABLE public.topic_notes
  ADD COLUMN IF NOT EXISTS pace_level INTEGER NOT NULL DEFAULT 3
  CHECK (pace_level BETWEEN 1 AND 5);

-- Replace the (slug, round_index, topic) unique key with one that
-- includes pace_level so we can hold all 5 variants per topic.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'topic_notes_company_slug_round_index_topic_key'
  ) THEN
    ALTER TABLE public.topic_notes
      DROP CONSTRAINT topic_notes_company_slug_round_index_topic_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'topic_notes_unique_with_pace'
  ) THEN
    ALTER TABLE public.topic_notes
      ADD CONSTRAINT topic_notes_unique_with_pace
      UNIQUE (company_slug, round_index, topic, pace_level);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_topic_notes_lookup_with_pace
  ON public.topic_notes(company_slug, round_index, topic, pace_level);

COMMIT;
