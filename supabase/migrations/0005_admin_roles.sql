-- Add role + account status on profiles for admin controls.

alter table public.profiles
  add column if not exists role text not null default 'student'
    check (role in ('student', 'admin'));

alter table public.profiles
  add column if not exists is_active boolean not null default true;

-- Ensure existing rows are fully backfilled.
update public.profiles
set role = 'student'
where role is null;

update public.profiles
set is_active = true
where is_active is null;

