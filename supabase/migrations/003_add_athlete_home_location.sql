-- Uruchom po 002_running_mvp.sql.
alter table public.athlete_profiles
  add column if not exists home_location text;
