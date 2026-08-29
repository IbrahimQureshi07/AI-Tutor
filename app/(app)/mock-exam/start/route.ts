import { NextResponse } from "next/server";
import { z } from "zod";
import { startSession } from "@/lib/runner/session";
import { createClient } from "@/lib/supabase/server";
import { hasFinishedMistakes } from "@/lib/mock/completion";
import { getAccessState } from "@/lib/access/check-access";
import {
  pickMockQuestions,
  MOCK_TOTAL,
  MOCK_SMOKE_TOTAL,
  MOCK_DURATION_MIN,
  MOCK_PASS_PCT,
} from "@/lib/mock/pick-questions";

const Body = z
  .object({
    length: z.enum(["full", "smoke"]).optional().default("full"),
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

  const access = await getAccessState(supabase, user);
  if (!access.canUsePaidExams) {
    return NextResponse.json(
      { error: "payment_required", unlock: "/unlock" },
      { status: 403 },
    );
  }

  const mistakesDone = await hasFinishedMistakes(supabase, user.id);
  if (!mistakesDone) {
    return NextResponse.json(
      {
        error:
          "Mock Exam is locked until you finish a Mistakes Test (full or smoke, 80% answered).",
      },
      { status: 403 },
    );
  }

  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  const length = parsed.success ? parsed.data.length : "full";
  const total = length === "smoke" ? MOCK_SMOKE_TOTAL : MOCK_TOTAL;

  const durationMin =
    length === "smoke"
      ? Math.max(10, Math.round((total / MOCK_TOTAL) * MOCK_DURATION_MIN))
      : MOCK_DURATION_MIN;

  const { questions, composition } = await pickMockQuestions(
    supabase,
    user.id,
    total,
  );

  if (questions.length < Math.min(20, total)) {
    return NextResponse.json(
      { error: "Not enough questions in the bank to run the Mock Exam." },
      { status: 400 },
    );
  }

  const { sessionId } = await startSession({
    mode: "mock",
    config: {
      question_ids: questions.map((q) => q.id),
      durationMin,
      passPct: MOCK_PASS_PCT,
      length,
      target_total: total,
      composition,
    },
  });

  return NextResponse.json({
    sessionId,
    runnerPath: `/mock-exam/${sessionId}`,
    length,
    total,
    durationMin,
  });
}
