import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

const CreateBody = z.object({
  section_code: z.string().min(1),
  concept_id: z.string().nullable().optional(),
  level: z.enum(["easy", "medium", "hard"]),
  prompt: z.string().min(8),
  option_a: z.string().min(1),
  option_b: z.string().min(1),
  option_c: z.string().min(1),
  option_d: z.string().min(1),
  correct_option: z.enum(["A", "B", "C", "D"]),
  explanation: z.string().nullable().optional(),
});

const UpdateBody = CreateBody.partial().extend({
  id: z.string().uuid(),
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

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("questions")
    .select(
      "id, section_code, concept_id, level, prompt, option_a, option_b, option_c, option_d, correct_option, explanation",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ questions: data ?? [] });
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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createAdminClient();
  const payload = {
    ...parsed.data,
    concept_id: parsed.data.concept_id?.trim() || null,
    explanation: parsed.data.explanation?.trim() || null,
    pool: "standard" as const,
    source: "admin" as const,
    hint: null as null,
  };
  const { data, error } = await admin
    .from("questions")
    .insert(payload)
    .select(
      "id, section_code, concept_id, level, prompt, option_a, option_b, option_c, option_d, correct_option, explanation",
    )
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

  const parsed = UpdateBody.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { id, ...rest } = parsed.data;
  if (Object.keys(rest).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("questions")
    .update({
      ...rest,
      concept_id: rest.concept_id?.trim() || null,
      explanation: rest.explanation?.trim() || null,
    })
    .eq("id", id)
    .select(
      "id, section_code, concept_id, level, prompt, option_a, option_b, option_c, option_d, correct_option, explanation",
    )
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ question: data });
}

