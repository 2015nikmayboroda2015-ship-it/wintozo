-- ============================================================
--  WinChat — обновление: СИНЯЯ ГАЛОЧКА (верификация)
--  Выполнить после предыдущих скриптов. Идемпотентный.
--  Dashboard → SQL Editor → New query → вставить целиком → Run
-- ============================================================

-- 1. ПОЛЕ ВЕРИФИКАЦИИ -------------------------------------------
alter table public.profiles
  add column if not exists verified boolean not null default false;

-- 2. ГАЛОЧКА СИСТЕМНЫМ АККАУНТАМ --------------------------------
-- @admin и @winchat получают её автоматически (и в приложении тоже,
-- даже если строки ещё нет в базе).
update public.profiles
set verified = true
where lower(username) in ('admin', 'winchat');

-- 3. ЗАЩИТА ОТ САМОВЫДАЧИ ---------------------------------------
-- Обычный пользователь не может выдать галочку сам себе:
-- при обновлении профиля значение verified должно остаться прежним.
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and verified is not distinct from (
      select p.verified from public.profiles p where p.id = auth.uid()
    )
  );

-- ============================================================
--  КАК ВЫДАТЬ ГАЛОЧКУ ЛЮБОМУ ПОЛЬЗОВАТЕЛЮ
--  (выполняется из SQL Editor — он работает в обход RLS)
--
--    update public.profiles set verified = true  where username = 'ivan';
--
--  КАК ЗАБРАТЬ:
--    update public.profiles set verified = false where username = 'ivan';
--
--  ПОСМОТРЕТЬ ВСЕХ ВЕРИФИЦИРОВАННЫХ:
--    select username, nickname from public.profiles where verified;
-- ============================================================

-- 4. ПРОВЕРКА ----------------------------------------------------
select username, nickname, verified
from public.profiles
order by verified desc, username;
