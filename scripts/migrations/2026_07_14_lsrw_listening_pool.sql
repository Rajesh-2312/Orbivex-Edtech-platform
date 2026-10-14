-- LSRW: persistent cache for AI-generated content pools (30 items per level).
-- Covers Listening (passages) and Speaking (topics).
-- Optional. Without these tables the backend still works using an in-memory cache
-- (regenerated once per server start). Run in Supabase SQL Editor to persist pools.

create table if not exists public.lsrw_listening_pool (
  level      text primary key check (level in ('beginner', 'intermediate', 'advanced')),
  items      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lsrw_speaking_pool (
  level      text primary key check (level in ('beginner', 'intermediate', 'advanced')),
  items      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lsrw_listening_pool enable row level security;
alter table public.lsrw_speaking_pool  enable row level security;

-- Backend uses the service-role key (bypasses RLS). No public policies needed.
