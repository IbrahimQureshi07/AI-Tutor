import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { SECTIONS, type SectionCode } from "@/lib/constants";
import {
  getGlobalAssessmentSectionLockStatus,
  setGlobalAssessmentSectionLocked,
} from "@/lib/access/global-assessment-section-locks";

export const dynamic = "force-dynamic";

const SECTION_CODES = SECTIONS.map((s) => s.code) as [
  SectionCode,
  ...SectionCode[],
];

const Body = z.object({
  section: z.enum(SECTION_CODES),
  locked: z.boolean(),
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

  const status = await getGlobalAssessmentSectionLockStatus(supabase);
  return NextResponse.json(status);
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

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 503 });
  }

  const result = await setGlobalAssessmentSectionLocked(
    admin,
    parsed.data.section,
    parsed.data.locked,
    guard.user.id,
  );

  if (!result.ok) {
    const status = result.reason === "migration_required" ? 503 : 500;
    return NextResponse.json(
      {
        error: result.message ?? result.reason,
        reason: result.reason,
        settingsTableReady: result.reason !== "migration_required",
      },
      { status },
    );
  }

  const { bustAccessGateCookie } = await import(
    "@/lib/access/access-gate-cookie"
  );
  await bustAccessGateCookie();

  return NextResponse.json({ ok: true, ...result.status });
}
