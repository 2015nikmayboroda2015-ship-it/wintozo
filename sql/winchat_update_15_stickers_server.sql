-- ============================================================
--  WinChat: стикеры — ЧАСТЬ 2 из 2
--  STICKER-СЕРВЕР (qscgbkwmbprzbwciyemh)
--
--  Выполнить в SQL Editor проекта qscgbkwmbprzbwciyemh.
--  Создаёт bucket, таблицы паков/стикеров и политики доступа.
--
--  Часть 1 (текстовая база) лежит в отдельном файле:
--    sql/winchat_update_15_stickers_text.sql
-- ============================================================

-- ------------------------------------------------------------
--  Bucket для файлов стикеров и GIF
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stickers',
  'stickers',
  true,
  10485760, -- 10 МБ на стикер
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Чтение стикеров — всем (они публичные).
drop policy if exists "stickers_public_read" on storage.objects;
create policy "stickers_public_read" on storage.objects
  for select
  using (bucket_id = 'stickers');

-- Загрузка — клиенту приложения (anon publishable key) и авторизованным.
-- Приложение грузит стикеры на отдельный сервер без входа в него,
-- поэтому insert разрешён роли anon.
drop policy if exists "stickers_anon_insert" on storage.objects;
create policy "stickers_anon_insert" on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'stickers');

-- Перезапись/удаление из приложения не используются.
drop policy if exists "stickers_anon_update" on storage.objects;
create policy "stickers_anon_update" on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'stickers')
  with check (bucket_id = 'stickers');

drop policy if exists "stickers_anon_delete" on storage.objects;
create policy "stickers_anon_delete" on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'stickers');

-- ------------------------------------------------------------
--  Паки стикеров и стикеры внутри них
--  owner_id — это id пользователя из ОСНОВНОЙ базы WinChat.
--  На sticker-сервере нет входа в аккаунт, поэтому доступ
--  разрешён anon publishable-ключу приложения.
-- ------------------------------------------------------------

create table if not exists public.sticker_packs (
  id          uuid primary key default gen_random_uuid(),
  owner_id    text not null,
  name        text not null,
  cover_url   text,
  is_public   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists sticker_packs_owner_idx
  on public.sticker_packs(owner_id, created_at);

create table if not exists public.sticker_items (
  id          uuid primary key default gen_random_uuid(),
  pack_id     uuid not null references public.sticker_packs(id) on delete cascade,
  owner_id    text not null,
  url         text not null,
  created_at  timestamptz not null default now()
);

create index if not exists sticker_items_pack_idx
  on public.sticker_items(pack_id, created_at);

-- Один и тот же стикер не дублируется в одном паке.
create unique index if not exists sticker_items_unique_url
  on public.sticker_items(pack_id, url);

alter table public.sticker_packs enable row level security;
alter table public.sticker_items enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.sticker_packs to anon, authenticated;
grant select, insert, update, delete on public.sticker_items to anon, authenticated;

drop policy if exists "sticker_packs_read" on public.sticker_packs;
create policy "sticker_packs_read" on public.sticker_packs
  for select to anon, authenticated using (true);

drop policy if exists "sticker_packs_insert" on public.sticker_packs;
create policy "sticker_packs_insert" on public.sticker_packs
  for insert to anon, authenticated with check (true);

drop policy if exists "sticker_packs_update" on public.sticker_packs;
create policy "sticker_packs_update" on public.sticker_packs
  for update to anon, authenticated using (true) with check (true);

drop policy if exists "sticker_packs_delete" on public.sticker_packs;
create policy "sticker_packs_delete" on public.sticker_packs
  for delete to anon, authenticated using (true);

drop policy if exists "sticker_items_read" on public.sticker_items;
create policy "sticker_items_read" on public.sticker_items
  for select to anon, authenticated using (true);

drop policy if exists "sticker_items_insert" on public.sticker_items;
create policy "sticker_items_insert" on public.sticker_items
  for insert to anon, authenticated with check (true);

drop policy if exists "sticker_items_delete" on public.sticker_items;
create policy "sticker_items_delete" on public.sticker_items
  for delete to anon, authenticated using (true);

-- Проверка bucket:
-- select id, name, public, file_size_limit from storage.buckets where id = 'stickers';

-- Обновляем кэш схемы PostgREST, чтобы /rest/v1/sticker_packs и
-- /rest/v1/sticker_items сразу стали доступны (иначе будет 404).
notify pgrst, 'reload schema';
