-- ============================================================
--  WinChat — хотфикс: заполнение admin_username во всех RPC
--  Выполни в SQL Editor (заменяет функции с багом null).
-- ============================================================

-- 1. admin_ban
create or replace function public.admin_ban(
  target_uuid uuid,
  reason text,
  do_ban boolean
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  _admin_id uuid;
  _admin_username text;
  _target_nickname text;
begin
  _admin_id := auth.uid();
  if _admin_id is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  if not public.is_admin(_admin_id) then
    return jsonb_build_object('error', 'not_admin');
  end if;

  select username into _admin_username
    from public.profiles where id = _admin_id;

  select nickname into _target_nickname
    from public.profiles where id = target_uuid;

  update public.profiles
  set banned_at = case when do_ban then now() else null end,
      ban_reason = case when do_ban then reason else null end
  where id = target_uuid;

  insert into public.admin_audit (admin_id, admin_username, target_id, action, details)
  values (_admin_id, _admin_username, target_uuid,
          case when do_ban then 'ban' else 'unban' end,
          jsonb_build_object('reason', reason, 'target_nickname', _target_nickname));

  return jsonb_build_object(
    'ok', true,
    'banned_at', case when do_ban then now() else null end,
    'ban_reason', case when do_ban then reason else null end
  );
end;
$$;

-- 2. admin_delete_user
create or replace function public.admin_delete_user(target_uuid uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  _admin_id uuid;
  _admin_username text;
  _target_nickname text;
begin
  _admin_id := auth.uid();
  if _admin_id is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  if not public.is_admin(_admin_id) then
    return jsonb_build_object('error', 'not_admin');
  end if;

  select username into _admin_username
    from public.profiles where id = _admin_id;

  select nickname into _target_nickname
    from public.profiles where id = target_uuid;

  update public.profiles set banned_at = now(), ban_reason = 'deleted_by_admin'
  where id = target_uuid;

  delete from public.profiles where id = target_uuid;

  insert into public.admin_audit (admin_id, admin_username, target_id, action, details)
  values (_admin_id, _admin_username, target_uuid, 'delete',
          jsonb_build_object('target_nickname', _target_nickname));

  return jsonb_build_object('ok', true, 'deleted', true);
end;
$$;

-- 3. admin_edit_profile
create or replace function public.admin_edit_profile(
  target_uuid uuid,
  new_nickname text,
  new_username text,
  new_verified boolean
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  _admin_id uuid;
  _admin_username text;
  _old_nick text;
  _old_user text;
  _old_ver boolean;
begin
  _admin_id := auth.uid();
  if _admin_id is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  if not public.is_admin(_admin_id) then
    return jsonb_build_object('error', 'not_admin');
  end if;

  select username into _admin_username
    from public.profiles where id = _admin_id;

  select username, nickname, verified
    into _old_user, _old_nick, _old_ver
    from public.profiles where id = target_uuid;

  update public.profiles
  set nickname = coalesce(nullif(trim(new_nickname), ''), nickname),
      username = coalesce(nullif(trim(lower(new_username)), ''), username),
      verified = coalesce(new_verified, verified)
  where id = target_uuid;

  insert into public.admin_audit (admin_id, admin_username, target_id, action, details)
  values (_admin_id, _admin_username, target_uuid, 'edit',
          jsonb_build_object(
            'old_nickname', _old_nick, 'new_nickname', new_nickname,
            'old_username', _old_user, 'new_username', new_username,
            'old_verified', _old_ver, 'new_verified', new_verified
          ));

  return jsonb_build_object('ok', true);
end;
$$;

-- 4. admin_impersonate
create or replace function public.admin_impersonate(target_uuid uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  _admin_id uuid;
  _admin_username text;
  _target_nickname text;
  _target_username text;
begin
  _admin_id := auth.uid();
  if _admin_id is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  if not public.is_admin(_admin_id) then
    return jsonb_build_object('error', 'not_admin');
  end if;

  select username into _admin_username
    from public.profiles where id = _admin_id;

  select nickname, username
    into _target_nickname, _target_username
    from public.profiles where id = target_uuid;

  if _target_nickname is null then
    return jsonb_build_object('error', 'target_not_found');
  end if;

  if (select banned_at is not null from public.profiles where id = target_uuid) then
    return jsonb_build_object('error', 'target_banned');
  end if;

  insert into public.admin_audit (admin_id, admin_username, target_id, action, details)
  values (_admin_id, _admin_username, target_uuid, 'impersonate',
          jsonb_build_object('target_nickname', _target_nickname, 'target_username', _target_username));

  return jsonb_build_object(
    'ok', true,
    'target_id', target_uuid,
    'target_nickname', _target_nickname,
    'target_username', _target_username
  );
end;
$$;

-- 5. admin_get_users (fix: total alias)
create or replace function public.admin_get_users(
  page integer default 1,
  per_page integer default 50,
  search text default ''
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  _admin_id uuid;
  _offset integer;
  _users jsonb;
begin
  _admin_id := auth.uid();
  if _admin_id is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  if not public.is_admin(_admin_id) then
    return jsonb_build_object('error', 'not_admin');
  end if;

  _offset := (page - 1) * per_page;

  with filtered as (
    select id, username, nickname, avatar_url, bio, verified,
           banned_at, ban_reason, created_at
    from public.profiles
    where (search = '' or
           username ilike ('%' || search || '%') or
           nickname ilike ('%' || search || '%'))
  ),
  paginated as (
    select * from filtered
    order by created_at desc
    limit per_page offset _offset
  ),
  total_count as (
    select count(*) as total from filtered
  )
  select jsonb_build_object(
    'users', coalesce((select jsonb_agg(row_to_json(p)) from paginated p), '[]'::jsonb),
    'total', (select total from total_count),
    'page', page,
    'per_page', per_page,
    'total_pages', ceil((select total from total_count)::numeric / per_page::numeric)
  ) into _users;

  return _users;
end;
$$;
