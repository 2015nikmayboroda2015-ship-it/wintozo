-- =============================================================
-- WinChat update 14: поддержки пререлизных версий (например 4.0.0-beta)
-- ------------------------------------------------------------
-- Что делает:
--   1. Ослабляет проверку формата версии в set_wintozo_version
--      (winchat_update_9.sql разрешал только X.Y / X.Y.Z)
--      → теперь можно суффикс пререлиза: 4.0.0-beta, 4.0.0-rc.1
--      и суффикс сборки: 4.0.0-beta+build123
--   2. Ослабляет такую же проверку в set_winchat_ota
--      (winchat_update_10_ota.sql).
--
-- Формат:  X.Y / X.Y.Z  +  опционально  -пререлиз  +  опционально  +сборка
--   пререлиз: буквы/цифры/точки/дефисы (alpha, beta, beta.1, rc1 …)
--   сборка:   буквы/цифры/точки/дефисы
--
-- Запускать в Supabase SQL Editor вручную.
-- =============================================================

-- ------------------------------------------------------------
-- 1. RPC: установить версию (только admin) — с пререлизами
-- ------------------------------------------------------------
drop function if exists public.set_wintozo_version(uuid, text);
create or replace function public.set_wintozo_version(
  _admin_id uuid,
  _version  text
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  _nickname text;
begin
  if not exists (select 1 from public.profiles where id = _admin_id and username = 'admin') then
    return jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  end if;

  -- X.Y / X.Y.Z + опциональный пререлиз -beta… и сборка +build…
  if _version is null
     or trim(_version) !~ '^[0-9]+\.[0-9]+(\.[0-9]+)?(-[0-9A-Za-z][0-9A-Za-z.\-]*)?(\+[0-9A-Za-z.\-]+)?$'
  then
    return jsonb_build_object(
      'ok', false,
      'error', 'Неверный формат версии. Пример: 3.0.1 или 4.0.0-beta'
    );
  end if;

  insert into public.app_settings (key, value, updated_at)
  values ('wintozo_version', trim(_version), now())
  on conflict (key)
  do update set value = trim(_version), updated_at = now();

  select nickname into _nickname from public.profiles where id = _admin_id;

  return jsonb_build_object(
    'ok', true,
    'version', trim(_version),
    'message', 'Версия обновлена на ' || trim(_version)
  );
end;
$$;

grant execute on function public.set_wintozo_version(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 2. RPC: установить OTA (только admin) — версия с пререлизом
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

  -- Тот же формат: X.Y.Z + опциональный пререлиз и сборка.
  if _clean_version is not null
     and _clean_version !~ '^[0-9]+\.[0-9]+(\.[0-9]+)?(-[0-9A-Za-z][0-9A-Za-z.\-]*)?(\+[0-9A-Za-z.\-]+)?$'
  then
    return jsonb_build_object(
      'ok', false,
      'error', 'Неверный формат версии. Пример: 3.1.0 или 4.0.0-beta'
    );
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

-- =============================================================
-- Готово. Теперь можно: /set version 4.0.0-beta
-- и /set ota "https://…apk" 4.0.0-beta
-- =============================================================
