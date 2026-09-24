import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isBootstrapAdminEmail } from "@/lib/auth/bootstrap-admin";
import { isMissingDisabledModesColumnError } from "@/lib/access/check-access";
import { MODES, type ModeKey } from "@/lib/constants";

export const dynamic = "force-dynamic";

const MODE_KEYS = Object.keys(MODES) as ModeKey[];
const Body = z.object({
  mode: z.enum(["assessment", "practice", "mistakes", "mock", "final"]),
  locked: z.boolean(),
});

function normalizeModes(value: unknown): ModeKey[] {
  if (!Array.isArray(value)) return [];
  return MODE_KEYS.filter((mode) => value.includes(mode));
}

async function getContext(id: string) {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if (!guard.ok) {
    return {
      error: NextResponse.json(
        { error: guard.reason === "unauthorized" ? "unauthorized" : "forbidden" },
        { status: guard.reason === "unauthorized" ? 401 : 403 },
      ),
    };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return {
      error: NextResponse.json(
        { error: "Server misconfigured." },
        { status: 503 },
      ),
    };
  }

  const authRes = await admin.auth.admin.getUserById(id);
  if (authRes.error || !authRes.data.user) {
    return {
      error: NextResponse.json({ error: "User not found." }, { status: 404 }),
    };
  }

  const profileRes = await admin
    .from("profiles")
    .select("role, disabled_modes")
    .eq("id", id)
    .maybeSingle();

  if (profileRes.error) {
    if (isMissingDisabledModesColumnError(profileRes.error)) {
      return {
        error: NextResponse.json(
          {
            error:
              "Mode-lock migration (0008_profile_disabled_modes.sql) is not applied yet.",
            migrationApplied: false,
          },
          { status: 503 },
        ),
      };
    }
    return {
      error: NextResponse.json(
        { error: profileRes.error.message },
        { status: 500 },
      ),
    };
  }

  if (!profileRes.data) {
    return {
      error: NextResponse.json(
        { error: "Student profile not found." },
        { status: 404 },
      ),
    };
  }

  const isTargetAdmin =
    profileRes.data.role === "admin" ||
    isBootstrapAdminEmail(authRes.data.user.email);

  return {
    admin,
    isTargetAdmin,
    disabledModes: normalizeModes(profileRes.data.disabled_modes),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const context = await getContext(id);
  if ("error" in context) return context.error;

  return NextResponse.json({
    migrationApplied: true,
    disabledModes: context.disabledModes,
    isAdmin: context.isTargetAdmin,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const context = await getContext(id);
  if ("error" in context) return context.error;
  if (context.isTargetAdmin) {
    return NextResponse.json(
      { error: "Admin accounts cannot be mode-locked." },
      { status: 400 },
    );
  }

  const next = new Set(context.disabledModes);
  if (parsed.data.locked) next.add(parsed.data.mode);
  else next.delete(parsed.data.mode);

  // Store in canonical order for stable API responses and predictable diffs.
  const disabledModes = MODE_KEYS.filter((mode) => next.has(mode));
  const { data, error } = await context.admin
    .from("profiles")
    .update({ disabled_modes: disabledModes })
    .eq("id", id)
    .select("disabled_modes")
    .single();

  if (error) {
    if (isMissingDisabledModesColumnError(error)) {
      return NextResponse.json(
        {
          error:
            "Mode-lock migration (0008_profile_disabled_modes.sql) is not applied yet.",
          migrationApplied: false,
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    migrationApplied: true,
    disabledModes: normalizeModes(data.disabled_modes),
  });
}
