-- ============================================================
--  WinChat Update 6 — Верификация с уровнями + Админ-терминал
--  Уровни: user (нет) → grey → green → full (синяя)
-- ============================================================

-- 1. Добавляем колонку verify_status
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verify_status TEXT NOT NULL DEFAULT 'user';

-- 2. Добавляем колонку terminal_log для истории команд
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS terminal_log JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 3. Обновляем существующих верифицированных (синяя галочка)
UPDATE profiles SET verify_status = 'full' WHERE verified = true;

-- 4. Создаём RPC-функцию для добавления галочки
CREATE OR REPLACE FUNCTION add_verify_status(
  _admin_id UUID,
  _target_username TEXT,
  _level TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _target_id UUID;
  _target_nickname TEXT;
  _log JSONB;
BEGIN
  -- Проверяем, что админ
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = _admin_id AND username = 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  END IF;

  -- Ищем пользователя
  SELECT id, nickname INTO _target_id, _target_nickname
  FROM profiles WHERE username = _target_username;

  IF _target_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Пользователь не найден');
  END IF;

  -- Проверяем валидность уровня
  IF _level NOT IN ('grey', 'green', 'full') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Неверный уровень. Доступные: grey, green, full');
  END IF;

  -- Обновляем статус
  UPDATE profiles
  SET verify_status = _level
  WHERE id = _target_id;

  -- Логгируем
  _log := jsonb_build_array(
    jsonb_build_object(
      'timestamp', NOW(),
      'admin', _admin_id,
      'action', 'add_verify',
      'target', _target_username,
      'level', _level
    )
  );
  UPDATE profiles SET terminal_log = _log WHERE id = _admin_id;

  RETURN jsonb_build_object(
    'ok', true,
    'username', _target_username,
    'nickname', _target_nickname,
    'status', _level,
    'message', CASE _level
      WHEN 'grey' THEN 'Серая галочка добавлена'
      WHEN 'green' THEN 'Зелёная галочка добавлена'
      WHEN 'full' THEN 'Синяя галочка добавлена'
    END
  );
END;
$$;

-- 5. Создаём RPC-функцию для снятия галочки
CREATE OR REPLACE FUNCTION disverify_status(
  _admin_id UUID,
  _target_username TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _target_id UUID;
  _target_nickname TEXT;
BEGIN
  -- Проверяем, что админ
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = _admin_id AND username = 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  END IF;

  -- Ищем пользователя
  SELECT id, nickname INTO _target_id, _target_nickname
  FROM profiles WHERE username = _target_username;

  IF _target_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Пользователь не найден');
  END IF;

  -- Сбрасываем статус
  UPDATE profiles SET verify_status = 'user' WHERE id = _target_id;

  RETURN jsonb_build_object(
    'ok', true,
    'username', _target_username,
    'nickname', _target_nickname,
    'message', 'Галочка удалена'
  );
END;
$$;

-- 6. Создаём RPC-функцию для блокировки
CREATE OR REPLACE FUNCTION ban_user_by_username(
  _admin_id UUID,
  _target_username TEXT,
  _reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _target_id UUID;
  _target_nickname TEXT;
BEGIN
  -- Проверяем, что админ
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = _admin_id AND username = 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  END IF;

  -- Ищем пользователя
  SELECT id, nickname INTO _target_id, _target_nickname
  FROM profiles WHERE username = _target_username;

  IF _target_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Пользователь не найден');
  END IF;

  -- Блокируем
  UPDATE profiles
  SET banned_at = NOW(), ban_reason = _reason
  WHERE id = _target_id;

  RETURN jsonb_build_object(
    'ok', true,
    'username', _target_username,
    'nickname', _target_nickname,
    'message', 'Пользователь заблокирован'
  );
END;
$$;

-- 7. Создаём RPC-функцию для разблокировки
CREATE OR REPLACE FUNCTION unban_user_by_username(
  _admin_id UUID,
  _target_username TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _target_id UUID;
  _target_nickname TEXT;
BEGIN
  -- Проверяем, что админ
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = _admin_id AND username = 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  END IF;

  -- Ищем пользователя
  SELECT id, nickname INTO _target_id, _target_nickname
  FROM profiles WHERE username = _target_username;

  IF _target_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Пользователь не найден');
  END IF;

  -- Разблокируем
  UPDATE profiles
  SET banned_at = NULL, ban_reason = NULL
  WHERE id = _target_id;

  RETURN jsonb_build_object(
    'ok', true,
    'username', _target_username,
    'nickname', _target_nickname,
    'message', 'Пользователь разблокирован'
  );
END;
$$;

-- 8. Создаём RPC-функцию для просмотра статуса галочек
CREATE OR REPLACE FUNCTION get_verify_status(
  _admin_id UUID,
  _target_username TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _result JSONB;
BEGIN
  -- Проверяем, что админ
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = _admin_id AND username = 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Доступ запрещён');
  END IF;

  SELECT jsonb_build_object(
    'ok', true,
    'username', p.username,
    'nickname', p.nickname,
    'verify_status', p.verify_status,
    'banned', p.banned_at IS NOT NULL
  ) INTO _result
  FROM profiles p WHERE p.username = _target_username;

  IF _result IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Пользователь не найден');
  END IF;

  RETURN _result;
END;
$$;
