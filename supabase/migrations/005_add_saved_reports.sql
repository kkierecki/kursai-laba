-- Zapisane raporty z generatora /report.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  topic text not null,
  content text not null
);

create index if not exists reports_user_created_idx
  on public.reports (user_id, created_at desc);

-- Zgodne z pozostałymi tabelami kursowej aplikacji: dostęp do danych
-- kontroluje endpoint po weryfikacji tokenu użytkownika.
alter table public.reports disable row level security;

grant select, insert, update, delete on table public.reports
  to anon, authenticated, service_role;
