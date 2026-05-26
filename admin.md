# TeachBuddy — Project Blueprint

> **Version**: 2.0
> **Last Updated**: 2026-04-11
> **Status**: In Development

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

**TeachBuddy** is an AI-powered EdTech platform for 4,000+ students. It delivers:

| Capability | Description |
|---|---|
| **Courses & Lessons** | Browse, enroll, track progress with video lessons |
| **AI Quiz Generation** | Auto-generate MCQ quizzes from lesson content via Ollama |
| **Plagiarism Detection** | AI-powered assignment originality check |
| **Smart Grading** | Automated rubric-based grading with feedback |
| **Personalized Paths** | AI-recommended next lessons based on progress |
| **Job Board** | Post jobs, apply, track application status |
| **Progress Analytics** | Visual dashboards with charts |
| **Admin Dashboard** | Full platform management (users, courses, lessons, jobs) |

### Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Auth** | Email + Password | Direct Supabase Auth, no synthetic emails |
| **Frontend** | React 18 + Vite + Vanilla CSS | Maximum control over premium animations |
| **Backend** | Node.js + Express | Simple, fast, REST API |
| **Database** | Supabase PostgreSQL | Free tier, scalable, built-in auth & RLS |
| **AI/LLM** | Ollama (Phi3/Mistral) in Docker | Free, self-hosted, no API costs |
| **State** | Zustand | Lightweight, no boilerplate |
| **Containerization** | Docker Compose | Single-command deployment |

---

## 2. Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────────────┐
│                     BROWSER (Client)                        │
│  React 18 + Vite | Vanilla CSS | Framer Motion             │
│  Zustand (state) | React Router | Chart.js                  │
└────────────────────────────┬────────────────────────────────┘
                             | REST API (JSON)
                             v
┌─────────────────── DOCKER COMPOSE ──────────────────────────┐
│                                                             │
│  ┌──────────────────────┐   ┌─────────────────────────────┐ │
│  │  API Service          │   │  Ollama Service              │ │
│  │  Node.js + Express    │-->│  Phi3 / Mistral Models      │ │
│  │  Port 3001            │   │  Port 11434 (internal)      │ │
│  │                       │   │  Port 11435 (external)      │ │
│  │  Routes:              │   └─────────────────────────────┘ │
│  │  /api/auth            │                                   │
│  │  /api/courses         │   ┌─────────────────────────────┐ │
│  │  /api/lessons         │   │  Redis                       │ │
│  │  /api/quizzes         │   │  Caching layer               │ │
│  │  /api/progress        │   │  Port 6379                   │ │
│  │  /api/jobs            │   └─────────────────────────────┘ │
│  │  /api/analytics       │                                   │
│  │  /api/ai              │   ┌─────────────────────────────┐ │
│  │  /api/admin           │   │  Supabase (External)         │ │
│  │  /api/health          │   │  - PostgreSQL                │ │
│  └──────────────────────┘   │  - Auth (email-based)        │ │
│                              │  - Storage (videos/docs)     │ │
│                              │  - Realtime                  │ │
│                              └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Authentication

### Strategy

Users sign up and log in with **email + password**. Supabase Auth handles all token management.

- **Signup**: `POST /api/auth/signup` — creates user via `supabaseAdmin.auth.admin.createUser()` with `email_confirm: true` (bypasses email verification)
- **Login**: `POST /api/auth/login` — returns JWT access token + refresh token
- **Profile**: auto-created via database trigger on signup

### Roles

| Role | Access |
|------|--------|
| `student` | Default role. Can browse courses, enroll, take quizzes, track progress, apply to jobs |
| `teacher` | Can create/edit courses and lessons |
| `admin` | Full platform access. Can manage all users, courses, lessons, jobs via Admin Dashboard |

### Middleware

- `middleware/auth.js` — verifies Supabase JWT, attaches `req.user`
- `middleware/role.js` — `roleMiddleware('admin', 'teacher')` restricts by role

---

## 4. Frontend Design System

### Design Philosophy

