-- MVP trenera biegania. Uruchom po 001_initial_agent_memory.sql.
-- Tabele są powiązane z użytkownikiem Supabase Auth przez user_id.

create table if not exists public.athlete_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  birth_year smallint check (birth_year between 1900 and extract(year from now())::int),
  sex text check (sex in ('female', 'male', 'nonbinary', 'undisclosed')),
  weight_kg numeric(5,2) check (weight_kg between 20 and 400),
  height_cm numeric(5,1) check (height_cm between 80 and 260),
  hr_max smallint check (hr_max between 80 and 260),
  lactate_threshold_hr smallint check (lactate_threshold_hr between 60 and 250),
  lactate_threshold_pace_seconds integer check (lactate_threshold_pace_seconds between 120 and 1200),
  vo2max numeric(4,1) check (vo2max between 10 and 100),
  typical_cadence_spm smallint check (typical_cadence_spm between 100 and 260),
  weekly_availability text,
  injury_limitations text,
  notes text,
  metric_observed_at jsonb not null default '{}'::jsonb
);

create table if not exists public.athlete_hr_zones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  zone smallint not null check (zone between 1 and 5),
  lower_bpm smallint not null check (lower_bpm between 30 and 260),
  upper_bpm smallint not null check (upper_bpm between 30 and 260 and upper_bpm >= lower_bpm),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, zone)
);

create table if not exists public.running_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null check (char_length(trim(title)) between 3 and 180),
  description text,
  target_metric text,
  target_value numeric,
  target_unit text,
  target_date date,
  priority smallint not null default 3 check (priority between 1 and 5),
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'cancelled'))
);

create unique index if not exists running_goals_one_active_title_idx
  on public.running_goals (user_id, lower(title)) where status = 'active';

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  performed_on date not null,
  started_at timestamptz,
  training_type text check (training_type in ('easy', 'long', 'tempo', 'threshold', 'intervals', 'recovery', 'race', 'cross_training', 'other')),
  source text not null default 'chat' check (source in ('garmin', 'strava', 'screenshot', 'chat', 'manual', 'other')),
  summary text not null check (char_length(trim(summary)) between 3 and 1000),
  distance_m integer check (distance_m between 0 and 500000),
  duration_seconds integer check (duration_seconds between 0 and 172800),
  average_pace_seconds integer check (average_pace_seconds between 90 and 3600),
  average_hr smallint check (average_hr between 30 and 260),
  max_hr smallint check (max_hr between 30 and 260),
  average_cadence_spm smallint check (average_cadence_spm between 80 and 300),
  elevation_gain_m integer check (elevation_gain_m between 0 and 20000),
  rpe smallint check (rpe between 1 and 10),
  unstructured_notes text,
  extracted_data jsonb not null default '{}'::jsonb,
  extraction_confidence text not null default 'user_reported' check (extraction_confidence in ('user_reported', 'screen_verified', 'partial_screen', 'inferred'))
);

create index if not exists workouts_user_performed_idx
  on public.workouts (user_id, performed_on desc, created_at desc);

create table if not exists public.recovery_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sleep_hours numeric(3,1) check (sleep_hours between 0 and 24),
  sleep_quality smallint check (sleep_quality between 1 and 5),
  resting_hr smallint check (resting_hr between 25 and 150),
  hrv_ms numeric(6,1) check (hrv_ms between 1 and 300),
  fatigue smallint check (fatigue between 1 and 10),
  soreness smallint check (soreness between 1 and 10),
  pain_description text,
  stress smallint check (stress between 1 and 10),
  notes text,
  unique (user_id, logged_on)
);

create index if not exists recovery_logs_user_date_idx
  on public.recovery_logs (user_id, logged_on desc);

-- Wersja MVP korzysta z klienta anon w aktualnej aplikacji, dlatego RLS jest
-- tymczasowo wyłączony, analogicznie do migracji początkowej. Przed wdrożeniem
-- publicznym należy włączyć RLS i przejść na klienta serwerowy z tokenem sesji.
alter table public.athlete_profiles disable row level security;
alter table public.athlete_hr_zones disable row level security;
alter table public.running_goals disable row level security;
alter table public.workouts disable row level security;
alter table public.recovery_logs disable row level security;

grant select, insert, update, delete on table
  public.athlete_profiles,
  public.athlete_hr_zones,
  public.running_goals,
  public.workouts,
  public.recovery_logs
to anon, authenticated, service_role;
