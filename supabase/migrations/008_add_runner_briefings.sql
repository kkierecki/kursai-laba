-- Poranne briefingi trenera biegania. Uruchom po migracji 007.
create table if not exists public.runner_briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  briefing_date date not null,
  content text not null check (char_length(trim(content)) > 0),
  context jsonb not null default '{}'::jsonb,
  unique (user_id, briefing_date)
);

create index if not exists runner_briefings_user_created_idx
  on public.runner_briefings (user_id, created_at desc);

-- Spójne z aktualnym MVP: endpoint weryfikuje sesję użytkownika.
alter table public.runner_briefings disable row level security;

grant select, insert, update, delete on table public.runner_briefings
to anon, authenticated, service_role;
