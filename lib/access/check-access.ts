import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  isBootstrapAdminEmail,
  resolveIsAdmin,
} from "@/lib/auth/bootstrap-admin";
import { isPaywallEnabled } from "@/lib/access/paywall-settings";
import { MODES, type ModeKey } from "@/lib/constants";
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
const MODE_KEYS = Object.keys(MODES) as ModeKey[];

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

export function isMissingDisabledModesColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { message?: string; details?: string; code?: string };
  const msg = `${e.message ?? ""} ${e.details ?? ""}`.toLowerCase();
  return (
    (e.code === "42703" || e.code === "PGRST204" || msg.includes("column")) &&
    msg.includes("disabled_modes")
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

function normalizeDisabledModes(value: unknown): ModeKey[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (mode): mode is ModeKey =>
          typeof mode === "string" && MODE_KEYS.includes(mode as ModeKey),
      ),
    ),
  ];
}

export function isModeDisabled(
  access: AccessState,
  mode: ModeKey,
): boolean {
  return !access.isAdmin && access.disabledModes.includes(mode);
}

export function canUseMode(access: AccessState, mode: ModeKey): boolean {
  if (isModeDisabled(access, mode)) return false;
  if (mode === "mock" || mode === "final") return access.canUsePaidExams;
  return access.canUseFreeModes;
}

function getFreemiumCutoverMs(): number | null {
  const raw = process.env.FREEMIUM_CUTOVER_ISO?.trim();
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isGrandfathered(profile: AccessProfile | null): boolean {
  const cutover = getFreemiumCutoverMs();
  if (!cutover || !profile?.created_at) return false;
  const createdMs = new Date(profile.created_at).getTime();
  if (!Number.isFinite(createdMs)) return false;
  return createdMs < cutover;
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
    modeLocksApplied: false,
    status: "active",
    hasFullAccess: true,
    isAdmin,
    needsPaywall: false,
    paidAt: null,
    paymentProvider: null,
    grandfathered: false,
    canUseFreeModes: true,
    canUsePaidExams: true,
    disabledModes: [],
  };
}

export function resolveAccessState(
  profile: AccessProfile | null,
  isAdmin: boolean,
  migrationApplied: boolean,
  modeLocksApplied = true,
): AccessState {
  if (!migrationApplied) {
    return buildLegacyFullAccessState(isAdmin);
  }

  const grandfathered = !isAdmin && isGrandfathered(profile);
  const disabledModes =
    isAdmin || !modeLocksApplied
      ? []
      : normalizeDisabledModes(profile?.disabled_modes);

  if (profile?.is_active === false && !isAdmin) {
    return {
      migrationApplied: true,
      modeLocksApplied,
      status: normalizeAccessStatus(profile.access_status),
      hasFullAccess: false,
      isAdmin: false,
      needsPaywall: true,
      paidAt: profile.paid_at ?? null,
      paymentProvider: normalizePaymentProvider(profile.payment_provider),
      grandfathered: false,
      canUseFreeModes: false,
      canUsePaidExams: false,
      disabledModes,
    };
  }

  if (isAdmin) {
    return {
      migrationApplied: true,
      modeLocksApplied,
      status: "active",
      hasFullAccess: true,
      isAdmin: true,
      needsPaywall: false,
      paidAt: profile?.paid_at ?? null,
      paymentProvider: normalizePaymentProvider(profile?.payment_provider),
      grandfathered: false,
      canUseFreeModes: true,
      canUsePaidExams: true,
      disabledModes: [],
    };
  }

  const status = normalizeAccessStatus(profile?.access_status);
  const hasFullAccess = status === "active";
  const canUsePaidExams = hasFullAccess || grandfathered;

  return {
    migrationApplied: true,
    modeLocksApplied,
    status,
    hasFullAccess,
    isAdmin: false,
    needsPaywall: !hasFullAccess,
    paidAt: profile?.paid_at ?? null,
    paymentProvider: normalizePaymentProvider(profile?.payment_provider),
    grandfathered,
    canUseFreeModes: true,
    canUsePaidExams,
    disabledModes,
  };
}

export async function loadAccessProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<
  | {
      ok: true;
      profile: AccessProfile | null;
      migrationApplied: true;
      modeLocksApplied: boolean;
    }
  | {
      ok: true;
      profile: null;
      migrationApplied: false;
      modeLocksApplied: false;
    }
  | { ok: false; error: unknown }
> {
  const fullSelect =
    "role, is_active, access_status, paid_at, payment_provider, created_at, disabled_modes";
  const legacySelect =
    "role, is_active, access_status, paid_at, payment_provider, created_at";

  const { data, error } = await supabase
    .from("profiles")
    .select(fullSelect)
    .eq("id", userId)
    .maybeSingle<AccessProfile>();

  if (!error) {
    return {
      ok: true,
      profile: data ?? null,
      migrationApplied: true,
      modeLocksApplied: true,
    };
  }

  // Migration 0008 can be deployed after this code. Retry without the new
  // column so the existing app keeps working with no extra locks meanwhile.
  if (isMissingDisabledModesColumnError(error)) {
    const retry = await supabase
      .from("profiles")
      .select(legacySelect)
      .eq("id", userId)
      .maybeSingle<Omit<AccessProfile, "disabled_modes">>();

    if (!retry.error) {
      return {
        ok: true,
        profile: retry.data
          ? { ...retry.data, disabled_modes: null }
          : null,
        migrationApplied: true,
        modeLocksApplied: false,
      };
    }
    if (isMissingAccessColumnsError(retry.error)) {
      return {
        ok: true,
        profile: null,
        migrationApplied: false,
        modeLocksApplied: false,
      };
    }
    return { ok: false, error: retry.error };
  }

  if (isMissingAccessColumnsError(error)) {
    return {
      ok: true,
      profile: null,
      migrationApplied: false,
      modeLocksApplied: false,
    };
  }

  return { ok: false, error };
}

/**
 * Single profiles round-trip (role + access columns). Admin is derived from
 * that row — no separate isUserAdmin query.
 */
export async function getAccessState(
  supabase: SupabaseClient,
  user: User,
): Promise<AccessState> {
  const loaded = await loadAccessProfile(supabase, user.id);

  if (!loaded.ok) {
    console.error("access profile lookup failed", loaded.error);
    return buildLegacyFullAccessState(isBootstrapAdminEmail(user.email));
  }

  if (!loaded.migrationApplied) {
    return buildLegacyFullAccessState(isBootstrapAdminEmail(user.email));
  }

  const isAdmin = resolveIsAdmin(user, loaded.profile);
  const state = resolveAccessState(
    loaded.profile,
    isAdmin,
    true,
    loaded.modeLocksApplied,
  );

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
