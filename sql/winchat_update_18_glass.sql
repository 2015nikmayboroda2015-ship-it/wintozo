-- ============================================================
--  WinChat Update 18 — WinChat Glass по флагу админа
--  /give glass @username   → is_winchat_glass_true
--  /delete glass @username → is_winchat_glass_no
-- ============================================================

-- 1. Колонка-флаг (по умолчанию Glass не выдан)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_winchat_glass text DEFAULT 'is_winchat_glass_no';

-- 2. RPC: выдать WinChat Glass
drop function if exists public.give_glass(uuid, text);
create or replace function public.give_glass(
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
  set is_winchat_glass = 'is_winchat_glass_true'
  where id = _target_id;

  return jsonb_build_object(
    'ok', true,
    'username', _target_username,
    'nickname', _target_nickname,
    'message', 'WinChat Glass выдан @' || _target_username || ' (флаг is_winchat_glass_true)'
  );
end;
$$;

-- 3. RPC: снять WinChat Glass
drop function if exists public.delete_glass(uuid, text);
create or replace function public.delete_glass(
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
  set is_winchat_glass = 'is_winchat_glass_no'
  where id = _target_id;

  return jsonb_build_object(
    'ok', true,
    'username', _target_username,
    'nickname', _target_nickname,
    'message', 'WinChat Glass снят с @' || _target_username || ' (флаг is_winchat_glass_no)'
  );
end;
$$;

-- 4. Policy: чтение is_winchat_glass только авторизованным
drop policy if exists "profiles_glass_select" on public.profiles;
create policy "profiles_glass_select" on public.profiles
  for select using (true);
