import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isMissingAccessColumnsError,
  loadAccessProfile,
  resolveAccessState,
} from "@/lib/access/check-access";
import type { AccessStatus, PaymentProvider } from "@/lib/access/types";

export type AdminStudentAccess = {
  migrationApplied: boolean;
  status: AccessStatus;
  hasFullAccess: boolean;
  paidAt: string | null;
  paymentProvider: PaymentProvider | null;
};

export type GrantAccessResult =
  | { ok: true; access: AdminStudentAccess }
  | {
      ok: false;
      reason:
        | "migration_required"
        | "not_found"
        | "is_admin"
        | "already_active"
        | "not_active"
        | "error";
      message?: string;
    };

export async function loadAdminStudentAccess(
  admin: SupabaseClient,
  userId: string,
  isTargetAdmin: boolean,
): Promise<AdminStudentAccess> {
  const loaded = await loadAccessProfile(admin, userId);
  if (!loaded.ok) {
    return {
      migrationApplied: false,
      status: "active",
      hasFullAccess: true,
      paidAt: null,
      paymentProvider: null,
    };
  }
  if (!loaded.migrationApplied) {
    return {
      migrationApplied: false,
      status: "active",
      hasFullAccess: true,
      paidAt: null,
      paymentProvider: null,
    };
  }

  const state = resolveAccessState(loaded.profile, isTargetAdmin, true);
  return {
    migrationApplied: true,
    status: state.status,
    hasFullAccess: state.hasFullAccess,
    paidAt: state.paidAt,
    paymentProvider: state.paymentProvider,
  };
}

function toAccessResult(profile: {
  access_status: string | null;
  paid_at: string | null;
  payment_provider: string | null;
}): AdminStudentAccess {
  const status = (profile.access_status ?? "none") as AccessStatus;
  const hasFullAccess = status === "active";
  return {
    migrationApplied: true,
    status,
    hasFullAccess,
    paidAt: profile.paid_at ?? null,
    paymentProvider:
      profile.payment_provider === "manual" || profile.payment_provider === "stripe"
        ? profile.payment_provider
        : null,
  };
}

export async function grantCourseAccess(
  admin: SupabaseClient,
  userId: string,
): Promise<GrantAccessResult> {
  const paidAt = new Date().toISOString();
  const { data, error } = await admin
    .from("profiles")
    .update({
      access_status: "active",
      paid_at: paidAt,
      payment_provider: "manual",
    })
    .eq("id", userId)
    .select("access_status, paid_at, payment_provider")
    .maybeSingle();

  if (error) {
    if (isMissingAccessColumnsError(error)) {
      return { ok: false, reason: "migration_required" };
    }
    return { ok: false, reason: "error", message: error.message };
  }

  if (!data) {
    return { ok: false, reason: "not_found" };
  }

  return { ok: true, access: toAccessResult(data) };
}

export async function revokeCourseAccess(
  admin: SupabaseClient,
  userId: string,
): Promise<GrantAccessResult> {
  const { data, error } = await admin
    .from("profiles")
    .update({
      access_status: "none",
      paid_at: null,
      payment_provider: null,
    })
    .eq("id", userId)
    .select("access_status, paid_at, payment_provider")
    .maybeSingle();

  if (error) {
    if (isMissingAccessColumnsError(error)) {
      return { ok: false, reason: "migration_required" };
    }
    return { ok: false, reason: "error", message: error.message };
  }

  if (!data) {
    return { ok: false, reason: "not_found" };
  }

  return { ok: true, access: toAccessResult(data) };
}
