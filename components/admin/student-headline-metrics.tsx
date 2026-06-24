"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { UserStats } from "@/lib/kpi/stats";
import type { SessionHistoryRow } from "@/lib/admin/session-history";
import {
  buildFinishedTestScores,
  buildLifetimeMetrics,
  buildModeRunBreakdown,
  mergeJourneyScores,
  type FinishedTestScore,
} from "@/lib/admin/headline-metrics";
import type { Journey } from "@/lib/journey/load";

function tone(acc: number | null, hasData: boolean): string {
  if (!hasData || acc == null) return "text-ink-muted";
  if (acc >= 70) return "text-success";
  if (acc >= 50) return "text-warn";
  return "text-danger";
}

function fmtHours(ms: number): string {
  if (!ms) return "0h";
  const h = ms / (60 * 60 * 1000);
  if (h < 1) return `${Math.round(ms / (60 * 1000))}m`;
  return `${h.toFixed(1)}h`;
}

function Metric({
  label,
  sublabel,
  value,
  toneCls,
}: {
  label: string;
  sublabel?: string;
  value: string | number;
  toneCls?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-3">
      <div
        className={cn(
          "text-xl font-serif font-semibold tabular-nums",
          toneCls ?? "text-ink",
        )}
      >
        {value}
      </div>
      <div className="text-[10px] text-ink-muted mt-1 uppercase tracking-wide">
        {label}
        {sublabel && (
          <span className="normal-case tracking-normal block text-[10px] mt-0.5">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}

function FinishedScoreRow({ row }: { row: FinishedTestScore }) {
  const hasFinished = row.finishedCount > 0;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-border/60 last:border-0">
      <div className="min-w-[120px]">
        <span className="text-sm font-medium text-ink">{row.label}</span>
        <span className="text-xs text-ink-muted ml-2">
          {hasFinished
            ? `${row.finishedCount} finished`
            : "no finished runs"}
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-ink-muted">
        <span>
          Latest:{" "}
          <span
            className={cn(
              "font-semibold tabular-nums",
              tone(row.latest, row.latest != null),
            )}
          >
            {row.latest != null ? `${row.latest}%` : "—"}
          </span>
        </span>
        <span>
          Best:{" "}
          <span className="font-semibold tabular-nums text-ink">
            {row.best != null ? `${row.best}%` : "—"}
          </span>
        </span>
      </div>
    </div>
  );
}

export function StudentHeadlineMetrics({
  stats,
  journey,
  sessions,
  showQuestionOnlyNote,
}: {
  stats: UserStats;
  journey: Journey;
  sessions: SessionHistoryRow[];
  showQuestionOnlyNote: boolean;
}) {
  const coverage = stats.mastery.filter((m) => m.total > 0).length;
  const lifetime = buildLifetimeMetrics(stats, coverage);
  const finishedScores = mergeJourneyScores(
    buildFinishedTestScores(sessions),
    journey,
  );
  const runBreakdown = buildModeRunBreakdown(sessions);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lifetime · all question attempts</CardTitle>
          <p className="text-xs text-ink-muted">
            Every question answered across any session (smoke, partial, or complete).
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <Metric
              label="Questions attempted"
              value={lifetime.totalQuestions}
            />
            <Metric
              label="Lifetime accuracy"
              sublabel={`${lifetime.totalCorrect} correct`}
              value={
                lifetime.totalQuestions
                  ? `${lifetime.accuracy}%`
                  : "—"
              }
              toneCls={tone(lifetime.accuracy, lifetime.totalQuestions > 0)}
            />
            <Metric
              label="7-day accuracy"
              value={
                lifetime.totalQuestions
                  ? `${lifetime.sevenDayAccuracy}%`
                  : "—"
              }
              toneCls={tone(
                lifetime.sevenDayAccuracy,
                lifetime.totalQuestions > 0,
              )}
            />
            <Metric
              label="Section coverage"
              value={`${lifetime.coverageSections}/${lifetime.totalSections}`}
            />
            <Metric
              label="Open mistakes"
              value={lifetime.openMistakes}
              toneCls={
                lifetime.openMistakes > 0 ? "text-warn" : "text-ink"
              }
            />
            <Metric
              label="Readiness estimate"
              sublabel="composite score"
              value={`${lifetime.readinessScore}%`}
              toneCls={tone(lifetime.readinessScore, lifetime.totalQuestions > 0)}
            />
            <Metric
              label="Active days"
              sublabel="last 30 days"
              value={lifetime.activeDaysLast30}
            />
            <Metric
              label="Study time"
              sublabel="last 30 days"
              value={fmtHours(lifetime.studyMsLast30)}
            />
          </div>
          {showQuestionOnlyNote && (
            <p className="text-xs text-warn mt-3 leading-relaxed">
              No completed exam sessions yet — accuracy is from individual
              questions only, not a finished test score.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Finished test scores</CardTitle>
          <p className="text-xs text-ink-muted">
            Only sessions marked <strong>finished</strong> with a score — not
            partial or in-progress runs.
          </p>
        </CardHeader>
        <CardContent>
          {stats.totalFinishedSessions === 0 ? (
            <p className="text-sm text-ink-muted">
              No finished exam sessions yet.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {finishedScores.map((row) => (
                <FinishedScoreRow key={row.mode} row={row} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Session breakdown by mode & type</CardTitle>
          <p className="text-xs text-ink-muted">
            How many runs per mode and run type (smoke, full, etc.) — finished
            vs partial.
          </p>
        </CardHeader>
        <CardContent>
          {runBreakdown.length === 0 ? (
            <p className="text-sm text-ink-muted">No sessions recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {runBreakdown.map((row) => (
                <div
                  key={`${row.mode}-${row.runType}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-elevated/20 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-ink shrink-0">
                      {row.modeLabel}
                    </span>
                    <Badge variant="secondary" className="text-[10px] capitalize shrink-0">
                      {row.runTypeLabel}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {row.finished > 0 && (
                      <Badge variant="success" className="text-[10px]">
                        {row.finished} finished
                      </Badge>
                    )}
                    {row.partial > 0 && (
                      <Badge variant="warn" className="text-[10px]">
                        {row.partial} partial
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
