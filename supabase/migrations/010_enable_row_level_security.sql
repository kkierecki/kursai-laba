-- Włącza izolację danych użytkowników dla wszystkich tabel dostępnych przez
-- PostgREST. Uruchom w Supabase SQL Editor po migracji 009.

alter table public.messages enable row level security;
alter table public.user_profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.race_plans enable row level security;
alter table public.runner_briefings enable row level security;
alter table public.documents enable row level security;
alter table public.recovery_logs enable row level security;
alter table public.athlete_hr_zones enable row level security;
alter table public.running_goals enable row level security;
alter table public.workouts enable row level security;
alter table public.athlete_profiles enable row level security;
alter table public.webhook_events enable row level security;
alter table public.reports enable row level security;

drop policy if exists own_user_profile on public.user_profiles;
create policy own_user_profile on public.user_profiles
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists own_conversations on public.conversations;
create policy own_conversations on public.conversations
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists own_messages on public.messages;
create policy own_messages on public.messages
  for all to authenticated
  using (exists (
    select 1 from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
  ));

drop policy if exists own_race_plans on public.race_plans;
create policy own_race_plans on public.race_plans for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists own_runner_briefings on public.runner_briefings;
create policy own_runner_briefings on public.runner_briefings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists own_documents on public.documents;
create policy own_documents on public.documents for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists own_recovery_logs on public.recovery_logs;
create policy own_recovery_logs on public.recovery_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists own_athlete_hr_zones on public.athlete_hr_zones;
create policy own_athlete_hr_zones on public.athlete_hr_zones for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists own_running_goals on public.running_goals;
create policy own_running_goals on public.running_goals for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists own_workouts on public.workouts;
create policy own_workouts on public.workouts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists own_athlete_profiles on public.athlete_profiles;
create policy own_athlete_profiles on public.athlete_profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists own_reports on public.reports;
create policy own_reports on public.reports for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Zdarzenia zapisuje wyłącznie endpoint integracji z kluczem service_role.
-- Użytkownik może odczytać tylko swoje zdarzenia, jeśli udostępnimy je w UI.
drop policy if exists read_own_webhook_events on public.webhook_events;
create policy read_own_webhook_events on public.webhook_events
  for select to authenticated
  using (user_id = auth.uid());

revoke all on table
  public.messages,
  public.user_profiles,
  public.conversations,
  public.race_plans,
  public.runner_briefings,
  public.documents,
  public.recovery_logs,
  public.athlete_hr_zones,
  public.running_goals,
  public.workouts,
  public.athlete_profiles,
  public.webhook_events,
  public.reports
from anon;

revoke execute on function public.match_documents(extensions.vector, float, integer, uuid) from anon;
grant execute on function public.match_documents(extensions.vector, float, integer, uuid) to authenticated, service_role;
alter function public.match_documents(extensions.vector, float, integer, uuid) security invoker;