> **Dark-mode first. Glassmorphism. Micro-animations everywhere.**

- CSS variables for theming (`--primary-500: #6366f1`, surfaces, borders)
- `glass-card` / `glass-card-static` for glassmorphism panels
- Framer Motion for page transitions, hover effects, staggered animations
- Responsive breakpoints at 768px and 480px

### Reusable UI Components (`components/ui/`)

| Component | Purpose |
|-----------|---------|
| `Button` | Primary, ghost, icon variants with loading state |
| `Card` | Glass card with optional hover effect |
| `Input` | Labeled input with icon support |
| `Modal` | Animated overlay with backdrop close |
| `Badge` | Status/category badges (primary, success, warning, danger) |
| `ProgressBar` | Animated progress indicator |
| `Skeleton` | Loading placeholder |
| `Toast` | Notification toasts (success, error, warning) |

---

## 5. Database Schema

All tables live in Supabase PostgreSQL. Setup SQL is in `supabase-setup.sql`.

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `profiles` | User profiles (linked to `auth.users`) | id, username, display_name, role, avatar_url, bio, college_id, branch_id, section_id, enrollment_number, hall_ticket_number |
| `colleges` | Institution management | id, name, code, address, type, principal_email, phone |
| `branches` | College departments | id, college_id, name, code, hod_name, hod_email |
| `sections` | Class sections | id, branch_id, section_name, academic_year, semester, student_count |
| `educators` | Faculty management | id, user_id, college_id, branch_id, qualification, specialization, experience_years |
| `educator_courses` | Course assignments | id, educator_id, course_id, section_id, academic_year |
| `educator_agent_config` | AI agent scaling | id, educator_id, agent_type, model_name, agent_count, parameters |
| `courses` | Course catalog | title, description, category, difficulty, is_published, created_by |
| `lessons` | Lesson content per course | course_id, title, video_url, content_text, sort_order, duration_minutes |
| `enrollments` | Student-course enrollment | user_id, course_id (unique pair) |
| `progress` | Lesson completion tracking | user_id, lesson_id, completed |
| `question_bank` | Questions repository | id, course_id, question_text, question_type, difficulty_level, category, test_type, company_name, answers_json |
| `test_papers` | Exam/test definitions | id, college_id, branch_id, section_id, course_id, title, test_type, company_name, total_marks, duration_minutes, status |
| `test_paper_questions` | Questions in test | id, test_paper_id, question_id, marks, sort_order |
| `test_submissions` | Student test responses | id, test_paper_id, student_id, response_json, obtained_marks, status |
| `bulk_imports` | Import history | id, import_type, college_id, imported_by, file_name, total_records, successful_records, error_log |
| `quizzes` | Quiz definitions | lesson_id, title, questions_json (JSONB) |
| `quiz_responses` | Student quiz submissions | user_id, quiz_id, score, answers_json |
| `jobs` | Job board listings | title, company, description, location, type, posted_by |
| `applications` | Job applications | user_id, job_id, status |
| `notifications` | User notifications | user_id, title, message, read |

### RLS

Row Level Security is enabled on all tables. The backend uses the **service role key** (bypasses RLS) for admin operations. Anon key respects RLS policies for public reads.

### Auto-Profile Trigger

A database trigger (`on_auth_user_created`) automatically inserts a `profiles` row whenever a new user signs up via Supabase Auth.

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
| `/api/ai` | generate-quiz, grade-assignment, check-plagiarism, recommend-lessons, summarize | Yes |
| `/api/admin` | overview, users CRUD, courses CRUD, lessons CRUD, jobs CRUD | Admin only |
| `/api/health` | service status check | No |

### Rate Limiting

| Scope | Limit |
|-------|-------|
| General API | 100 req/min per IP |
| Auth endpoints | 20 req/15 min |
| AI endpoints | 10 req/min |

---

## 7. AI Agents

Modular agents in `backend/agents/` that call Ollama's local LLM:

