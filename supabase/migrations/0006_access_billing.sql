-- Course access + guest demo tracking (paywall foundation).
-- Run in Supabase SQL Editor after 0005_admin_roles.sql.

-- =========================================================
-- PROFILES: billing / access columns
-- =========================================================
alter table public.profiles
  add column if not exists access_status text not null default 'none'
    check (access_status in ('none', 'demo_completed', 'active', 'expired'));

alter table public.profiles
  add column if not exists paid_at timestamptz;

alter table public.profiles
  add column if not exists payment_provider text
    check (payment_provider is null or payment_provider in ('manual', 'stripe'));

alter table public.profiles
  add column if not exists stripe_customer_id text;

alter table public.profiles
  add column if not exists stripe_payment_intent_id text;

-- Backfill any legacy nulls (should not happen with NOT NULL default).
update public.profiles
set access_status = 'none'
where access_status is null;

create index if not exists profiles_access_status_idx
  on public.profiles (access_status);

-- Prevent clients from self-granting paid access (server/service role only).
create or replace function public.guard_profile_billing_columns()
returns trigger
language plpgsql
as $$
begin
  if (
    new.access_status is distinct from old.access_status
    or new.paid_at is distinct from old.paid_at
    or new.payment_provider is distinct from old.payment_provider
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
  ) then
    if coalesce(auth.role(), '') is distinct from 'service_role' then
      raise exception 'Billing fields can only be updated by the server';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_billing_columns on public.profiles;
create trigger guard_profile_billing_columns
  before update on public.profiles
  for each row execute function public.guard_profile_billing_columns();

-- =========================================================
-- GUEST DEMO: one-time free trial per device fingerprint
-- =========================================================
create table if not exists public.guest_demo_claims (
  id uuid primary key default gen_random_uuid(),
  fingerprint_hash text not null unique,
  ip_hash text,
  questions_answered int not null default 0 check (questions_answered >= 0),
  used_at timestamptz not null default now()
);

create index if not exists guest_demo_claims_used_at_idx
  on public.guest_demo_claims (used_at desc);

alter table public.guest_demo_claims enable row level security;

-- No policies: only service-role server APIs read/write this table.

comment on column public.profiles.access_status is
  'none = unpaid; demo_completed = used guest demo; active = paid/granted; expired = lapsed access';
comment on table public.guest_demo_claims is
  'Tracks guest /try demo usage so the same device cannot repeat the free demo.';
