-- Global app settings (paywall on/off toggle, etc.).
-- Run in Supabase SQL Editor after 0006_access_billing.sql.

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.app_settings enable row level security;

-- Authenticated users may read settings (needed by middleware / access checks).
drop policy if exists "authenticated read app_settings" on public.app_settings;
create policy "authenticated read app_settings"
  on public.app_settings
  for select
  to authenticated
  using (true);

-- No insert/update/delete policies for authenticated clients.
-- Writes go through the service-role server (admin API only).

insert into public.app_settings (key, value)
values ('paywall_enabled', 'true'::jsonb)
on conflict (key) do nothing;

comment on table public.app_settings is
  'Key/value app config. paywall_enabled (bool): when false, unpaid students skip /unlock.';