| Agent | Model | Purpose |
|-------|-------|---------|
| `quizAgent.js` | phi3 | Generate MCQ quizzes from lesson content |
| `gradingAgent.js` | mistral | Grade assignments with rubric-based feedback |
| `plagiarismAgent.js` | mistral | Check assignment originality |
| `recommendAgent.js` | phi3 | Suggest next lessons based on student progress |
| `summaryAgent.js` | mistral | Summarize lesson content into bullet points |

Ollama config: `backend/config/ollama.js`

---

## 8. Admin Dashboard

### Overview

The Admin Dashboard (`pages/AdminPage.jsx`) provides a comprehensive interface for platform management. Accessible to users with `admin` role at `/admin` route. Features include college management, student management, educator management, test/question bank management, and more.

### Tab Panels

| Tab | Purpose | Key Functionality |
|-----|---------|-------------------|
| **Overview** | Dashboard stats | Total users, colleges, courses, quizzes, jobs, app health |
| **Colleges** | College management | Add, edit, delete colleges; manage branches & sections |
| **Students** | Student management | Bulk import (CSV), single creation, edit details, manage enrollment |
| **Educators** | Educator management | Add, assign to branches/sections, assign courses, configure agents |
| **Tests & Questions** | Assessment management | Create test papers, manage question bank (academic & company-specific) |
| **Users** | User management | List, search, edit roles, delete |
| **Courses** | Course management | Create, edit, delete, toggle publish |
| **Lessons** | Lesson management | Create, edit, delete, reorder |
| **Jobs** | Job board moderation | List, edit, delete job postings |

---

## 8.1 College Management

### Database Schema - Colleges

```sql
CREATE TABLE colleges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  type TEXT NOT NULL, -- 'government', 'private', 'autonomous'
  established_year INTEGER,
  principal_email TEXT,
  phone TEXT,
  website TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- 'CSE', 'ECE', 'Mechanical', etc.
  code TEXT NOT NULL,
  hod_name TEXT,
  hod_email TEXT,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(college_id, code)
);

CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  section_name TEXT NOT NULL, -- 'A', 'B', 'C', etc.
  academic_year TEXT, -- '2024-2025'
  semester INTEGER, -- 1-8
  student_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);
```

### API Routes - Colleges

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/admin/colleges` | GET | List all colleges (paginated) |
| `POST /api/admin/colleges` | POST | Create new college |
| `PATCH /api/admin/colleges/:id` | PATCH | Update college details |
| `DELETE /api/admin/colleges/:id` | DELETE | Delete college |
| `GET /api/admin/colleges/:id/branches` | GET | Get branches of a college |
| `POST /api/admin/colleges/:collegeId/branches` | POST | Add branch to college |
| `PATCH /api/admin/branches/:id` | PATCH | Update branch details |
| `DELETE /api/admin/branches/:id` | DELETE | Delete branch |
| `POST /api/admin/branches/:branchId/sections` | POST | Add section to branch |
| `PATCH /api/admin/sections/:id` | PATCH | Update section details |
| `DELETE /api/admin/sections/:id` | DELETE | Delete section |

---

## 8.2 Student Management

### Database Schema - Student Enrollment

```sql
-- Update profiles table to include student-specific fields
ALTER TABLE profiles ADD COLUMN (
  college_id UUID REFERENCES colleges(id),
  branch_id UUID REFERENCES branches(id),
  section_id UUID REFERENCES sections(id),
  enrollment_number TEXT UNIQUE,
  hall_ticket_number TEXT UNIQUE,
  semester INTEGER,
  admission_year INTEGER,
  is_active BOOLEAN DEFAULT true,
  emergency_contact TEXT,
  phone_number TEXT
);

