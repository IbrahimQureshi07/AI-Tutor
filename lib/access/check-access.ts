import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isUserAdmin } from "@/lib/auth/bootstrap-admin";
import { isPaywallEnabled } from "@/lib/access/paywall-settings";
import type {
  AccessProfile,
  AccessState,
  AccessStatus,
  PaymentProvider,
} from "@/lib/access/types";

export type { AccessProfile, AccessState, AccessStatus, PaymentProvider };

const ACCESS_STATUSES: AccessStatus[] = [
  "none",
  "demo_completed",
  "active",
  "expired",
];

export function isMissingAccessColumnsError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { message?: string; details?: string };
  const msg = `${e.message ?? ""} ${e.details ?? ""}`.toLowerCase();
  return (
    msg.includes("column") &&
    msg.includes("profiles") &&
    (msg.includes("access_status") ||
      msg.includes("paid_at") ||
      msg.includes("payment_provider"))
  );
}

function normalizeAccessStatus(value: unknown): AccessStatus {
  if (typeof value === "string" && ACCESS_STATUSES.includes(value as AccessStatus)) {
    return value as AccessStatus;
  }
  return "none";
}

function normalizePaymentProvider(value: unknown): PaymentProvider | null {
  if (value === "manual" || value === "stripe") return value;
  return null;
}

/** Placeholder price until client confirms; override via env. */
export function getCoursePriceUsd(): number {
  const raw = process.env.NEXT_PUBLIC_COURSE_PRICE;
  const n = raw ? Number(raw) : 299;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 299;
}

export function getCoursePriceLabel(): string {
  return `$${getCoursePriceUsd()}`;
}

/**
 * Legacy mode: billing columns missing → treat everyone (except deactivated) as paid
 * so the app keeps working until migration 0006 runs on Supabase.
 */
export function buildLegacyFullAccessState(isAdmin: boolean): AccessState {
  return {
    migrationApplied: false,
    status: "active",
    hasFullAccess: true,
    isAdmin,
    needsPaywall: false,
    paidAt: null,
    paymentProvider: null,
  };
}

export function resolveAccessState(
  profile: AccessProfile | null,
  isAdmin: boolean,
  migrationApplied: boolean,
): AccessState {
  if (!migrationApplied) {
    return buildLegacyFullAccessState(isAdmin);
  }

  if (profile?.is_active === false && !isAdmin) {
    return {
      migrationApplied: true,
      status: normalizeAccessStatus(profile.access_status),
      hasFullAccess: false,
      isAdmin: false,
      needsPaywall: true,
      paidAt: profile.paid_at ?? null,
      paymentProvider: normalizePaymentProvider(profile.payment_provider),
    };
  }

  if (isAdmin) {
    return {
      migrationApplied: true,
      status: "active",
      hasFullAccess: true,
      isAdmin: true,
      needsPaywall: false,
      paidAt: profile?.paid_at ?? null,
      paymentProvider: normalizePaymentProvider(profile?.payment_provider),
    };
  }

  const status = normalizeAccessStatus(profile?.access_status);
  const hasFullAccess = status === "active";

  return {
    migrationApplied: true,
    status,
    hasFullAccess,
    isAdmin: false,
    needsPaywall: !hasFullAccess,
    paidAt: profile?.paid_at ?? null,
    paymentProvider: normalizePaymentProvider(profile?.payment_provider),
  };
}

export async function loadAccessProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<
  | { ok: true; profile: AccessProfile | null; migrationApplied: true }
  | { ok: true; profile: null; migrationApplied: false }
  | { ok: false; error: unknown }
> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "role, is_active, access_status, paid_at, payment_provider",
    )
    .eq("id", userId)
    .maybeSingle<AccessProfile>();

  if (!error) {
    return { ok: true, profile: data ?? null, migrationApplied: true };
  }

  if (isMissingAccessColumnsError(error)) {
    return { ok: true, profile: null, migrationApplied: false };
  }

  return { ok: false, error };
}

export async function getAccessState(
  supabase: SupabaseClient,
  user: User,
): Promise<AccessState> {
  const isAdmin = await isUserAdmin(supabase, user);
  const loaded = await loadAccessProfile(supabase, user.id);

  if (!loaded.ok) {
    console.error("access profile lookup failed", loaded.error);
    return buildLegacyFullAccessState(isAdmin);
  }

  if (!loaded.migrationApplied) {
    return buildLegacyFullAccessState(isAdmin);
  }

  const state = resolveAccessState(loaded.profile, isAdmin, true);

  // Global paywall off → active accounts skip /unlock (DB access_status unchanged).
  // Deactivated accounts and admins keep their normal rules.
  if (
    !state.isAdmin &&
    state.needsPaywall &&
    loaded.profile?.is_active !== false
  ) {
    const paywallOn = await isPaywallEnabled(supabase);
    if (!paywallOn) {
      return {
        ...state,
        hasFullAccess: true,
        needsPaywall: false,
      };
    }
  }

  return state;
}

export async function hasFullAccess(
  supabase: SupabaseClient,
  user: User,
): Promise<boolean> {
  const state = await getAccessState(supabase, user);
  return state.hasFullAccess;
}

/** Alias for route guards — same rule as hasFullAccess for now. */
export async function canUseApp(
  supabase: SupabaseClient,
  user: User,
): Promise<boolean> {
  return hasFullAccess(supabase, user);
}

export function isGuestDemoTableMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { message?: string; details?: string; code?: string };
  const msg = `${e.message ?? ""} ${e.details ?? ""}`.toLowerCase();
  return (
    msg.includes("guest_demo_claims") &&
    (msg.includes("does not exist") || msg.includes("relation"))
  );
}
