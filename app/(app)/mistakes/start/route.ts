import { NextResponse } from "next/server";
import { z } from "zod";
import { startSession } from "@/lib/runner/session";
import { createClient } from "@/lib/supabase/server";
import { hasFinishedPractice } from "@/lib/practice/completion";
import {
  pickMistakesQuestions,
  MISTAKES_TOTAL,
  MISTAKES_SMOKE_TOTAL,
} from "@/lib/mistakes/pick-questions";
import {
  accessDeniedResponse,
  requireModeAccess,
} from "@/lib/access/require-access";

const Body = z
  .object({
    length: z.enum(["full", "smoke"]).optional().default("full"),
  })
  .optional()
  .default({ length: "full" });

export async function POST(req: Request) {
  const supabase = await createClient();
  const guard = await requireModeAccess(supabase, "mistakes");
  if (!guard.ok) return accessDeniedResponse(guard);
  const { user } = guard;

  const practiceDone = await hasFinishedPractice(supabase, user.id);
  if (!practiceDone) {
    return NextResponse.json(
      {
        error:
          "Finish a practice run first (full 110 or 10-question smoke) to unlock the Mistakes Test.",
      },
      { status: 403 },
    );
  }

  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  const length = parsed.success ? parsed.data.length : "full";
  const total =
    length === "smoke" ? MISTAKES_SMOKE_TOTAL : MISTAKES_TOTAL;

  const { questions, mistakeCount, fillerCount, origins } =
    await pickMistakesQuestions(supabase, user.id, total);
  if (!questions.length) {
    return NextResponse.json(
      { error: "No questions available. Import your CSV first." },
      { status: 400 },
    );
  }

  const { sessionId } = await startSession({
    mode: "mistakes",
    config: {
      question_ids: questions.map((q) => q.id),
      mistakes_count: mistakeCount,
      filler_count: fillerCount,
      question_origins: origins,
      length,
      target_total: total,
    },
  });

  return NextResponse.json({
    sessionId,
    runnerPath: `/mistakes/${sessionId}`,
    length,
    total,
    composition: { mistakes: mistakeCount, filler: fillerCount },
  });
}
