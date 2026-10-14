# LSRW Skills — Setup Guide

LSRW (Listening, Speaking, Reading, Writing) is integrated directly into Orbivex as a sidebar tab. It uses a separate FastAPI backend for AI evaluation via Nvidia NIM.

## Quick Start

### 1. Start the LSRW AI Backend

The LSRW backend lives in `C:\Users\Ramya\Documents\Claude\Projects\Edtech_Platform_Upgraded\backend\`.

```bash
cd "C:\Users\Ramya\Documents\Claude\Projects\Edtech_Platform_Upgraded\backend"
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

> **Windows:** Run `run_backend.bat` in that folder instead.

Verify it's running: http://localhost:8000/docs

### 2. Start Orbivex as Normal

```bash
# In a second terminal
docker compose up -d --build   # starts API + Ollama + Redis
cd frontend && npm run dev      # starts Vite on :5173
```

### 3. Navigate to LSRW

Log in as any student → click **LSRW Skills** in the sidebar.

---

## Environment Variables

`frontend/.env` already has:
```
VITE_LSRW_API_URL=http://localhost:8000
```

The LSRW backend uses its own `.env` in the `backend/` folder (Nvidia NIM key, Supabase keys, etc.).

---

## Architecture

```
Orbivex Frontend (port 5173)
  └── LSRW pages in /src/pages/lsrw/
        └── lsrwApi.js → http://localhost:8000   (LSRW FastAPI)
        └── lib/api.js  → http://localhost:3001   (Orbivex Express)

LSRW FastAPI (port 8000)
  └── /api/listening/   → meta/llama-3.1-8b-instruct  (Nvidia NIM)
  └── /api/speaking/    → nvidia/canary-1b + llama-3.1-8b (STT + eval)
  └── /api/reading/     → meta/llama-3.1-70b-instruct
  └── /api/writing/     → mistralai/mistral-7b-instruct-v0.3
  └── Supabase          → stores evaluations + sessions
```

---

## Supabase Migration (run once)

In **Supabase Dashboard → SQL Editor**, run:

```
C:\Users\Ramya\Documents\Claude\Projects\Edtech_Platform_Upgraded\supabase\migrations\001_initial_schema.sql
```

This creates `student_profiles`, `sessions`, `evaluations`, `skills_progress`.

---

## Dependencies

| Tool | Why |
|------|-----|
| ffmpeg | Speaking agent: WebM→WAV conversion (install from https://ffmpeg.org/) |
| Python 3.11+ | LSRW FastAPI backend |

**ffmpeg install (Windows):**
```bash
winget install ffmpeg
# or download from https://ffmpeg.org/download.html and add to PATH
```
