import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  canUseMode,
  getAccessState,
  isModeDisabled,
  type AccessState,
} from "@/lib/access/check-access";
import type { ModeKey } from "@/lib/constants";

export type RequireAccessResult =
  | { ok: true; user: User; access: AccessState }
  | {
      ok: false;
      reason: "unauthorized" | "payment_required" | "mode_locked";
      access?: AccessState;
      mode?: ModeKey;
    };

type DeniedAccess = Extract<RequireAccessResult, { ok: false }>;

/** JSON error for NextResponse-based API routes. */
export function accessDeniedResponse(result: DeniedAccess): NextResponse {
  if (result.reason === "unauthorized") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (result.reason === "mode_locked") {
    return NextResponse.json(
      {
        error: "mode_locked",
        mode: result.mode,
        message: "This section has been locked by an administrator.",
      },
      { status: 403 },
    );
  }
  return NextResponse.json(
    { error: "payment_required", unlock: "/unlock" },
    { status: 403 },
  );
}

/** JSON error for streaming routes that return plain Response. */
export function accessDeniedStreamResponse(result: DeniedAccess): Response {
  const status = result.reason === "unauthorized" ? 401 : 403;
  const body =
    result.reason === "unauthorized"
      ? { error: "unauthorized" }
      : result.reason === "mode_locked"
        ? {
            error: "mode_locked",
            mode: result.mode,
            message: "This section has been locked by an administrator.",
          }
      : { error: "payment_required", unlock: "/unlock" };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Server guard for paid exam features and APIs (Mock + Final).
 * - unauthorized: not logged in
 * - payment_required: logged in but no active course access
 *
 * While migration 0006 is not applied, all authenticated users pass (legacy mode).
 */
export async function requireFullAccess(
  supabase: SupabaseClient,
): Promise<RequireAccessResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, reason: "unauthorized" };

  const access = await getAccessState(supabase, user);
  if (!access.canUsePaidExams) {
    return { ok: false, reason: "payment_required", access };
  }

  return { ok: true, user, access };
}

/**
 * Server guard for free modes (Assessment / Practice / Mistakes + AI).
 * Only blocks logged-out users and fully blocked accounts.
 */
export async function requireFreeAccess(
  supabase: SupabaseClient,
): Promise<RequireAccessResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, reason: "unauthorized" };

  const access = await getAccessState(supabase, user);
  if (!access.canUseFreeModes) {
    return { ok: false, reason: "payment_required", access };
  }

  return { ok: true, user, access };
}

/** Enforces both normal freemium access and an admin-imposed mode lock. */
export async function requireModeAccess(
  supabase: SupabaseClient,
  mode: ModeKey,
): Promise<RequireAccessResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, reason: "unauthorized" };

  const access = await getAccessState(supabase, user);
  const denied = getModeAccessDenial(access, mode);
  if (denied) return denied;

  return { ok: true, user, access };
}

/** Checks a mode when the request already loaded the user/access state. */
export function getModeAccessDenial(
  access: AccessState,
  mode: ModeKey,
): DeniedAccess | null {
  if (isModeDisabled(access, mode)) {
    return { ok: false, reason: "mode_locked", mode, access };
  }
  if (!canUseMode(access, mode)) {
    return { ok: false, reason: "payment_required", mode, access };
  }
  return null;
}
