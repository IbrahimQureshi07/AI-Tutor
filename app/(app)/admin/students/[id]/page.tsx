"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SectionMastery = {
  code: string;
  title: string;
  group: "National" | "State";
  total: number;
  correct: number;
  accuracy: number;
};

type ModeKey = "assessment" | "practice" | "mistakes" | "mock" | "final";

type ModeSessionStatus = { finished: number; partial: number };

type Stats = {
  totalAttempts: number;
  totalCorrect: number;
  overallAccuracy: number;
  sevenDayAccuracy: number;
  streakDays: number;
  readinessScore: number;
  mastery: SectionMastery[];
  topStrengths: SectionMastery[];
  topWeaknesses: SectionMastery[];
  unresolvedMistakes: number;
  nationalAccuracy: number;
  stateAccuracy: number;
  activeDaysLast30: number;
  studyMsLast30: number;
  modeTotals: Record<ModeKey, number>;
  modeSessionStatus: Record<ModeKey, ModeSessionStatus>;
  totalFinishedSessions: number;
  bestMockScore: number | null;
  lastMockScore: number | null;
  lastPracticeScore: number | null;
};

type JourneyPoint = {
  id: string;
  mode: string;
  started_at: string;
  finished_at: string | null;
  score_pct: number | null;
};

type ModeSeries = {
  mode: string;
  latest: number | null;
  best: number | null;
  delta: number | null;
  runs: JourneyPoint[];
};

type DetailResponse = {
  student: {
    id: string;
    email: string | null;
    fullName: string | null;
    role: "student" | "admin";
    isActive: boolean;
    createdAt: string | null;
    lastSignInAt: string | null;
  };
  stats: Stats;
  journey: {
    perMode: Record<string, ModeSeries>;
    combined: JourneyPoint[];
  };
};

type SessionHistoryRow = {
  id: string;
  mode: ModeKey;
  runType: string;
  status: "in_progress" | "finished" | "abandoned";
  startedAt: string;
  finishedAt: string | null;
  scorePct: number | null;
  answered: number;
  total: number;
  durationMs: number | null;
};

const MODE_LABELS: Record<ModeKey, string> = {
  assessment: "Assessment",
  practice: "Practice",
  mistakes: "Mistakes",
  mock: "Mock Exam",
  final: "Final Test",
};

const QUESTION_ONLY_NOTE =
  "Based on individual question attempts — no completed exam session yet.";

