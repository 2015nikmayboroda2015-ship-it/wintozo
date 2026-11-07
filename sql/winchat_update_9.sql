-- ============================================================
--  WinChat Update 9 — версии приложения + управление составом групп
--  Проект БД: https://iksgubxxxspkjwsazrwq.supabase.co
--  Выполнить в Dashboard → SQL Editor → New query → Run
-- ============================================================

-- ------------------------------------------------------------
-- 1. Хранилище текущей версии приложения (одна строка)
-- ------------------------------------------------------------
create table if not exists public.app_settings (
  key   text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Стартовая версия
insert into public.app_settings (key, value)
values ('wintozo_version', '3.0.0')
on conflict (key) do nothing;

-- Публичное чтение настроек (любой клиент должен уметь проверить версию)
alter table public.app_settings enable row level security;

drop policy if exists "app_settings_public_read" on public.app_settings;
create policy "app_settings_public_read" on public.app_settings
  for select using (true);

-- ------------------------------------------------------------
-- 2. RPC: получить текущую версию
-- ------------------------------------------------------------
drop function if exists public.get_wintozo_version();
create or replace function public.get_wintozo_version()
returns text
language sql
stable
security definer set search_path = public
as $$
  select coalesce(
    (select value from public.app_settings where key = 'wintozo_version'),
    '3.0.0'
  );
$$;

grant execute on function public.get_wintozo_version() to anon, authenticated;

-- ------------------------------------------------------------
-- 3. RPC: установить версию (только владелец аккаунта admin)
-- ------------------------------------------------------------
drop function if exists public.set_wintozo_version(uuid, text);
create or replace function public.set_wintozo_version(
  _admin_id uuid,
  _version  text
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  _nickname text;
begin
  if not exists (select 1 from public.profiles where id = _admin_id and username = 'admin') then
    return jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  end if;

  if _version is null or trim(_version) !~ '^[0-9]+\.[0-9]+(\.[0-9]+)?$' then
    return jsonb_build_object('ok', false, 'error', 'Неверный формат версии. Пример: 3.0.1');
  end if;

  insert into public.app_settings (key, value, updated_at)
  values ('wintozo_version', trim(_version), now())
  on conflict (key)
  do update set value = trim(_version), updated_at = now();

  select nickname into _nickname from public.profiles where id = _admin_id;

  return jsonb_build_object(
    'ok', true,
    'version', trim(_version),
    'message', 'Версия обновлена на ' || trim(_version)
  );
end;
$$;

grant execute on function public.set_wintozo_version(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 4. Владелец группы может добавлять и удалять участников
-- ------------------------------------------------------------
-- Добавление: любой участник добавляет новых (создание личных чатов),
-- но в группах с role-моделью — только владелец.
drop policy if exists "chat_members_insert" on public.chat_members;
create policy "chat_members_insert" on public.chat_members
  for insert with check (
    user_id = auth.uid()
    or public.is_chat_member(chat_id)
    or exists (
      select 1 from public.chats c
      where c.id = chat_members.chat_id
        and c.is_group = true
        and c.created_by = auth.uid()
    )
  );

-- Удаление: участник выходит сам, либо владелец группы кикает других
drop policy if exists "chat_members_delete" on public.chat_members;
create policy "chat_members_delete" on public.chat_members
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from public.chats c
      where c.id = chat_members.chat_id
        and c.is_group = true
        and c.created_by = auth.uid()
    )
  );
