-- ============================================================
--  WinChat — обновление 4: АДМИН-ПАНЕЛЬ
--  Бан, удаление, права, аудит, временный вход (impersonate)
--  Выполнить целиком в SQL Editor проекта Supabase.
--  Идемпотентная — безопасно запускать повторно.
-- ============================================================

-- ============================================================
--  1. КОЛОНКИ БАНОВ И АУДИТА В profiles
-- ============================================================
alter table public.profiles add column if not exists banned_at timestamptz;
alter table public.profiles add column if not exists ban_reason text;

-- Аудит-таблица: кто, что сделал над кем
create table if not exists public.admin_audit (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references public.profiles(id) on delete cascade,
  admin_username text not null,
  target_id   uuid not null,
  action      text not null,  -- 'ban' | 'unban' | 'delete' | 'verify' | 'unverify' | 'edit' | 'impersonate'
  details     text,           -- json-описание изменений
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_target_idx on public.admin_audit(target_id);
create index if not exists admin_audit_admin_idx  on public.admin_audit(admin_id);
create index if not exists admin_audit_created_idx on public.admin_audit(created_at desc);

-- ============================================================
--  2. ФУНКЦИЯ ПРОВЕРКИ БАННА (security definer — обходит RLS)
-- ============================================================
create or replace function public.check_banned(user_uuid uuid)
returns text  -- 'ok' | 'banned' | 'not_found'
language plpgsql
security definer set search_path = public
as $$
declare
  _banned_at timestamptz;
begin
  select banned_at into _banned_at
  from public.profiles where id = user_uuid;

  if _banned_at is null then
    return 'ok';
  else
    return 'banned';
  end if;
exception when others then
  return 'not_found';
end;
$$;

-- ============================================================
--  3. ФУНКЦИЯ ПРОВЕРКИ, ЯВЛЯЕТСЯ ЛИ ПОЛЬЗОВАТЕЛЬ АДМИНОМ
-- ============================================================
create or replace function public.is_admin(user_uuid uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  -- Админы: username = 'admin' (или любые из списка ниже)
  return exists (
    select 1 from public.profiles
    where id = user_uuid and lower(username) = 'admin'
  );
end;
$$;

-- ============================================================
--  4. БАН / РАЗБАН ПОЛЬЗОВАТЕЛЯ
--    Вызывает: select public.admin_ban('uuid_юзера', 'reason', true/false)
-- ============================================================
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
  -- Проверка авторизации
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

  -- Обновляем бан-статус
  update public.profiles
  set banned_at = case when do_ban then now() else null end,
      ban_reason = case when do_ban then reason else null end
  where id = target_uuid;

  -- Аудит
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

-- ============================================================
--  5. УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ (мягкое: бан + каскад через RLS)
--    Временное отключение каскада через SECURITY DEFINER
-- ============================================================
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

  -- Мягкое удаление: сначала баним, потом удаляем профиль
  update public.profiles set banned_at = now(), ban_reason = 'deleted_by_admin'
  where id = target_uuid;

  -- Каскад: ON DELETE CASCADE удалит чаты, члены, сообщения
  delete from public.profiles where id = target_uuid;

  -- Аудит
  insert into public.admin_audit (admin_id, admin_username, target_id, action, details)
  values (_admin_id, _admin_username, target_uuid, 'delete',
          jsonb_build_object('target_nickname', _target_nickname));

  return jsonb_build_object('ok', true, 'deleted', true);
end;
$$;

-- ============================================================
--  6. ИЗМЕНЕНИЕ ПРОФИЛЯ (никнейм, username, верификация)
--    Вызывает: select public.admin_edit_profile('uuid', 'new_nick', 'new_user', true)
-- ============================================================
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

  -- Аудит
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

-- ============================================================
--  7. ВРЕМЕННЫЙ ВХОД НА АККАУНТ (impersonate)
--    Вызывает: select public.admin_impersonate(target_uuid)
--    Возвращает: jsonb с { ok: true, target_id, target_username }
--
--    МЕХАНИЗМ (SQL-only):
--    1. Функция возвращает target_id
--    2. Клиент сохраняет target_id в localStorage
--    3. При следующих RPC-вызовах клиент передаёт _admin_override_id
--    4. Все операции (чтение/отправка) идут от имени целевого юзера
--    5. Кнопка "Выйти из админ-режима" сбрасывает override
--
--    Это НЕ полноценный вход под другим пользователем
--    (без service-role ключа JWT сгенерировать невозможно),
--    но позволяет видеть/редактировать чужие данные.
-- ============================================================
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

  -- Аудит
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

-- ============================================================
--  7b. ВЫХОД ИЗ АДМИН-РЕЖИМА (resign)
--    Вызывает: select public.admin_resign()
--    Возвращает: { ok: true }
--    Функция нужна для аудита выхода
-- ============================================================
create or replace function public.admin_resign()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  _admin_id uuid;
  _admin_username text;
begin
  _admin_id := auth.uid();
  if _admin_id is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  select username into _admin_username
    from public.profiles where id = _admin_id;

  insert into public.admin_audit (admin_id, admin_username, target_id, action, details)
  values (_admin_id, _admin_username, _admin_id, 'resign',
          jsonb_build_object('reason', 'admin clicked resign button'));

  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================
--  8. ПОЛУЧИТЬ СПИСОК ВСЕХ ПОЛЬЗОВАТЕЛЕЙ (с пагинацией)
--    Вызывает: select public.admin_get_users(page, per_page, search)
--    page/per_page — пагинация (по умолч: 1/50)
--    search — поиск по username/nickname (optional)
-- ============================================================
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
  _count integer;
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

-- ============================================================
--  9. ПОЛУЧИТЬ АУДИТ-ЛОГИ (кто что сделал)
--    Вызывает: select public.admin_get_audit(page, per_page)
-- ============================================================
create or replace function public.admin_get_audit(
  page integer default 1,
  per_page integer default 50
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  _admin_id uuid;
  _offset integer;
begin
  _admin_id := auth.uid();
  if _admin_id is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  if not public.is_admin(_admin_id) then
    return jsonb_build_object('error', 'not_admin');
  end if;

  _offset := (page - 1) * per_page;

  return (
    select jsonb_build_object(
      'audits', coalesce((
        select jsonb_agg(row_to_json(a))
        from (
          select aa.id, aa.admin_id, aa.admin_username, aa.target_id, aa.action, aa.details, aa.created_at,
                 p.nickname as target_nickname, p.username as target_username
          from public.admin_audit aa
          left join public.profiles p on p.id = aa.target_id
          order by aa.created_at desc
          limit per_page offset _offset
        ) a
      ), '[]'::jsonb),
      'total', (select count(*) from public.admin_audit),
      'page', page,
      'per_page', per_page
    )
  );
end;
$$;

-- ============================================================
--  10. REALTIME ДЛЯ АУДИТ-ЛОГОВ
-- ============================================================
alter table public.admin_audit replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.admin_audit;
exception when duplicate_object then
  null;
end $$;

-- ============================================================
--  11. RLS для admin_audit (читают только админы)
-- ============================================================
alter table public.admin_audit enable row level security;

drop policy if exists "admin_audit_select" on public.admin_audit;
create policy "admin_audit_select" on public.admin_audit
  for select using (public.is_admin(auth.uid()));

-- ============================================================
--  11. СТАТУС-ТАБЛИЦА ДЛЯ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
--     (нужна для проверки бана при входе в App)
-- ============================================================
-- Используем function public.check_banned() — уже создана выше.
-- В App.tsx мы будем вызывать её при загрузке.

-- ============================================================
--  ГОТОВО!
-- ============================================================
-- После выполнения этого скрипта:
-- 1. Все пользователи с username='admin' получают права админа
-- 2. Функции admin_ban, admin_edit_profile, admin_delete_user
--    доступны через RPC вызовы из клиента
-- 3. Функция admin_get_users возвращает список пользователей
-- 4. Функция admin_get_audit возвращает логи действий
-- 5. Функция check_banned проверяет забанен ли пользователь
