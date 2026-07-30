-- Ostatnia linia ochrony: blokada aktywnego HTML/CSS/JavaScript również dla
-- zapisów wykonywanych bezpośrednio przez klienta Supabase.
create or replace function public.assert_safe_stored_text(p_value text, p_field text)
returns void
language plpgsql
immutable
as $$
begin
  if p_value is null then return; end if;

  if p_value ~* '<\s*/?\s*[a-z][a-z0-9:-]*(\s+[^<>]*)?/?\s*>'
     or p_value ~* '(javascript\s*:|\bon[a-z]+\s*=|@import\s+(url|[''"'']|\()|expression\s*\()'
     or p_value ~* '(\bunion\s+(all\s+)?select\b|\bdrop\s+table\b|\binformation_schema\b|\bpg_catalog\b|;\s*(drop|delete|insert|update|alter|create)\b)' then
    raise exception 'Niedozwolony aktywny kod, HTML lub wzorzec SQL injection w polu %', p_field
      using errcode = '22000';
  end if;
end;
$$;

create or replace function public.reject_unsafe_content()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'messages' then
    perform public.assert_safe_stored_text(new.content, 'messages.content');
  elsif tg_table_name = 'conversations' then
    perform public.assert_safe_stored_text(new.title, 'conversations.title');
  elsif tg_table_name = 'user_profiles' then
    perform public.assert_safe_stored_text(new.name, 'user_profiles.name');
    perform public.assert_safe_stored_text(new.preferences::text, 'user_profiles.preferences');
  elsif tg_table_name = 'documents' then
    perform public.assert_safe_stored_text(new.title, 'documents.title');
    perform public.assert_safe_stored_text(new.content, 'documents.content');
    perform public.assert_safe_stored_text(new.metadata::text, 'documents.metadata');
  elsif tg_table_name = 'reports' then
    perform public.assert_safe_stored_text(new.topic, 'reports.topic');
    perform public.assert_safe_stored_text(new.content, 'reports.content');
  elsif tg_table_name = 'webhook_events' then
    perform public.assert_safe_stored_text(new.source, 'webhook_events.source');
    perform public.assert_safe_stored_text(new.external_event_id, 'webhook_events.external_event_id');
    perform public.assert_safe_stored_text(new.data::text, 'webhook_events.data');
    perform public.assert_safe_stored_text(new.analysis, 'webhook_events.analysis');
  elsif tg_table_name = 'athlete_profiles' then
    perform public.assert_safe_stored_text(new.weekly_availability, 'athlete_profiles.weekly_availability');
    perform public.assert_safe_stored_text(new.injury_limitations, 'athlete_profiles.injury_limitations');
    perform public.assert_safe_stored_text(new.notes, 'athlete_profiles.notes');
    perform public.assert_safe_stored_text(new.home_location, 'athlete_profiles.home_location');
  elsif tg_table_name = 'running_goals' then
    perform public.assert_safe_stored_text(new.title, 'running_goals.title');
    perform public.assert_safe_stored_text(new.description, 'running_goals.description');
  elsif tg_table_name = 'workouts' then
    perform public.assert_safe_stored_text(new.summary, 'workouts.summary');
    perform public.assert_safe_stored_text(new.unstructured_notes, 'workouts.unstructured_notes');
    perform public.assert_safe_stored_text(new.extracted_data::text, 'workouts.extracted_data');
  elsif tg_table_name = 'recovery_logs' then
    perform public.assert_safe_stored_text(new.pain_description, 'recovery_logs.pain_description');
    perform public.assert_safe_stored_text(new.notes, 'recovery_logs.notes');
  elsif tg_table_name = 'race_plans' then
    perform public.assert_safe_stored_text(new.event_name, 'race_plans.event_name');
    perform public.assert_safe_stored_text(new.location, 'race_plans.location');
    perform public.assert_safe_stored_text(new.event_details::text, 'race_plans.event_details');
    perform public.assert_safe_stored_text(new.plan_markdown, 'race_plans.plan_markdown');
  elsif tg_table_name = 'runner_briefings' then
    perform public.assert_safe_stored_text(new.content, 'runner_briefings.content');
    perform public.assert_safe_stored_text(new.context::text, 'runner_briefings.context');
  end if;
  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'messages', 'conversations', 'user_profiles', 'documents', 'reports', 'webhook_events',
    'athlete_profiles', 'running_goals', 'workouts', 'recovery_logs',
    'race_plans', 'runner_briefings'
  ] loop
    execute format('drop trigger if exists reject_unsafe_content_before_write on public.%I', v_table);
    execute format('create trigger reject_unsafe_content_before_write before insert or update on public.%I for each row execute function public.reject_unsafe_content()', v_table);
  end loop;
end;
$$;
