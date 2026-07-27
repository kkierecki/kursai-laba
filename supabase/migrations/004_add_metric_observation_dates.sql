-- Uruchom po 003. Przechowuje obiektywną datę źródłową każdej metryki.
alter table public.athlete_profiles
  add column if not exists metric_observed_at jsonb not null default '{}'::jsonb;
