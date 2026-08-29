import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  getAccessState,
  type AccessState,
} from "@/lib/access/check-access";

export type RequireFullAccessResult =
  | { ok: true; user: User; access: AccessState }
  | {
      ok: false;
      reason: "unauthorized" | "payment_required";
      access?: AccessState;
    };

type DeniedAccess = Extract<RequireFullAccessResult, { ok: false }>;

/** JSON error for NextResponse-based API routes. */
export function accessDeniedResponse(result: DeniedAccess): NextResponse {
  if (result.reason === "unauthorized") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
): Promise<RequireFullAccessResult> {
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
): Promise<RequireFullAccessResult> {
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
