-- Per-student Assessment section locks (A1–B6) controlled by the admin backend.
-- Run in Supabase SQL Editor after 0008_profile_disabled_modes.sql.

-- Empty array means no admin-imposed Assessment section locks.
alter table public.profiles
  add column if not exists disabled_assessment_sections text[];

alter table public.profiles
  alter column disabled_assessment_sections set default '{}'::text[];

update public.profiles
set disabled_assessment_sections = '{}'::text[]
where disabled_assessment_sections is null;

alter table public.profiles
  alter column disabled_assessment_sections set not null;

-- Only the twelve catalog section codes can be stored, with no duplicates.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_disabled_assessment_sections_valid'
  ) then
    alter table public.profiles
      add constraint profiles_disabled_assessment_sections_valid
      check (
        disabled_assessment_sections <@ array[
          'A1', 'A2', 'A3', 'A4', 'A5', 'A6',
          'B1', 'B2', 'B3', 'B4', 'B5', 'B6'
        ]::text[]
        and cardinality(disabled_assessment_sections) = (
          case when 'A1' = any(disabled_assessment_sections) then 1 else 0 end
          + case when 'A2' = any(disabled_assessment_sections) then 1 else 0 end
          + case when 'A3' = any(disabled_assessment_sections) then 1 else 0 end
          + case when 'A4' = any(disabled_assessment_sections) then 1 else 0 end
          + case when 'A5' = any(disabled_assessment_sections) then 1 else 0 end
          + case when 'A6' = any(disabled_assessment_sections) then 1 else 0 end
          + case when 'B1' = any(disabled_assessment_sections) then 1 else 0 end
          + case when 'B2' = any(disabled_assessment_sections) then 1 else 0 end
          + case when 'B3' = any(disabled_assessment_sections) then 1 else 0 end
          + case when 'B4' = any(disabled_assessment_sections) then 1 else 0 end
          + case when 'B5' = any(disabled_assessment_sections) then 1 else 0 end
          + case when 'B6' = any(disabled_assessment_sections) then 1 else 0 end
        )
      );
  end if;
end;
$$;

-- Profiles are self-updatable under RLS, so protect this admin-only field at
-- the database layer. Admin APIs use the service role and remain authorized.
create or replace function public.guard_profile_disabled_assessment_sections()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    if (
      (tg_op = 'INSERT' and cardinality(new.disabled_assessment_sections) > 0)
      or (
        tg_op = 'UPDATE'
        and new.disabled_assessment_sections is distinct from old.disabled_assessment_sections
      )
    ) then
      raise exception 'Assessment section locks can only be updated by the server';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_disabled_assessment_sections on public.profiles;
create trigger guard_profile_disabled_assessment_sections
  before insert or update on public.profiles
  for each row execute function public.guard_profile_disabled_assessment_sections();

comment on column public.profiles.disabled_assessment_sections is
  'Admin-imposed per-student Assessment section locks (A1–B6). Empty means none locked.';
