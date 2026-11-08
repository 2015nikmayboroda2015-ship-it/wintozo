-- ============================================================
--  WinChat Update 10 — OTA-обновления для Android
--  Проект БД: https://iksgubxxxspkjwsazrwq.supabase.co
--  Выполнить в Dashboard → SQL Editor → New query → Run
--
--  Схема работы:
--    1. Android-клиент при запуске шлёт статус устройства:
--       is_wintozo_web_true  — открыт как веб-страница (OTA не нужна)
--       is_wintozo_web_no    — нативное приложение (можно ставить APK)
--    2. Для нативного приложения клиент запрашивает версию
--       (get_wintozo_version / check_version) и winchat_search_ota.
--    3. Админ в терминале выполняет:
--         /set ota "https://.../app.apk" [версия] [@username|device_id|*]
--       и телефон получает ссылку на APK, которую можно установить
--       прямо из приложения.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Устройства, которые запускали приложение
-- ------------------------------------------------------------
create table if not exists public.winchat_devices (
  device_id       text primary key,
  is_wintozo_web  boolean not null default true,
  status          text not null default 'is_wintozo_web_true',
  platform        text,
  app_version     text,
  model           text,
  manufacturer    text,
  os_version      text,
  user_id         uuid references auth.users(id) on delete set null,
  first_seen      timestamptz not null default now(),
  last_seen       timestamptz not null default now()
);

-- На случай, если таблица уже создавалась без колонки status.
alter table public.winchat_devices
  add column if not exists status text not null default 'is_wintozo_web_true';

create index if not exists winchat_devices_last_seen_idx
  on public.winchat_devices (last_seen desc);

alter table public.winchat_devices enable row level security;

-- Прямого доступа у клиентов нет: только через security-definer RPC.
drop policy if exists "winchat_devices_no_direct_access" on public.winchat_devices;

-- ------------------------------------------------------------
-- 1b. Текущая OTA-настройка (одна строка, только через RPC)
-- ------------------------------------------------------------
create table if not exists public.winchat_ota (
  id         boolean primary key default true check (id),
  url        text not null,
  version    text,
  target     text,
  updated_at timestamptz not null default now()
);

alter table public.winchat_ota enable row level security;
drop policy if exists "winchat_ota_no_direct_access" on public.winchat_ota;

