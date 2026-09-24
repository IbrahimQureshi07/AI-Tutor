import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { startSession, attachQuestionsToSession } from "@/lib/runner/session";
import { pickAssessmentQuestions } from "@/lib/assessment/select";
import {
  accessDeniedResponse,
  requireModeAccess,
} from "@/lib/access/require-access";

const SMOKE_PER_SECTION = 2;

const VALID_SECTIONS = [
  "A1","A2","A3","A4","A5","A6",
  "B1","B2","B3","B4","B5","B6",
] as const;

const Body = z.object({
  length: z.enum(["quick", "deep", "smoke"]).default("quick"),
  sections: z
    .array(z.enum(VALID_SECTIONS))
    .min(1, "Pick at least one section.")
    .max(VALID_SECTIONS.length),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const { length, sections } = parsed.data;
  const perSection =
    length === "deep" ? 35 : length === "quick" ? 15 : SMOKE_PER_SECTION;

  const supabase = await createClient();
  const guard = await requireModeAccess(supabase, "assessment");
  if (!guard.ok) return accessDeniedResponse(guard);

  const questions = await pickAssessmentQuestions(
    supabase,
    sections,
    perSection,
  );

  if (!questions.length) {
    return NextResponse.json(
      {
        error:
          "No questions available. Run `npm run import` to load the question bank.",
      },
      { status: 400 },
    );
  }

  const { sessionId } = await startSession({
    mode: "assessment",
    config: {
      version: 2,
      length,
      sections,
      per_section: perSection,
      question_ids: questions.map((q) => q.id),
    },
  });

  await attachQuestionsToSession(sessionId, questions.map((q) => q.id));

  return NextResponse.json({
    sessionId,
    runnerPath: `/assessment/${sessionId}`,
    total: questions.length,
  });
}
