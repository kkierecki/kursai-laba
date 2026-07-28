-- Zachowuje źródłową skalę jakości snu (np. Garmin 80/100) bez jej przeliczania.
alter table public.recovery_logs
  add column if not exists sleep_quality_scale smallint;

alter table public.recovery_logs
  drop constraint if exists recovery_logs_sleep_quality_check;

alter table public.recovery_logs
  add constraint recovery_logs_sleep_quality_check
  check (
    sleep_quality is null
    or (
      sleep_quality_scale in (5, 100)
      and sleep_quality between 1 and sleep_quality_scale
    )
  );

alter table public.recovery_logs
  add constraint recovery_logs_sleep_quality_scale_check
  check (sleep_quality_scale is null or sleep_quality_scale in (5, 100));

-- Dotychczasowa kolumna przyjmowała wyłącznie wartości 1–5.
update public.recovery_logs
set sleep_quality_scale = 5
where sleep_quality is not null and sleep_quality_scale is null;
