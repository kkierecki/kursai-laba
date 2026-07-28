-- Zdarzenia odebrane z zewnętrznych integracji biegowych.
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  processed_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (char_length(trim(source)) between 1 and 80),
  external_event_id text not null check (char_length(trim(external_event_id)) between 1 and 160),
  type text not null check (type in ('workout', 'recovery', 'race_interest')),
  data jsonb not null,
  analysis text not null,
  status text not null check (status in ('processed', 'analysis_failed')),
  unique (source, external_event_id)
);

create index if not exists webhook_events_user_created_idx
  on public.webhook_events (user_id, created_at desc);

alter table public.webhook_events disable row level security;

grant select, insert, update, delete on table public.webhook_events
to anon, authenticated, service_role;
