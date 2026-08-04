-- Naprawa baz, w których trigger 013 został uruchomiony bez migracji 003.
-- Trigger bezpieczeństwa odwołuje się do NEW.home_location przy każdym zapisie profilu.
alter table public.athlete_profiles
  add column if not exists home_location text;