-- Track student bulk imports
CREATE TABLE bulk_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_type TEXT, -- 'students', 'educators', etc.
  college_id UUID REFERENCES colleges(id),
  imported_by UUID REFERENCES profiles(id),
  file_name TEXT,
  total_records INTEGER,
  successful_records INTEGER,
  failed_records INTEGER,
  error_log JSONB, -- Store errors for each failed row
  import_status TEXT DEFAULT 'completed', -- 'pending', 'processing', 'completed', 'failed'
  created_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP
);
```

### API Routes - Students

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/admin/students` | GET | List all students (paginated, filterable by college/branch/section) |
| `POST /api/admin/students` | POST | Create single student |
| `POST /api/admin/students/bulk-import` | POST | Bulk import students from CSV |
| `PATCH /api/admin/students/:id` | PATCH | Update student details (name, branch, section, hall ticket, email) |
| `DELETE /api/admin/students/:id` | DELETE | Delete student account |
| `GET /api/admin/students/:id` | GET | Get detailed student profile |
| `POST /api/admin/students/:id/activate` | POST | Activate/deactivate student |
| `GET /api/admin/bulk-imports` | GET | List all bulk import history |
| `GET /api/admin/bulk-imports/:id` | GET | Get detailed import log with errors |

### CSV Format for Bulk Student Import

```csv
enrollment_number,first_name,last_name,email,phone,branch_code,section,hall_ticket_number,semester,admission_year
E001,John,Doe,john.doe@college.edu,9876543210,CSE,A,CSE-A-001,4,2022
E002,Jane,Smith,jane.smith@college.edu,9876543211,CSE,A,CSE-A-002,4,2022
E003,Bob,Johnson,bob.johnson@college.edu,9876543212,ECE,B,ECE-B-001,3,2023
```

### Student Management Features

#### Single Student Creation
- Form-based creation with validation
- Auto-generate enrollment number (optional)
- Assign college, branch, section
- Set contact details, hall ticket number

#### Bulk Student Import
- CSV file upload with validation and preview
- Automatic account creation with temporary password (sent via email)
- Rollback on error (transaction-based)
- Detailed error report per student

#### Student Detail Editing
- Edit student name (first, last)
- Change branch/section
- Update email (with verification if changed)
- Update/correct hall ticket number
- Manage active/inactive status

---

## 8.3 Educator Management

### Database Schema - Educators

```sql
CREATE TABLE educators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  college_id UUID REFERENCES colleges(id),
  branch_id UUID REFERENCES branches(id),
  section_id UUID REFERENCES sections(id),
  qualification TEXT, -- 'BTech', 'MTech', 'PhD', etc.
  specialization TEXT,
  experience_years INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE educator_courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  educator_id UUID NOT NULL REFERENCES educators(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  section_id UUID REFERENCES sections(id),
  academic_year TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Track AI agent assignments per educator
CREATE TABLE educator_agent_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  educator_id UUID NOT NULL REFERENCES educators(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL, -- 'quiz', 'grading', 'plagiarism', 'recommendation'
  model_name TEXT, -- 'phi3', 'mistral'
  agent_count INTEGER DEFAULT 1, -- Number of parallel agents (1-10 for scaling)
  parameters JSONB, -- Custom agent parameters
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### API Routes - Educators

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/admin/educators` | GET | List all educators (filterable by college/branch) |
| `POST /api/admin/educators` | POST | Create new educator account |
| `PATCH /api/admin/educators/:id` | PATCH | Update educator details |
| `DELETE /api/admin/educators/:id` | DELETE | Delete educator (soft/hard) |
| `POST /api/admin/educators/:id/assign-branch` | POST | Assign educator to branch/section |
| `POST /api/admin/educators/:id/assign-course` | POST | Assign course(s) to educator |
| `DELETE /api/admin/educators/:id/courses/:courseId` | DELETE | Remove course from educator |
| `POST /api/admin/educators/:id/configure-agents` | POST | Configure/scale AI agents (set agent count 1-10) |
| `GET /api/admin/educators/:id/agent-config` | GET | Get agent configuration for educator |
| `POST /api/admin/educators/bulk-import` | POST | Bulk import educators from CSV |

### Educator Management Features

#### Add Educator
- Create account with qualification, specialization, experience
- Assign to specific college and branch
- Account activation email sent automatically

#### Assign to Branch/Section
- Link educator to branch and section
- Can teach multiple sections

#### Assign Courses
- Select available courses to teach
- Specify section per course
- Set academic year

