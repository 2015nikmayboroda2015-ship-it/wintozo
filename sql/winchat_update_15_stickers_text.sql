-- ============================================================
--  WinChat: стикеры — ЧАСТЬ 1 из 2
--  ТЕКСТОВЫЙ СЕРВЕР (основная база WinChat: iksgubxxxspkjwsazrwq)
--
--  Выполнить в SQL Editor проекта iksgubxxxspkjwsazrwq.
--  Часть 2 (sticker-сервер) лежит в отдельном файле:
--    sql/winchat_update_15_stickers_server.sql
-- ============================================================

-- Храним только ссылку на стикер/GIF, сам файл лежит на sticker-сервере.
alter table public.messages
  add column if not exists sticker_url text;

-- Сообщение может состоять только из стикера (без текста/фото/видео).
alter table public.messages drop constraint if exists messages_not_empty;
alter table public.messages add constraint messages_not_empty
  check (
    content is not null or
    image_url is not null or
    sticker_url is not null or
    audio_url is not null or
    video_url is not null
  );

-- Быстрый поиск сообщений со стикерами (не обязательно, но полезно).
create index if not exists messages_sticker_idx
  on public.messages(chat_id, created_at)
  where sticker_url is not null;

-- Проверка (должна вернуть 1 строку):
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'messages'
--   and column_name = 'sticker_url';
