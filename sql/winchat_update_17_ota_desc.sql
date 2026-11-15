-- =============================================================
-- WinChat update 17: описание OTA-обновления (пятый аргумент _desc)
-- ------------------------------------------------------------
-- Что делает:
--   1. Добавляет колонку winchat_ota.description (текст «что нового»).
--   2. Пересоздаёт set_winchat_ota с 5-м параметром _desc:
--        /set ota @user "https://…apk" 5.0.0 [@target|*] ["описание"]
--      Сигнатура: set_winchat_ota(uuid, text, text, text, text)
--      (старая 4-арговая версия удаляется — именно из-за неё терминал
--       получал «Could not find the function … in the schema cache»).
--   3. get_winchat_ota теперь возвращает и description.
--
-- Запускать в Supabase SQL Editor вручную.
-- =============================================================

-- ------------------------------------------------------------
-- 1. Колонка описания
-- ------------------------------------------------------------
alter table public.winchat_ota
  add column if not exists description text;

-- ------------------------------------------------------------
-- 2. RPC: установить/снять OTA (только admin) — с описанием
-- ------------------------------------------------------------
drop function if exists public.set_winchat_ota(uuid, text, text, text);
drop function if exists public.set_winchat_ota(uuid, text, text, text, text);
create or replace function public.set_winchat_ota(
  _admin_id uuid,
  _url      text,
  _version  text default null,
  _target   text default null,
  _desc     text default null
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  _clean_url     text := nullif(trim(_url), '');
  _clean_version text := nullif(trim(_version), '');
  _clean_target  text := nullif(trim(_target), '');
  _clean_desc    text := nullif(trim(_desc), '');
begin
  if not exists (
    select 1 from public.profiles
    where id = _admin_id and lower(username) = 'admin'
  ) then
    return jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  end if;

  if _clean_desc is not null and length(_clean_desc) > 500 then
    return jsonb_build_object('ok', false, 'error', 'Описание слишком длинное (макс. 500 символов)');
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

  -- Формат версии: X.Y / X.Y.Z + опциональный пререлиз (-beta) и сборка (+build).
  if _clean_version is not null
     and _clean_version !~ '^[0-9]+\.[0-9]+(\.[0-9]+)?(-[0-9A-Za-z][0-9A-Za-z.\-]*)?(\+[0-9A-Za-z.\-]+)?$'
  then
    return jsonb_build_object(
      'ok', false,
      'error', 'Неверный формат версии. Пример: 3.1.0 или 5.0.0-beta'
    );
  end if;

  if _clean_target is not null
     and length(_clean_target) > 128 then
    return jsonb_build_object('ok', false, 'error', 'Слишком длинная цель (device_id / @username)');
  end if;

  insert into public.winchat_ota (id, url, version, target, description, updated_at)
  values (true, _clean_url, _clean_version, _clean_target, _clean_desc, now())
  on conflict (id) do update set
    url         = excluded.url,
    version     = excluded.version,
    target      = excluded.target,
    description = excluded.description,
    updated_at  = now();

  return jsonb_build_object(
    'ok', true,
    'message', 'OTA-обновление настроено',
    'url', _clean_url,
    'version', _clean_version,
    'target', coalesce(_clean_target, '*'),
    'description', _clean_desc
  );
end;
$$;

grant execute on function public.set_winchat_ota(uuid, text, text, text, text) to authenticated;

-- ------------------------------------------------------------
-- 3. RPC: посмотреть текущую OTA-настройку (только admin)
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
  _desc    text;
  _updated timestamptz;
begin
  if not exists (
    select 1 from public.profiles
    where id = _admin_id and lower(username) = 'admin'
  ) then
    return jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  end if;

  select url, version, target, description, updated_at
    into _url, _version, _target, _desc, _updated
    from public.winchat_ota
    where id = true;

  return jsonb_build_object(
    'ok', true,
    'url', _url,
    'version', _version,
    'target', coalesce(_target, '*'),
    'description', _desc,
    'updated_at', _updated
  );
end;
$$;

grant execute on function public.get_winchat_ota(uuid) to authenticated;

-- =============================================================
-- Готово. Теперь можно:
--   /set ota @user "https://…/release%205.0.0.apk" 5.0.0
--   /get ota
-- =============================================================
