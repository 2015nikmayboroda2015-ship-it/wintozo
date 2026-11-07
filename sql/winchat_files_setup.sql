-- ============================================================
--  WinChat — настройка ФАЙЛОВОГО проекта Supabase
--  Проект: https://liprykmtennsmjtfpbuw.supabase.co
--  Dashboard → SQL Editor → New query → вставить целиком → Run
--  (выполнять именно В НОВОМ файловом проекте!)
-- ============================================================

-- 1. Бакеты для файлов (публичные на чтение)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('video-attachments', 'video-attachments', true)
on conflict (id) do nothing;

-- 2. Политики: любой может читать публичные файлы
drop policy if exists "files_read" on storage.objects;
create policy "files_read" on storage.objects
  for select using (bucket_id in ('avatars', 'attachments', 'video-attachments'));

-- 3. Политики: загружать могут только авторизованные этого проекта.
--    ВАЖНО: пользователи WinChat авторизуются в СТАРОМ проекте,
--    поэтому здесь разрешаем загрузку по anon/service ключу любому
--    аутентифицированному запросу (включая anon = «public» uploads).
drop policy if exists "files_insert" on storage.objects;
create policy "files_insert" on storage.objects
  for insert with check (
    bucket_id in ('avatars', 'attachments', 'video-attachments')
  );

drop policy if exists "files_update" on storage.objects;
create policy "files_update" on storage.objects
  for update using (
    bucket_id in ('avatars', 'attachments', 'video-attachments')
  );

drop policy if exists "files_delete" on storage.objects;
create policy "files_delete" on storage.objects
  for delete using (
    bucket_id in ('avatars', 'attachments', 'video-attachments')
  );

-- ============================================================
--  Готово. Проверить: Storage → должны быть 3 бакета,
--  каждый с пометкой Public.
-- ============================================================
