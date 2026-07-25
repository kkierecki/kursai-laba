-- Lekcja 5 / W1: schema pamięci agenta.
-- Wklej cały skrypt do Supabase Dashboard -> SQL Editor i uruchom.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text,
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  role text,
  content text
);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text,
  preferences jsonb not null default '{}'::jsonb
);

-- Zgodnie z W1: RLS pozostaje wyłączone do Lekcji 7.
alter table public.conversations disable row level security;
alter table public.messages disable row level security;
alter table public.user_profiles disable row level security;

-- Uprawnienia do Data API dla klucza anon używanego przez aplikację.
grant select, insert, update, delete on table
  public.conversations, public.messages, public.user_profiles
  to anon, authenticated, service_role;

