import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

type ProfileRow = {
  id: string;
  role: string | null;
  is_active: boolean | null;
};

function normalizeEmail(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

function getBootstrapAdminEmail(): string {
  return normalizeEmail(process.env.BOOTSTRAP_ADMIN_EMAIL);
}

function isMissingRoleColumnsError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { message?: string; details?: string; code?: string };
  const msg = `${maybe.message ?? ""} ${maybe.details ?? ""}`.toLowerCase();
  return msg.includes("column") && msg.includes("role") && msg.includes("profiles");
}

export function isBootstrapAdminEmail(email: string | null | undefined): boolean {
  const bootEmail = getBootstrapAdminEmail();
  if (!bootEmail) return false;
  return normalizeEmail(email) === bootEmail;
}

/**
 * Prefer role-based admin if columns exist, otherwise fall back to bootstrap email.
 */
export async function isUserAdmin(
  supabase: SupabaseClient,
  user: User,
): Promise<boolean> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle<Pick<ProfileRow, "role" | "is_active">>();

  if (!error && profile) {
    if (profile.is_active === false) return false;
    return profile.role === "admin";
  }

  if (error && !isMissingRoleColumnsError(error)) {
    console.error("admin status lookup failed", error);
  }
  // Temporary fallback while role columns are unavailable.
  return isBootstrapAdminEmail(user.email);
}

/**
 * One-time bootstrap path:
 * If the configured bootstrap email logs in, ensure their profile is admin.
 */
export async function maybeBootstrapAdmin(
  supabase: SupabaseClient,
  user: User,
): Promise<void> {
  const bootEmail = getBootstrapAdminEmail();
  const userEmail = normalizeEmail(user.email);
  if (!bootEmail || !userEmail || userEmail !== bootEmail) return;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();
  if (error) {
    // Migration not applied yet: silently rely on email fallback.
    if (isMissingRoleColumnsError(error)) return;
    console.error("bootstrap admin profile lookup failed", error);
    return;
  }

  if (!profile) {
    const fallbackName = user.user_metadata?.full_name ?? userEmail.split("@")[0];
    const { error: upsertError } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fallbackName,
      role: "admin",
      is_active: true,
    });
    if (upsertError) {
      console.error("bootstrap admin upsert failed", upsertError);
    }
    return;
  }

  if (profile.role === "admin" && profile.is_active !== false) return;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ role: "admin", is_active: true })
    .eq("id", user.id);
  if (updateError) {
    console.error("bootstrap admin update failed", updateError);
  }
}