#### AI Agent Configuration
- Select agent types (Quiz Gen, Grading, Plagiarism Check, Recommendations)
- Set model preference (Phi3, Mistral)
- Configure number of parallel agents (1-10) for scaling
- Custom parameters per agent type

#### Educator Removal
- Soft delete (mark inactive) or hard delete from system

---

## 8.4 Test & Question Bank Management

### Database Schema - Tests & Questions

```sql
-- Main question bank
CREATE TABLE question_bank (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id UUID REFERENCES colleges(id),
  course_id UUID REFERENCES courses(id),
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL, -- 'mcq', 'short-answer', 'descriptive', 'code'
  difficulty_level TEXT, -- 'easy', 'medium', 'hard'
  category TEXT, -- 'technical', 'non-technical', 'aptitude'
  test_type TEXT NOT NULL, -- 'academic', 'company-specific'
  company_name TEXT, -- For company-specific questions
  answers_json JSONB, -- {options: [...], correct: 1, explanation: "..."}
  created_by UUID REFERENCES educators(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Test/Exam papers
CREATE TABLE test_papers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  college_id UUID NOT NULL REFERENCES colleges(id),
  branch_id UUID REFERENCES branches(id),
  section_id UUID REFERENCES sections(id),
  course_id UUID REFERENCES courses(id),
  title TEXT NOT NULL,
  description TEXT,
  test_type TEXT NOT NULL, -- 'academic', 'company-specific'
  company_name TEXT, -- For company-specific tests
  total_marks INTEGER,
  duration_minutes INTEGER,
  passing_score INTEGER,
  scheduled_date TIMESTAMP,
  scheduled_end_time TIMESTAMP,
  created_by UUID REFERENCES educators(id),
  is_published BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'draft', -- 'draft', 'scheduled', 'active', 'completed'
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Questions in test paper
CREATE TABLE test_paper_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_paper_id UUID NOT NULL REFERENCES test_papers(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES question_bank(id),
  marks INTEGER,
  sort_order INTEGER,
  added_at TIMESTAMP DEFAULT now()
);

-- Student test responses
CREATE TABLE test_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_paper_id UUID NOT NULL REFERENCES test_papers(id),
  student_id UUID NOT NULL REFERENCES profiles(id),
  started_at TIMESTAMP,
  submitted_at TIMESTAMP,
  response_json JSONB, -- {question_id: answer_value, ...}
  total_marks INTEGER,
  obtained_marks INTEGER,
  status TEXT DEFAULT 'in_progress', -- 'in_progress', 'submitted', 'evaluated'
  created_at TIMESTAMP DEFAULT now()
);
```

