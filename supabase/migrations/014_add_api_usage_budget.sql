-- Budżet per użytkownik: endpointy zapisują rzeczywiste usage zwrócone przez model.
create table if not exists public.api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  tokens_input integer not null check (tokens_input >= 0),
  tokens_output integer not null check (tokens_output >= 0),
  model text not null check (char_length(model) between 1 and 160),
  endpoint text not null check (endpoint ~ '^/api/[a-z0-9/_-]{1,120}$')
);

create index if not exists api_usage_user_created_at_idx
  on public.api_usage (user_id, created_at desc);

alter table public.api_usage enable row level security;
revoke all on table public.api_usage from anon;

drop policy if exists own_api_usage on public.api_usage;
create policy own_api_usage on public.api_usage
  for select to authenticated
  using (user_id = auth.uid());

create policy insert_own_api_usage on public.api_usage
  for insert to authenticated
  with check (user_id = auth.uid());

-- Zapisy są wykonywane wyłącznie z autoryzowanych endpointów serwera, które
-- przekazują JWT użytkownika. Klient nie ma polityki INSERT ani UPDATE/DELETE.
create or replace function public.reject_unsafe_api_usage_content()
returns trigger language plpgsql as $$
begin
  perform public.assert_safe_stored_text(new.model, 'api_usage.model');
  perform public.assert_safe_stored_text(new.endpoint, 'api_usage.endpoint');
  return new;
end;
$$;

drop trigger if exists reject_unsafe_api_usage_before_write on public.api_usage;
create trigger reject_unsafe_api_usage_before_write
  before insert or update on public.api_usage
  for each row execute function public.reject_unsafe_api_usage_content();
