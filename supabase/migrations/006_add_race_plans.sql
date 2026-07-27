-- Trwale zapisane plany przygotowań do konkretnych zawodów.
create table if not exists public.race_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  event_name text not null check (char_length(trim(event_name)) between 3 and 180),
  event_date date not null,
  distance_km numeric(6,2),
  location text,
  official_url text not null check (official_url ~* '^https?://'),
  event_details jsonb not null default '{}'::jsonb,
  plan_markdown text not null check (char_length(trim(plan_markdown)) > 0),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled'))
);

create index if not exists race_plans_user_active_idx
  on public.race_plans (user_id, event_date asc, updated_at desc)
  where status = 'active';

alter table public.race_plans disable row level security;

grant select, insert, update, delete on table public.race_plans
to anon, authenticated, service_role;
