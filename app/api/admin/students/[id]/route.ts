import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isBootstrapAdminEmail } from "@/lib/auth/bootstrap-admin";
import { loadAdminStudentAccess } from "@/lib/access/admin-grant";
import { getUserStats } from "@/lib/kpi/stats";
import { loadJourney } from "@/lib/journey/load";

export const dynamic = "force-dynamic";

function hasMissingRoleColumns(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { message?: string; details?: string };
  const msg = `${e.message ?? ""} ${e.details ?? ""}`.toLowerCase();
  return msg.includes("column") && msg.includes("role") && msg.includes("profiles");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.reason === "unauthorized" ? "unauthorized" : "forbidden" },
      { status: guard.reason === "unauthorized" ? 401 : 403 },
    );
  }

  const admin = createAdminClient();

  const authRes = await admin.auth.admin.getUserById(id);
  if (authRes.error || !authRes.data.user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const authUser = authRes.data.user;

  let profile: { full_name?: string | null; role?: string; is_active?: boolean } | null =
    null;
  const profileRes = await admin
    .from("profiles")
    .select("full_name, role, is_active")
    .eq("id", id)
    .maybeSingle();
  if (profileRes.error && !hasMissingRoleColumns(profileRes.error)) {
    // Try a minimal select if role/is_active columns are absent.
    const fallback = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", id)
      .maybeSingle();
    profile = fallback.data ?? null;
  } else {
    profile = profileRes.data ?? null;
  }

  const fallbackAdmin = isBootstrapAdminEmail(authUser.email);
  const role =
    (profile?.role as "student" | "admin" | undefined) ??
    (fallbackAdmin ? "admin" : "student");
  const isTargetAdmin = role === "admin";

  const [stats, journey, access] = await Promise.all([
    getUserStats(id, admin),
    loadJourney(admin, id, { perModeLimit: 12, combinedLimit: 24 }),
    loadAdminStudentAccess(admin, id, isTargetAdmin),
  ]);

  return NextResponse.json({
    student: {
      id: authUser.id,
      email: authUser.email ?? null,
      fullName:
        (profile?.full_name as string | null | undefined) ??
        ((authUser.user_metadata?.full_name as string | undefined) ?? null),
      role,
      isActive: (profile?.is_active as boolean | undefined) ?? true,
      createdAt: authUser.created_at ?? null,
      lastSignInAt: authUser.last_sign_in_at ?? null,
    },
    access,
    stats,
    journey,
  });
}
