-- ============================================================
--  WinChat Update 10 — Push-уведомления (веб + Android)
--  https://iksgubxxxspkjwsazrwq.supabase.co
--  Запустить в SQL Editor Supabase Dashboard
-- ============================================================

-- 1. Таблица подписок на пуш-уведомления
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  user_agent text,                 -- браузер / платформа
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

-- Пользователь читает и пишет только свои подписки
create policy "push_subscriptions_select" on public.push_subscriptions
  for select using (auth.uid() = user_id);

create policy "push_subscriptions_insert" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

create policy "push_subscriptions_update" on public.push_subscriptions
  for update using (auth.uid() = user_id);

create policy "push_subscriptions_delete" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- 2. RPC: сохранить / обновить подписку
drop function if exists public.save_push_subscription(text, text, text, text);
create or replace function public.save_push_subscription(
  _endpoint   text,
  _p256dh     text,
  _auth       text,
  _user_agent text
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    return jsonb_build_object('ok', false, 'error', 'требуется авторизация');
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, updated_at)
  values (_uid, _endpoint, _p256dh, _auth, _user_agent, now())
  on conflict (user_id, endpoint)
  do update set
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- 3. RPC: удалить подписку по endpoint
drop function if exists public.remove_push_subscription(text);
create or replace function public.remove_push_subscription(_endpoint text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.push_subscriptions
  where user_id = auth.uid() and endpoint = _endpoint;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.remove_push_subscription(text) to authenticated;

-- 4. RPC: получить свои подписки
drop function if exists public.get_my_push_subscriptions();
create or replace function public.get_my_push_subscriptions()
returns table (
  id uuid,
  endpoint text,
  p256dh text,
  auth text,
  user_agent text,
  created_at timestamptz
)
language plpgsql
security definer set search_path = public
as $$
begin
  return query
  select id, endpoint, p256dh, auth, user_agent, created_at
  from public.push_subscriptions
  where user_id = auth.uid();
end;
$$;

grant execute on function public.get_my_push_subscriptions() to authenticated;

-- 5. RPC: отправить пуш всем подписчикам пользователя (для админа / теста)
drop function if exists public.send_push_to_user(uuid, text, text);
create or replace function public.send_push_to_user(
  _target_user_id uuid,
  _title text,
  _body text
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  _is_admin boolean;
begin
  select exists (
    select 1 from public.profiles where id = auth.uid() and username = 'admin'
  ) into _is_admin;

  if not _is_admin then
    return jsonb_build_object('ok', false, 'error', 'только администратор');
  end if;

  return jsonb_build_object(
    'ok', true,
    'message', 'пуш-отправка через Edge Function (подробности в src/lib/push.ts)',
    'subscriptions_to', _target_user_id
  );
end;
$$;

grant execute on function public.send_push_to_user(uuid, text, text) to authenticated;
