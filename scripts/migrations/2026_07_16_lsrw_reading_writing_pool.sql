-- LSRW: persistent cache for AI-generated Reading and Writing pools (30 items per level).
-- Completes the set started in 2026_07_14_lsrw_listening_pool.sql, which covered
-- Listening and Speaking only.
--
-- Optional. Without these tables the backend still works using an in-memory cache
-- (regenerated once per server start). Run in Supabase SQL Editor to persist pools.

create table if not exists public.lsrw_reading_pool (
  level      text primary key check (level in ('beginner', 'intermediate', 'advanced')),
  items      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lsrw_writing_pool (
  level      text primary key check (level in ('beginner', 'intermediate', 'advanced')),
  items      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lsrw_reading_pool enable row level security;
alter table public.lsrw_writing_pool enable row level security;

-- Backend uses the service-role key (bypasses RLS). No public policies needed.
