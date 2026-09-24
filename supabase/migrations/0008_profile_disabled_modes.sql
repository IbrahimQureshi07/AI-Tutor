-- Per-student mode locks controlled by the admin backend.
-- Run in Supabase SQL Editor after 0007_app_settings.sql.

-- Empty array means no admin-imposed locks.
alter table public.profiles
  add column if not exists disabled_modes text[];

alter table public.profiles
  alter column disabled_modes set default '{}'::text[];

update public.profiles
set disabled_modes = '{}'::text[]
where disabled_modes is null;

alter table public.profiles
  alter column disabled_modes set not null;

-- Only the five application modes can be stored, with no duplicates.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_disabled_modes_valid'
  ) then
    alter table public.profiles
      add constraint profiles_disabled_modes_valid
      check (
        disabled_modes <@ array[
          'assessment',
          'practice',
          'mistakes',
          'mock',
          'final'
        ]::text[]
        and cardinality(disabled_modes) = (
          case when 'assessment' = any(disabled_modes) then 1 else 0 end
          + case when 'practice' = any(disabled_modes) then 1 else 0 end
          + case when 'mistakes' = any(disabled_modes) then 1 else 0 end
          + case when 'mock' = any(disabled_modes) then 1 else 0 end
          + case when 'final' = any(disabled_modes) then 1 else 0 end
        )
      );
  end if;
end;
$$;

-- Profiles are self-updatable under RLS, so protect this admin-only field at
-- the database layer. Admin APIs use the service role and remain authorized.
create or replace function public.guard_profile_disabled_modes()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    if (
      (tg_op = 'INSERT' and cardinality(new.disabled_modes) > 0)
      or (
        tg_op = 'UPDATE'
        and new.disabled_modes is distinct from old.disabled_modes
      )
    ) then
      raise exception 'Mode locks can only be updated by the server';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_disabled_modes on public.profiles;
create trigger guard_profile_disabled_modes
  before insert or update on public.profiles
  for each row execute function public.guard_profile_disabled_modes();

comment on column public.profiles.disabled_modes is
  'Admin-imposed per-student locks. Empty means no extra locks.';
