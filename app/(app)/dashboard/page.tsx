import { Suspense } from "react";
import { getAppShell, requireAppUser } from "@/lib/auth/request-session";
import { getUserStats } from "@/lib/kpi/stats";
import {
  getAssessmentCoverage,
  type AssessmentCoverage,
} from "@/lib/assessment/coverage";
import { hasFinishedPractice } from "@/lib/practice/completion";
import { formatSectionDisplayLabel } from "@/lib/sections/display-label";
import { DashboardHome } from "@/components/dashboard/dashboard-home";
import { PageLoadingSkeleton } from "@/components/app/page-loading-skeleton";

export default async function DashboardPage() {
  await requireAppUser();
  return (
    <Suspense fallback={<PageLoadingSkeleton />}>
      <DashboardBody />
    </Suspense>
  );
}

async function DashboardBody() {
  const shell = await getAppShell();
  if (!shell) return null;
  const { supabase, user, profile } = shell;

  const [stats, coverage, practiceComplete] = await Promise.all([
    getUserStats(user.id),
    getAssessmentCoverage(supabase, user.id),
    hasFinishedPractice(supabase, user.id),
  ]);
  const firstName = (profile?.full_name ?? user.email ?? "")
    .split(/[\s@]/)[0]
    ?.replace(/^./, (c: string) => c.toUpperCase());

  const next = getNextBestAction(stats, coverage, practiceComplete);
  const continueAssessmentHref = coverage.missing.length
    ? `/assessment?sections=${coverage.missing.join(",")}`
    : "/assessment";

  return (
    <DashboardHome
      firstName={firstName}
      targetExamDate={profile?.target_exam_date ?? null}
      stats={stats}
      coverage={coverage}
      practiceComplete={practiceComplete}
      next={next}
      continueAssessmentHref={continueAssessmentHref}
    />
  );
}

function getNextBestAction(
  stats: Awaited<ReturnType<typeof getUserStats>>,
  coverage: AssessmentCoverage,
  practiceComplete: boolean,
) {
  if (stats.totalAttempts === 0) {
    return {
      title: "Take the 24-question Assessment.",
      detail:
        "It covers every section so we can map your strengths and gaps in about 15 minutes.",
      cta: "Start Assessment",
      href: "/assessment",
    };
  }
  if (!coverage.allCoveredEver) {
    const next = coverage.nextSection;
    const nextLabel = next ? formatSectionDisplayLabel(next) : "";
    const continueHref = coverage.missing.length
      ? `/assessment?sections=${coverage.missing.join(",")}`
      : "/assessment";
    const left = coverage.missing.length;
    return {
      title: next
        ? `Finish the assessment — ${nextLabel} is next.`
        : "Finish the assessment to unlock Practice.",
      detail: `Practice adapts to your weak spots, but needs a baseline on every section first. ${left} section${left === 1 ? "" : "s"} to go.`,
      cta: next ? `Continue: ${nextLabel}` : "Continue assessment",
      href: continueHref,
    };
  }
  if (stats.unresolvedMistakes >= 5) {
    if (!practiceComplete) {
      return {
        title: `You have ${stats.unresolvedMistakes} mistakes queued — Mistakes unlocks after Practice.`,
        detail:
          "Complete one full 110-question practice session. Then you can re-drill your personal mistake pool.",
        cta: "Start Practice",
        href: "/practice",
      };
    }
    return {
      title: `Drill your ${stats.unresolvedMistakes} unresolved mistakes.`,
      detail: "Nothing moves the needle faster than fixing the same misses.",
      cta: "Start Mistakes Test",
      href: "/mistakes",
    };
  }
  if (stats.topWeaknesses.length > 0) {
    const w = stats.topWeaknesses[0];
    return {
      title: `Drill ${formatSectionDisplayLabel(w.code)} — you're at ${w.accuracy}%.`,
      detail: "Jump into a Practice session focused on raising this weak spot.",
      cta: "Practice now",
      href: "/practice",
    };
  }
  if (stats.readinessScore >= 70) {
    return {
      title: "You're close. Take a timed Mock Exam.",
      detail: "Simulate the real SC exam: 120 questions in 240 minutes.",
      cta: "Start Mock Exam",
      href: "/mock-exam",
    };
  }
  return {
    title: "Keep building volume with Practice.",
    detail: "A few more sessions and the readiness score will climb fast.",
    cta: "Practice",
    href: "/practice",
  };
}
