# Orbivex — Project Blueprint

> **Version**: 3.0
> **Last Updated**: 2026-04-19
> **Status**: Beta-Ready (Phase 7 complete)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & Tech Stack](#2-architecture--tech-stack)
3. [Authentication](#3-authentication)
4. [Frontend Design System](#4-frontend-design-system)
5. [Database Schema](#5-database-schema)
6. [Backend API](#6-backend-api)
7. [AI Agents](#7-ai-agents)
8. [Admin Dashboard](#8-admin-dashboard)
9. [Docker Compose](#9-docker-compose)
10. [Project Structure](#10-project-structure)
11. [Environment Variables](#11-environment-variables)
12. [Running the Project](#12-running-the-project)
13. [Sample Credentials](#13-sample-credentials)
14. [Build Phases](#14-build-phases)
15. [Deployment & Scaling](#15-deployment--scaling)

---

## 1. Project Overview

**Orbivex** is an AI-powered EdTech platform designed for 4,000+ students across multiple colleges. It delivers a full learning management stack plus a career pipeline, and every heavy "content" task (quiz creation, grading, plagiarism, course drafting) is handled by self-hosted LLM agents running on Ollama — no third-party AI costs.

| Capability | Description |
|---|---|
| **Courses & Lessons** | Browse, enroll, track progress with video + rich-text lessons |
| **AI Course Generation** | Draft a full course outline (title, description, lessons) from a subject prompt |
| **AI Quiz Generation** | Auto-generate MCQ quizzes from lesson content |
| **Plagiarism Detection** | AI-powered assignment originality check |
| **Smart Grading** | Automated rubric-based grading with feedback |
| **Personalized Paths** | AI-recommended next lessons based on progress |
| **Question Bank + Tests** | Academic and company-specific (Java, Python, DBMS, Aptitude, Verbal) question banks that feed into assembled test papers |
| **Multi-Tenant Org Model** | Colleges → Branches → Sections → Students; courses can be scoped per-scope |
| **Job Board** | Post jobs, apply, track application status |
| **Company Prep** | Company-specific interview roadmaps, timed attempts, practice sessions, and AI-generated topic notes (with 5 pace levels) |
| **Progress Analytics** | Visual dashboards with charts |
| **Admin Dashboard** | Full platform management (users, colleges, courses, lessons, tests, jobs) |

### Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Auth** | Email + Password via Supabase Auth | Direct, no synthetic emails, JWT handled by Supabase |
| **Frontend** | React 18 + Vite + Vanilla CSS | Maximum control over premium animations, no Tailwind churn |
| **Backend** | Node.js + Express | Simple, fast, REST API |
| **Database** | Supabase PostgreSQL | Free tier, scalable, built-in auth & RLS |
| **AI/LLM** | Ollama in Docker — default `qwen2.5:1.5b` (~1 GB); optional `phi3` / `mistral` | Free, self-hosted, no API costs. Small default fits ~4 GiB Docker hosts |
| **State** | Zustand | Lightweight, no boilerplate |
| **Containerization** | Docker Compose | Single-command deployment |

---

## 2. Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                      BROWSER (Client)                           │
│  React 18 + Vite · Vanilla CSS · Framer Motion                  │
│  Zustand (state) · React Router · Chart.js · Axios              │
│  Branding: "Orbivex" — dark-mode glassmorphism                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST API (JSON, JWT in Authorization)
                               ▼
┌───────────────────── DOCKER COMPOSE (network: orbivex-net) ─────┐
│                                                                 │
│  ┌──────────────────────────┐   ┌─────────────────────────────┐ │
│  │  orbivex-api              │   │  orbivex-ollama              │ │
│  │  Node.js 20 + Express     │──▶│  ollama/ollama:latest        │ │
│  │  Port 3001 (host 3001)    │   │  Models: qwen2.5:1.5b        │ │
│  │                           │   │          (opt) phi3, mistral │ │
│  │  /api/auth                │   │  Port 11434 (host 11435)     │ │
│  │  /api/courses             │   └─────────────────────────────┘ │
│  │  /api/lessons             │                                   │
│  │  /api/quizzes             │   ┌─────────────────────────────┐ │
│  │  /api/progress            │──▶│  orbivex-redis               │ │
│  │  /api/jobs                │   │  redis:7-alpine              │ │
│  │  /api/analytics           │   │  Port 6379                   │ │
│  │  /api/ai                  │   └─────────────────────────────┘ │
│  │  /api/admin               │                                   │
│  │  /api/health              │   ┌─────────────────────────────┐ │
│  └──────────────┬────────────┘   │  Supabase (External)         │ │
│                 │                 │  - PostgreSQL + RLS          │ │
│                 └────────────────▶│  - Auth (email + password)   │ │
│                                   │  - Storage (videos/docs)     │ │
│                                   │  - Realtime                  │ │
│                                   └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Request Lifecycle (typical API call)

1. Frontend action → Zustand store → `lib/api.js` (Axios) attaches `Authorization: Bearer <jwt>`
2. Express receives request → rate limiter → `authMiddleware` verifies JWT with Supabase
3. `roleMiddleware('admin')` (if needed) checks `req.user.role`
4. Route handler uses `supabaseAdmin` (service-role key) for data access (bypasses RLS)
5. For `/api/ai/*` and `/api/admin/courses/generate`, handler calls an **Agent** in `backend/agents/`
6. Agent hits Ollama over the Docker network (`http://ollama:11434`) and returns structured JSON
7. Response formatted by `utils/response.js` → `{ success, data }` or `{ success: false, error }`

---

## 3. Authentication

### Strategy

Users sign up and log in with **email + password**. Supabase Auth handles all token management.

- **Signup**: `POST /api/auth/signup` — creates user via `supabaseAdmin.auth.admin.createUser()` with `email_confirm: true` (bypasses email verification)
- **Login**: `POST /api/auth/login` — returns JWT access token + refresh token
- **Me**: `GET /api/auth/me` — returns current profile joined with `profiles` row
- **Profile row**: auto-created via database trigger `on_auth_user_created` → `handle_new_user()` on signup

### Roles

| Role | Access |
|------|--------|
| `student` | Default role. Browse courses (scoped by `course_access`), enroll, take quizzes/tests, track progress, apply to jobs |
| `teacher` | Can create/edit courses and lessons; bypasses course_access filter |
| `admin` | Full platform access. Manages all users, colleges, educators, courses, lessons, tests, jobs via Admin Dashboard |

### Middleware Stack

- `middleware/auth.js` — verifies Supabase JWT, attaches `req.user` (id, email, role)
- `middleware/role.js` — `roleMiddleware('admin', 'teacher')` restricts by role
- `middleware/rateLimiter.js` — per-route limits (see §6)

---

## 4. Frontend Design System

### Design Philosophy

> **Dark-mode first. Glassmorphism. Micro-animations everywhere.**

- CSS variables for theming (`--primary-500: #6366f1`, surfaces, borders, text tiers)
- `glass-card` / `glass-card-static` classes for glassmorphism panels
- Framer Motion for page transitions, hover effects, staggered list animations
- Responsive breakpoints at 768px and 480px
- Brand mark: "**O**" in a gradient ring, wordmark "Orbivex"

### Reusable UI Components (`components/ui/`)

| Component | Purpose |
|-----------|---------|
| `Button` | Primary, ghost, icon variants with loading state |
| `Card` | Glass card with optional hover effect |
| `Input` | Labeled input with icon support |
| `Modal` | Animated overlay with backdrop close; accepts `size="md" \| "lg" \| "xl"` |
| `Badge` | Status/category badges (primary, success, warning, danger) |
| `ProgressBar` | Animated progress indicator |
| `Skeleton` | Loading placeholder |
| `Toast` | Notification toasts (success, error, warning) |

### Notable Custom Visualizers

| Component | Where | Purpose |
|---|---|---|
| AI Course Generation progress bar | [AdminPage.jsx — CoursesPanel](frontend/src/pages/AdminPage.jsx) | Staged progress (Connecting → Drafting → Generating lessons → Saving → Finalizing) with gradient shimmer and elapsed-seconds counter while the Ollama call runs |
| Agent Config Panel | [AgentConfigPanel.jsx](frontend/src/components/admin/AgentConfigPanel.jsx) | Per-educator AI agent scaling slider (1–10 parallel agents) |
| Test Paper Builder | [TestPaperBuilder.jsx](frontend/src/components/admin/TestPaperBuilder.jsx) | Drag-and-drop question ordering with mark assignment |

---

## 5. Database Schema

All tables live in Supabase PostgreSQL. Setup SQL is in `supabase-setup.sql`.

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `profiles` | User profiles (linked to `auth.users`) | id, username, display_name, role, avatar_url, bio, college_id, branch_id, section_id, enrollment_number, hall_ticket_number |
| `colleges` | Institution management | id, name, code, address, type, principal_email, phone |
| `branches` | College departments | id, college_id, name, code, hod_name, hod_email |
| `sections` | Class sections | id, branch_id, section_name, academic_year, semester, student_count |
| `educators` | Faculty management | id, user_id, college_id, branch_id, qualification, specialization, experience_years |
| `educator_courses` | Course assignments | id, educator_id, course_id, section_id, academic_year |
| `educator_agent_config` | AI agent scaling | id, educator_id, agent_type, model_name, agent_count, parameters |

### Learning Content

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `courses` | Course catalog | title, description, category, difficulty, is_published, created_by |
| `lessons` | Lesson content per course | course_id, title, video_url, content_text, sort_order, duration_minutes |
| `enrollments` | Student-course enrollment | user_id, course_id (unique pair) |
| `progress` | Lesson completion tracking | user_id, lesson_id, completed |
| `course_access` | Scope a course to specific college/branch/section | id, course_id, college_id, branch_id, section_id (NULL = wildcard at that level) |

### Assessment

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `quizzes` | Quiz definitions (per-lesson) | lesson_id, title, questions_json (JSONB) |
| `quiz_responses` | Student quiz submissions | user_id, quiz_id, score, answers_json |
| `question_bank` | Questions repository (academic + company) | id, course_id, question_text, question_type, difficulty_level, category, test_type, company_name, answers_json |
| `test_papers` | Exam/test definitions | id, college_id, branch_id, section_id, course_id, title, test_type, company_name, total_marks, duration_minutes, status |
| `test_paper_questions` | Questions in a test | id, test_paper_id, question_id, marks, sort_order |
| `test_submissions` | Student test responses | id, test_paper_id, student_id, response_json, obtained_marks, status |

### Platform

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `jobs` | Job board listings | title, company, description, location, type, posted_by |
| `applications` | Job applications | user_id, job_id, status |
| `notifications` | User notifications | user_id, title, message, read |
| `bulk_imports` | Import history (CSV audits) | id, import_type, college_id, imported_by, file_name, total_records, successful_records, error_log |

### Company Prep & Paced Learning (v3.1)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `company_rounds` | Roadmap rounds per company | company_slug, round_index, title, topics |
| `company_round_progress` | Track student unlock status | student_id, company_slug, round_index, status |
| `practice_sessions` | Real-time practice tracking | student_id, company_name, category, session_minutes |
| `practice_responses` | Per-question answer logs | session_id, question_id, is_correct |
| `company_round_attempts`| Timed exam attempts | student_id, company_round_id, percentage, status |
| `topic_notes` | Cached AI study materials | company_slug, round_index, topic, pace_level, notes_json |

### RLS

Row Level Security is enabled on all tables. The backend uses the **service role key** (bypasses RLS) for admin operations. Anon key respects RLS policies for public reads.

### Auto-Profile Trigger

A database trigger (`on_auth_user_created`) automatically inserts a `profiles` row whenever a new user signs up via Supabase Auth. Uses `ON CONFLICT (id) DO NOTHING` to survive re-seed attempts.

---

## 6. Backend API

Node.js + Express, fully Dockerized. All routes return consistent JSON:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "message" }
```

### API Routes

| Route Group | Endpoints | Auth Required |
|-------------|-----------|---------------|
| `/api/auth` | signup, login, logout, me | No (signup/login), Yes (me) |
| `/api/courses` | list, get, create, update, delete, enroll, my/enrolled | Yes |
| `/api/lessons` | list by course, get, create, update | Yes |
| `/api/quizzes` | get by lesson, submit, results | Yes |
| `/api/progress` | mark complete, summary, course progress | Yes |
| `/api/jobs` | list, apply | Yes |
| `/api/analytics` | dashboard stats, course analytics | Yes |
| `/api/ai` | generate-quiz, grade-assignment, check-plagiarism, recommend-lessons, summarize, generate-course | Yes |
| `/api/admin` | overview, users, courses (+ generate, access), lessons, jobs, colleges, branches, sections, students, educators, question-bank, test-papers CRUD | Admin only |
| `/api/health` | service status check | No |

### Rate Limiting

| Scope | Limit |
|-------|-------|
| General API | 100 req/min per IP |
| Auth endpoints | 20 req/15 min |
| AI endpoints | 10 req/min |

---

## 7. AI Agents

Modular agents in `backend/agents/` that call Ollama's local LLM. Every agent's model is read from env vars with `qwen2.5:1.5b` as the baseline default so the stack works on small Docker hosts.

| Agent | Default model | Env override | Purpose |
|-------|---------------|--------------|---------|
| `quizAgent.js` | `qwen2.5:1.5b` | `OLLAMA_QUIZ_MODEL` | Generate MCQ quizzes from lesson content (also used by `/api/admin/question-bank/generate*`) |
| `courseGeneratorAgent.js` | `qwen2.5:1.5b` | `OLLAMA_COURSE_MODEL` | Generate a full course outline (title, description, category, lessons) from a subject |
| `gradingAgent.js` | `mistral` | — | Grade assignments with rubric-based feedback |
| `plagiarismAgent.js` | `mistral` | — | Check assignment originality |
| `recommendAgent.js` | `phi3` | — | Suggest next lessons based on student progress |
| `summaryAgent.js` | `mistral` | — | Summarize lesson content into bullet points |

`OLLAMA_DEFAULT_MODEL` acts as a global fallback for agents that respect env overrides. Ollama config lives in `backend/config/ollama.js`.

**Memory note:** `phi3` needs ~3.5 GiB RAM and `mistral` ~5 GiB. Docker Desktop's default container memory (~3.7 GiB on Windows WSL2) is below `phi3`'s threshold, so Ollama returns `model requires more system memory` and the agents 500. Either raise Docker → Settings → Resources → Memory, or stick with `qwen2.5:1.5b` (the current default, ~1 GB). Pull it with `docker compose exec ollama ollama pull qwen2.5:1.5b`.

---

## 8. Admin Dashboard

Accessible at `/admin` (frontend) — only visible to users with `role: 'admin'`.

### Tab Panels

| Tab | Purpose | Key Functionality |
|-----|---------|-------------------|
| **Overview** | Dashboard stats | Total users, colleges, courses, educators, enrollments, jobs, recent signups |
| **Colleges** | College management | Add, edit, delete colleges; manage branches & sections (expandable `size="lg"` modal) |
| **Students** | Student management | Bulk import (CSV), single creation, edit details, manage enrollment |
| **Educators** | Educator management | Add, assign to branches/sections, assign courses, configure AI agents (1-10 parallel) |
| **Tests & Questions** | Assessment management | AI question generation (from lessons or custom content), question bank (academic & company-specific), create test papers, publish tests, view results |
| **Users** | User management | List, search, edit roles, delete |
| **Courses** | Course management | Create, edit, delete, toggle publish, **AI-generate with staged progress visualizer**, manage per-course access scopes |
| **Lessons** | Lesson management | Create, edit, delete, reorder |
| **Jobs** | Job board moderation | List, edit, delete job postings |

### Frontend Components (`components/admin/`)

| Component | Purpose |
|-----------|---------|
| `AdminCollegeTab.jsx` | College CRUD with expandable branches/sections |
| `AdminStudentTab.jsx` | Student CRUD + bulk CSV import + filters |
| `AdminEducatorTab.jsx` | Educator CRUD + course assignment + agent config |
| `AdminTestTab.jsx` | Question bank + test paper management |
| `BulkImportModal.jsx` | Reusable CSV upload, parse, preview, import |
| `AgentConfigPanel.jsx` | Per-educator AI agent scaling UI (1-10 agents) |
| `TestPaperBuilder.jsx` | Question selection from bank, reorder, assign marks |
| `AdminCourseAccessPanel.jsx` | Manage `course_access` rows for a course (cascading college → branch → section pickers, public vs restricted banner) |

### Backend

All admin routes (`/api/admin/*`) require `authMiddleware` + `roleMiddleware('admin')`.
Uses `supabaseAdmin` (service role key) to bypass RLS for full table access.

---

## 8a. Course Access Gating

Courses are gated per student using the `course_access` table.

**Rule (enforced in [backend/routes/courses.js](backend/routes/courses.js) `filterByCourseAccess`):**
- If a course has **zero** `course_access` rows → visible to all students (public).
- If a course has **≥1** rows → student must match at least one row on `(college_id, branch_id, section_id)`. A `NULL` column on a row means "wildcard" at that level, so a row with only `college_id` set grants the whole college.
- Admins and teachers bypass the filter.

**Admin endpoints:**
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/courses/:id/access` | List access scopes for a course |
| POST | `/api/admin/courses/:id/access` | Add a scope `{college_id?, branch_id?, section_id?}` |
| DELETE | `/api/admin/courses/:id/access/:accessId` | Remove a scope |
| POST | `/api/admin/courses/generate` | AI-generate a course + lessons from a subject (optional `access[]` scopes + `publish`) |

**Migration:** [scripts/migrations/2026_04_13_course_access.sql](scripts/migrations/2026_04_13_course_access.sql) — run in Supabase SQL Editor before using the feature.

## 8b. Admin E2E Test Script

[scripts/admin-e2e-test.js](scripts/admin-e2e-test.js) drives the full admin surface against the live API:

1. Logs in as admin
2. Creates 2 `TEST_` colleges, each with 2 branches × 1 section
3. Creates 5 students per college, assigned to first section
4. Creates 2 educators per college
5. AI-generates questions for Java / Python / DBMS / Aptitude / Verbal (skippable)
6. AI-generates a course + lessons, plus a manual course
7. Adds and edits a lesson
8. Scopes the manual course to College1/CSE/A via `course_access`
9. Prints pass/fail summary

```bash
node scripts/admin-e2e-test.js              # full run
node scripts/admin-e2e-test.js --skip-ai    # skip Ollama-dependent steps
node scripts/admin-e2e-test.js --cleanup    # delete TEST_ rows and exit
```

Requires Node 18+ (global `fetch`). AI steps need Ollama running with the configured model pulled (default `qwen2.5:1.5b`).

## 9. Docker Compose

File: `docker-compose.yml`. Network: `orbivex-net`.

| Service | Container name | Image | Port (host:container) |
|---------|----------------|-------|----------------------|
| `api` | `orbivex-api` | Custom (Node.js 20 Alpine) | 3001:3001 |
| `ollama` | `orbivex-ollama` | `ollama/ollama:latest` | 11435:11434 |
| `redis` | `orbivex-redis` | `redis:7-alpine` | 6379:6379 |

The API service mounts `./backend` as a volume for live reload during development.

---

## 10. Project Structure

```
production1/
├── CLAUDE.md                     # This file
├── docker-compose.yml            # Docker services (orbivex-api, orbivex-ollama, orbivex-redis)
├── .env                          # Environment variables (not committed)
├── supabase-setup.sql            # Database schema setup SQL
│
├── frontend/                     # React + Vite (orbivex-frontend)
│   ├── index.html                # <title>Orbivex — Learn. Grow. Succeed.</title>
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx              # Entry point
│       ├── App.jsx               # Router + route guards
│       ├── index.css             # Global styles + design system
│       │
│       ├── components/
│       │   ├── auth/             # LoginForm, SignupForm (Orbivex-branded)
│       │   ├── courses/          # CourseCard, CourseDetail, CourseList, LessonPlayer
│       │   ├── dashboard/        # StatCard, ProgressChart, RecentActivity
│       │   ├── jobs/             # JobCard, JobDetail
│       │   ├── layout/           # Layout, Header, Sidebar (Orbivex logo), PageTransition
│       │   ├── quiz/             # QuizPlayer, QuizResults
│       │   ├── admin/            # Admin-specific components
│       │   │   ├── AdminCollegeTab.jsx      # College management (size="lg" modals)
│       │   │   ├── AdminStudentTab.jsx      # Student management + bulk import
│       │   │   ├── AdminEducatorTab.jsx     # Educator management + agent config
│       │   │   ├── AdminTestTab.jsx         # Test & question bank management
│       │   │   ├── BulkImportModal.jsx      # CSV upload & preview
│       │   │   ├── AgentConfigPanel.jsx     # AI agent scaling UI (1-10 agents)
│       │   │   ├── TestPaperBuilder.jsx     # Question selection & reordering
│       │   │   └── AdminCourseAccessPanel.jsx # Course visibility scoping
│       │   └── ui/               # Button, Card, Input, Modal (size prop), Badge, etc.
│       │
│       ├── pages/
│       │   ├── AdminPage.jsx     # Admin dashboard (tabbed panels) — includes AI-course staged progress visualizer
│       │   ├── DashboardPage.jsx # Student dashboard
│       │   ├── CoursesPage.jsx   # Course catalog
│       │   ├── CourseDetailPage.jsx
│       │   ├── LessonPage.jsx
│       │   ├── QuizPage.jsx
│       │   ├── ProgressPage.jsx
│       │   ├── JobsPage.jsx
│       │   ├── SettingsPage.jsx
│       │   ├── LoginPage.jsx     # Orbivex auth branding
│       │   └── SignupPage.jsx    # Orbivex auth branding
│       │
│       ├── store/                # Zustand state management
│       │   ├── authStore.js      # User auth, login/signup/logout
│       │   ├── courseStore.js    # Course & lesson data
│       │   └── uiStore.js        # Sidebar, modals, toasts
│       │
│       └── lib/
│           ├── api.js            # Axios client (baseURL: /api, auto-attaches JWT)
│           ├── constants.js      # APP_NAME = 'Orbivex'
│           └── supabase.js       # Frontend Supabase client
│
├── backend/                      # Express API (orbivex-api)
│   ├── Dockerfile
│   ├── package.json              # name: orbivex-api
│   ├── server.js                 # Express setup; banner: "🎓 Orbivex API"
│   ├── seed.js                   # Creates admin@orbivex.com / teacher@orbivex.com / student@orbivex.com
│   ├── seed-lessons.js           # Sample lesson content (Orbivex Academy)
│   ├── setup-db.js               # DB setup helper
│   │
│   ├── config/
│   │   ├── supabase.js           # Supabase clients (anon + service role)
│   │   └── ollama.js             # Ollama connection config
│   │
│   ├── middleware/
│   │   ├── auth.js               # JWT verification, attaches req.user
│   │   ├── role.js               # Role-based access control
│   │   └── rateLimiter.js        # Rate limit configs
│   │
│   ├── routes/
│   │   ├── admin.js              # Admin CRUD: colleges, students, educators, tests,
│   │   │                         # question bank, test papers, users, courses
│   │   │                         # (+ generate, access), lessons, jobs
│   │   ├── auth.js               # Signup, login, logout, me
│   │   ├── courses.js            # Course CRUD + enrollment + filterByCourseAccess
│   │   ├── lessons.js            # Lesson CRUD
│   │   ├── quizzes.js            # Quiz fetch + submit
│   │   ├── progress.js           # Progress tracking
│   │   ├── jobs.js               # Job board
│   │   ├── analytics.js          # Dashboard stats
│   │   └── ai.js                 # AI agent endpoints (including question generation)
│   │
│   ├── agents/
│   │   ├── quizAgent.js          # Quiz generation
│   │   ├── courseGeneratorAgent.js # Full course outline generation
│   │   ├── gradingAgent.js       # Assignment grading
│   │   ├── plagiarismAgent.js    # Plagiarism detection
│   │   ├── recommendAgent.js     # Lesson recommendations
│   │   └── summaryAgent.js       # Content summarization
│   │
│   └── utils/
│       ├── response.js           # success(), error(), paginated() helpers
│       └── validation.js         # Input validation functions
│
└── scripts/
    ├── admin-e2e-test.js         # End-to-end admin surface smoke test
    ├── init-ollama.sh            # Pulls default models into orbivex-ollama
    └── migrations/
        └── 2026_04_13_course_access.sql
```

---

## 11. Environment Variables

File: `.env` (project root, loaded by Docker Compose)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (bypasses RLS) |
| `JWT_SECRET` | JWT signing secret |
| `NODE_ENV` | `development` or `production` |
| `PORT` | API port (default: 3001) |
| `OLLAMA_URL` | Ollama service URL (set by Docker: `http://ollama:11434`) |
| `REDIS_URL` | Redis URL (set by Docker: `redis://redis:6379`) |
| `OLLAMA_DEFAULT_MODEL` | Default model used by all agents. Fallback: `qwen2.5:1.5b` (~1 GB, fits on ~4 GiB Docker hosts) |
| `OLLAMA_QUIZ_MODEL` | Override model for `quizAgent` only |
| `OLLAMA_COURSE_MODEL` | Override model for `courseGeneratorAgent` only |

**Important**: Never commit `.env` to version control.

---

## 11a. First-time Database Setup (REQUIRED)

The Supabase project **must** have the full schema applied before admin features (colleges, students, educators, question bank, tests, course access) will work. If those tabs return `Could not find the table 'public.<name>'`, the schema hasn't been applied.

Run in **Supabase Dashboard → SQL Editor** in this order:

1. [supabase-setup.sql](supabase-setup.sql) — base schema: profiles, courses, lessons, colleges, branches, sections, educators, question_bank, test_papers, jobs, enrollments, etc.
2. [scripts/migrations/2026_04_13_course_access.sql](scripts/migrations/2026_04_13_course_access.sql) — `course_access` table (new in v2.1).

Then seed sample accounts with `docker compose exec api node seed.js`.

## 12. Running the Project

### Prerequisites

- Docker Desktop running
- Node.js 20+ (for frontend dev server)

### Start Everything

```bash
# 1. Start backend services (orbivex-api + orbivex-ollama + orbivex-redis)
docker compose up -d --build

# 2. Pull the default AI model (first time only; ~1 GB)
docker compose exec ollama ollama pull qwen2.5:1.5b
# Optional larger models (only if Docker memory > 4 GiB):
# docker compose exec ollama ollama pull phi3      # ~2.2 GB, needs ~3.5 GiB RAM
# docker compose exec ollama ollama pull mistral   # ~4.4 GB, needs ~5 GiB RAM

# 3. Install frontend dependencies (first time only)
cd frontend && npm install

# 4. Start frontend dev server
npm run dev
```

### Access Points

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 (or next available port) |
| Backend API | http://localhost:3001 |
| Ollama | http://localhost:11435 |
| API Health | http://localhost:3001/api/health |

### Seed Sample Data

```bash
docker compose exec api node seed.js
```

---

## 13. Sample Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@orbivex.com` | `admin123` |
| **Teacher** | `teacher@orbivex.com` | `teacher123` |
| **Student** | `student@orbivex.com` | `student123` |

Created via `backend/seed.js`. The admin account has access to the Admin Panel at `/admin`.

---

## 14. Build Phases

| Phase | Focus | Status |
|-------|-------|--------|
| 1. Foundation | Project setup, auth, layout, routing | Done |
| 2. Courses & Content | Course browsing, enrollment, lessons, video player | Done |
| 3. AI Agents | Ollama integration, quiz gen, grading, plagiarism, recommendations, course generation | Done |
| 4. Dashboard & Analytics | Student progress, charts, stats | Done |
| 5. Jobs & Admin | Job board, admin dashboard, multi-tenant org model | Done |
| 6. Rebrand to Orbivex | Name, logos, container names, credentials | Done |
| 7. Polish | Animations, progress visualizers, error handling, edge cases | Done |
| 8. Role Architecture | Role-based dashboard, settings fix, progress fix, job search | Done |
| 9. Company Prep & Paced Learning | Placement roadmaps, practice sessions, topic notes caching, 5-variant pace levels, landing page visual tweaks | Done |

---

## 15a. Role-Based Architecture (v3.0)

### Three User Roles

```
ADMIN
 └── Full platform control
      ├── College / Branch / Section management
      ├── User management (create, edit role, delete)
      ├── Course CRUD + AI generation + access scoping
      ├── Lesson CRUD
      ├── Question bank (academic + company-specific)
      ├── Test paper assembly + publish + results
      ├── Job board moderation
      ├── Educator management + AI agent scaling
      └── Student bulk import (CSV)

EDUCATOR (teacher)
 └── Content creation + analytics
      ├── Create / edit / delete own courses
      ├── Add / edit / reorder lessons (video + rich text)
      ├── Generate quizzes via AI (quizAgent)
      ├── Generate full course outlines via AI (courseGeneratorAgent)
      ├── View enrollment counts and completion analytics
      └── All student capabilities

STUDENT
 └── Learning + career
      ├── Browse and enroll in courses (access-gated by college/branch/section)
      ├── Watch video lessons + read rich-text content
      ├── Mark lessons complete (progress tracking)
      ├── Take MCQ quizzes → instant scored results + explanations
      ├── View per-course progress percentage (real, not hardcoded)
      ├── Dashboard: enrolled courses, streak, quiz scores, weekly activity
      ├── Job board: browse + search + filter + apply
      ├── My Applications tab: view submission status
      ├── AI Studio: quiz generator, content summarizer, lesson recommender
      └── Settings: update display name + bio (persists to DB)
```

### Dashboard by Role

| Role | Dashboard Shows |
|------|----------------|
| **Student** | Stats → Feature quick-actions (6 cards) → Progress chart → Weekly activity → My courses → Recent activity |
| **Educator** | Stats → Educator tools (6 cards: create course, AI studio, lesson manager, analytics) → Charts |
| **Admin** | System stats (users/courses/enrollments/colleges) → Role architecture info → Admin panel sections (6 cards) → Charts |

### API Endpoints Added in v3.0

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| `PATCH` | `/api/auth/profile` | Any | Update display_name + bio |

### Bugs Fixed in v3.0

| File | Bug | Fix |
|------|-----|-----|
| `SettingsPage.jsx` | `handleSave()` only showed toast, never called API | Wired to `PATCH /api/auth/profile` via `updateProfile()` in authStore |
| `ProgressPage.jsx` | Progress bar hardcoded to `value={0}` | Calls `GET /progress/course/:id` for each enrolled course; shows real % |
| `JobsPage.jsx` | Apply URL used `/api/jobs/...` (double prefix) → 404 | Fixed to `/jobs/${jobId}/apply` |
| `JobsPage.jsx` | No search, no filter, no application history | Added search bar, job-type filter pills, "My Applications" tab |

### Frontend Files Changed in v3.0

| File | Change |
|------|--------|
| `frontend/src/store/authStore.js` | Added `updateProfile(fields)` action |
| `frontend/src/pages/DashboardPage.jsx` | Role-based dashboard (Student/Educator/Admin) with feature quick-actions |
| `frontend/src/pages/SettingsPage.jsx` | Profile update wired to API; shows role badge, institutional info |
| `frontend/src/pages/ProgressPage.jsx` | Real per-course progress %; Continue link; trophy for 100% |
| `frontend/src/pages/JobsPage.jsx` | Search, type filter, "My Applications" tab, applied state |
| `frontend/src/index.css` | Cosmic Command design system (Exo 2 + Outfit fonts, orange brand) |
| `frontend/src/components/layout/Sidebar.jsx` | Animated SVG planet logo, ORBI**VEX** wordmark, user pill |
| `frontend/src/components/layout/Header.jsx` | Breadcrumb nav, orange notification dot, user avatar pill |
| `frontend/src/pages/LoginPage.jsx` | Split-screen: orbital planet animation + feature list (left) + form (right) |
| `frontend/src/pages/SignupPage.jsx` | Split-screen: orbital planet + stat grid (left) + form (right) |
| `frontend/public/landing.html` | Full landing page (standalone HTML, served at `/landing.html`) |
| `frontend/src/pages/LandingPage.jsx` | React route `/` → redirects to `/landing.html`; auth users → `/dashboard` |

---

## 15. Deployment & Scaling

### Production Setup

- Self-hosted on VPS with Docker Compose
- Frontend built with `vite build`, served via Nginx or CDN
- Supabase handles database scaling (upgrade to Pro at ~4000 users)
- Cloudflare free tier for CDN and DDoS protection

### Scaling Notes

| Concern | Solution |
|---------|----------|
| Database at 4000 users | Supabase Pro ($25/mo) for 8GB storage, 300 connections |
| Video delivery | Cloudflare CDN (free) + HLS adaptive streaming |
| AI response time | Dedicated GPU server if heavy usage; `qwen2.5:1.5b` is fastest default |
| API throughput | Redis caching for frequently accessed data |

---

## Recommended Skills

When working on this codebase, lean on these built-in Claude Code skills at the right moments. They are user-invocable via the `Skill` tool — don't paraphrase what they do, just call them.

| Skill | When to use it on Orbivex |
|---|---|
| **security-review** | Before any merge that touches admin routes, `.env`, RLS policies, AI/LLM prompts, or new third-party API keys. The `pyq_jobs`, NVIDIA-NIM, and Supabase service-role surfaces are the highest-risk areas. Requires git history to diff against. |
| **simplify** | After any non-trivial refactor (agent rewrites, new routes, schema changes). Reviews changed files in three lenses — reuse, quality, efficiency — and applies fixes. Great for catching duplicated parser/validator helpers between `quizAgent` and `pyqAgent`. |
| **review** | When opening a PR. Pairs well with `security-review` for sensitive branches. |
| **fewer-permission-prompts** | One-off, after a long session. Scans transcripts and writes a tight allowlist into `.claude/settings.json` for read-only Bash + MCP reads. |
| **schedule** | For ongoing operational tasks — e.g. "every Sunday, run the PYQ top-up to 30 for every topic" via the admin seed endpoint. |
| **graphify** | When orienting a new developer or auditing the agent graph. Generates a knowledge graph from the codebase. |

Skills NOT generally relevant here:
- `claude-api` — we use Ollama + NVIDIA NIM, not the Anthropic SDK.
- `init` — `CLAUDE.md` already exists (this file).
- `keybindings-help` / `update-config` — IDE/CLI plumbing, not project code.

### Project-specific custom skills

The repo also ships its own slash-style skills at [.claude/skills/](.claude/skills/):
`debug-issue`, `explore-codebase`, `refactor-safely`, `review-changes`, `split-large-file`, `token-frugal`. Use these for project-flavored workflows; they complement the built-in skills.

---

## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
