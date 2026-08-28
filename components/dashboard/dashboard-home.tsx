"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Target,
  Flame,
  Sparkles,
  Clock3,
  Activity,
  CalendarDays,
  Timer,
  Trophy,
  BarChart3,
  Map,
  Flag,
  Zap,
  Brain,
  ListTodo,
} from "lucide-react";
import type { UserStats } from "@/lib/kpi/stats";
import type { AssessmentCoverage } from "@/lib/assessment/coverage";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KpiStatCard } from "@/components/kpi/kpi-stat-card";
import { MasteryMap } from "@/components/kpi/mastery-map";
import { StrengthsWeaknesses } from "@/components/kpi/strengths-weaknesses";
import { ActivityHeatmap } from "@/components/kpi/activity-heatmap";
import { ReadinessRing } from "@/components/kpi/readiness-ring";
import { StreakFlame } from "@/components/kpi/streak-flame";
import { ModeCards } from "@/components/kpi/mode-cards";
import { Sparkline } from "@/components/kpi/sparkline";
import { cn, formatMs } from "@/lib/utils";
import { formatSectionDisplayLabel } from "@/lib/sections/display-label";

export type DashboardNextAction = {
  title: string;
  detail: string;
  cta: string;
  href: string;
};

type Props = {
  firstName?: string;
  targetExamDate: string | null;
  stats: UserStats;
  coverage: AssessmentCoverage;
  practiceComplete: boolean;
  next: DashboardNextAction;
  continueAssessmentHref: string;
};

function formatStudyMinutes(ms: number) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).setHours(0, 0, 0, 0);
  const now = new Date().setHours(0, 0, 0, 0);
  return Math.ceil((t - now) / (24 * 60 * 60 * 1000));
}

