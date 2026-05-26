-- ============================================
-- Orbivex — Complete Database Setup
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================

-- Profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  role TEXT DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'student'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Courses
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  difficulty TEXT DEFAULT 'beginner',
  thumbnail_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Lessons
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  video_url TEXT,
  content_text TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  duration_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enrollments
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, course_id)
);

-- Progress
CREATE TABLE IF NOT EXISTS public.progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT true,
  completed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- Quizzes
CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'Quiz',
  questions_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Quiz Responses
CREATE TABLE IF NOT EXISTS public.quiz_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  score FLOAT,
  answers_json JSONB,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

-- Jobs
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  company TEXT DEFAULT '',
  description TEXT DEFAULT '',
  location TEXT DEFAULT '',
  type TEXT DEFAULT 'full-time',
  posted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Applications
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  applied_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, job_id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  message TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Colleges ───
CREATE TABLE IF NOT EXISTS public.colleges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  type TEXT NOT NULL CHECK (type IN ('government', 'private', 'autonomous')),
  established_year INTEGER,
  principal_email TEXT,
  phone TEXT,
  website TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Branches ───
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  hod_name TEXT,
  hod_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(college_id, code)
);

-- ─── Sections ───
CREATE TABLE IF NOT EXISTS public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  section_name TEXT NOT NULL,
  academic_year TEXT,
  semester INTEGER,
  student_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Add student fields to profiles ───
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='college_id') THEN
    ALTER TABLE public.profiles ADD COLUMN college_id UUID REFERENCES public.colleges(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='branch_id') THEN
    ALTER TABLE public.profiles ADD COLUMN branch_id UUID REFERENCES public.branches(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='section_id') THEN
    ALTER TABLE public.profiles ADD COLUMN section_id UUID REFERENCES public.sections(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='enrollment_number') THEN
    ALTER TABLE public.profiles ADD COLUMN enrollment_number TEXT UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='hall_ticket_number') THEN
    ALTER TABLE public.profiles ADD COLUMN hall_ticket_number TEXT UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='semester') THEN
    ALTER TABLE public.profiles ADD COLUMN semester INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='admission_year') THEN
    ALTER TABLE public.profiles ADD COLUMN admission_year INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_active') THEN
    ALTER TABLE public.profiles ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='emergency_contact') THEN
    ALTER TABLE public.profiles ADD COLUMN emergency_contact TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='phone_number') THEN
    ALTER TABLE public.profiles ADD COLUMN phone_number TEXT;
  END IF;
END $$;

-- ─── Educators ───
CREATE TABLE IF NOT EXISTS public.educators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  college_id UUID REFERENCES public.colleges(id),
  branch_id UUID REFERENCES public.branches(id),
  section_id UUID REFERENCES public.sections(id),
  qualification TEXT,
  specialization TEXT,
  experience_years INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Educator Courses ───
CREATE TABLE IF NOT EXISTS public.educator_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  educator_id UUID NOT NULL REFERENCES public.educators(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id),
  academic_year TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Educator Agent Config ───
