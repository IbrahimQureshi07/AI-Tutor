import { MockReport, type MockAttempt } from "@/components/mock/mock-report";
import { loadSessionAttempts } from "@/lib/runner/loader";
import { buildMockReport } from "@/lib/mock/report";
import { MOCK_PASS_PCT } from "@/lib/mock/pick-questions";
import { generateMockNote } from "@/lib/mock/results-note";
import { loadJourney } from "@/lib/journey/load";
import { requireAppUser } from "@/lib/auth/request-session";
import { SECTIONS } from "@/lib/constants";
import type { QuestionRow } from "@/lib/supabase/types";
import { sanitizePlan, type DebriefPlan } from "@/lib/coach/debrief-plan";

type StoredComposition = Parameters<typeof buildMockReport>[0]["composition"];

export default async function MockExamResults({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { session, attempts } = await loadSessionAttempts(sessionId);

  const cfg = (session.config ?? {}) as {
    passPct?: number;
    length?: "full" | "smoke";
    composition?: StoredComposition;
  };
  const passPct = cfg.passPct ?? MOCK_PASS_PCT;
  const length = cfg.length ?? "full";
  const composition = cfg.composition ?? null;

  const normalizedAttempts: MockAttempt[] = attempts
    .filter((a: { question: QuestionRow | null }) => !!a.question)
    .map(
      (a: {
        question: QuestionRow;
        user_answer: "A" | "B" | "C" | "D" | null;
        is_correct: boolean;
      }) => ({
        question: a.question,
        user_answer: a.user_answer,
        is_correct: a.is_correct,
      }),
    );

  const total = normalizedAttempts.length;
  const correct = normalizedAttempts.filter((a) => a.is_correct).length;
  const scorePct =
    session.score_pct != null
      ? Math.round(Number(session.score_pct))
      : total > 0
        ? Math.round((correct / total) * 100)
        : 0;

  const report = buildMockReport({
    attempts: normalizedAttempts.map((a) => ({
      is_correct: a.is_correct,
      question: {
        section_code: a.question.section_code,
        level: a.question.level,
      },
    })),
    composition,
    passPct,
  });

  const { supabase, user } = await requireAppUser();

  const journey = await loadJourney(supabase, user.id);
  const sectionTitles = Object.fromEntries(
    SECTIONS.map((s) => [s.code, s.title]),
  );

  // Cache the AI note in `sessions.config.mock_note` so it doesn't
  // re-generate on every refresh.
  const cfgMut = (session.config ?? {}) as Record<string, unknown>;
  let aiNote = (cfgMut.mock_note as string | undefined) ?? "";
  if (!aiNote || aiNote.length < 30) {
    aiNote = await generateMockNote({
      score: scorePct,
      passPct,
      total,
      correct,
      nationalCorrect: report.nationalCorrect,
      nationalTotal: report.nationalTotal,
      stateCorrect: report.stateCorrect,
      stateTotal: report.stateTotal,
      sections: report.sections,
      difficulty: report.difficulty,
      verdict: report.verdict,
      calibration: report.calibration,
      journey,
      sectionTitles,
    });
    try {
      await supabase
        .from("sessions")
        .update({ config: { ...cfgMut, mock_note: aiNote } })
        .eq("id", sessionId)
        .eq("user_id", user.id);
    } catch (e) {
      console.warn("[mock/results] failed to cache mock_note", e);
    }
  }

  const storedPlan = cfgMut.debrief_plan
    ? sanitizePlan(cfgMut.debrief_plan as Partial<DebriefPlan>)
    : null;
  const storedCommitted = Boolean(cfgMut.debrief_committed);

  return (
    <MockReport
      sessionId={sessionId}
      score={scorePct}
      total={total}
      correct={correct}
      durationMs={session.duration_ms ?? 0}
      passPct={passPct}
      length={length}
      nationalCorrect={report.nationalCorrect}
      nationalTotal={report.nationalTotal}
      stateCorrect={report.stateCorrect}
      stateTotal={report.stateTotal}
      sections={report.sections}
      difficulty={report.difficulty}
      verdict={report.verdict}
      calibration={report.calibration}
      attempts={normalizedAttempts}
      journey={journey}
      aiNote={aiNote}
      initialPlan={storedPlan}
      initialPlanCommitted={storedCommitted}
    />
  );
}
