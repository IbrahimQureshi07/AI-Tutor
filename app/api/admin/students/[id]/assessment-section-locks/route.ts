import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isBootstrapAdminEmail } from "@/lib/auth/bootstrap-admin";
import { isMissingDisabledAssessmentSectionsColumnError } from "@/lib/access/check-access";
import { SECTIONS, type SectionCode } from "@/lib/constants";

export const dynamic = "force-dynamic";

const SECTION_CODES = SECTIONS.map((s) => s.code) as [
  SectionCode,
  ...SectionCode[],
];

const Body = z.object({
  section: z.enum(SECTION_CODES),
  locked: z.boolean(),
});

function normalizeSections(value: unknown): SectionCode[] {
  if (!Array.isArray(value)) return [];
  return SECTION_CODES.filter((code) => value.includes(code));
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
    .select("role, disabled_assessment_sections")
    .eq("id", id)
    .maybeSingle();

  if (profileRes.error) {
    if (isMissingDisabledAssessmentSectionsColumnError(profileRes.error)) {
      return {
        error: NextResponse.json(
          {
            error:
              "Assessment section-lock migration (0009_profile_disabled_assessment_sections.sql) is not applied yet.",
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
    disabledAssessmentSections: normalizeSections(
      profileRes.data.disabled_assessment_sections,
    ),
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
    disabledAssessmentSections: context.disabledAssessmentSections,
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
      { error: "Admin accounts cannot have Assessment sections locked." },
      { status: 400 },
    );
  }

  const next = new Set(context.disabledAssessmentSections);
  if (parsed.data.locked) next.add(parsed.data.section);
  else next.delete(parsed.data.section);

  // Canonical A1–B6 order for stable responses.
  const disabledAssessmentSections = SECTION_CODES.filter((code) =>
    next.has(code),
  );

  const { data, error } = await context.admin
    .from("profiles")
    .update({ disabled_assessment_sections: disabledAssessmentSections })
    .eq("id", id)
    .select("disabled_assessment_sections")
    .single();

  if (error) {
    if (isMissingDisabledAssessmentSectionsColumnError(error)) {
      return NextResponse.json(
        {
          error:
            "Assessment section-lock migration (0009_profile_disabled_assessment_sections.sql) is not applied yet.",
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
    disabledAssessmentSections: normalizeSections(
      data.disabled_assessment_sections,
    ),
  });
}
