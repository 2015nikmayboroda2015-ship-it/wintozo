-- WinChat: per-user legacy UI flag
-- /set legacy @username  -> is_winchat_legacy_true  (force base/legacy UI)
-- /del legacy @username  -> is_winchat_legacy_false (new UI)
-- default: is_winchat_legacy_false

alter table public.profiles
  add column if not exists is_winchat_legacy text not null default 'is_winchat_legacy_false';

-- Optional: constrain allowed values (safe to re-run)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_is_winchat_legacy_check'
  ) then
    alter table public.profiles
      add constraint profiles_is_winchat_legacy_check
      check (is_winchat_legacy in ('is_winchat_legacy_true', 'is_winchat_legacy_false'));
  end if;
end $$;

comment on column public.profiles.is_winchat_legacy is
  'WinChat UI mode override: is_winchat_legacy_true = force legacy/base UI, is_winchat_legacy_false = new UI (default).';
