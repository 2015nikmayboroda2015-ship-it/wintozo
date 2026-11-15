-- ============================================================
--  WinChat Update 19 — OOBE назначенной версии
--  /set oobe @username "5.0" → profiles.oobe_version = '5.0'
--    (при следующем входе пользователю покажется OOBE 5.0)
--  /set oobe @username "6.0" → profiles.oobe_version = '6.0'
--  /set oobe @username off   → profiles.oobe_version = null
--    (обычная логика OOBE)
-- ============================================================

-- 1. Колонка: какая версия OOBE назначена пользователю (null — обычная логика)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS oobe_version text;

-- 2. RPC: назначить (или снять) версию OOBE пользователю
drop function if exists public.set_oobe(uuid, text, text);
create or replace function public.set_oobe(
  _admin_id uuid,
  _target_username text,
  _version text
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  _target_id uuid;
  _target_nickname text;
begin
  if not exists (select 1 from public.profiles where id = _admin_id and username = 'admin') then
    return jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  end if;

  select id, nickname into _target_id, _target_nickname
  from public.profiles where username = _target_username;

  if _target_id is null then
    return jsonb_build_object('ok', false, 'error', 'Пользователь не найден');
  end if;

  update public.profiles
  set oobe_version = _version
  where id = _target_id;

  if _version is null or _version = '' then
    return jsonb_build_object(
      'ok', true,
      'username', _target_username,
      'nickname', _target_nickname,
      'message', 'OOBE версии снята с @' || _target_username || ' — вернётся обычная логика'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'username', _target_username,
    'nickname', _target_nickname,
    'message', 'OOBE версии ' || _version || ' назначена @' || _target_username || ' — покажется при следующем входе'
  );
end;
$$;
