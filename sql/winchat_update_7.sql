-- ============================================================
--  WinChat Update 7 — WinPass (код восстановления аккаунта)
--  Формат: 33b42-XXXXXXXXXXXX
--  Выполнить в СТАРОМ проекте (iksgubxxxspkjwsazrwq):
--  Dashboard → SQL Editor → New query → вставить целиком → Run
-- ============================================================

-- 1. Колонка winpass в profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS winpass TEXT UNIQUE;

-- 2. Хелпер:сгенерировать уникальный WinPass (вызывается из триггера и RPC)
create or replace function public.generate_winpass()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  candidate text;
begin
  loop
    -- Формат: 33b42-XXXXXXXXXXXX, где X — строчные hex-символы
    candidate := '33b42-' || substr(
      md5(random()::text || clock_timestamp()::text),
      1, 12
    );
    exit when not exists (select 1 from public.profiles where winpass = candidate);
  end loop;
  return candidate;
end;
$$;

-- 2.5 Перевыдать WinPass всем аккаунтам в старом формате (заглавные hex)
do $$
declare
  r record;
begin
  for r in select id from public.profiles where winpass is not null and winpass <> lower(winpass) loop
    update public.profiles set winpass = public.generate_winpass() where id = r.id;
  end loop;
end $$;

-- 3. Выдать WinPass всем существующим аккаунтам без него
do $$
declare
  r record;
begin
  for r in select id from public.profiles where winpass is null loop
    update public.profiles set winpass = public.generate_winpass() where id = r.id;
  end loop;
end $$;

-- 4. Обновить триггер handle_new_user: профиль сразу получает winpass
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, nickname, winpass)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data ->> 'username', 'user_' || left(new.id::text, 6))),
    coalesce(new.raw_user_meta_data ->> 'nickname', 'Пользователь'),
    public.generate_winpass()
  );
  return new;
end;
$$;

-- 5. RPC: получить свой WinPass (для экрана настроек)
drop function if exists public.get_my_winpass(uuid);
create or replace function public.get_my_winpass(_user_id uuid)
returns text
language sql
security definer stable set search_path = public
as $$
  select winpass from public.profiles where id = _user_id;
$$;

-- 6. RPC: смена WinPass (сброс кода)
drop function if exists public.regenerate_winpass(uuid);
create or replace function public.regenerate_winpass(_user_id uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  new_code text;
begin
  new_code := public.generate_winpass();
  update public.profiles set winpass = new_code where id = _user_id;
  return new_code;
end;
$$;

-- 7. RPC для админ-терминала: /get winpass <username>
drop function if exists public(admin_get_winpass(uuid, text));
create or replace function public.admin_get_winpass(_admin_id uuid, _target_username text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  _winpass text;
  _nickname text;
begin
  if not exists (select 1 from public.profiles where id = _admin_id and username = 'admin') then
    return jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  end if;

  select winpass, nickname into _winpass, _nickname
  from public.profiles where username = _target_username;

  if _nickname is null then
    return jsonb_build_object('ok', false, 'error', 'Пользователь не найден');
  end if;

  return jsonb_build_object(
    'ok', true,
    'username', _target_username,
    'nickname', _nickname,
    'winpass', _winpass
  );
end;
$$;

-- 8. RPC: вход по WinPass — проверяет код и выдаёт временный пароль,
--    которым клиент сразу signInWithPassword'ится через Supabase Auth.
--    SECURITY DEFINER + owner postgres имеет полный доступ к auth.users.
drop function if exists public.login_by_winpass(text);

-- pgcrypto нужен для crypt/gen_salt (установка хеша пароля)
create extension if not exists pgcrypto with schema extensions;

create or replace function public.login_by_winpass(_winpass text)
returns jsonb
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  _uid uuid;
  _username text;
  _nickname text;
  temp_pw text;
begin
  if _winpass is null or _winpass = '' then
    return jsonb_build_object('ok', false, 'error', 'WinPass не указан');
  end if;

  select id, username, nickname into _uid, _username, _nickname
  from public.profiles
  where winpass = lower(trim(_winpass));

  if _uid is null then
    return jsonb_build_object('ok', false, 'error', 'Неверный WinPass');
  end if;

  -- Проверка бана
  if exists (select 1 from public.profiles where id = _uid and banned_at is not null) then
    return jsonb_build_object('ok', false, 'error', 'Аккаунт заблокирован');
  end if;

  -- Уникальный временный пароль (требования GoTrue: минимум 6 символов, буквы)
  temp_pw := substr(md5(random()::text || clock_timestamp()::text), 1, 12) || 'aB';

  -- Ставим новый bcrypt-хеш пароля прямо в auth.users
  begin
    update auth.users
    set encrypted_password = crypt(temp_pw, gen_salt('bf')),
        updated_at = now()
    where id = _uid;
  exception when undefined_function or invalid_schema_name then
    return jsonb_build_object(
      'ok', false,
      'error', 'pgcrypto не установлен. Выполните CREATE EXTENSION pgcrypto;',
      'hint', SQLERRM,
      'user_id', _uid
    );
  when insufficient_privilege then
    return jsonb_build_object(
      'ok', false,
      'error', 'Нет прав на обновление пароля (service_role)',
      'hint', 'TRIGGER SECURITY DEFINER + owner postgres должен иметь доступ к auth.users',
      'user_id', _uid
    );
  end;

  return jsonb_build_object(
    'ok', true,
    'user_id', _uid,
    'username', _username,
    'nickname', _nickname,
    'temp_password', temp_pw
  );
end;
$$;

-- ============================================================

-- ============================================================
