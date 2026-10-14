-- ============================================================================
-- RLS HARDENING — deny by default
-- Date: 2026-08-06   Phase: 0 (integrity)
-- ============================================================================
--
-- WHY THIS EXISTS
-- ---------------
-- The schema shipped with policies like:
--     CREATE POLICY ... ON question_bank FOR SELECT USING (true);
--     CREATE POLICY ... ON lessons       FOR SELECT USING (true);
--     CREATE POLICY ... ON quizzes       FOR SELECT USING (true);
--     CREATE POLICY ... ON company_round_progress FOR ALL USING (true) WITH CHECK (true);
--
-- The anon key is public — it ships inside the browser bundle as
-- VITE_SUPABASE_KEY. So `USING (true)` meant any student could open devtools
-- and run:
--     supabase.from('question_bank').select('*')
-- and receive every question together with its `answers_json` marking the
-- correct option. The API hides answers (routes/tests.js); the database handed
-- them out anyway. The `USING (true) WITH CHECK (true)` write policies let any
-- authenticated user forge rows for any other student_id.
--
-- THE NEW POSTURE
-- ---------------
-- Every table in `public` has RLS enabled and NO policy, except the four
-- tables the browser subscribes to over Realtime (which evaluates RLS with the
-- caller's JWT). Those get own-row SELECT only.
--
-- All application access goes through the backend's service-role client
-- (`supabaseAdmin`), which bypasses RLS. That is now the ONLY write path, and
-- authorization is enforced in Express middleware where it can be reviewed and
-- tested. Any route still using the anon `supabase` client for table access
-- will now fail loudly instead of silently depending on a permissive policy.
--
-- Deliberately NOT using `ALTER TABLE ... FORCE ROW LEVEL SECURITY` — that
-- would apply policies to the table owner and service_role too, breaking the
-- entire backend.
--
-- Safe to re-run. Pre-launch: this drops existing policies outright rather
-- than layering compatible ones.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Enable RLS on every table in `public`, and drop EVERY existing policy.
--
--    Enumerating policy names by hand was the old approach and it rotted —
--    24 migrations added policies under inconsistent names, several of which
--    (placement_drives et al.) enabled RLS and then never created a policy at
--    all. Driving off the catalog covers tables added since, too.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'          -- ordinary tables only, no views/matviews
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tbl);
  END LOOP;

  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Helper: the caller's college, read without tripping RLS recursion.
--
--    SECURITY DEFINER so the lookup on `profiles` isn't itself subject to the
--    profiles policy (which would recurse). search_path is pinned — a
--    SECURITY DEFINER function with a mutable search_path is a privilege
--    escalation vector.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_college_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT college_id FROM public.profiles WHERE id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.current_college_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_college_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. The allowlist — own-row SELECT for the four Realtime tables only.
--
--    frontend/src/hooks/useRealtime.js subscribes to exactly these:
--      notifications    -> useNotifications(userId)
--      progress         -> useProgress(userId)
--      test_submissions -> useTestResult(submissionId)
--      placement_drives -> useDriveUpdates(collegeId)
--
--    SELECT only. Realtime needs read to deliver a change event; it never
--    needs write. Every mutation goes through the API.
--
--    NOTE: `placement_drives` had RLS enabled with zero policies since
--    2026_05_27, so useDriveUpdates() has been silently dead. This is the
--    first policy it has ever had.
-- ---------------------------------------------------------------------------

CREATE POLICY "rt_own_notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "rt_own_progress" ON public.progress
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "rt_own_test_submissions" ON public.test_submissions
  FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "rt_own_college_drives" ON public.placement_drives
  FOR SELECT TO authenticated
  USING (college_id = public.current_college_id());

-- Own profile read/update stays available to the client: Supabase auth helpers
-- and the session bootstrap expect it, and it leaks nothing cross-tenant.
CREATE POLICY "own_profile_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "own_profile_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

COMMIT;

-- ============================================================================
-- VERIFICATION — run these after applying.
-- ============================================================================
--
-- (a) Nothing in public should be missing RLS. Expect zero rows:
--
--     SELECT c.relname
--     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--     WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
--
-- (b) The surviving policy set should be exactly the six above:
--
--     SELECT tablename, policyname, cmd, roles
--     FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
--
-- (c) The leak that motivated this. With the ANON key (not service role),
--     this must now return zero rows / a permission error:
--
--     supabase.from('question_bank').select('*').limit(1)
--     supabase.from('lessons').select('content_text').limit(1)
--     supabase.from('quizzes').select('questions_json').limit(1)
--
-- (d) Realtime still works: log in as a student, have the API insert a
--     notification, confirm the bell badge increments without a refresh.
-- ============================================================================
