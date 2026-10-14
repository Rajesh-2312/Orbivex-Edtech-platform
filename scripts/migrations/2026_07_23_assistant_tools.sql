-- ═══════════════════════════════════════════════════════════════════
-- Orbivex — Platform assistant + tool execution (Phase 3)
-- Migration: 2026_07_23_assistant_tools.sql
--
-- Extends tutor_messages so it can carry a platform-wide assistant
-- conversation (not just a single lesson's Q&A) and record what the
-- assistant did each turn — the trace that Phase 5 evaluates and Phase 6
-- trains on.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

-- A platform-scoped turn is not tied to any lesson.
ALTER TABLE public.tutor_messages ALTER COLUMN lesson_id DROP NOT NULL;

ALTER TABLE public.tutor_messages
  ADD COLUMN IF NOT EXISTS scope        TEXT    DEFAULT 'lesson',  -- lesson | course | platform
  ADD COLUMN IF NOT EXISTS session_id   UUID,                      -- groups a conversation
  ADD COLUMN IF NOT EXISTS tool_calls   JSONB,                     -- [{name, args, ok, ms}]
  ADD COLUMN IF NOT EXISTS latency_ms   INT,
  ADD COLUMN IF NOT EXISTS provider     TEXT,                      -- which LLM answered
  ADD COLUMN IF NOT EXISTS grounded_score FLOAT;                   -- filled async, Phase 4

-- Retrieve a whole conversation by session efficiently.
CREATE INDEX IF NOT EXISTS idx_tutor_messages_session
  ON public.tutor_messages(session_id, created_at)
  WHERE session_id IS NOT NULL;

-- The existing RLS SELECT policy ("own tutor messages", user_id = auth.uid())
-- already covers platform-scoped rows — no policy change needed. The backend
-- writes with the service-role key, which bypasses RLS.