CREATE TABLE IF NOT EXISTS public.educator_agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  educator_id UUID NOT NULL REFERENCES public.educators(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  model_name TEXT,
  agent_count INTEGER DEFAULT 1,
  parameters JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Question Bank ───
CREATE TABLE IF NOT EXISTS public.question_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id UUID REFERENCES public.colleges(id),
  course_id UUID REFERENCES public.courses(id),
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('mcq', 'short-answer', 'descriptive', 'code')),
  difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
  category TEXT CHECK (category IN ('technical', 'non-technical', 'aptitude')),
  test_type TEXT NOT NULL CHECK (test_type IN ('academic', 'company-specific')),
  company_name TEXT,
  answers_json JSONB,
  created_by UUID REFERENCES public.educators(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Test Papers ───
CREATE TABLE IF NOT EXISTS public.test_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id UUID NOT NULL REFERENCES public.colleges(id),
  branch_id UUID REFERENCES public.branches(id),
  section_id UUID REFERENCES public.sections(id),
  course_id UUID REFERENCES public.courses(id),
  title TEXT NOT NULL,
  description TEXT,
  test_type TEXT NOT NULL CHECK (test_type IN ('academic', 'company-specific')),
  company_name TEXT,
  total_marks INTEGER,
  duration_minutes INTEGER,
  passing_score INTEGER,
  scheduled_date TIMESTAMPTZ,
  scheduled_end_time TIMESTAMPTZ,
  created_by UUID REFERENCES public.educators(id),
  is_published BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Test Paper Questions ───
CREATE TABLE IF NOT EXISTS public.test_paper_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_paper_id UUID NOT NULL REFERENCES public.test_papers(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.question_bank(id),
  marks INTEGER,
  sort_order INTEGER,
  added_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Test Submissions ───
CREATE TABLE IF NOT EXISTS public.test_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_paper_id UUID NOT NULL REFERENCES public.test_papers(id),
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  response_json JSONB,
  total_marks INTEGER,
  obtained_marks INTEGER,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'evaluated')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Bulk Imports ───
CREATE TABLE IF NOT EXISTS public.bulk_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type TEXT,
  college_id UUID REFERENCES public.colleges(id),
  imported_by UUID REFERENCES public.profiles(id),
  file_name TEXT,
  total_records INTEGER,
  successful_records INTEGER,
  failed_records INTEGER,
  error_log JSONB,
  import_status TEXT DEFAULT 'completed' CHECK (import_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ─── RLS Policies ───
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educator_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educator_agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_paper_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_imports ENABLE ROW LEVEL SECURITY;

-- Allow service role (backend) full access — these policies let the anon key read public data
DO $$ BEGIN
  -- Profiles
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own profile') THEN
    CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile') THEN
    CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
  -- Courses
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view published courses') THEN
    CREATE POLICY "Anyone can view published courses" ON public.courses FOR SELECT USING (is_published = true);
  END IF;
  -- Lessons
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view lessons') THEN
    CREATE POLICY "Anyone can view lessons" ON public.lessons FOR SELECT USING (true);
  END IF;
  -- Jobs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view jobs') THEN
    CREATE POLICY "Anyone can view jobs" ON public.jobs FOR SELECT USING (true);
  END IF;
  -- Enrollments
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own enrollments') THEN
    CREATE POLICY "Users can view own enrollments" ON public.enrollments FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can enroll') THEN
    CREATE POLICY "Users can enroll" ON public.enrollments FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  -- Progress
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own progress') THEN
    CREATE POLICY "Users can view own progress" ON public.progress FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert progress') THEN
    CREATE POLICY "Users can insert progress" ON public.progress FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  -- Quizzes
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view quizzes') THEN
    CREATE POLICY "Anyone can view quizzes" ON public.quizzes FOR SELECT USING (true);
  END IF;
  -- Quiz responses
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own quiz responses') THEN
    CREATE POLICY "Users can view own quiz responses" ON public.quiz_responses FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can submit quiz') THEN
    CREATE POLICY "Users can submit quiz" ON public.quiz_responses FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  -- Applications
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own applications') THEN
    CREATE POLICY "Users can view own applications" ON public.applications FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can apply') THEN
    CREATE POLICY "Users can apply" ON public.applications FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  -- Notifications
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own notifications') THEN
    CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
  END IF;
  -- Colleges (public read)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view colleges') THEN
    CREATE POLICY "Anyone can view colleges" ON public.colleges FOR SELECT USING (true);
  END IF;
  -- Branches (public read)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view branches') THEN
    CREATE POLICY "Anyone can view branches" ON public.branches FOR SELECT USING (true);
  END IF;
  -- Sections (public read)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view sections') THEN
    CREATE POLICY "Anyone can view sections" ON public.sections FOR SELECT USING (true);
  END IF;
  -- Educators (public read)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view educators') THEN
    CREATE POLICY "Anyone can view educators" ON public.educators FOR SELECT USING (true);
  END IF;
  -- Question bank (public read)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view questions') THEN
    CREATE POLICY "Anyone can view questions" ON public.question_bank FOR SELECT USING (true);
  END IF;
  -- Test papers (public read for published)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view published tests') THEN
    CREATE POLICY "Anyone can view published tests" ON public.test_papers FOR SELECT USING (is_published = true);
  END IF;
  -- Test submissions (own only)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own test submissions') THEN
    CREATE POLICY "Users can view own test submissions" ON public.test_submissions FOR SELECT USING (auth.uid() = student_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can submit tests') THEN
    CREATE POLICY "Users can submit tests" ON public.test_submissions FOR INSERT WITH CHECK (auth.uid() = student_id);
  END IF;
END $$;

-- ─── Backfill profiles for existing auth users ───
INSERT INTO public.profiles (id, username, display_name, role)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1)),
  COALESCE(raw_user_meta_data->>'display_name', split_part(email, '@', 1)),
  'student'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Company Prep tables (mirrors scripts/migrations/2026_04_30_company_prep.sql)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.company_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  company_slug TEXT NOT NULL,
  company_color TEXT,
  company_tier TEXT,
  company_tagline TEXT,
  company_hiring TEXT,
  round_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  duration_minutes INTEGER,
  topics JSONB DEFAULT '[]'::jsonb,
  test_paper_id UUID REFERENCES public.test_papers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT company_rounds_unique_slug_index UNIQUE (company_slug, round_index)
);

