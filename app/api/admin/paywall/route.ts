import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  getPaywallStatus,
  setPaywallEnabled,
} from "@/lib/access/paywall-settings";

export const dynamic = "force-dynamic";

const Body = z.object({
  enabled: z.boolean(),
});

export async function GET() {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.reason === "unauthorized" ? "unauthorized" : "forbidden" },
      { status: guard.reason === "unauthorized" ? 401 : 403 },
    );
  }

  const status = await getPaywallStatus(supabase);
  return NextResponse.json(status);
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.reason === "unauthorized" ? "unauthorized" : "forbidden" },
      { status: guard.reason === "unauthorized" ? 401 : 403 },
    );
  }

  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Send { enabled: true | false }." },
      { status: 400 },
    );
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 503 });
  }

  const result = await setPaywallEnabled(
    admin,
    parsed.data.enabled,
    guard.user.id,
  );

  if (!result.ok) {
    const status =
      result.reason === "migration_required"
        ? 503
        : result.reason === "env_locked"
          ? 409
          : 500;
    return NextResponse.json(
      { error: result.message ?? result.reason, reason: result.reason },
      { status },
    );
  }

  // Force fresh access checks after global paywall flip.
  const { bustAccessGateCookie } = await import("@/lib/access/access-gate-cookie");
  await bustAccessGateCookie();

  return NextResponse.json(result.status);
}
