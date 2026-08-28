import { NextResponse } from "next/server";
import { z } from "zod";
import { startSession } from "@/lib/runner/session";
import { createClient } from "@/lib/supabase/server";
import { getAssessmentCoverage } from "@/lib/assessment/coverage";
import {
  pickPracticeQuestions,
  PRACTICE_TOTAL,
  PRACTICE_SMOKE_TOTAL,
} from "@/lib/practice/pick-questions";
import { DebriefPlanSchema, sanitizePlan } from "@/lib/coach/debrief-plan";

const Body = z
  .object({
    length: z.enum(["full", "smoke", "custom"]).optional().default("full"),
    plan: DebriefPlanSchema.optional(),
    fromSessionId: z.string().uuid().optional(),
  })
  .optional()
  .default({ length: "full" });

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const coverage = await getAssessmentCoverage(supabase, user.id);
  if (!coverage.allCoveredEver) {
    return NextResponse.json(
      {
        error: `Finish the assessment first — ${coverage.missingEver.length} section${
          coverage.missingEver.length === 1 ? "" : "s"
        } still need a baseline.`,
        missing: coverage.missingEver,
        nextSection: coverage.nextSection,
      },
      { status: 403 },
    );
  }

  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  const length = parsed.success ? parsed.data.length : "full";

  // If a plan is provided, look up a plan-specified total; fallback otherwise.
  let plan = parsed.success && parsed.data.plan ? sanitizePlan(parsed.data.plan) : null;

  // Also try to pull a saved plan from the originating session (if the user
  // accepted one via the debrief agent and came back later).
  if (!plan && parsed.success && parsed.data.fromSessionId) {
    const { data: src } = await supabase
      .from("sessions")
      .select("config")
      .eq("id", parsed.data.fromSessionId)
      .eq("user_id", user.id)
      .maybeSingle();
    const stored = (src?.config as Record<string, unknown> | null)?.debrief_plan;
    if (stored) plan = sanitizePlan(stored as Record<string, unknown>);
  }

  const total =
    length === "custom" && plan?.total
      ? plan.total
      : length === "smoke"
        ? PRACTICE_SMOKE_TOTAL
        : PRACTICE_TOTAL;

  const qs = await pickPracticeQuestions(supabase, user.id, total, plan);
  if (!qs.length) {
    return NextResponse.json(
      { error: "No questions available. Import your CSV first." },
      { status: 400 },
    );
  }

  const { sessionId } = await startSession({
    mode: "practice",
    config: {
      question_ids: qs.map((q) => q.id),
      length,
      target_total: total,
      debrief_plan_applied: plan ?? null,
      from_session_id: parsed.success ? (parsed.data.fromSessionId ?? null) : null,
    },
  });

  return NextResponse.json({
    sessionId,
    runnerPath: `/practice/${sessionId}`,
    length,
    total,
    planApplied: !!plan,
  });
}
