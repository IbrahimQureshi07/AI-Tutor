"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdminMetricTooltip } from "@/components/admin/admin-metric-tooltip";
import { PaywallTogglePanel } from "@/components/admin/paywall-toggle-panel";

type ModeKey = "assessment" | "practice" | "mistakes" | "mock" | "final";

type Overview = {
  totals: {
    totalStudents: number;
    activeStudents: number;
    avgAccuracy: number;
    atRisk: number;
    totalOpenMistakes: number;
  };
  funnel: Record<ModeKey, number>;
  mock: {
    buckets: { lt50: number; b50: number; b60: number; b70: number; b80: number; b90: number };
    learners: number;
  };
  sectionPerformance: {
    code: string;
    title: string;
    group: "National" | "State";
    accuracy: number | null;
    learners: number;
    attempts: number;
  }[];
  totalSections: number;
  recentActive: {
    id: string;
    fullName: string | null;
    email: string | null;
    lastActive: string | null;
    accuracy: number | null;
    coverage: number;
  }[];
};

const FUNNEL_STEPS: { key: ModeKey; label: string }[] = [
  { key: "assessment", label: "Assessment" },
  { key: "practice", label: "Practice" },
  { key: "mistakes", label: "Mistakes" },
  { key: "mock", label: "Mock Exam" },
  { key: "final", label: "Final Test" },
];

