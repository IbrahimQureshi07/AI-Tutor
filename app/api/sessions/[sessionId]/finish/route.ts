import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  accessDeniedResponse,
  requireFreeAccess,
} from "@/lib/access/require-access";
import { buildSummary } from "@/lib/assessment/summary";
import { generateTutorLetter } from "@/lib/assessment/letter";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  score_pct: z.number().min(0).max(100),
  duration_ms: z.number().int().nonnegative(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const guard = await requireFreeAccess(supabase);
  if (!guard.ok) return accessDeniedResponse(guard);
  const { user, access } = guard;

  const json = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("id, mode, config")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();
  if (sErr || !session)
    return NextResponse.json({ error: "session not found" }, { status: 404 });

  if (
    (session.mode === "mock" || session.mode === "final") &&
    !access.canUsePaidExams
  ) {
    return NextResponse.json(
      { error: "payment_required", unlock: "/unlock" },
      { status: 403 },
    );
  }

  // Build summary + tutor letter for assessment v2.
  let summaryPatch: Record<string, unknown> = {};
  if (session.mode === "assessment") {
    const { data: attempts } = await supabase
      .from("attempts")
      .select(
        "question_id, attempt_number, is_correct, result_label, time_spent_ms, question:questions(id, section_code, concept_id, level)",
      )
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    const summary = buildSummary(
      ((attempts ?? []) as unknown) as Parameters<typeof buildSummary>[0],
    );
    const letter = await generateTutorLetter(summary);

    summaryPatch = {
      config: {
        ...((session.config as Record<string, unknown>) ?? {}),
        summary,
        tutor_letter: letter,
      },
    };
  }

  const { error } = await supabase
    .from("sessions")
    .update({
      finished_at: new Date().toISOString(),
      status: "finished",
      score_pct: parsed.data.score_pct,
      duration_ms: parsed.data.duration_ms,
      ...summaryPatch,
    })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
