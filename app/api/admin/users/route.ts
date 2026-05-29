import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isBootstrapAdminEmail } from "@/lib/auth/bootstrap-admin";

const CreateBody = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters."),
  fullName: z.string().trim().optional(),
  role: z.enum(["student", "admin"]).default("student"),
});

const UpdateBody = z.object({
  userId: z.string().uuid(),
  role: z.enum(["student", "admin"]).optional(),
  isActive: z.boolean().optional(),
});

function formatAuthAdminError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already") && (m.includes("registered") || m.includes("exists"))) {
    return "A user with this email already exists.";
  }
  return message;
}

function hasMissingRoleColumns(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { message?: string; details?: string };
  const msg = `${e.message ?? ""} ${e.details ?? ""}`.toLowerCase();
  return msg.includes("column") && msg.includes("role") && msg.includes("profiles");
}

export async function GET() {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.reason === "unauthorized" ? "unauthorized" : "forbidden" },
      { status: guard.reason === "unauthorized" ? 401 : 403 },
    );
  }

  const admin = createAdminClient();
  const { data: authData, error: authErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 500 });
  }

  const { data: profiles, error: pErr } = await admin
    .from("profiles")
    .select("id, full_name, role, is_active");
  if (pErr && !hasMissingRoleColumns(pErr)) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  const items = (authData.users ?? []).map((u) => {
    const profile = byId.get(u.id);
    const email = u.email ?? null;
    const fallbackAdmin = isBootstrapAdminEmail(email);
    return {
      id: u.id,
      email,
      createdAt: u.created_at,
      fullName:
        (profile?.full_name as string | null | undefined) ??
        ((u.user_metadata?.full_name as string | undefined) ?? null),
      role:
        (profile?.role as "student" | "admin" | undefined) ??
        (fallbackAdmin ? "admin" : "student"),
      isActive:
        (profile?.is_active as boolean | undefined) ?? (fallbackAdmin ? true : true),
    };
  });

  return NextResponse.json({ users: items });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.reason === "unauthorized" ? "unauthorized" : "forbidden" },
      { status: guard.reason === "unauthorized" ? 401 : 403 },
    );
  }

  const parsed = CreateBody.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const first =
      flat.fieldErrors.password?.[0] ??
      flat.fieldErrors.email?.[0] ??
      "Invalid input.";
    return NextResponse.json({ error: first, details: flat }, { status: 400 });
  }

  const { email, password, fullName, role } = parsed.data;
  const admin = createAdminClient();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName?.trim() || email.split("@")[0],
    },
  });

  if (createErr || !created.user) {
    const msg = createErr?.message ?? "Could not create user.";
    const status = msg.toLowerCase().includes("already") ? 409 : 500;
    return NextResponse.json(
      { error: formatAuthAdminError(msg) },
      { status },
    );
  }

  const userId = created.user.id;
  const displayName =
    fullName?.trim() ||
    (created.user.user_metadata?.full_name as string | undefined) ||
    email.split("@")[0];

  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      full_name: displayName,
      role,
      is_active: true,
    },
    { onConflict: "id" },
  );

  if (profileErr && !hasMissingRoleColumns(profileErr)) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  if (profileErr && hasMissingRoleColumns(profileErr)) {
    await admin.from("profiles").upsert(
      { id: userId, full_name: displayName },
      { onConflict: "id" },
    );
  }

  return NextResponse.json({
    user: {
      id: userId,
      email: created.user.email ?? email,
      fullName: displayName,
      role: hasMissingRoleColumns(profileErr) && isBootstrapAdminEmail(email)
        ? "admin"
        : role,
      isActive: true,
      createdAt: created.user.created_at,
    },
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.reason === "unauthorized" ? "unauthorized" : "forbidden" },
      { status: guard.reason === "unauthorized" ? 401 : 403 },
    );
  }

  const parsed = UpdateBody.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { userId, role, isActive } = parsed.data;
  if (role == null && isActive == null) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (role != null) patch.role = role;
  if (isActive != null) patch.is_active = isActive;

  const { error } = await admin.from("profiles").update(patch).eq("id", userId);
  if (error) {
    const status = hasMissingRoleColumns(error) ? 409 : 500;
    return NextResponse.json(
      {
        error:
          status === 409
            ? "Role columns are not available yet. Run migration 0005_admin_roles.sql first."
            : error.message,
      },
      { status },
    );
  }
  return NextResponse.json({ ok: true });
}

