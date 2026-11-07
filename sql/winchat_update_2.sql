-- ============================================================
--  WinChat — миграция: ГРУППЫ, ОПИСАНИЯ, ГОЛОСОВЫЕ
--  Усиленная версия: достраивает ВСЕ недостающие колонки,
--  включая direct_key (если таблица chats создавалась вручную).
--  Идемпотентная: безопасно запускать повторно.
--  Dashboard → SQL Editor → New query → вставить целиком → Run
-- ============================================================

-- 1. ПРОФИЛИ: достраиваем колонки ------------------------------
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio        text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();

-- 2. ЧАТЫ: direct_key (мог отсутствовать) + поля групп ---------
alter table public.chats add column if not exists direct_key  text;
alter table public.chats alter column direct_key drop not null;

create unique index if not exists chats_direct_key_key
  on public.chats(direct_key);

alter table public.chats add column if not exists is_group    boolean not null default false;
alter table public.chats add column if not exists title       text;
alter table public.chats add column if not exists description text;
alter table public.chats add column if not exists avatar_url  text;
alter table public.chats add column if not exists created_by  uuid references public.profiles(id) on delete set null;
alter table public.chats add column if not exists created_at  timestamptz not null default now();
alter table public.chats add column if not exists updated_at  timestamptz not null default now();

-- 3. УЧАСТНИКИ: роли и дата вступления -------------------------
alter table public.chat_members add column if not exists role      text not null default 'member';
alter table public.chat_members add column if not exists joined_at timestamptz not null default now();

-- 4. СООБЩЕНИЯ: фото, голосовые, дата --------------------------
alter table public.messages add column if not exists content        text;
alter table public.messages add column if not exists image_url      text;
alter table public.messages add column if not exists audio_url      text;
alter table public.messages add column if not exists audio_duration integer;
alter table public.messages add column if not exists created_at     timestamptz not null default now();

-- Сообщение должно содержать хоть что-то
alter table public.messages drop constraint if exists messages_not_empty;
alter table public.messages add  constraint messages_not_empty
  check (content is not null or image_url is not null or audio_url is not null);

-- Индексы на случай, если таблицы создавались вручную
create index if not exists messages_chat_idx     on public.messages(chat_id, created_at);
create index if not exists chat_members_user_idx on public.chat_members(user_id);
create index if not exists profiles_username_idx on public.profiles(username);

-- 5. ПОЛИТИКИ ДЛЯ ГРУПП -----------------------------------------
-- Владелец группы может менять название, описание и обложку
drop policy if exists "chats_update" on public.chats;
create policy "chats_update" on public.chats
  for update
  using (created_by = auth.uid() and is_group = true)
  with check (created_by = auth.uid() and is_group = true);

-- Участник может выйти из группы (удалить свою запись)
drop policy if exists "chat_members_delete" on public.chat_members;
create policy "chat_members_delete" on public.chat_members
  for delete using (user_id = auth.uid());

-- 6. ТРИГГЕР updated_at (на случай, если его не было) ----------
create or replace function public.touch_chat()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.chats set updated_at = now() where id = new.chat_id;
  return new;
end;
$$;

drop trigger if exists on_message_created on public.messages;
create trigger on_message_created
  after insert on public.messages
  for each row execute function public.touch_chat();

-- 7. REALTIME ДЛЯ ЧАТОВ И СООБЩЕНИЙ ----------------------------
alter table public.chats replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.chats;
exception when duplicate_object then
  null;
end $$;

-- 8. ПРОВЕРКА РЕЗУЛЬТАТА ----------------------------------------
-- Ожидаем: chats = 7, messages = 5, profiles = 4, members = 2
select
  (select count(*) from information_schema.columns
    where table_name = 'chats' and column_name in
      ('direct_key','is_group','title','description','avatar_url','created_by','updated_at')) as chats_ok,
  (select count(*) from information_schema.columns
    where table_name = 'messages' and column_name in
      ('content','image_url','audio_url','audio_duration','created_at'))                      as messages_ok,
  (select count(*) from information_schema.columns
    where table_name = 'profiles' and column_name in
      ('username','nickname','avatar_url','bio'))                                             as profiles_ok,
  (select count(*) from information_schema.columns
    where table_name = 'chat_members' and column_name in
      ('role','joined_at'))                                                                   as members_ok;
