import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isBootstrapAdminEmail } from "@/lib/auth/bootstrap-admin";
import {
  grantCourseAccess,
  loadAdminStudentAccess,
  revokeCourseAccess,
} from "@/lib/access/admin-grant";

export const dynamic = "force-dynamic";

const Body = z.object({
  action: z.enum(["grant", "revoke"]),
});

function accessErrorMessage(
  reason: Exclude<
    Awaited<ReturnType<typeof grantCourseAccess>>,
    { ok: true }
  >["reason"],
): string {
  switch (reason) {
    case "migration_required":
      return "Billing migration (0006_access_billing.sql) is not applied on Supabase yet.";
    case "not_found":
      return "Student profile not found.";
    case "is_admin":
      return "Admin accounts always have full access.";
    case "already_active":
      return "This student already has course access.";
    case "not_active":
      return "This student does not have active course access.";
    case "error":
    default:
      return "Could not update course access.";
  }
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

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 503 });
  }

  const authRes = await admin.auth.admin.getUserById(id);
  if (authRes.error || !authRes.data.user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const profileRes = await admin
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle();
  const isTargetAdmin =
    profileRes.data?.role === "admin" ||
    isBootstrapAdminEmail(authRes.data.user.email);

  const access = await loadAdminStudentAccess(admin, id, isTargetAdmin);
  return NextResponse.json({ access, isAdmin: isTargetAdmin });
}

export async function POST(
  request: Request,
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

  const json = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 503 });
  }

  const authRes = await admin.auth.admin.getUserById(id);
  if (authRes.error || !authRes.data.user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const profileRes = await admin
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle();
  const isTargetAdmin =
    profileRes.data?.role === "admin" ||
    isBootstrapAdminEmail(authRes.data.user.email);

  if (isTargetAdmin) {
    return NextResponse.json({ error: accessErrorMessage("is_admin") }, { status: 400 });
  }

  const current = await loadAdminStudentAccess(admin, id, false);
  if (!current.migrationApplied) {
    return NextResponse.json(
      { error: accessErrorMessage("migration_required") },
      { status: 503 },
    );
  }

  if (parsed.data.action === "grant") {
    if (current.hasFullAccess) {
      return NextResponse.json(
        { error: accessErrorMessage("already_active") },
        { status: 409 },
      );
    }
    const result = await grantCourseAccess(admin, id);
    if (!result.ok) {
      const status =
        result.reason === "migration_required"
          ? 503
          : result.reason === "not_found"
            ? 404
            : 500;
      return NextResponse.json(
        { error: result.message ?? accessErrorMessage(result.reason) },
        { status },
      );
    }
    return NextResponse.json({ ok: true, access: result.access });
  }

  if (!current.hasFullAccess) {
    return NextResponse.json(
      { error: accessErrorMessage("not_active") },
      { status: 409 },
    );
  }

  const result = await revokeCourseAccess(admin, id);
  if (!result.ok) {
    const status =
      result.reason === "migration_required"
        ? 503
        : result.reason === "not_found"
          ? 404
          : 500;
    return NextResponse.json(
      { error: result.message ?? accessErrorMessage(result.reason) },
      { status },
    );
  }
  return NextResponse.json({ ok: true, access: result.access });
}
