import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveIsAdmin } from "@/lib/auth/bootstrap-admin";

export type AppProfileShell = {
  full_name: string | null;
  role: string | null;
  is_active: boolean | null;
  target_exam_date: string | null;
};

/**
 * One auth + one profiles read per RSC request (deduped via React cache).
 * Use in (app) layout / pages instead of repeating getUser + isUserAdmin.
 */
export const getRequestSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
});

export const getAppShell = cache(async () => {
  const { supabase, user } = await getRequestSession();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, is_active, target_exam_date")
    .eq("id", user.id)
    .maybeSingle<AppProfileShell>();

  return {
    supabase,
    user,
    profile: profile ?? null,
    showAdmin: resolveIsAdmin(user, profile ?? null),
  };
});

/** Logged-in app page/loader. Shares the layout's getUser via React cache. */
export async function requireAppUser() {
  const session = await getRequestSession();
  if (!session.user) redirect("/login");
  return { supabase: session.supabase, user: session.user };
}

export function shellShowAdmin(
  user: User,
  profile: Pick<AppProfileShell, "role" | "is_active"> | null,
): boolean {
  return resolveIsAdmin(user, profile);
}
