import { loadSessionAttempts } from "@/lib/runner/loader";
import { requireAppUser } from "@/lib/auth/request-session";
import {
  buildFinalReport,
  predictedPassProbability,
} from "@/lib/final/report";
import { FINAL_PASS_PCT } from "@/lib/final/pick-questions";
import {
  FinalReport,
  type ReviewAttempt,
} from "@/components/final/final-report";
import type { QuestionRow } from "@/lib/supabase/types";

type AttemptRow = {
  question: QuestionRow | null;
  user_answer: "A" | "B" | "C" | "D" | null;
  is_correct: boolean;
};

export default async function FinalTestResults({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { session, attempts } = await loadSessionAttempts(sessionId);

  const cfg = (session.config ?? {}) as {
    passPct?: number;
    portion?: "both" | "national" | "state";
    composition?: unknown;
    report?: unknown;
  };
  const passPct = cfg.passPct ?? FINAL_PASS_PCT;

  const reviewable: ReviewAttempt[] = (attempts as AttemptRow[])
    .filter((a) => !!a.question)
    .map((a) => ({
      question: a.question!,
      user_answer: a.user_answer,
      is_correct: a.is_correct,
    }));

  const report = buildFinalReport({
    attempts: reviewable.map((a) => ({
      is_correct: a.is_correct,
      question: {
        section_code: a.question.section_code,
        level: a.question.level,
      },
    })),
    passPct,
  });

  // Persist the dual-portion report into session.config so the gate
  // (lib/final/completion.ts) can read pass/fail per portion for cooldown
  // and partial-retake state. Merge — don't clobber.
  if (!cfg.report) {
    const { supabase } = await requireAppUser();
    const reportSummary = {
      nationalPct: report.nationalPct,
      statePct: report.statePct,
      nationalPassed: report.nationalPassed,
      statePassed: report.statePassed,
      passed: report.passed,
      verdictKind: report.verdict.kind,
      computedAt: new Date().toISOString(),
    };
    await supabase
      .from("sessions")
      .update({ config: { ...cfg, report: reportSummary } })
      .eq("id", sessionId);
  }

  const probability = predictedPassProbability(report);

  return (
    <FinalReport
      sessionId={sessionId}
      durationMs={session.duration_ms ?? 0}
      passPct={passPct}
      report={report}
      predictedPassProbability={probability}
      attempts={reviewable}
    />
  );
}
