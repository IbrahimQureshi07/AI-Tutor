import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_SESSION_COOKIE } from "@/lib/demo/constants";
import { readDemoSession, currentQuestionId } from "@/lib/demo/request-session";
import {
  demoSessionCookieOptions,
  encodeDemoSession,
} from "@/lib/demo/session-cookie";
import type { QuestionRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const Body = z.object({
  answer: z.enum(["A", "B", "C", "D"]),
});

export async function POST(request: NextRequest) {
  const session = readDemoSession(request);
  if (!session || session.complete) {
    return NextResponse.json({ error: "No active demo session." }, { status: 400 });
  }

  const questionId = currentQuestionId(session);
  if (!questionId) {
    return NextResponse.json({ error: "Demo complete." }, { status: 400 });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid answer." }, { status: 400 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 503 });
  }

  const { data: q, error } = await admin
    .from("questions")
    .select(
      "id, correct_option, explanation, hint, option_a, option_b, option_c, option_d",
    )
    .eq("id", questionId)
    .single();

  if (error || !q) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }

  const row = q as QuestionRow;
  const isCorrect = parsed.data.answer === row.correct_option;
  const nextIndex = session.index + 1;
  const done = nextIndex >= session.questionIds.length;

  const updated = {
    ...session,
    index: done ? session.index : nextIndex,
    answered: session.answered + 1,
    correct: session.correct + (isCorrect ? 1 : 0),
    complete: done,
  };

  const res = NextResponse.json({
    correct: isCorrect,
    correctOption: row.correct_option,
    explanation: row.explanation,
    hint: row.hint,
    done,
    answered: updated.answered,
    correctCount: updated.correct,
    total: session.questionIds.length,
    accuracy: Math.round((100 * updated.correct) / updated.answered),
  });

  res.cookies.set(
    DEMO_SESSION_COOKIE,
    encodeDemoSession(updated),
    demoSessionCookieOptions(),
  );

  return res;
}
