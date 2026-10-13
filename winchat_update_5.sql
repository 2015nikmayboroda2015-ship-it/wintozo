-- ============================================================
--  WinChat — обновление 5: ВИДЕОКРУЖКИ
--  Выполнить в SQL Editor проекта Supabase.
--  Идемпотентная.
-- ============================================================

-- 1. КОЛОНКИ ВИДЕО В messages
alter table public.messages add column if not exists video_url      text;
alter table public.messages add column if not exists video_duration integer;

-- 2. CONSTRAINT: сообщение должно содержать хоть что-то
--    (теперь включает video_url)
alter table public.messages drop constraint if exists messages_not_empty;
alter table public.messages add  constraint messages_not_empty
  check (
    content is not null or
    image_url is not null or
    audio_url is not null or
    video_url is not null
  );

-- 3. STORAGE: бакет video-attachments (отдельный от audio/image)
insert into storage.buckets (id, name, public)
values ('video-attachments', 'video-attachments', true)
on conflict (id) do nothing;

-- политика: все читают, авторизованные загружают
drop policy if exists "video_attachments_read" on storage.objects;
create policy "video_attachments_read" on storage.objects
  for select using (bucket_id = 'video-attachments');

drop policy if exists "video_attachments_insert" on storage.objects;
create policy "video_attachments_insert" on storage.objects
  for insert with check (bucket_id = 'video-attachments' and auth.role() = 'authenticated');
