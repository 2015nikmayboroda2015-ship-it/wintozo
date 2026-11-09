-- ============================================================
--  WinChat Update 12 — Cleanup (release-winchat.js)
--  /release-cleanup через RPC: удаляются чаты и сообщения,
--  кроме группы _kept_group_id и кроме бакета avatars.
-- ============================================================

create or replace function public.release_cleanup(
  _admin_id uuid,
  _kept_group_id text
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = _admin_id and username = 'admin') then
    return jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  end if;

  delete from public.messages where chat_id <> _kept_group_id;
  delete from public.chat_members where chat_id <> _kept_group_id;
  delete from public.chats where id <> _kept_group_id;

  return jsonb_build_object(
    'ok', true,
    'kept_group_id', _kept_group_id,
    'deleted_messages', true,
    'deleted_chats', true
  );
end;
$$;
