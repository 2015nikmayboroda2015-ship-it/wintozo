-- ============================================================
--  WinChat Update 13 — Каналы, синие галочки, редактирование
-- ============================================================
--  RPC:
--    create_winchat_ch(...)        — создать канал (может любой)
--    delete_winchat_ch(...)        — удалить канал
--    edit_wintozo_channel(...)     — изменить канал
--    edit_wintozo_message(...)     — изменить отправленное сообщение
-- ============================================================

-- 1. Флаги чатов ------------------------------------------------
alter table public.chats add column if not exists is_channel  boolean not null default false;
alter table public.chats add column if not exists is_official boolean not null default false;
alter table public.chats add column if not exists verified    boolean not null default false;

-- 2. Время редактирования сообщения -----------------------------
alter table public.messages add column if not exists edited_at timestamptz;

create index if not exists chats_channel_idx      on public.chats(is_channel);
create index if not exists chat_members_role_idx  on public.chat_members(chat_id, role);

-- 3. Хелперы ----------------------------------------------------
create or replace function public.is_global_admin(_user_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = _user_id and lower(username) = 'admin'
  );
$$;

create or replace function public.is_chat_channel(_chat_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select is_channel from public.chats where id = _chat_id), false);
$$;

create or replace function public.is_chat_official(_chat_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select is_official from public.chats where id = _chat_id), false);
$$;

-- Владелец/админ канала или глобальный администратор WinChat.
create or replace function public.is_chat_admin(_chat_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_global_admin(_user_id)
      or exists (
        select 1 from public.chat_members
        where chat_id = _chat_id
          and user_id = _user_id
          and role in ('owner', 'admin')
      );
$$;

-- 4. RLS --------------------------------------------------------
-- Создавать чаты/каналы может любой авторизованный, но нельзя
-- самостоятельно выставить синюю галочку или официальность.
drop policy if exists "chats_insert" on public.chats;
create policy "chats_insert" on public.chats
  for insert with check (
    auth.uid() is not null
    and created_by = auth.uid()
    and verified = false
    and is_official = false
  );

drop policy if exists "chats_update" on public.chats;
create policy "chats_update" on public.chats
  for update
  using (
    (created_by = auth.uid() and is_group = true)
    or public.is_chat_admin(id, auth.uid())
  )
  with check (
    (created_by = auth.uid() and is_group = true)
    or public.is_chat_admin(id, auth.uid())
  );

drop policy if exists "chat_members_insert" on public.chat_members;
create policy "chat_members_insert" on public.chat_members
  for insert with check (
    user_id = auth.uid()
    or public.is_chat_admin(chat_id, auth.uid())
    or (
      not public.is_chat_channel(chat_id)
      and public.is_chat_member(chat_id)
    )
    or exists (
      select 1 from public.chats c
      where c.id = chat_members.chat_id
        and c.is_group = true
        and c.created_by = auth.uid()
    )
  );

drop policy if exists "chat_members_update" on public.chat_members;
create policy "chat_members_update" on public.chat_members
  for update using (public.is_chat_admin(chat_id, auth.uid()))
  with check (public.is_chat_admin(chat_id, auth.uid()));

drop policy if exists "chat_members_delete" on public.chat_members;
create policy "chat_members_delete" on public.chat_members
  for delete using (
    not (user_id = auth.uid() and public.is_chat_official(chat_id))
    and (
      user_id = auth.uid()
      or public.is_chat_admin(chat_id, auth.uid())
    )
  );

drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and (
      public.is_chat_member(chat_id)
      or public.is_global_admin(auth.uid())
    )
    and (
      not public.is_chat_channel(chat_id)
      or public.is_chat_admin(chat_id, auth.uid())
    )
  );

drop policy if exists "messages_update" on public.messages;
create policy "messages_update" on public.messages
  for update using (
    sender_id = auth.uid()
    or public.is_chat_admin(chat_id, auth.uid())
  )
  with check (
    sender_id = auth.uid()
    or public.is_chat_admin(chat_id, auth.uid())
  );

-- Защита флагов от прямой подмены клиентом.
create or replace function public.protect_chat_flags()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null
     and (new.verified is distinct from old.verified
       or new.is_official is distinct from old.is_official)
     and not public.is_global_admin(auth.uid()) then
    raise exception 'Менять галочку и статус официального канала может только администратор WinChat';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_chat_flags_trg on public.chats;