export function DashboardHome({
  firstName,
  targetExamDate,
  stats,
  coverage,
  practiceComplete,
  next,
  continueAssessmentHref,
}: Props) {
  const sectionsWithData = stats.mastery.filter((m) => m.total > 0).length;
  const delta7 =
    stats.sevenDayAccuracy && stats.overallAccuracy
      ? Math.round(stats.sevenDayAccuracy - stats.overallAccuracy)
      : null;
  const until = daysUntil(targetExamDate);

  return (
    <div className="space-y-8">
      <HeroSection
        firstName={firstName}
        until={until}
        stats={stats}
        coverage={coverage}
        continueAssessmentHref={continueAssessmentHref}
      />

      {/* Dense KPI wall */}
      <section>
        <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
          <div>
            <h2 className="font-serif text-2xl font-semibold tracking-tight text-ink">
              Performance pulse
            </h2>
            <p className="text-sm text-ink-muted mt-0.5">
              Lifetime accuracy, recent heat, and how you split National vs State.
            </p>
          </div>
          <Badge variant="outline" className="text-[11px] shrink-0">
            {sectionsWithData}/12 sections with data
          </Badge>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
          <KpiStatCard
            label="Overall accuracy"
            value={stats.overallAccuracy}
            suffix="%"
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            spark={stats.sparkline}
            delta={delta7}
            index={0}
          />
          <KpiStatCard
            label="7-day accuracy"
            value={stats.sevenDayAccuracy}
            suffix="%"
            icon={<Zap className="h-3.5 w-3.5" />}
            index={1}
          />
          <KpiStatCard
            label="Readiness"
            value={stats.readinessScore}
            suffix="/100"
            icon={<Sparkles className="h-3.5 w-3.5" />}
            index={2}
          />
          <KpiStatCard
            label="Study streak"
            value={stats.streakDays}
            suffix={stats.streakDays === 1 ? "day" : "days"}
            icon={<Flame className="h-3.5 w-3.5" />}
            index={3}
          />
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
          <KpiStatCard
            label="Questions · correct"
            value={`${stats.totalCorrect}/${stats.totalAttempts}`}
            icon={<Target className="h-3.5 w-3.5" />}
            index={0}
          />
          <KpiStatCard
            label="Attempts today"
            value={stats.attemptsToday}
            icon={<Activity className="h-3.5 w-3.5" />}
            index={1}
          />
          <KpiStatCard
            label="Study time (30d)"
            value={stats.studyMsLast30 ? formatStudyMinutes(stats.studyMsLast30) : "0 min"}
            icon={<Timer className="h-3.5 w-3.5" />}
            index={2}
          />
          <KpiStatCard
            label="Active days (30d)"
            value={stats.activeDaysLast30}
            suffix="/30"
            icon={<CalendarDays className="h-3.5 w-3.5" />}
            index={3}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-3">
          <NationalStateCard national={stats.nationalAccuracy} state={stats.stateAccuracy} />
          <MockScoresCard best={stats.bestMockScore} last={stats.lastMockScore} lastPractice={stats.lastPracticeScore} />
          <ModeVolumeCard totals={stats.modeTotals} finished30={stats.finishedSessionsLast30} />
        </div>

        <div className="mt-3 rounded-2xl border border-border bg-elevated/30 p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
            <span className="text-xs uppercase tracking-widest text-ink-muted flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5" />
              14-day accuracy trend
            </span>
            <span className="text-[11px] text-ink-muted">Daily first-try mix</span>
          </div>
          <div className="h-16 w-full max-w-2xl">
            {stats.sparkline.some((v) => v > 0) ? (
              <Sparkline values={stats.sparkline} height={64} />
            ) : (
              <p className="text-sm text-ink-muted py-4">
                Your sparkline fills in as you log study days.
              </p>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-2xl font-semibold">Jump back in</h2>
        </div>
        <ModeCards />
      </section>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4">
        <Card className="overflow-hidden border-border/80 shadow-soft">
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Map className="h-5 w-5 text-primary" />
                  Mastery map
                </CardTitle>
                <CardDescription>
                  Accuracy across every section from A1 to B6.
                </CardDescription>
              </div>
              <Badge variant="outline">{sectionsWithData}/12 covered</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <MasteryMap mastery={stats.mastery} />
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-border/80 shadow-soft bg-gradient-to-b from-surface to-primary-soft/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-primary" />
              Readiness score
            </CardTitle>
            <CardDescription>Weighted blend of accuracy, recency, mock, and coverage.</CardDescription>
          </CardHeader>
          <CardContent>
            <ReadinessRing value={stats.readinessScore} />
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4">
        <Card className="border-border/80 shadow-soft">
          <CardHeader>
            <CardTitle>Strengths &amp; focus areas</CardTitle>
            <CardDescription>
              Where you&apos;re crushing it, and where to spend your next session.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StrengthsWeaknesses
              strengths={stats.topStrengths}
              weaknesses={stats.topWeaknesses}
            />
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-soft">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Activity</CardTitle>
                <CardDescription>Last 10 weeks.</CardDescription>
              </div>
              <StreakFlame days={stats.streakDays} />
            </div>
          </CardHeader>
          <CardContent>
            <ActivityHeatmap days={stats.dailyActivity} />
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.5fr] gap-4">
        <Card className="relative overflow-hidden border-primary/20 shadow-soft">
          <div className="absolute inset-0 mesh-gradient opacity-35" aria-hidden />
          <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-primary/20 blur-3xl pointer-events-none" aria-hidden />
          <CardHeader className="relative">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle>Next best action</CardTitle>
            </div>
            <CardDescription>Based on your current pulse.</CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <p className="text-ink font-medium text-lg leading-snug">{next.title}</p>
            <p className="text-sm text-ink-muted mt-1">{next.detail}</p>
            <div className="mt-4">
              <Button asChild>
                <Link href={next.href}>{next.cta}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <RecentSessionsCard sessions={stats.recentSessions} />
      </div>

      {stats.unresolvedMistakes > 0 && (
        <Card className="border-warn/25 bg-gradient-to-r from-warn/5 to-transparent overflow-hidden">
          <CardContent className="py-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-warn/15 grid place-items-center ring-1 ring-warn/25">
                <Activity className="h-5 w-5 text-warn" />
              </div>
              <div>
                <p className="font-medium text-ink">
                  {stats.unresolvedMistakes} unresolved mistake{stats.unresolvedMistakes === 1 ? "" : "s"} in your queue.
                </p>
                <p className="text-sm text-ink-muted">
                  {practiceComplete
                    ? "Nothing moves the needle faster than fixing the same misses."
                    : "Mistakes Test unlocks after you finish one full practice run (110 questions)."}
                </p>
              </div>
            </div>
            {practiceComplete ? (
              <Button asChild variant="outline" className="border-warn/40">
                <Link href="/mistakes">Start Mistakes Test</Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/practice">Finish Practice first</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ——— Hero ——— */

function HeroSection({
  firstName,
  until,
  stats,
  coverage,
  continueAssessmentHref,
}: {
  firstName?: string;
  until: number | null;
  stats: UserStats;
  coverage: AssessmentCoverage;
  continueAssessmentHref: string;
}) {
  const readiness = stats.readinessScore;
  const tone =
    readiness >= 85 ? "text-success" : readiness >= 70 ? "text-primary" : readiness >= 50 ? "text-warn" : "text-ink-muted";

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-3xl border border-border bg-surface shadow-soft"
    >
      <div className="absolute inset-0 mesh-gradient opacity-40" aria-hidden />
      <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl pointer-events-none" aria-hidden />
      <div className="absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-primary-soft/40 blur-2xl pointer-events-none" aria-hidden />

      <div className="relative p-6 md:p-10 lg:p-12">
        <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-surface/80 backdrop-blur-sm">
                Dashboard
              </Badge>
              {until != null && (
                <Badge
                  variant={until <= 14 ? "danger" : until <= 45 ? "secondary" : "outline"}
                  className="gap-1"
                >
                  <CalendarDays className="h-3 w-3" />
                  {until < 0
                    ? "Exam date passed — reschedule in Settings"
                    : until === 0
                      ? "Exam is today"
                      : `${until} day${until === 1 ? "" : "s"} to target`}
                </Badge>
              )}
            </div>
            <div>
              <p className="text-sm text-ink-muted">
                Welcome back{firstName ? `, ${firstName}` : ""}
              </p>
              <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight text-ink leading-tight mt-1">
                Your study command center.
              </h1>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <div className="rounded-2xl border border-border bg-elevated/50 px-4 py-3 min-w-[140px]">
                <div className="text-[11px] uppercase tracking-widest text-ink-muted">This week</div>
                <div className="font-serif text-2xl font-semibold tabular-nums text-ink mt-0.5">
                  {stats.sevenDayAccuracy ? `${stats.sevenDayAccuracy}%` : "—"}
                </div>
                <div className="text-xs text-ink-muted">rolling accuracy</div>
              </div>
              <div className="rounded-2xl border border-border bg-elevated/50 px-4 py-3 min-w-[140px]">
                <div className="text-[11px] uppercase tracking-widest text-ink-muted">Volume</div>
                <div className="font-serif text-2xl font-semibold tabular-nums text-ink mt-0.5">
                  {stats.totalAttempts.toLocaleString()}
                </div>
                <div className="text-xs text-ink-muted">lifetime attempts</div>
              </div>
              <div className="rounded-2xl border border-border bg-elevated/50 px-4 py-3 min-w-[140px]">
                <div className="text-[11px] uppercase tracking-widest text-ink-muted">Sessions (30d)</div>
                <div className="font-serif text-2xl font-semibold tabular-nums text-ink mt-0.5">
                  {stats.finishedSessionsLast30}
                </div>
                <div className="text-xs text-ink-muted">finished runs</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {coverage.allCoveredEver ? (
                <Button asChild size="lg" className="shadow-soft">
                  <Link href="/practice">Start practice</Link>
                </Button>
              ) : (
                <Button asChild size="lg" className="shadow-soft">
                  <Link href={continueAssessmentHref}>
                    {coverage.nextSection
                      ? `Continue assessment · ${formatSectionDisplayLabel(coverage.nextSection)}`
                      : "Continue assessment"}
                  </Link>
                </Button>
              )}
              <Button asChild size="lg" variant="outline">
                <Link href="/mock-exam">Mock exam</Link>
              </Button>
            </div>
          </div>

          <div className="flex flex-col items-center lg:items-end gap-4">
            <div className="relative rounded-3xl border border-border/80 bg-elevated/40 backdrop-blur-sm px-8 py-8 min-w-[200px] text-center lg:text-right shadow-inner">
              <div className="text-[11px] uppercase tracking-widest text-ink-muted">Readiness</div>
              <div className={cn("font-serif text-7xl md:text-8xl font-semibold tabular-nums leading-none mt-2", tone)}>
                {readiness}
              </div>
              <div className="text-sm text-ink-muted mt-2 max-w-[200px] lg:ml-auto">
                {readiness >= 85
                  ? "Exam-shaped reps next."
                  : readiness >= 70
                    ? "Mocks will sharpen the edge."
                    : "Stack honest volume in Practice."}
              </div>
            </div>
            <div className="w-full max-w-[280px] h-14 opacity-90">
              {stats.sparkline.some((v) => v > 0) ? (
                <Sparkline values={stats.sparkline} height={56} />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/* ——— Extra KPI cards ——— */

function NationalStateCard({ national, state }: { national: number; state: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08, duration: 0.35 }}
    >
      <Card className="h-full border-border/80 overflow-hidden bg-gradient-to-br from-surface to-primary-soft/15">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-ink-muted mb-4">
            <BarChart3 className="h-3.5 w-3.5" />
            Catalog balance
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-ink-muted">National portion</span>
                <span className="font-semibold tabular-nums text-ink">{national}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${national}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-ink-muted">South Carolina state portion</span>
                <span className="font-semibold tabular-nums text-ink">{state}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full bg-success rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${state}%` }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function MockScoresCard({
  best,
  last,
  lastPractice,
}: {
  best: number | null;
  last: number | null;
  lastPractice: number | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12, duration: 0.35 }}
    >
      <Card className="h-full border-border/80 overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-ink-muted mb-4">
            <Trophy className="h-3.5 w-3.5" />
            Mock &amp; practice peaks
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-border bg-elevated/40 p-3">
              <div className="text-[10px] uppercase text-ink-muted">Best mock</div>
              <div className="font-serif text-2xl font-semibold tabular-nums mt-1">
                {best != null ? `${best}%` : "—"}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-elevated/40 p-3">
              <div className="text-[10px] uppercase text-ink-muted">Last mock</div>
              <div className="font-serif text-2xl font-semibold tabular-nums mt-1">
                {last != null ? `${last}%` : "—"}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-elevated/40 p-3">
              <div className="text-[10px] uppercase text-ink-muted">Last practice</div>
              <div className="font-serif text-2xl font-semibold tabular-nums mt-1">
                {lastPractice != null ? `${lastPractice}%` : "—"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ModeVolumeCard({
  totals,
  finished30,
}: {
  totals: UserStats["modeTotals"];
  finished30: number;
}) {
  const rows: { key: keyof typeof totals; label: string; Icon: typeof Target }[] = [
    { key: "assessment", label: "Assessment", Icon: Target },
    { key: "practice", label: "Practice", Icon: Brain },
    { key: "mistakes", label: "Mistakes", Icon: ListTodo },
    { key: "mock", label: "Mock", Icon: Timer },
    { key: "final", label: "Final", Icon: Trophy },
  ];
  const max = Math.max(1, ...rows.map((r) => totals[r.key]));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.16, duration: 0.35 }}
      className="lg:col-span-1"
    >
      <Card className="h-full border-border/80">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-ink-muted">
              <Activity className="h-3.5 w-3.5" />
              Finished sessions
            </div>
            <Badge variant="secondary" className="text-[10px]">
              {finished30} in 30d
            </Badge>
          </div>
          <div className="space-y-2.5">
            {rows.map(({ key, label, Icon }) => {
              const n = totals[key];
              const w = Math.round((100 * n) / max);
              return (
                <div key={key} className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-ink-muted shrink-0" />
                  <span className="text-[11px] text-ink-muted w-20 shrink-0">{label}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full bg-primary/80 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${w}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                  <span className="text-xs font-medium tabular-nums w-6 text-right">{n}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function RecentSessionsCard({
  sessions,
}: {
  sessions: UserStats["recentSessions"];
}) {
  return (
    <Card className="border-border/80 shadow-soft">
      <CardHeader>
        <CardTitle>Recent sessions</CardTitle>
        <CardDescription>Your last eight sessions across all modes.</CardDescription>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Nothing yet. Start with the Assessment to map your strengths.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {sessions.map((s) => {
              const finished = !!s.finished_at;
              const resultsHref =
                s.mode === "practice"
                  ? `/practice/${s.id}/results`
                  : s.mode === "mock"
                    ? `/mock-exam/${s.id}/results`
                    : s.mode === "final"
                      ? `/final-test/${s.id}/results`
                      : s.mode === "mistakes"
                        ? `/mistakes/${s.id}/results`
                        : `/assessment/${s.id}/results`;
              const runnerHref = resultsHref.replace("/results", "");
              return (
                <div
                  key={s.id}
                  className="py-3 px-3 flex items-center justify-between gap-3 bg-surface/50 hover:bg-elevated/50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="capitalize">
                        {s.mode}
                      </Badge>
                      <span className="text-xs text-ink-muted">
                        {new Date(s.started_at).toLocaleDateString()}
                      </span>
                    </div>
                    {finished && (
                      <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-2">
                        <Clock3 className="h-3 w-3" />
                        {formatMs(s.duration_ms ?? 0)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {finished ? (
                      <>
                        <div className="text-right">
                          <div className="font-serif text-lg tabular-nums">
                            {Math.round(Number(s.score_pct ?? 0))}%
                          </div>
                        </div>
                        <Button asChild size="sm" variant="outline">
                          <Link href={resultsHref}>Review</Link>
                        </Button>
                      </>
                    ) : (
                      <Button asChild size="sm">
                        <Link href={runnerHref}>Resume</Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
