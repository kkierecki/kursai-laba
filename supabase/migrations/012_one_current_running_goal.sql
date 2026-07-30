-- Jeden biegacz może mieć tylko jeden aktualny cel. Starsze cele pozostają
-- w historii ze statusem cancelled, aby nie zacierać danych treningowych.

with ranked_active_goals as (
  select
    id,
    row_number() over (
      partition by user_id
      order by updated_at desc, created_at desc, id desc
    ) as position
  from public.running_goals
  where status = 'active'
)
update public.running_goals as goal
set status = 'cancelled', updated_at = now()
from ranked_active_goals as ranked
where goal.id = ranked.id
  and ranked.position > 1;

drop index if exists public.running_goals_one_active_title_idx;
create unique index if not exists running_goals_one_active_user_idx
  on public.running_goals (user_id)
  where status = 'active';

create or replace function public.replace_running_goal(
  p_user_id uuid,
  p_title text,
  p_description text default null,
  p_target_metric text default null,
  p_target_value numeric default null,
  p_target_unit text default null,
  p_target_date date default null
)
returns table (id uuid, title text)
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.running_goals
  set status = 'cancelled', updated_at = now()
  where user_id = p_user_id and status = 'active';

  return query
  insert into public.running_goals (
    user_id,
    title,
    description,
    target_metric,
    target_value,
    target_unit,
    target_date,
    status
  ) values (
    p_user_id,
    trim(p_title),
    nullif(trim(p_description), ''),
    nullif(trim(p_target_metric), ''),
    p_target_value,
    nullif(trim(p_target_unit), ''),
    p_target_date,
    'active'
  )
  returning running_goals.id, running_goals.title;
end;
$$;

grant execute on function public.replace_running_goal(uuid, text, text, text, numeric, text, date)
  to authenticated, service_role;
