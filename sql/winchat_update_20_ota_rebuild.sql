-- =============================================================
-- WinChat update 20: пересборка APK с той же версией через OTA
-- ------------------------------------------------------------
-- Проблема:
--   Тестер поставил 6.0.0-closed-beta, админ пересобрал APK с той же
--   версией → клиент считал версии равными и не предлагал обновление.
--   Приходилось поднимать суффикс (beta → beta2 → beta3 …).
--
-- Что делает:
--   winchat_search_ota теперь возвращает updated_at записи OTA
--   (он автоматически ставится в now() при каждом /set ota).
--   Клиент предлагает установку, если:
--     - версия OTA строго новее установленной (semver), ИЛИ
--     - запись OTA перезаливали (updated_at изменился) после того,
--       как пользователь ставил прошлую пересборку.
--
--   Итог: APK можно пересобирать сколько угодно раз в день с той же
--   версией — достаточно после каждой пересборки повторить
--   /set ota "https://…apk" 6.0.0-closed-beta, и тестеры снова
--   увидят «Доступно обновление».
--
-- Запускать в Supabase SQL Editor вручную.
-- =============================================================

-- ------------------------------------------------------------
-- RPC: поиск OTA-обновления для устройства (+ updated_at)
-- ------------------------------------------------------------
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
  _updated timestamptz;
  _allowed boolean := false;
begin
  select url, version, target, updated_at
    into _url, _version, _target, _updated
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
    'target', coalesce(nullif(trim(_target), ''), '*'),
    'updated_at', _updated
  );
end;
$$;

grant execute on function public.winchat_search_ota(text) to anon, authenticated;

-- =============================================================
-- Готово. Порядок работы с пересборками:
--   1. Пересобрал APK → выложил на GitHub Releases.
--   2. Повторил /set ota "ссылка" "6.0.0-closed-beta" (версию менять не нужно).
--   3. updated_at обновился → у тестеров снова появилась плашка обновления.
-- =============================================================