const MOCK_BANDS: { key: keyof Overview["mock"]["buckets"]; label: string; tone: string }[] = [
  { key: "lt50", label: "< 50%", tone: "bg-danger" },
  { key: "b50", label: "50–59%", tone: "bg-danger/70" },
  { key: "b60", label: "60–69%", tone: "bg-warn" },
  { key: "b70", label: "70–79%", tone: "bg-success/70" },
  { key: "b80", label: "80–89%", tone: "bg-success" },
  { key: "b90", label: "90–100%", tone: "bg-success" },
];

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / (60 * 1000)))}m ago`;
  if (diff < day) return `${Math.floor(diff / (60 * 60 * 1000))}h ago`;
  const days = Math.floor(diff / day);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function accTone(acc: number | null): string {
  if (acc == null) return "text-ink-muted";
  if (acc >= 70) return "text-success";
  if (acc >= 50) return "text-warn";
  return "text-danger";
}

function barTone(acc: number | null): string {
  if (acc == null) return "bg-border";
  if (acc >= 70) return "bg-success";
  if (acc >= 50) return "bg-warn";
  return "bg-danger";
}

export default function AdminHomePage() {
  const [data, setData] = React.useState<Overview | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/overview", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(json.error ?? "Could not load overview.");
          return;
        }
        if (!cancelled) setData(json as Overview);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl font-semibold tracking-tight">
            Admin Console
          </h1>
          <p className="text-ink-muted mt-1">
            Class-wide overview — lifetime question accuracy vs finished exam
            progress. Hover metrics for source details.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/admin/students">View students</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/users">Manage users</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/questions">Manage questions</Link>
          </Button>
        </div>
      </div>

      <PaywallTogglePanel />

      {loading ? (
        <p className="text-sm text-ink-muted">Loading overview…</p>
      ) : !data ? (
        <p className="text-sm text-ink-muted">Overview unavailable.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <AdminMetricTooltip k="cohort_students">
              <Kpi label="Students" value={data.totals.totalStudents} />
            </AdminMetricTooltip>
            <AdminMetricTooltip k="active_7d">
              <Kpi label="Active (7d)" value={data.totals.activeStudents} />
            </AdminMetricTooltip>
            <AdminMetricTooltip k="avg_lifetime_accuracy">
              <Kpi
                label="Avg lifetime question accuracy"
                value={`${data.totals.avgAccuracy}%`}
                toneCls={accTone(data.totals.avgAccuracy)}
              />
            </AdminMetricTooltip>
            <AdminMetricTooltip k="at_risk">
              <Kpi
                label="At risk"
                value={data.totals.atRisk}
                toneCls={data.totals.atRisk > 0 ? "text-danger" : "text-ink"}
              />
            </AdminMetricTooltip>
            <AdminMetricTooltip k="open_mistakes">
              <Kpi
                label="Open mistakes"
                value={data.totals.totalOpenMistakes}
                toneCls={data.totals.totalOpenMistakes > 0 ? "text-warn" : "text-ink"}
              />
            </AdminMetricTooltip>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <AdminMetricTooltip k="completion_funnel" className="block h-full">
              <Card className="h-full cursor-help">
                <CardHeader>
                  <CardTitle>Completion funnel (finished sessions)</CardTitle>
                  <p className="text-xs text-ink-muted">
                    Students who finished each stage at least once — not lifetime
                    question accuracy.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {FUNNEL_STEPS.map((step) => {
                    const count = data.funnel[step.key] ?? 0;
                    const pct = data.totals.totalStudents
                      ? Math.round((100 * count) / data.totals.totalStudents)
                      : 0;
                    return (
                      <div key={step.key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-ink">{step.label}</span>
                          <span className="text-ink-muted tabular-nums">
                            {count}/{data.totals.totalStudents} · {pct}%
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-elevated overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.max(2, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </AdminMetricTooltip>

            <AdminMetricTooltip k="mock_distribution" className="block h-full">
              <Card className="h-full cursor-help">
                <CardHeader>
                  <CardTitle>Best finished mock distribution</CardTitle>
                  <p className="text-xs text-ink-muted">
                    Each student&apos;s highest finished mock score — partial runs
                    excluded. {data.mock.learners} student
                    {data.mock.learners !== 1 ? "s" : ""} with at least one
                    finished mock.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.mock.learners === 0 ? (
                    <p className="text-sm text-ink-muted">
                      No finished mock exams yet.
                    </p>
                  ) : (
                    MOCK_BANDS.map((band) => {
                      const count = data.mock.buckets[band.key] ?? 0;
                      const pct = data.mock.learners
                        ? Math.round((100 * count) / data.mock.learners)
                        : 0;
                      return (
                        <div key={band.key} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-ink">{band.label}</span>
                            <span className="text-ink-muted tabular-nums">{count}</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-elevated overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", band.tone)}
                              style={{ width: `${Math.max(count ? 4 : 0, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </AdminMetricTooltip>
          </div>

          <AdminMetricTooltip k="class_section_accuracy" className="block">
            <Card className="cursor-help">
              <CardHeader>
                <CardTitle>Class lifetime accuracy by section</CardTitle>
                <p className="text-xs text-ink-muted">
                  Combined correct ÷ total question attempts across all students
                  per section — not finished-test scores.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                  {data.sectionPerformance.map((sec) => (
                    <div key={sec.code} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-ink truncate pr-2">
                          <span className="font-medium">{sec.code}</span> · {sec.title}
                        </span>
                        <span className={cn("font-semibold tabular-nums", accTone(sec.accuracy))}>
                          {sec.accuracy != null ? `${sec.accuracy}%` : "—"}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-elevated overflow-hidden">
                        {sec.accuracy != null && (
                          <div
                            className={cn("h-full rounded-full", barTone(sec.accuracy))}
                            style={{ width: `${Math.max(2, sec.accuracy)}%` }}
                          />
                        )}
                      </div>
                      <div className="text-[10px] text-ink-muted">
                        {sec.learners} learner{sec.learners !== 1 ? "s" : ""} · {sec.attempts} question attempts
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </AdminMetricTooltip>

          <Card>
            <CardHeader>
              <CardTitle>Recently active students</CardTitle>
              <p className="text-xs text-ink-muted">
                Lifetime question accuracy shown — not finished test scores.
              </p>
            </CardHeader>
            <CardContent>
              {data.recentActive.length === 0 ? (
                <p className="text-sm text-ink-muted">No activity yet.</p>
              ) : (
                <div className="divide-y divide-border">
                  {data.recentActive.map((r) => (
                    <Link
                      key={r.id}
                      href={`/admin/students/${r.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 hover:bg-elevated/40 -mx-2 px-2 rounded-lg transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-ink truncate">
                          {r.fullName || "Unnamed user"}
                        </p>
                        <p className="text-xs text-ink-muted truncate">{r.email ?? "—"}</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-ink-muted shrink-0">
                        <AdminMetricTooltip k="coverage_sections">
                          <span className="cursor-help">
                            Coverage {r.coverage}/{data.totalSections}
                          </span>
                        </AdminMetricTooltip>
                        <AdminMetricTooltip k="lifetime_accuracy">
                          <span className={cn("font-semibold tabular-nums cursor-help", accTone(r.accuracy))}>
                            {r.accuracy != null ? `${r.accuracy}%` : "—"}
                            <span className="font-normal text-ink-muted ml-1 hidden sm:inline">
                              lifetime
                            </span>
                          </span>
                        </AdminMetricTooltip>
                        <span className="w-16 text-right">{timeAgo(r.lastActive)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  toneCls,
}: {
  label: string;
  value: number | string;
  toneCls?: string;
}) {
  return (
    <Card className="h-full cursor-help">
      <CardContent className="pt-6">
        <div className={cn("text-2xl font-serif font-semibold tabular-nums", toneCls ?? "text-ink")}>
          {value}
        </div>
        <div className="text-xs text-ink-muted mt-1 uppercase tracking-wide leading-snug">
          {label}
        </div>
      </CardContent>
    </Card>
  );
}