-- ------------------------------------------------------------
-- 2. RPC: отчёт устройства о себе при запуске
-- ------------------------------------------------------------
drop function if exists public.winchat_report_device(text, boolean, text, text, text, text, text);
create or replace function public.winchat_report_device(
  _device_id      text,
  _is_wintozo_web boolean,
  _platform       text default null,
  _app_version    text default null,
  _model          text default null,
  _manufacturer   text default null,
  _os_version     text default null
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _status text := case when coalesce(_is_wintozo_web, true)
                       then 'is_wintozo_web_true'
                       else 'is_wintozo_web_no' end;
begin
  if _device_id is null or length(trim(_device_id)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'Не указан device_id');
  end if;

  insert into public.winchat_devices (
    device_id, is_wintozo_web, status, platform, app_version,
    model, manufacturer, os_version, user_id, last_seen
  )
  values (
    left(trim(_device_id), 128),
    coalesce(_is_wintozo_web, true),
    _status,
    left(_platform, 32),
    left(_app_version, 32),
    left(_model, 128),
    left(_manufacturer, 128),
    left(_os_version, 64),
    _uid,
    now()
  )
  on conflict (device_id) do update set
    is_wintozo_web = coalesce(excluded.is_wintozo_web, public.winchat_devices.is_wintozo_web),
    status         = excluded.status,
    platform       = coalesce(excluded.platform, public.winchat_devices.platform),
    app_version    = coalesce(excluded.app_version, public.winchat_devices.app_version),
    model          = coalesce(excluded.model, public.winchat_devices.model),
    manufacturer   = coalesce(excluded.manufacturer, public.winchat_devices.manufacturer),
    os_version     = coalesce(excluded.os_version, public.winchat_devices.os_version),
    user_id        = coalesce(excluded.user_id, public.winchat_devices.user_id),
    last_seen      = now();

  return jsonb_build_object(
    'ok', true,
    'status', _status
  );
end;
$$;

grant execute on function public.winchat_report_device(text, boolean, text, text, text, text, text)
  to anon, authenticated;

-- ------------------------------------------------------------
-- 3. RPC: поиск OTA-обновления для устройства
-- ------------------------------------------------------------
-- Возвращает:
--   { ok: true, available: false }
--   { ok: true, available: true, url, version, target }
drop function if exists public.winchat_search_ota(text);
create or replace function public.winchat_search_ota(_device_id text)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  _url     text;
  _version text;
  _target  text;
  _allowed boolean := false;
begin
  select url, version, target into _url, _version, _target
    from public.winchat_ota
    where id = true;

  if _url is null or length(trim(_url)) = 0 then
    return jsonb_build_object('ok', true, 'available', false);
  end if;

  -- Без цели (NULL / пусто / *) обновление доступно всем.
  if _target is null or length(trim(_target)) = 0 or trim(_target) = '*' then
    _allowed := true;
  elsif _device_id is not null and trim(_target) = trim(_device_id) then
    _allowed := true;
  elsif left(trim(_target), 1) = '@' then
    -- Цель — username. Ищем, кому принадлежит это устройство.
    select exists (
      select 1
      from public.winchat_devices d
      join public.profiles p on p.id = d.user_id
      where d.device_id = _device_id
        and lower(p.username) = lower(replace(trim(_target), '@', ''))
    ) into _allowed;
  end if;

  if not _allowed then
    return jsonb_build_object('ok', true, 'available', false);
  end if;

  return jsonb_build_object(
    'ok', true,
    'available', true,
    'url', _url,
    'version', _version,
    'target', coalesce(nullif(trim(_target), ''), '*')
  );
end;
$$;

grant execute on function public.winchat_search_ota(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 4. RPC: check_version — понятный алиас для проверки версии
-- ------------------------------------------------------------
drop function if exists public.check_version();
create or replace function public.check_version()
returns text
language sql
stable
security definer set search_path = public
as $$
  select coalesce(
    (select value from public.app_settings where key = 'wintozo_version'),
    '3.0.0'
  );
$$;

grant execute on function public.check_version() to anon, authenticated;

-- ------------------------------------------------------------
-- 5. RPC: установить OTA (только admin)
-- ------------------------------------------------------------
drop function if exists public.set_winchat_ota(uuid, text, text, text);
create or replace function public.set_winchat_ota(
  _admin_id uuid,
  _url      text,
  _version  text default null,
  _target   text default null
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  _clean_url     text := nullif(trim(_url), '');
  _clean_version text := nullif(trim(_version), '');
  _clean_target  text := nullif(trim(_target), '');
begin
  if not exists (
    select 1 from public.profiles
    where id = _admin_id and lower(username) = 'admin'
  ) then
    return jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  end if;

  -- Пустая ссылка = отключить OTA.
  if _clean_url is null then
    delete from public.winchat_ota where id = true;
    return jsonb_build_object('ok', true, 'message', 'OTA-обновление отключено');
  end if;

  if _clean_url !~* '^https?://' or length(_clean_url) > 2048 then
    return jsonb_build_object(
      'ok', false,
      'error', 'Ссылка должна начинаться с http:// или https://'
    );
  end if;

  if _clean_version is not null
     and _clean_version !~ '^[0-9]+\.[0-9]+(\.[0-9]+)?$' then
    return jsonb_build_object('ok', false, 'error', 'Неверный формат версии. Пример: 3.1.0');
  end if;

  if _clean_target is not null
     and length(_clean_target) > 128 then
    return jsonb_build_object('ok', false, 'error', 'Слишком длинная цель (device_id / @username)');
  end if;

  insert into public.winchat_ota (id, url, version, target, updated_at)
  values (true, _clean_url, _clean_version, _clean_target, now())
  on conflict (id) do update set
    url        = excluded.url,
    version    = excluded.version,
    target     = excluded.target,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'message', 'OTA-обновление настроено',
    'url', _clean_url,
    'version', _clean_version,
    'target', coalesce(_clean_target, '*')
  );
end;
$$;

grant execute on function public.set_winchat_ota(uuid, text, text, text) to authenticated;

-- ------------------------------------------------------------
-- 6. RPC: посмотреть текущую OTA-настройку (только admin)
-- ------------------------------------------------------------
drop function if exists public.get_winchat_ota(uuid);
create or replace function public.get_winchat_ota(_admin_id uuid)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  _url     text;
  _version text;
  _target  text;
  _updated timestamptz;
begin
  if not exists (
    select 1 from public.profiles
    where id = _admin_id and lower(username) = 'admin'
  ) then
    return jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  end if;

  select url, version, target, updated_at into _url, _version, _target, _updated
    from public.winchat_ota
    where id = true;

  return jsonb_build_object(
    'ok', true,
    'url', _url,
    'version', _version,
    'target', coalesce(_target, '*'),
    'updated_at', _updated
  );
end;
$$;

grant execute on function public.get_winchat_ota(uuid) to authenticated;

-- ------------------------------------------------------------
-- 7. RPC: список устройств для админа (чтобы выбрать цель)
-- ------------------------------------------------------------
drop function if exists public.get_winchat_ota_devices(uuid, integer);
create or replace function public.get_winchat_ota_devices(
  _admin_id uuid,
  _limit    integer default 50
) returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  _devices jsonb;
begin
  if not exists (
    select 1 from public.profiles
    where id = _admin_id and lower(username) = 'admin'
  ) then
    return jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  end if;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  into _devices
  from (
    select
      d.device_id,
      d.is_wintozo_web,
      d.status,
      d.platform,
      d.app_version,
      d.model,
      d.manufacturer,
      d.os_version,
      d.last_seen,
      p.username
    from public.winchat_devices d
    left join public.profiles p on p.id = d.user_id
    order by d.last_seen desc
    limit greatest(1, least(coalesce(_limit, 50), 200))
  ) t;

  return jsonb_build_object('ok', true, 'devices', _devices);
end;
$$;

grant execute on function public.get_winchat_ota_devices(uuid, integer) to authenticated;
