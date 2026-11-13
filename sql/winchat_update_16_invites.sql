-- ============================================================
-- WinChat 5.0.x — приглашения в группы и каналы
--
-- Новая колонка chats.invite_code + RPC get_chat_by_invite:
--   ссылка приглашения: /channel/invite/<code>  или  /group/invite/<code>
--   код — случайное число (например, 10000..330357).
--
-- Выполните этот файл в SQL Editor проекта Supabase.
-- ============================================================

alter table public.chats
  add column if not exists invite_code text;

create unique index if not exists chats_invite_code_key
  on public.chats (invite_code);

-- RPC: найти чат по коду приглашения.
create or replace function public.get_chat_by_invite(_invite_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.chats;
begin
  select *
    into c
    from public.chats
   where public.chats.invite_code = lower(trim(_invite_code))
   limit 1;

  if c.id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  return json_build_object(
    'ok', true,
    'chat', json_build_object(
      'id', c.id,
      'direct_key', c.direct_key,
      'is_group', c.is_group,
      'is_channel', c.is_channel,
      'title', c.title,
      'description', c.description,
      'avatar_url', c.avatar_url,
      'created_by', c.created_by,
      'created_at', c.created_at,
      'updated_at', c.updated_at,
      'invite_code', c.invite_code
    )
  );
end;
$$;

-- RPC: сгенерировать новый код приглашения для чата.
create or replace function public.regen_chat_invite(_chat_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.chats;
  code text;
begin
  select *
    into c
    from public.chats
   where public.chats.id = _chat_id
   limit 1;

  if c.id is null then
    return null;
  end if;

  loop
    code := (10000 + floor(random() * 320348))::text;
    exit when not exists (select 1 from public.chats where public.chats.invite_code = code);
  end loop;

  update public.chats
     set invite_code = code
   where public.chats.id = _chat_id;

  return code;
end;
$$;
