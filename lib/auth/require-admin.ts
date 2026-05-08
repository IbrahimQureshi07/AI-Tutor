import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isUserAdmin } from "@/lib/auth/bootstrap-admin";

export type RequireAdminResult =
  | { ok: true; user: User }
  | { ok: false; reason: "unauthorized" | "forbidden" };

/**
 * Shared server-side guard for admin-only surfaces.
 * - unauthorized: not logged in
 * - forbidden: logged in, but not admin
 */
export async function requireAdmin(
  supabase: SupabaseClient,
): Promise<RequireAdminResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, reason: "unauthorized" };
  const allowed = await isUserAdmin(supabase, user);
  if (!allowed) return { ok: false, reason: "forbidden" };
  return { ok: true, user };
}

