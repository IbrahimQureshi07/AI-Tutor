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

/**
 * Server guard for paid app features and APIs.
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
  if (!access.hasFullAccess) {
    return { ok: false, reason: "payment_required", access };
  }

  return { ok: true, user, access };
}
