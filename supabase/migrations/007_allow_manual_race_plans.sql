-- Ręcznie dodane zawody mogą nie mieć publicznego adresu organizatora.
alter table public.race_plans alter column official_url drop not null;
alter table public.race_plans drop constraint if exists race_plans_official_url_check;
alter table public.race_plans add constraint race_plans_official_url_check
  check (official_url is null or official_url ~* '^https?://');
