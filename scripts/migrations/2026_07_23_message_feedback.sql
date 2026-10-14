-- ═══════════════════════════════════════════════════════════════════
-- Orbivex — Message feedback (Phase 4)
-- Migration: 2026_07_23_message_feedback.sql
--
-- A thumbs up/down on an assistant answer. This is the seed corpus for
-- the Phase 6 fine-tune: thumbs-up + high grounded_score turns are
-- positive training examples, thumbs-down are hard negatives.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.tutor_messages
  ADD COLUMN IF NOT EXISTS feedback SMALLINT;  -- 1 = up, -1 = down, NULL = none

-- Constrain to the three valid states.
DO $$ BEGIN
  ALTER TABLE public.tutor_messages
    ADD CONSTRAINT tutor_messages_feedback_chk CHECK (feedback IN (-1, 1));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Find rated turns fast when building the training set.
CREATE INDEX IF NOT EXISTS idx_tutor_messages_feedback
  ON public.tutor_messages(feedback)
  WHERE feedback IS NOT NULL;
