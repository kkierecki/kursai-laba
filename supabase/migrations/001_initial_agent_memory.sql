-- Fundament aplikacji: użytkownicy, historia czatu i prywatna baza wiedzy.
-- Uruchom jako pierwszą migrację w Supabase SQL Editor.

create extension if not exists vector with schema extensions;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  title text,
  updated_at timestamptz not null default now()
);

-- Kompatybilność z pierwszą wersją kursowej tabeli bez user_id.
alter table public.conversations
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  created_at timestamptz not null default now(),
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null
);

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text,
  preferences jsonb not null default '{}'::jsonb
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  title text not null,
  content text not null,
  embedding extensions.vector(768) not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at asc);
create index if not exists documents_user_created_idx
  on public.documents (user_id, created_at desc);

create or replace function public.match_documents(
  query_embedding extensions.vector(768),
  match_threshold float,
  match_count integer,
  match_user_id uuid
)
returns table (
  id uuid,
  title text,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    documents.id,
    documents.title,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from public.documents
  where documents.user_id = match_user_id
    and 1 - (documents.embedding <=> query_embedding) >= match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
$$;

-- Aplikacja kursowa korzysta z klienta anon. RLS należy włączyć dopiero wraz
-- z przejściem na serwerowy klient Supabase przekazujący token sesji.
alter table public.conversations disable row level security;
alter table public.messages disable row level security;
alter table public.user_profiles disable row level security;
alter table public.documents disable row level security;

grant select, insert, update, delete on table
  public.conversations, public.messages, public.user_profiles, public.documents
  to anon, authenticated, service_role;
grant execute on function public.match_documents(extensions.vector, float, integer, uuid)
  to anon, authenticated, service_role;
