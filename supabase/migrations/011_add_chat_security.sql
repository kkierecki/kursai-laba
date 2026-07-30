-- Rejestr wiadomości i atomowy limit 50 wiadomości na godzinę na użytkownika.
create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  message_length integer not null check (message_length between 0 and 2000),
  blocked boolean not null default false,
  block_reason text check (block_reason is null or char_length(block_reason) <= 80)
);

create index if not exists message_logs_user_created_idx
  on public.message_logs (user_id, created_at desc);

alter table public.message_logs enable row level security;

drop policy if exists read_own_message_logs on public.message_logs;
create policy read_own_message_logs on public.message_logs
  for select to authenticated using (user_id = auth.uid());

revoke all on table public.message_logs from anon, authenticated;

create or replace function public.consume_chat_message_slot(
  p_message_length integer,
  p_blocked boolean default false,
  p_block_reason text default null
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_window_start timestamptz := now() - interval '1 hour';
  v_count integer;
  v_oldest timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_message_length < 0 or p_message_length > 2000 then
    raise exception 'Invalid message length';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user_id::text));

  select count(*), min(created_at)
    into v_count, v_oldest
    from public.message_logs
   where user_id = v_user_id and created_at >= v_window_start;

  if v_count >= 50 then
    return query select false, greatest(1, ceil(extract(epoch from (v_oldest + interval '1 hour' - now())))::integer);
    return;
  end if;

  insert into public.message_logs (user_id, message_length, blocked, block_reason)
  values (v_user_id, p_message_length, p_blocked, p_block_reason);

  return query select not p_blocked, 0;
end;
$$;

revoke all on function public.consume_chat_message_slot(integer, boolean, text) from public;
grant execute on function public.consume_chat_message_slot(integer, boolean, text) to authenticated;
