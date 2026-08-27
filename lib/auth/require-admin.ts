import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getAppShell } from "@/lib/auth/request-session";
import { isUserAdmin } from "@/lib/auth/bootstrap-admin";

export type RequireAdminResult =
  | { ok: true; user: User }
  | { ok: false; reason: "unauthorized" | "forbidden" };

/**
 * Shared server-side guard for admin-only surfaces.
 * Uses the request-cached app shell (no extra getUser) when possible.
 */
export async function requireAdmin(
  supabase?: SupabaseClient,
): Promise<RequireAdminResult> {
  const shell = await getAppShell();
  if (shell) {
    if (!shell.showAdmin) return { ok: false, reason: "forbidden" };
    return { ok: true, user: shell.user };
  }

  if (!supabase) return { ok: false, reason: "unauthorized" };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "unauthorized" };
  const allowed = await isUserAdmin(supabase, user);
  if (!allowed) return { ok: false, reason: "forbidden" };
  return { ok: true, user };
}