create trigger protect_chat_flags_trg
  before update on public.chats
  for each row execute function public.protect_chat_flags();

-- Владельца канала/группы нельзя понизить в роли.
create or replace function public.protect_chat_owner_role()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.role = 'owner' and new.role is distinct from 'owner' then
    raise exception 'Владельца канала нельзя понизить в роли';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_chat_owner_role_trg on public.chat_members;
create trigger protect_chat_owner_role_trg
  before update on public.chat_members
  for each row execute function public.protect_chat_owner_role();

-- 5. RPC: создать канал -----------------------------------------
drop function if exists public.create_winchat_ch(uuid, text, text, text);
create or replace function public.create_winchat_ch(
  _creator_id uuid,
  _title text,
  _description text default null,
  _avatar_url text default null
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  _chat_id uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Требуется вход');
  end if;

  if _creator_id <> auth.uid() and not public.is_global_admin(auth.uid()) then
    return jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  end if;

  if _title is null or length(btrim(_title)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'Укажите название канала');
  end if;

  insert into public.chats (id, is_group, is_channel, title, description, avatar_url, created_by)
  values (
    _chat_id,
    true,
    true,
    btrim(_title),
    nullif(btrim(coalesce(_description, '')), ''),
    nullif(btrim(coalesce(_avatar_url, '')), ''),
    _creator_id
  );

  insert into public.chat_members (chat_id, user_id, role)
  values (_chat_id, _creator_id, 'owner');

  return jsonb_build_object('ok', true, 'chat_id', _chat_id, 'title', btrim(_title));
end;
$$;

grant execute on function public.create_winchat_ch(uuid, text, text, text) to authenticated;

-- 6. RPC: удалить канал -----------------------------------------
drop function if exists public.delete_winchat_ch(uuid, uuid);
create or replace function public.delete_winchat_ch(
  _user_id uuid,
  _chat_id uuid
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  _official boolean;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Требуется вход');
  end if;

  if _user_id <> auth.uid() and not public.is_global_admin(auth.uid()) then
    return jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  end if;

  select is_official into _official
  from public.chats
  where id = _chat_id and is_channel = true;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Канал не найден');
  end if;

  if not public.is_chat_admin(_chat_id, _user_id) then
    return jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  end if;

  if _official and not public.is_global_admin(_user_id) then
    return jsonb_build_object('ok', false, 'error', 'Официальный канал может удалить только администратор WinChat');
  end if;

  delete from public.chats where id = _chat_id;

  return jsonb_build_object('ok', true, 'chat_id', _chat_id);
end;
$$;

grant execute on function public.delete_winchat_ch(uuid, uuid) to authenticated;

-- 7. RPC: изменить канал ----------------------------------------
drop function if exists public.edit_wintozo_channel(uuid, uuid, text, text, text, boolean, boolean);
create or replace function public.edit_wintozo_channel(
  _user_id uuid,
  _chat_id uuid,
  _title text default null,
  _description text default null,
  _avatar_url text default null,
  _verified boolean default null,
  _is_official boolean default null
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  _chat public.chats%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Требуется вход');
  end if;

  if _user_id <> auth.uid() and not public.is_global_admin(auth.uid()) then
    return jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  end if;

  select * into _chat from public.chats where id = _chat_id and is_channel = true;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Канал не найден');
  end if;

  if not public.is_chat_admin(_chat_id, _user_id) then
    return jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  end if;

  if (_verified is not null or _is_official is not null)
     and not public.is_global_admin(_user_id) then
    return jsonb_build_object('ok', false, 'error', 'Галочку и статус официального канала может менять только администратор WinChat');
  end if;

  if _title is not null and length(btrim(_title)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'Название не может быть пустым');
  end if;

  update public.chats
  set title       = case when _title is null then title else btrim(_title) end,
      description = case when _description is null then description else nullif(btrim(_description), '') end,
      avatar_url  = case when _avatar_url is null then avatar_url else nullif(btrim(_avatar_url), '') end,
      verified    = coalesce(_verified, verified),
      is_official = coalesce(_is_official, is_official)
  where id = _chat_id;

  select * into _chat from public.chats where id = _chat_id;

  return jsonb_build_object(
    'ok', true,
    'chat_id', _chat_id,
    'title', _chat.title,
    'description', _chat.description,
    'avatar_url', _chat.avatar_url,
    'verified', _chat.verified,
    'is_official', _chat.is_official
  );
end;
$$;

grant execute on function public.edit_wintozo_channel(uuid, uuid, text, text, text, boolean, boolean) to authenticated;

-- 8. RPC: редактировать сообщение -------------------------------
drop function if exists public.edit_wintozo_message(uuid, uuid, text);
create or replace function public.edit_wintozo_message(
  _user_id uuid,
  _message_id uuid,
  _content text
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  _msg public.messages%rowtype;
  _edited_at timestamptz := now();
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Требуется вход');
  end if;

  if _user_id <> auth.uid() and not public.is_global_admin(auth.uid()) then
    return jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  end if;

  select * into _msg from public.messages where id = _message_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Сообщение не найдено');
  end if;

  if _msg.sender_id <> _user_id
     and not public.is_chat_admin(_msg.chat_id, _user_id) then
    return jsonb_build_object('ok', false, 'error', 'Можно редактировать только свои сообщения');
  end if;

  if (_content is null or length(btrim(_content)) = 0)
     and _msg.image_url is null
     and _msg.audio_url is null
     and _msg.video_url is null then
    return jsonb_build_object('ok', false, 'error', 'Сообщение не может быть пустым');
  end if;

  update public.messages
  set content = nullif(btrim(_content), ''),
      edited_at = _edited_at
  where id = _message_id;

  return jsonb_build_object(
    'ok', true,
    'message_id', _message_id,
    'content', nullif(btrim(_content), ''),
    'edited_at', _edited_at
  );
end;
$$;

grant execute on function public.edit_wintozo_message(uuid, uuid, text) to authenticated;

-- 8.1 RPC: список каналов (для админ-терминала) ------------------
drop function if exists public.list_winchat_channels(uuid);
create or replace function public.list_winchat_channels(
  _user_id uuid
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Требуется вход');
  end if;

  if _user_id <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  end if;

  if not public.is_global_admin(auth.uid()) then
    return jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  end if;

  return jsonb_build_object(
    'ok', true,
    'channels', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'title', c.title,
            'verified', c.verified,
            'is_official', c.is_official,
            'subscribers', (
              select count(*) from public.chat_members m where m.chat_id = c.id
            )
          )
          order by c.is_official desc, c.created_at
        )
        from public.chats c
        where c.is_channel = true
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.list_winchat_channels(uuid) to authenticated;

-- 9. Официальный канал + синяя галочка группе ------------------
do $$
declare
  _admin_id uuid;
  _official_id uuid := '00000000-0000-4000-8000-000000000001';
begin
  select id into _admin_id
  from public.profiles
  where lower(username) = 'admin'
  limit 1;

  if _admin_id is null then
    select id into _admin_id from public.profiles order by created_at limit 1;
  end if;

  -- Синяя галочка уже существующей группе.
  update public.chats
  set verified = true
  where id = 'a7296d8e-f687-422b-886f-68a8f792af92';

  -- Официальный канал WinChat Official.
  insert into public.chats (
    id, is_group, is_channel, is_official, verified,
    title, description, created_by
  )
  values (
    _official_id,
    true,
    true,
    true,
    true,
    'WinChat Official',
    'Официальный канал WinChat — новости и объявления.',
    _admin_id
  )
  on conflict (id) do nothing;

  update public.chats
  set is_channel = true,
      is_official = true,
      verified = true
  where id = _official_id;

  if _admin_id is not null then
    insert into public.chat_members (chat_id, user_id, role)
    values (_official_id, _admin_id, 'owner')
    on conflict (chat_id, user_id) do update set role = 'owner';
  end if;

  -- Все существующие пользователи подписаны на официальный канал.
  insert into public.chat_members (chat_id, user_id, role)
  select _official_id, p.id, 'subscriber'
  from public.profiles p
  on conflict (chat_id, user_id) do nothing;

  if _admin_id is not null then
    update public.chat_members
    set role = 'owner'
    where chat_id = _official_id and user_id = _admin_id;
  end if;
end $$;

-- 10. Новые пользователи автоматически подписываются ------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, nickname, winpass)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data ->> 'username', 'user_' || left(new.id::text, 6))),
    coalesce(new.raw_user_meta_data ->> 'nickname', 'Пользователь'),
    public.generate_winpass()
  );

  insert into public.chat_members (chat_id, user_id, role)
  select c.id, new.id, 'subscriber'
  from public.chats c
  where c.is_official = true
  on conflict (chat_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
