import { NextResponse } from "next/server";
import { z } from "zod";
import { startSession } from "@/lib/runner/session";
import { createClient } from "@/lib/supabase/server";
import { isUserAdmin } from "@/lib/auth/bootstrap-admin";
import { getAccessState } from "@/lib/access/check-access";
import { getFinalGateStatus } from "@/lib/final/completion";
import {
  pickFinalQuestions,
  FINAL_NATIONAL_DURATION_MIN,
  FINAL_STATE_DURATION_MIN,
  FINAL_PASS_PCT,
  type Portion,
} from "@/lib/final/pick-questions";

const Body = z
  .object({
    portion: z.enum(["both", "national", "state"]).optional().default("both"),
  })
  .optional()
  .default({ portion: "both" });

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const access = await getAccessState(supabase, user);
  if (!access.canUsePaidExams) {
    return NextResponse.json(
      { error: "payment_required", unlock: "/unlock" },
      { status: 403 },
    );
  }

  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  let portion: "both" | Portion = parsed.success ? parsed.data.portion : "both";

  // Gate check + partial-retake enforcement.
  const isAdmin = await isUserAdmin(supabase, user);
  const gate = await getFinalGateStatus(supabase, user.id, isAdmin);
  // Partial-retake mode forces the missing portion regardless of request.
  if (gate.partialRetake?.active) {
    portion = gate.partialRetake.needPortion;
  } else if (!gate.unlocked) {
    return NextResponse.json(
      { error: gate.reasons[0] ?? "Final Test is locked." },
      { status: 403 },
    );
  }

  const pick = await pickFinalQuestions(supabase, user.id, { portion });

  const all = [...pick.nationalQuestions, ...pick.stateQuestions];
  if (all.length === 0) {
    return NextResponse.json(
      {
        error:
          "Held-out pool is exhausted for this user — no unseen questions left for the requested portion.",
      },
      { status: 400 },
    );
  }

  // Per-portion durations; informational total in config.
  const nationalDuration =
    pick.nationalQuestions.length > 0 ? FINAL_NATIONAL_DURATION_MIN : 0;
  const stateDuration =
    pick.stateQuestions.length > 0 ? FINAL_STATE_DURATION_MIN : 0;

  const { sessionId } = await startSession({
    mode: "final",
    config: {
      // Persist national first, state second — runner uses portions
      // independently but loader uses this order for review listing.
      question_ids: all.map((q) => q.id),
      national_question_ids: pick.nationalQuestions.map((q) => q.id),
      state_question_ids: pick.stateQuestions.map((q) => q.id),
      portion,
      passPct: FINAL_PASS_PCT,
      national_duration_min: nationalDuration,
      state_duration_min: stateDuration,
      durationMin: nationalDuration + stateDuration,
      composition: pick.composition,
    },
  });

  return NextResponse.json({
    sessionId,
    runnerPath: `/final-test/${sessionId}`,
    portion,
    nationalCount: pick.nationalQuestions.length,
    stateCount: pick.stateQuestions.length,
  });
}
