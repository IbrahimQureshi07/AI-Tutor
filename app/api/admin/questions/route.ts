import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { validateQuestionForm } from "@/lib/admin/question-form-validate";
import { ensureConceptExists } from "@/lib/admin/ensure-concept";

const UpdateBody = z.object({
  id: z.string().uuid(),
  section_code: z.string().optional(),
  concept_id: z.string().nullable().optional(),
  level: z.enum(["easy", "medium", "hard"]).optional(),
  prompt: z.string().optional(),
  option_a: z.string().optional(),
  option_b: z.string().optional(),
  option_c: z.string().optional(),
  option_d: z.string().optional(),
  correct_option: z.enum(["A", "B", "C", "D"]).optional(),
  explanation: z.string().nullable().optional(),
});

const SELECT =
  "id, section_code, concept_id, level, prompt, option_a, option_b, option_c, option_d, correct_option, explanation";

function clampInt(v: string | null, { min, max, fallback }: { min: number; max: number; fallback: number }) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function cleanSearch(q: string | null): string {
  return (q ?? "").trim().replace(/[%_]/g, "").slice(0, 120);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.reason === "unauthorized" ? "unauthorized" : "forbidden" },
      { status: guard.reason === "unauthorized" ? 401 : 403 },
    );
  }

  const url = new URL(request.url);
  const q = cleanSearch(url.searchParams.get("q"));
  const offset = clampInt(url.searchParams.get("offset"), { min: 0, max: 200_000, fallback: 0 });
  const limit = clampInt(url.searchParams.get("limit"), { min: 1, max: 500, fallback: 200 });

  const admin = createAdminClient();
  let query = admin.from("questions").select(SELECT).order("created_at", { ascending: false }).order("id", { ascending: false });

  if (q) {
    const maybeSection = q.toUpperCase();
    const isSection = /^[AB][1-6]$/.test(maybeSection);
    const like = `%${q}%`;
    query = query.or(
      [
        `prompt.ilike.${like}`,
        `concept_id.ilike.${like}`,
        isSection ? `section_code.eq.${maybeSection}` : null,
      ]
        .filter(Boolean)
        .join(","),
    );
  }

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    questions: data ?? [],
    offset,
    limit,
    nextOffset: offset + (data?.length ?? 0),
    hasMore: (data?.length ?? 0) === limit,
  });
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

  const raw = await request.json().catch(() => ({}));
  const checked = validateQuestionForm(raw);
  if (!checked.ok) {
    return NextResponse.json(
      { error: checked.errors[0], errors: checked.errors },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  try {
    await ensureConceptExists(admin, checked.data.concept_id);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create concept." },
      { status: 500 },
    );
  }
  const payload = {
    ...checked.data,
    pool: "standard" as const,
    source: "admin" as const,
    hint: null as null,
  };
  const { data, error } = await admin
    .from("questions")
    .insert(payload)
    .select(SELECT)
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ question: data });
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

  const raw = await request.json().catch(() => ({}));
  const parsed = UpdateBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update payload." }, { status: 400 });
  }

  const { id, ...rest } = parsed.data;
  if (Object.keys(rest).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  // Full-form updates (admin UI) go through the same validator as create.
  const hasFullForm =
    rest.section_code != null &&
    rest.level != null &&
    rest.prompt != null &&
    rest.option_a != null &&
    rest.option_b != null &&
    rest.option_c != null &&
    rest.option_d != null &&
    rest.correct_option != null;

  let updatePayload: Record<string, unknown> = { ...rest };
  if (hasFullForm) {
    const checked = validateQuestionForm({
      section_code: rest.section_code!,
      concept_id: rest.concept_id,
      level: rest.level!,
      prompt: rest.prompt!,
      option_a: rest.option_a!,
      option_b: rest.option_b!,
      option_c: rest.option_c!,
      option_d: rest.option_d!,
      correct_option: rest.correct_option!,
      explanation: rest.explanation,
    });
    if (!checked.ok) {
      return NextResponse.json(
        { error: checked.errors[0], errors: checked.errors },
        { status: 400 },
      );
    }
    updatePayload = checked.data;
  }

  const admin = createAdminClient();
  if (typeof (updatePayload as { concept_id?: unknown }).concept_id === "string") {
    try {
      await ensureConceptExists(admin, (updatePayload as { concept_id?: string | null }).concept_id);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Could not create concept." },
        { status: 500 },
      );
    }
  }
  const { data, error } = await admin
    .from("questions")
    .update(updatePayload)
    .eq("id", id)
    .select(SELECT)
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ question: data });
}
