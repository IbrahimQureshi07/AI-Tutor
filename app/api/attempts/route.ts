import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  accessDeniedResponse,
  requireFreeAccess,
} from "@/lib/access/require-access";

const Body = z.object({
  session_id: z.string().uuid(),
  question_id: z.string().uuid(),
  mode: z.enum(["assessment", "practice", "mistakes", "mock", "final"]),
  user_answer: z.enum(["A", "B", "C", "D"]).nullable(),
  is_correct: z.boolean(),
  hinted: z.boolean(),
  retried: z.boolean(),
  time_spent_ms: z.number().int().nonnegative(),
  attempt_number: z.number().int().min(1).max(2).default(1),
  result_label: z
    .enum(["mastered", "soft_miss", "hard_miss"])
    .nullable()
    .optional(),
  is_sibling: z.boolean().optional().default(false),
  parent_attempt_id: z.string().uuid().nullable().optional(),
  coached: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const guard = await requireFreeAccess(supabase);
  if (!guard.ok) return accessDeniedResponse(guard);
  const { user, access } = guard;

  const json = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload: Record<string, unknown> = { user_id: user.id, ...parsed.data };

  // Paid-exam protection: don't allow Mock/Final attempts unless paid/grandfathered.
  if (
    (parsed.data.mode === "mock" || parsed.data.mode === "final") &&
    !access.canUsePaidExams
  ) {
    return NextResponse.json(
      { error: "payment_required", unlock: "/unlock" },
      { status: 403 },
    );
  }

  let { data: inserted, error } = await supabase
    .from("attempts")
    .insert(payload)
    .select("id")
    .single();

  // Graceful fallback: if migration 0004 (attempts.coached) hasn't been applied
  // yet (or PostgREST's schema cache is stale), the insert fails. Postgres
  // raises 42703 ("column ... does not exist"); PostgREST surfaces a stale
  // cache as PGRST204 with a "Could not find the 'coached' column" message.
  // Drop the new column and retry so the app keeps working pre-migration.
  const isMissingCoached =
    !!error &&
    (error.code === "42703" ||
      error.code === "PGRST204" ||
      /coached/i.test(error.message ?? ""));
  if (isMissingCoached) {
    console.warn(
      "[api/attempts] attempts.coached column missing or schema cache stale — apply migration 0004_coached_attempts.sql (and reload PostgREST schema). Retrying without coached.",
    );
    delete payload.coached;
    const retry = await supabase
      .from("attempts")
      .insert(payload)
      .select("id")
      .single();
    inserted = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error("[api/attempts] insert failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: inserted?.id ?? null });
}

const Patch = z.object({
  result_label: z.enum(["mastered", "soft_miss", "hard_miss"]),
});

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const guard = await requireFreeAccess(supabase);
  if (!guard.ok) return accessDeniedResponse(guard);
  const { user } = guard;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = Patch.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { error } = await supabase
    .from("attempts")
    .update({ result_label: parsed.data.result_label })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
