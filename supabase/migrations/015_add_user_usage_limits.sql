-- Indywidualne limity tokenów ustawiane przez administratora.
create table if not exists public.user_usage_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_token_limit integer check (daily_token_limit is null or daily_token_limit > 0),
  monthly_token_limit integer check (monthly_token_limit is null or monthly_token_limit > 0),
  updated_at timestamptz not null default now()
);

alter table public.user_usage_limits enable row level security;

revoke all on table public.user_usage_limits from anon, authenticated;
grant select on table public.user_usage_limits to authenticated;

drop policy if exists read_own_user_usage_limits on public.user_usage_limits;
create policy read_own_user_usage_limits on public.user_usage_limits
  for select to authenticated using (user_id = auth.uid());