function ModeStatusBadges({ status }: { status: ModeSessionStatus }) {
  const hasFinished = status.finished > 0;
  const hasPartial = status.partial > 0;
  if (!hasFinished && !hasPartial) {
    return (
      <Badge variant="outline" className="text-[10px]">
        no sessions
      </Badge>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      {hasFinished && (
        <Badge variant="success" className="text-[10px]">
          {status.finished} finished
        </Badge>
      )}
      {hasPartial && (
        <Badge variant="warn" className="text-[10px]">
          {status.partial} partial
        </Badge>
      )}
    </div>
  );
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDurationMs(ms: number | null): string {
  if (!ms || ms <= 0) return "—";
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function sessionStatusVariant(
  status: SessionHistoryRow["status"],
): "success" | "warn" | "outline" {
  if (status === "finished") return "success";
  if (status === "in_progress") return "warn";
  return "outline";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtHours(ms: number): string {
  if (!ms) return "0h";
  const h = ms / (60 * 60 * 1000);
  if (h < 1) return `${Math.round(ms / (60 * 1000))}m`;
  return `${h.toFixed(1)}h`;
}

function tone(acc: number, hasData: boolean): string {
  if (!hasData) return "text-ink-muted";
  if (acc >= 70) return "text-success";
  if (acc >= 50) return "text-warn";
  return "text-danger";
}

function barTone(acc: number): string {
  if (acc >= 70) return "bg-success";
  if (acc >= 50) return "bg-warn";
  return "bg-danger";
}

export default function AdminStudentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [data, setData] = React.useState<DetailResponse | null>(null);
  const [sessions, setSessions] = React.useState<SessionHistoryRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [downloading, setDownloading] = React.useState(false);

  const downloadPdf = React.useCallback(async () => {
    if (!id) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/admin/students/${id}/pdf`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? "Could not generate report card.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const name = (data?.student.fullName ?? data?.student.email ?? "student")
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase();
      a.download = `report-card-${name}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not generate report card.");
    } finally {
      setDownloading(false);
    }
  }, [id, data]);

  React.useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setSessionsLoading(true);
      try {
        const [detailRes, sessionsRes] = await Promise.all([
          fetch(`/api/admin/students/${id}`, { cache: "no-store" }),
          fetch(`/api/admin/students/${id}/sessions`, { cache: "no-store" }),
        ]);
        const detailJson = await detailRes.json().catch(() => ({}));
        const sessionsJson = await sessionsRes.json().catch(() => ({}));
        if (!detailRes.ok) {
          toast.error(detailJson.error ?? "Could not load student.");
          return;
        }
        if (!cancelled) setData(detailJson as DetailResponse);
        if (sessionsRes.ok && !cancelled) {
          setSessions((sessionsJson.sessions ?? []) as SessionHistoryRow[]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setSessionsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return <p className="text-sm text-ink-muted">Loading student…</p>;
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-ink-muted">Student data unavailable.</p>
      </div>
    );
  }

  const { student, stats, journey } = data;
  const national = stats.mastery.filter((m) => m.group === "National");
  const state = stats.mastery.filter((m) => m.group === "State");
  const coverage = stats.mastery.filter((m) => m.total > 0).length;
  const showQuestionOnlyNote =
    stats.totalAttempts > 0 && stats.totalFinishedSessions === 0;

  return (
    <div className="space-y-6">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-serif text-3xl font-semibold tracking-tight">
              {student.fullName || "Unnamed user"}
            </h1>
            {student.role === "admin" && (
              <Badge variant="secondary">admin</Badge>
            )}
            <Badge variant={student.isActive ? "success" : "outline"}>
              {student.isActive ? "active" : "deactivated"}
            </Badge>
          </div>
          <p className="text-sm text-ink-muted mt-1">{student.email ?? "—"}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button size="sm" onClick={downloadPdf} disabled={downloading}>
            {downloading ? "Preparing…" : "Download report card"}
          </Button>
          <div className="text-right text-xs text-ink-muted space-y-0.5">
            <div>Joined: {fmtDate(student.createdAt)}</div>
            <div>Last sign-in: {fmtDate(student.lastSignInAt)}</div>
          </div>
        </div>
      </div>

      {showQuestionOnlyNote && (
        <div className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-ink-muted leading-relaxed">
          {QUESTION_ONLY_NOTE} Readiness and accuracy reflect every question
          answered (including smoke or partial runs), not a finished test score.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Readiness"
          value={`${stats.readinessScore}%`}
          toneCls={tone(stats.readinessScore, stats.totalAttempts > 0)}
          hint={showQuestionOnlyNote ? "Estimate from question attempts" : undefined}
        />
        <StatCard
          label="Lifetime question accuracy"
          sublabel="(all attempts)"
          value={stats.totalAttempts ? `${stats.overallAccuracy}%` : "—"}
          toneCls={tone(stats.overallAccuracy, stats.totalAttempts > 0)}
          hint={showQuestionOnlyNote ? QUESTION_ONLY_NOTE : undefined}
        />
        <StatCard
          label="Section coverage"
          sublabel="(sections with attempts)"
          value={`${coverage}/${stats.mastery.length}`}
        />
        <StatCard
          label="Open mistakes"
          value={stats.unresolvedMistakes}
          toneCls={stats.unresolvedMistakes > 0 ? "text-warn" : "text-ink"}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Questions attempted"
          sublabel="(lifetime)"
          value={stats.totalAttempts}
        />
        <StatCard
          label="7-day question accuracy"
          value={stats.totalAttempts ? `${stats.sevenDayAccuracy}%` : "—"}
        />
        <StatCard label="Active days (30d)" value={stats.activeDaysLast30} />
        <StatCard label="Study time (30d)" value={fmtHours(stats.studyMsLast30)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mode progress</CardTitle>
          <p className="text-xs text-ink-muted leading-relaxed">
            <strong>Finished</strong> = completed exam session with a score.{" "}
            <strong>In progress / partial</strong> = started but not finished
            (smoke runs, abandoned, or incomplete).
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(MODE_LABELS) as ModeKey[]).map((m) => {
              const series = journey.perMode?.[m];
              const sessionStatus =
                stats.modeSessionStatus?.[m] ?? { finished: 0, partial: 0 };
              const latest = series?.latest ?? null;
              const best = series?.best ?? null;
              return (
                <div
                  key={m}
                  className="rounded-xl border border-border p-3 space-y-2 min-w-0"
                >
                  <div className="space-y-1.5">
                    <span className="text-sm font-medium block">{MODE_LABELS[m]}</span>
                    <ModeStatusBadges status={sessionStatus} />
                  </div>
                  <div className="flex flex-col gap-1 text-xs text-ink-muted sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
                    <span className="shrink-0">
                      Latest finished:{" "}
                      <span className={cn("font-semibold", tone(latest ?? 0, latest != null))}>
                        {latest != null ? `${latest}%` : "—"}
                      </span>
                    </span>
                    <span className="shrink-0">
                      Best finished:{" "}
                      <span className="font-semibold text-ink">
                        {best != null ? `${best}%` : "—"}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session history</CardTitle>
          <p className="text-xs text-ink-muted">
            Every exam run — click a row for question-level detail.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {sessionsLoading ? (
            <p className="text-sm text-ink-muted">Loading sessions…</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-ink-muted">No sessions yet.</p>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-ink-muted uppercase tracking-wide">
                  <th className="pb-2 pr-3 font-medium">Date</th>
                  <th className="pb-2 pr-3 font-medium">Mode</th>
                  <th className="pb-2 pr-3 font-medium">Type</th>
                  <th className="pb-2 pr-3 font-medium">Status</th>
                  <th className="pb-2 pr-3 font-medium">Score</th>
                  <th className="pb-2 pr-3 font-medium">Answered</th>
                  <th className="pb-2 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/60 hover:bg-elevated/50 transition-colors"
                  >
                    <td className="py-2.5 pr-3">
                      <Link
                        href={`/admin/students/${id}/sessions/${row.id}`}
                        className="text-ink hover:text-primary block"
                      >
                        {fmtDateTime(row.startedAt)}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Link
                        href={`/admin/students/${id}/sessions/${row.id}`}
                        className="text-ink hover:text-primary"
                      >
                        {MODE_LABELS[row.mode] ?? row.mode}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3 capitalize text-ink-muted">
                      {row.runType === "unknown" ? "—" : row.runType}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge
                        variant={sessionStatusVariant(row.status)}
                        className="text-[10px]"
                      >
                        {row.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">
                      <Link
                        href={`/admin/students/${id}/sessions/${row.id}`}
                        className={cn(
                          "hover:text-primary",
                          row.scorePct != null && row.scorePct >= 70
                            ? "text-success font-semibold"
                            : row.scorePct != null
                              ? "text-warn font-semibold"
                              : "text-ink-muted",
                        )}
                      >
                        {row.scorePct != null ? `${row.scorePct}%` : "—"}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-ink-muted">
                      {row.total > 0
                        ? `${row.answered}/${row.total}`
                        : `${row.answered}/—`}
                    </td>
                    <td className="py-2.5 tabular-nums text-ink-muted">
                      {fmtDurationMs(row.durationMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionMasteryCard
          title="National sections"
          subtitle="Accuracy from individual question attempts (any mode)"
          rows={national}
        />
        <SectionMasteryCard
          title="State sections"
          subtitle="Accuracy from individual question attempts (any mode)"
          rows={state}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top strengths</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.topStrengths.length === 0 ? (
              <p className="text-sm text-ink-muted">No attempts yet.</p>
            ) : (
              stats.topStrengths.map((s) => (
                <MiniRow key={s.code} label={`${s.code} · ${s.title}`} acc={s.accuracy} />
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Needs work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.topWeaknesses.length === 0 ? (
              <p className="text-sm text-ink-muted">No attempts yet.</p>
            ) : (
              stats.topWeaknesses.map((s) => (
                <MiniRow key={s.code} label={`${s.code} · ${s.title}`} acc={s.accuracy} />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/students"
      className="inline-flex items-center text-sm text-ink-muted hover:text-ink"
    >
      ← Back to students
    </Link>
  );
}

function StatCard({
  label,
  sublabel,
  value,
  toneCls,
  hint,
}: {
  label: string;
  sublabel?: string;
  value: number | string;
  toneCls?: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className={cn("text-2xl font-serif font-semibold tabular-nums", toneCls ?? "text-ink")}>
          {value}
        </div>
        <div className="text-xs text-ink-muted mt-1 uppercase tracking-wide">
          {label}
          {sublabel && (
            <span className="normal-case tracking-normal block text-[10px] mt-0.5">
              {sublabel}
            </span>
          )}
        </div>
        {hint && (
          <p className="text-[10px] text-ink-muted mt-2 leading-snug normal-case tracking-normal">
            {hint}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SectionMasteryCard({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle?: string;
  rows: SectionMastery[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {subtitle && (
          <p className="text-xs text-ink-muted">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <div key={r.code} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink truncate pr-2">
                <span className="font-medium">{r.code}</span> · {r.title}
              </span>
              <span className={cn("font-semibold tabular-nums", tone(r.accuracy, r.total > 0))}>
                {r.total > 0 ? `${r.accuracy}%` : "—"}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-elevated overflow-hidden">
              {r.total > 0 && (
                <div
                  className={cn("h-full rounded-full", barTone(r.accuracy))}
                  style={{ width: `${Math.max(2, r.accuracy)}%` }}
                />
              )}
            </div>
            <div className="text-[10px] text-ink-muted">
              {r.total > 0 ? `${r.correct}/${r.total} correct` : "no attempts"}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MiniRow({ label, acc }: { label: string; acc: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink truncate pr-2">{label}</span>
      <span className={cn("font-semibold tabular-nums", tone(acc, true))}>{acc}%</span>
    </div>
  );
}
