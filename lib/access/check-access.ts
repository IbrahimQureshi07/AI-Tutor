import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  isBootstrapAdminEmail,
  resolveIsAdmin,
} from "@/lib/auth/bootstrap-admin";
import { isPaywallEnabled } from "@/lib/access/paywall-settings";
import {
  getGlobalDisabledModes,
  mergeDisabledModes,
} from "@/lib/access/global-mode-locks";
import { MODES, SECTIONS, type ModeKey, type SectionCode } from "@/lib/constants";
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
const SECTION_CODES = SECTIONS.map((s) => s.code) as SectionCode[];

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

export function isMissingDisabledAssessmentSectionsColumnError(
  error: unknown,
): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { message?: string; details?: string; code?: string };
  const msg = `${e.message ?? ""} ${e.details ?? ""}`.toLowerCase();
  return (
    (e.code === "42703" || e.code === "PGRST204" || msg.includes("column")) &&
    msg.includes("disabled_assessment_sections")
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

function normalizeDisabledAssessmentSections(value: unknown): SectionCode[] {
  if (!Array.isArray(value)) return [];
  return SECTION_CODES.filter((code) => value.includes(code));
}

export function isModeDisabled(
  access: AccessState,
  mode: ModeKey,
): boolean {
  return !access.isAdmin && access.disabledModes.includes(mode);
}

export function isAssessmentSectionDisabled(
  access: AccessState,
  section: SectionCode | string,
): boolean {
  if (access.isAdmin) return false;
  return access.disabledAssessmentSections.includes(section as SectionCode);
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
    assessmentSectionLocksApplied: false,
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
    disabledAssessmentSections: [],
  };
}

export function resolveAccessState(
  profile: AccessProfile | null,
  isAdmin: boolean,
  migrationApplied: boolean,
  modeLocksApplied = true,
  assessmentSectionLocksApplied = true,
): AccessState {
  if (!migrationApplied) {
    return buildLegacyFullAccessState(isAdmin);
  }

  const grandfathered = !isAdmin && isGrandfathered(profile);
  const disabledModes =
    isAdmin || !modeLocksApplied
      ? []
      : normalizeDisabledModes(profile?.disabled_modes);
  const disabledAssessmentSections =
    isAdmin || !assessmentSectionLocksApplied
      ? []
      : normalizeDisabledAssessmentSections(
          profile?.disabled_assessment_sections,
        );

  if (profile?.is_active === false && !isAdmin) {
    return {
      migrationApplied: true,
      modeLocksApplied,
      assessmentSectionLocksApplied,
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
      disabledAssessmentSections,
    };
  }

  if (isAdmin) {
    return {
      migrationApplied: true,
      modeLocksApplied,
      assessmentSectionLocksApplied,
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
      disabledAssessmentSections: [],
    };
  }

  const status = normalizeAccessStatus(profile?.access_status);
  const hasFullAccess = status === "active";
  const canUsePaidExams = hasFullAccess || grandfathered;

  return {
    migrationApplied: true,
    modeLocksApplied,
    assessmentSectionLocksApplied,
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
    disabledAssessmentSections,
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
      assessmentSectionLocksApplied: boolean;
    }
  | {
      ok: true;
      profile: null;
      migrationApplied: false;
      modeLocksApplied: false;
      assessmentSectionLocksApplied: false;
    }
  | { ok: false; error: unknown }
> {
  const withBoth =
    "role, is_active, access_status, paid_at, payment_provider, created_at, disabled_modes, disabled_assessment_sections";
  const withModes =
    "role, is_active, access_status, paid_at, payment_provider, created_at, disabled_modes";
  const legacySelect =
    "role, is_active, access_status, paid_at, payment_provider, created_at";

  const { data, error } = await supabase
    .from("profiles")
    .select(withBoth)
    .eq("id", userId)
    .maybeSingle<AccessProfile>();

  if (!error) {
    return {
      ok: true,
      profile: data ?? null,
      migrationApplied: true,
      modeLocksApplied: true,
      assessmentSectionLocksApplied: true,
    };
  }

  // Migration 0009 can land after this code. Retry without assessment sections.
  if (isMissingDisabledAssessmentSectionsColumnError(error)) {
    const retry = await supabase
      .from("profiles")
      .select(withModes)
      .eq("id", userId)
      .maybeSingle<Omit<AccessProfile, "disabled_assessment_sections">>();

    if (!retry.error) {
      return {
        ok: true,
        profile: retry.data
          ? { ...retry.data, disabled_assessment_sections: null }
          : null,
        migrationApplied: true,
        modeLocksApplied: true,
        assessmentSectionLocksApplied: false,
      };
    }

    if (isMissingDisabledModesColumnError(retry.error)) {
      const legacy = await supabase
        .from("profiles")
        .select(legacySelect)
        .eq("id", userId)
        .maybeSingle<
          Omit<AccessProfile, "disabled_modes" | "disabled_assessment_sections">
        >();

      if (!legacy.error) {
        return {
          ok: true,
          profile: legacy.data
            ? {
                ...legacy.data,
                disabled_modes: null,
                disabled_assessment_sections: null,
              }
            : null,
          migrationApplied: true,
          modeLocksApplied: false,
          assessmentSectionLocksApplied: false,
        };
      }
      if (isMissingAccessColumnsError(legacy.error)) {
        return {
          ok: true,
          profile: null,
          migrationApplied: false,
          modeLocksApplied: false,
          assessmentSectionLocksApplied: false,
        };
      }
      return { ok: false, error: legacy.error };
    }

    if (isMissingAccessColumnsError(retry.error)) {
      return {
        ok: true,
        profile: null,
        migrationApplied: false,
        modeLocksApplied: false,
        assessmentSectionLocksApplied: false,
      };
    }
    return { ok: false, error: retry.error };
  }

  // Migration 0008 can be deployed after this code. Retry without mode locks.
  if (isMissingDisabledModesColumnError(error)) {
    const retry = await supabase
      .from("profiles")
      .select(legacySelect)
      .eq("id", userId)
      .maybeSingle<
        Omit<AccessProfile, "disabled_modes" | "disabled_assessment_sections">
      >();

    if (!retry.error) {
      return {
        ok: true,
        profile: retry.data
          ? {
              ...retry.data,
              disabled_modes: null,
              disabled_assessment_sections: null,
            }
          : null,
        migrationApplied: true,
        modeLocksApplied: false,
        assessmentSectionLocksApplied: false,
      };
    }
    if (isMissingAccessColumnsError(retry.error)) {
      return {
        ok: true,
        profile: null,
        migrationApplied: false,
        modeLocksApplied: false,
        assessmentSectionLocksApplied: false,
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
      assessmentSectionLocksApplied: false,
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
  let state = resolveAccessState(
    loaded.profile,
    isAdmin,
    true,
    loaded.modeLocksApplied,
    loaded.assessmentSectionLocksApplied,
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
      state = {
        ...state,
        hasFullAccess: true,
        needsPaywall: false,
      };
    }
  }

  // Global mode locks apply to every student, on top of per-student locks.
  if (!state.isAdmin) {
    const globalDisabled = await getGlobalDisabledModes(supabase);
    if (globalDisabled.length > 0) {
      state = {
        ...state,
        disabledModes: mergeDisabledModes(state.disabledModes, globalDisabled),
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