CREATE TABLE IF NOT EXISTS public.company_round_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_slug TEXT NOT NULL,
  round_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'locked'
    CHECK (status IN ('locked', 'unlocked', 'completed')),
  completed_at TIMESTAMPTZ,
  UNIQUE (student_id, company_slug, round_index)
);

CREATE TABLE IF NOT EXISTS public.practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  category TEXT NOT NULL,
  topic TEXT,
  questions_answered INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  session_minutes INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  company_round_id UUID REFERENCES public.company_rounds(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.practice_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.practice_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.question_bank(id) ON DELETE CASCADE,
  selected_option INTEGER,
  is_correct BOOLEAN,
  answered_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_round_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_round_id UUID NOT NULL REFERENCES public.company_rounds(id) ON DELETE CASCADE,
  test_paper_id UUID REFERENCES public.test_papers(id) ON DELETE SET NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  obtained_marks INTEGER,
  total_marks INTEGER,
  percentage INTEGER,
  status TEXT DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'submitted', 'evaluated')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, company_round_id, attempt_number)
);

ALTER TABLE public.question_bank
  ADD COLUMN IF NOT EXISTS topic TEXT DEFAULT NULL;

ALTER TABLE public.company_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_round_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_round_attempts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'company_rounds readable by authenticated') THEN
    CREATE POLICY "company_rounds readable by authenticated" ON public.company_rounds FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'company_rounds admin write') THEN
    CREATE POLICY "company_rounds admin write" ON public.company_rounds FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'company_round_progress readable by authenticated') THEN
    CREATE POLICY "company_round_progress readable by authenticated" ON public.company_round_progress FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'company_round_progress owner write') THEN
    CREATE POLICY "company_round_progress owner write" ON public.company_round_progress FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'practice_sessions readable by authenticated') THEN
    CREATE POLICY "practice_sessions readable by authenticated" ON public.practice_sessions FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'practice_sessions owner write') THEN
    CREATE POLICY "practice_sessions owner write" ON public.practice_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'practice_responses readable by authenticated') THEN
    CREATE POLICY "practice_responses readable by authenticated" ON public.practice_responses FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'practice_responses owner write') THEN
    CREATE POLICY "practice_responses owner write" ON public.practice_responses FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'company_round_attempts readable by authenticated') THEN
    CREATE POLICY "company_round_attempts readable by authenticated" ON public.company_round_attempts FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'company_round_attempts owner write') THEN
    CREATE POLICY "company_round_attempts owner write" ON public.company_round_attempts FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_company_rounds_slug ON public.company_rounds(company_slug);
CREATE INDEX IF NOT EXISTS idx_company_rounds_round_index ON public.company_rounds(company_slug, round_index);
CREATE INDEX IF NOT EXISTS idx_company_round_progress_student ON public.company_round_progress(student_id, company_slug);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_student ON public.practice_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_company_name ON public.practice_sessions(company_name);
CREATE INDEX IF NOT EXISTS idx_practice_responses_session ON public.practice_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_company_round_attempts_student ON public.company_round_attempts(student_id, company_round_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_company_topic
  ON public.question_bank(company_name, topic)
  WHERE company_name IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- topic_notes — AI-generated study notes cache (Learn page)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.topic_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_slug TEXT NOT NULL,
  round_index INTEGER NOT NULL,
  topic TEXT NOT NULL,
  pace_level INTEGER NOT NULL DEFAULT 3 CHECK (pace_level BETWEEN 1 AND 5),
  notes_json JSONB NOT NULL,
  model TEXT,
  generated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT topic_notes_unique_with_pace UNIQUE (company_slug, round_index, topic, pace_level)
);

ALTER TABLE public.topic_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'topic_notes readable by authenticated') THEN
    CREATE POLICY "topic_notes readable by authenticated" ON public.topic_notes FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'topic_notes write by authenticated') THEN
    CREATE POLICY "topic_notes write by authenticated" ON public.topic_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_topic_notes_lookup
  ON public.topic_notes(company_slug, round_index, topic, pace_level);