### API Routes - Test & Question Bank

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/admin/question-bank` | GET | List all questions (filterable by type, difficulty, course) |
| `POST /api/admin/question-bank` | POST | Add question to bank |
| `PATCH /api/admin/question-bank/:id` | PATCH | Update question |
| `DELETE /api/admin/question-bank/:id` | DELETE | Delete question |
| `POST /api/admin/question-bank/bulk-import` | POST | Bulk import questions from CSV |
| `GET /api/admin/test-papers` | GET | List all test papers |
| `POST /api/admin/test-papers` | POST | Create new test paper |
| `PATCH /api/admin/test-papers/:id` | PATCH | Update test paper |
| `POST /api/admin/test-papers/:id/publish` | POST | Publish test to students |
| `DELETE /api/admin/test-papers/:id` | DELETE | Delete test paper |
| `POST /api/admin/test-papers/:id/add-questions` | POST | Add questions to test paper |
| `DELETE /api/admin/test-papers/:testId/questions/:questionId` | DELETE | Remove question from test |
| `GET /api/admin/test-papers/:id/results` | GET | Get test results (student scores, stats) |

### Test Paper Creation Workflow

1. **Create Test Paper**
   - Select college/branch/section
   - Choose test type: Academic or Company-specific
   - Add title, duration, total marks, passing score
   - Schedule if needed

2. **Build Question Paper**
   - Search and add questions from question bank
   - Reorder questions (drag-and-drop)
   - Assign marks to each question
   - Preview before publishing

3. **Publish Test**
   - Make visible to selected students
   - Set start/end time window
   - Toggle availability

### Question Bank Features

- **Two Question Types**:
  - Academic: For regular course assessments
  - Company-specific: Prepared with company name, interview patterns

- **Question Categories**:
  - Technical: Subject-specific content
  - Non-technical: Soft skills, HR questions
  - Aptitude: General reasoning, quant

- **AI-Generated Question Option**:
  - Educators can request Ollama to auto-generate questions from lesson content
  - API: `POST /api/ai/generate-questions` (uses quizAgent)
  - Output goes to question bank for review before use

---

## 8.6 Admin API Routes

All admin routes require `authMiddleware` + `roleMiddleware('admin')`.
Uses `supabaseAdmin` (service role key) to bypass RLS.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/admin/overview` | GET | Dashboard stats and health |
| `GET /api/admin/users` | GET | List all users (paginated) |
| `PATCH /api/admin/users/:id` | PATCH | Update user role/details |
| `DELETE /api/admin/users/:id` | DELETE | Delete user account |
| `POST /api/admin/courses` | POST | Create course |
| `PATCH /api/admin/courses/:id` | PATCH | Update course |
| `DELETE /api/admin/courses/:id` | DELETE | Delete course |
| `POST /api/admin/lessons` | POST | Create lesson |
| `PATCH /api/admin/lessons/:id` | PATCH | Update lesson |
| `DELETE /api/admin/lessons/:id` | DELETE | Delete lesson |
| `GET /api/admin/jobs` | GET | List all jobs |
| `DELETE /api/admin/jobs/:id` | DELETE | Delete job posting |

---

## 9. Docker Compose

File: `docker-compose.yml`

| Service | Image | Port (host:container) |
|---------|-------|----------------------|
| `api` | Custom (Node.js 20 Alpine) | 3001:3001 |
| `ollama` | `ollama/ollama:latest` | 11435:11434 |
| `redis` | `redis:7-alpine` | 6379:6379 |

The API service mounts `./backend` as a volume for live reload during development.

---

## 10. Project Structure

