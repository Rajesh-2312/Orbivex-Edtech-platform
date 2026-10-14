-- ============================================================
--  Orbivex — DSA Coding Practice Migration
--  2026-06-07
--  Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. coding_problems ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coding_problems (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  title           text NOT NULL,
  topic           text NOT NULL,
  difficulty      text NOT NULL CHECK (difficulty IN ('Easy','Medium','Hard')),
  description     text NOT NULL,
  constraints     text,
  hint_topic      text,
  companies       text[]   DEFAULT '{}',
  tags            text[]   DEFAULT '{}',
  test_type       text     DEFAULT 'coding',
  is_active       boolean  DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_coding_problems_topic      ON public.coding_problems(topic);
CREATE INDEX IF NOT EXISTS idx_coding_problems_difficulty ON public.coding_problems(difficulty);
CREATE INDEX IF NOT EXISTS idx_coding_problems_slug       ON public.coding_problems(slug);

-- ── 2. coding_attempts ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coding_attempts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id  uuid NOT NULL REFERENCES public.coding_problems(id) ON DELETE CASCADE,
  status      text NOT NULL CHECK (status IN ('solved','attempted','bookmarked')),
  hint_level  int  DEFAULT 0,
  attempted_at timestamptz DEFAULT now(),
  solved_at    timestamptz,
  UNIQUE(student_id, problem_id)
);

CREATE INDEX IF NOT EXISTS idx_coding_attempts_student ON public.coding_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_coding_attempts_problem ON public.coding_attempts(problem_id);

-- ── 3. user_streaks ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_streaks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak  int  DEFAULT 0,
  longest_streak  int  DEFAULT 0,
  last_active_date date,
  total_solved    int  DEFAULT 0,
  updated_at      timestamptz DEFAULT now()
);

-- ── 4. RLS ───────────────────────────────────────────────────
ALTER TABLE public.coding_problems  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_attempts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_streaks     ENABLE ROW LEVEL SECURITY;

-- coding_problems: anyone authenticated can read active problems
DROP POLICY IF EXISTS "coding_problems_read" ON public.coding_problems;
CREATE POLICY "coding_problems_read"
  ON public.coding_problems FOR SELECT
  USING (is_active = true);

-- coding_attempts: students own their rows
DROP POLICY IF EXISTS "coding_attempts_own" ON public.coding_attempts;
CREATE POLICY "coding_attempts_own"
  ON public.coding_attempts FOR ALL
  USING  (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- user_streaks: students own their rows
DROP POLICY IF EXISTS "user_streaks_own" ON public.user_streaks;
CREATE POLICY "user_streaks_own"
  ON public.user_streaks FOR ALL
  USING  (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- ── 5. Helper: upsert streak function ────────────────────────
CREATE OR REPLACE FUNCTION public.update_coding_streak(p_student_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_last_date  date;
  v_streak     int;
  v_longest    int;
  v_today      date := CURRENT_DATE;
BEGIN
  SELECT last_active_date, current_streak, longest_streak
    INTO v_last_date, v_streak, v_longest
    FROM public.user_streaks
    WHERE student_id = p_student_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_streaks (student_id, current_streak, longest_streak, last_active_date)
      VALUES (p_student_id, 1, 1, v_today);
    RETURN;
  END IF;

  IF v_last_date = v_today THEN
    -- Already active today, just refresh
    RETURN;
  ELSIF v_last_date = v_today - INTERVAL '1 day' THEN
    -- Consecutive day
    v_streak := v_streak + 1;
  ELSE
    -- Streak broken
    v_streak := 1;
  END IF;

  v_longest := GREATEST(v_longest, v_streak);

  UPDATE public.user_streaks
    SET current_streak  = v_streak,
        longest_streak  = v_longest,
        last_active_date= v_today,
        total_solved    = (
          SELECT COUNT(*) FROM public.coding_attempts
          WHERE student_id = p_student_id AND status = 'solved'
        ),
        updated_at = now()
  WHERE student_id = p_student_id;
END;
$$;
