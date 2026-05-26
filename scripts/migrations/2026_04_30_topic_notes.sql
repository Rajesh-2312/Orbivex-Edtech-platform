-- ─────────────────────────────────────────────────────────────
-- Migration: topic_notes
-- Date: 2026-04-30
-- Purpose: Cache for AI-generated study notes per
--   (company_slug, round_index, topic). Lets the Learn page
--   serve instantly after the first generation.
-- ─────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.topic_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_slug TEXT NOT NULL,
  round_index INTEGER NOT NULL,
  topic TEXT NOT NULL,
  notes_json JSONB NOT NULL,
  model TEXT,
  generated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_slug, round_index, topic)
);

ALTER TABLE public.topic_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "topic_notes readable by authenticated" ON public.topic_notes;
CREATE POLICY "topic_notes readable by authenticated"
  ON public.topic_notes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "topic_notes write by authenticated" ON public.topic_notes;
CREATE POLICY "topic_notes write by authenticated"
  ON public.topic_notes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_topic_notes_lookup
  ON public.topic_notes(company_slug, round_index, topic);

COMMIT;