```
production1/
├── CLAUDE.md                     # This file
├── docker-compose.yml            # Docker services config
├── .env                          # Environment variables (not committed)
├── supabase-setup.sql            # Database schema setup SQL
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx              # Entry point
│       ├── App.jsx               # Router + route guards
│       ├── index.css             # Global styles + design system
│       │
│       ├── components/
│       │   ├── auth/             # LoginForm, SignupForm
│       │   ├── courses/          # CourseCard, CourseDetail, CourseList, LessonPlayer
│       │   ├── dashboard/        # StatCard, ProgressChart, RecentActivity
│       │   ├── jobs/             # JobCard, JobDetail
│       │   ├── layout/           # Layout, Header, Sidebar, PageTransition
│       │   ├── quiz/             # QuizPlayer, QuizResults
│       │   ├── admin/            # NEW: Admin-specific components
│       │   │   ├── AdminCollegeTab.jsx      # College management
│       │   │   ├── AdminStudentTab.jsx      # Student management + bulk import
│       │   │   ├── AdminEducatorTab.jsx     # Educator management + agent config
│       │   │   ├── AdminTestTab.jsx         # Test & question bank management
│       │   │   ├── BulkImportModal.jsx      # CSV upload & preview
│       │   │   ├── AgentConfigPanel.jsx     # AI agent scaling UI (1-10 agents)
│       │   │   └── TestPaperBuilder.jsx     # Question selection & reordering
│       │   └── ui/               # Button, Card, Input, Modal, Badge, etc.
│       │
│       ├── pages/
│       │   ├── AdminPage.jsx     # Admin dashboard (tabbed panels)
│       │   ├── DashboardPage.jsx # Student dashboard
│       │   ├── CoursesPage.jsx   # Course catalog
│       │   ├── CourseDetailPage.jsx
│       │   ├── LessonPage.jsx
│       │   ├── QuizPage.jsx
│       │   ├── ProgressPage.jsx
│       │   ├── JobsPage.jsx
│       │   ├── SettingsPage.jsx
│       │   ├── LoginPage.jsx
│       │   └── SignupPage.jsx
│       │
│       ├── store/                # Zustand state management
│       │   ├── authStore.js      # User auth, login/signup/logout
│       │   ├── courseStore.js     # Course & lesson data
│       │   └── uiStore.js        # Sidebar, modals, toasts
│       │
│       └── lib/
│           ├── api.js            # Axios client (baseURL: /api, auto-attaches JWT)
│           ├── constants.js
│           └── supabase.js       # Frontend Supabase client
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js                 # Express app setup, middleware, route mounting
│   ├── seed.js                   # Creates sample admin/teacher/student accounts
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
│   │   ├── admin.js              # Admin CRUD: colleges, students, educators, tests
│   │   │                         # - colleges & branches management
│   │   │                         # - student management (CRUD + bulk import)
│   │   │                         # - educator management (CRUD + agent config)
│   │   │                         # - question bank (CRUD + bulk import)
│   │   │                         # - test papers (CRUD + publish + results)
│   │   │                         # - users, courses, lessons, jobs CRUD
│   │   ├── auth.js               # Signup, login, logout, me
│   │   ├── courses.js            # Course CRUD + enrollment
│   │   ├── lessons.js            # Lesson CRUD
│   │   ├── quizzes.js            # Quiz fetch + submit
│   │   ├── progress.js           # Progress tracking
│   │   ├── jobs.js               # Job board
│   │   ├── analytics.js          # Dashboard stats
│   │   └── ai.js                 # AI agent endpoints (including question generation)
│   │
│   ├── agents/
│   │   ├── quizAgent.js          # Quiz generation
│   │   ├── gradingAgent.js       # Assignment grading
│   │   ├── plagiarismAgent.js    # Plagiarism detection
│   │   ├── recommendAgent.js     # Lesson recommendations
│   │   └── summaryAgent.js       # Content summarization
│   │
│   └── utils/
│       ├── response.js           # success(), error(), paginated() helpers
│       └── validation.js         # Input validation functions
│
└── scripts/                      # Utility scripts
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

**Important**: Never commit `.env` to version control.

---

## 12. Running the Project

### Prerequisites

- Docker Desktop running
- Node.js 20+ (for frontend dev server)

### Start Everything

```bash
# 1. Start backend services (API + Ollama + Redis)
docker compose up -d --build

# 2. Install frontend dependencies (first time only)
cd frontend && npm install

# 3. Start frontend dev server
npm run dev
```

### Access Points

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 (or next available port) |
| Backend API | http://localhost:3001 |
| Ollama | http://localhost:11435 |
| API Health | http://localhost:3001/api/health |

### Database Setup

Run `supabase-setup.sql` in **Supabase Dashboard > SQL Editor** to create all tables, triggers, and RLS policies.

### Seed Sample Data

```bash
docker compose exec api node seed.js
```

---

## 13. Sample Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@teachbuddy.com` | `admin123` |
| **Teacher** | `teacher@teachbuddy.com` | `teacher123` |
| **Student** | `student@teachbuddy.com` | `student123` |

Created via `backend/seed.js`. The admin account has access to the Admin Panel at `/admin`.

---

## 14. Build Phases

| Phase | Focus | Status |
|-------|-------|--------|
| 1. Foundation | Project setup, auth, layout, routing | Done |
| 2. Courses & Content | Course browsing, enrollment, lessons, video player | Done |
| 3. AI Agents | Ollama integration, quiz gen, grading, plagiarism, recommendations | Done |
| 4. Dashboard & Analytics | Student progress, charts, stats | Done |
| 5. Jobs & Admin | Job board, admin dashboard, user management | Done |
| 6. Polish | Animations, error handling, edge cases, optimization | In Progress |

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
| AI response time | Dedicated GPU server if heavy usage; phi3 is fastest |
| API throughput | Redis caching for frequently accessed data |

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