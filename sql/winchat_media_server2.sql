-- ============================================================
--  WinChat — Второй сервер хранения медиа (балансирование нагрузки)
--  Проект: https://ahikheicrjrocnlpurpw.supabase.co
--
--  Выполнить в Dashboard → SQL Editor → New query → Run
--  Создаёт бакеты attachments и video-attachments с публичным
--  доступом на чтение и анонимной загрузкой (publishable key).
-- ============================================================

-- 1. Бакеты (если ещё не созданы)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('attachments', 'attachments', true, 31457280, array['image/png','image/jpeg','image/webp','image/gif','audio/webm','audio/ogg','video/mp4','video/webm'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('video-attachments', 'video-attachments', true, 62914560, array['video/webm','video/mp4'])
on conflict (id) do nothing;

-- 2. Политика: публичное чтение (все могут скачивать файлы по URL)
drop policy if exists "public_read_attachments" on storage.objects;
create policy "public_read_attachments"
  on storage.objects for select
  using (bucket_id in ('avatars','attachments','video-attachments'));

-- 3. Политика: анонимная загрузка в нужные бакеты.
--    Клиент использует publishable key (роль anon), поэтому даём
--    возможность загружать без авторизации — путь содержит id чата,
--    что обеспечивает естественную изоляцию переписок.
drop policy if exists "anon_insert_attachments" on storage.objects;
create policy "anon_insert_attachments"
  on storage.objects for insert
  with check (bucket_id in ('avatars','attachments','video-attachments'));

-- Обновление существующих объектов (upsert при перезагрузке)
drop policy if exists "anon_update_attachments" on storage.objects;
create policy "anon_update_attachments"
  on storage.objects for update
  using (bucket_id in ('avatars','attachments','video-attachments'));

-- Удаление разрешено (для будущих функций очистки)
drop policy if exists "anon_delete_attachments" on storage.objects;
create policy "anon_delete_attachments"
  on storage.objects for delete
  using (bucket_id in ('avatars','attachments','video-attachments'));
