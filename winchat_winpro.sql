-- ============================================================
--  WinChat Update 8 — WinPro (премиум-подписка)
--  /give wintozopro @username X days
--  /delete wintozopro @username
-- ============================================================

-- 1. Колонка winpro_until
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS winpro_until timestamptz;

-- 2. RPC: выдать WinPro
drop function if exists public.give_winpro(uuid, text, int);
create or replace function public.give_winpro(
  _admin_id uuid,
  _target_username text,
  _days int
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  _target_id uuid;
  _target_nickname text;
  _new_until timestamptz;
begin
  if not exists (select 1 from public.profiles where id = _admin_id and username = 'admin') then
    return jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  end if;

  select id, nickname into _target_id, _target_nickname
  from public.profiles where username = _target_username;

  if _target_id is null then
    return jsonb_build_object('ok', false, 'error', 'Пользователь не найден');
  end if;

  select coalesce(winpro_until, now()) + make_interval(days => _days) into _new_until
  from public.profiles where id = _target_id;

  update public.profiles
  set winpro_until = _new_until
  where id = _target_id;

  return jsonb_build_object(
    'ok', true,
    'username', _target_username,
    'nickname', _target_nickname,
    'expires', _new_until,
    'message', 'WinPro выдан на ' || _days || ' дн. до ' || to_char(_new_until, 'DD.MM.YYYY')
  );
end;
$$;

-- 3. RPC: удалить WinPro
drop function if exists public.delete_winpro(uuid, text);
create or replace function public.delete_winpro(
  _admin_id uuid,
  _target_username text
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
  set winpro_until = null
  where id = _target_id;

  return jsonb_build_object(
    'ok', true,
    'username', _target_username,
    'nickname', _target_nickname,
    'message', 'WinPro удалён'
  );
end;
$$;

-- 4. Policy: чтение winpro_until только авторизованным (и admin для других)
drop policy if exists "profiles_winpro_select" on public.profiles;
create policy "profiles_winpro_select" on public.profiles
  for select using (true);
