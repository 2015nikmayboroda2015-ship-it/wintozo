-- ============================================================
--  WinChat v2.0.4.12 — полная установка базы данных Supabase
--  Dashboard → SQL Editor → New query → вставить целиком → Run
-- ============================================================

-- 1. ПРОФИЛИ ----------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null unique,
  nickname   text not null,
  avatar_url text,
  bio        text,                        -- описание «о себе»
  created_at timestamptz not null default now()
);

-- 2. ЧАТЫ (личные и группы) -------------------------------------
create table if not exists public.chats (
  id          uuid primary key default gen_random_uuid(),
  direct_key  text unique,                -- "uuidA:uuidB" для личных чатов, NULL для групп
  is_group    boolean not null default false,
  title       text,                       -- название группы
  description text,                       -- описание группы
  avatar_url  text,                       -- обложка группы
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3. УЧАСТНИКИ ЧАТОВ --------------------------------------------
create table if not exists public.chat_members (
  chat_id   uuid not null references public.chats(id)    on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null default 'member',   -- 'owner' | 'member'
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

-- 4. СООБЩЕНИЯ (текст, фото, голосовые) -------------------------
create table if not exists public.messages (
  id             uuid primary key default gen_random_uuid(),
  chat_id        uuid not null references public.chats(id)    on delete cascade,
  sender_id      uuid not null references public.profiles(id) on delete cascade,
  content        text,
  image_url      text,
  audio_url      text,      -- голосовое сообщение
  audio_duration integer,   -- длительность в секундах
  created_at     timestamptz not null default now()
);

create index if not exists messages_chat_idx       on public.messages(chat_id, created_at);
create index if not exists chat_members_user_idx   on public.chat_members(user_id);
create index if not exists profiles_username_idx   on public.profiles(username);

-- 5. ТРИГГЕР: профиль создаётся автоматически при регистрации --
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, nickname)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data ->> 'username', 'user_' || left(new.id::text, 6))),
    coalesce(new.raw_user_meta_data ->> 'nickname', 'Пользователь')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6. ТРИГГЕР: updated_at чата при новом сообщении ---------------
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

-- 7. ХЕЛПЕР: проверка членства в чате (обходит RLS, без рекурсии)
create or replace function public.is_chat_member(chat_uuid uuid)
returns boolean
language sql
security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.chat_members
    where chat_id = chat_uuid and user_id = auth.uid()
  );
$$;

-- 8. ROW LEVEL SECURITY -----------------------------------------
alter table public.profiles     enable row level security;
alter table public.chats        enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages     enable row level security;

-- profiles: каталог пользователей читают все, менять можно только себя
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (true);

drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- chats: видны только участникам, создавать может любой авторизованный
drop policy if exists "chats_select" on public.chats;
create policy "chats_select" on public.chats
  for select using (public.is_chat_member(id));

drop policy if exists "chats_insert" on public.chats;
create policy "chats_insert" on public.chats
  for insert with check (auth.uid() is not null);

-- владелец группы редактирует название, описание и обложку
drop policy if exists "chats_update" on public.chats;
create policy "chats_update" on public.chats
  for update
  using (created_by = auth.uid() and is_group = true)
  with check (created_by = auth.uid() and is_group = true);

-- chat_members: участников видят участники, добавлять — себя или в свой чат
drop policy if exists "chat_members_select" on public.chat_members;
create policy "chat_members_select" on public.chat_members
  for select using (user_id = auth.uid() or public.is_chat_member(chat_id));

drop policy if exists "chat_members_insert" on public.chat_members;
create policy "chat_members_insert" on public.chat_members
  for insert with check (user_id = auth.uid() or public.is_chat_member(chat_id));

-- messages: читают и пишут только участники, удалять — только свои
drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages
  for select using (public.is_chat_member(chat_id));

drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages
  for insert with check (sender_id = auth.uid() and public.is_chat_member(chat_id));

drop policy if exists "messages_delete" on public.messages;
create policy "messages_delete" on public.messages
  for delete using (sender_id = auth.uid());

-- участник может покинуть чат (удалить свою запись)
drop policy if exists "chat_members_delete" on public.chat_members;
create policy "chat_members_delete" on public.chat_members
  for delete using (user_id = auth.uid());

-- чаты рассылают обновления (переименование группы и т.п.)
alter table public.chats replica identity full;

-- 9. REALTIME ----------------------------------------------------
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

-- 10. STORAGE: бакеты avatars и attachments ----------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- avatars: читают все, пишут авторизованные, удалять — только свою папку
drop policy if exists "avatars_read" on storage.objects;
create policy "avatars_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_insert" on storage.objects;
create policy "avatars_insert" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_update" on storage.objects
  for update using (bucket_id = 'avatars' and auth.role() = 'authenticated');

drop policy if exists "avatars_delete" on storage.objects;
create policy "avatars_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- attachments: читают все, загружают авторизованные
drop policy if exists "attachments_read" on storage.objects;
create policy "attachments_read" on storage.objects
  for select using (bucket_id = 'attachments');

drop policy if exists "attachments_insert" on storage.objects;
create policy "attachments_insert" on storage.objects
  for insert with check (bucket_id = 'attachments' and auth.role() = 'authenticated');

-- ============================================================
--  ВАЖНО после выполнения:
--  Authentication → Sign In / Providers → Email →
--  выключите «Confirm email» (используются синтетические адреса
--  вида username@winchat.app), Save. Готово — можно входить.
-- ============================================================
