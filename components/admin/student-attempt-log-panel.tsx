"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SECTIONS } from "@/lib/constants";

type AttemptRow = {
  id: string;
  sessionId: string;
  mode: string;
  runType: string;
  sectionCode: string;
  promptPreview: string;
  isCorrect: boolean;
  isSibling: boolean;
  createdAt: string;
};

type Filters = {
  mode: string;
  runType: string;
  section: string;
  result: string;
  primaryOnly: boolean;
};

const MODE_OPTIONS = [
  { value: "all", label: "All modes" },
  { value: "assessment", label: "Assessment" },
  { value: "practice", label: "Practice" },
  { value: "mistakes", label: "Mistakes" },
  { value: "mock", label: "Mock" },
  { value: "final", label: "Final" },
];

const RUN_TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "smoke", label: "Smoke" },
  { value: "full", label: "Full" },
  { value: "other", label: "Other (custom/quick/deep)" },
];

const RESULT_OPTIONS = [
  { value: "all", label: "All results" },
  { value: "correct", label: "Correct" },
  { value: "wrong", label: "Wrong" },
];

const MODE_LABELS: Record<string, string> = {
  assessment: "Assessment",
  practice: "Practice",
  mistakes: "Mistakes",
  mock: "Mock",
  final: "Final",
};

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildQuery(studentId: string, f: Filters): string {
  const p = new URLSearchParams();
  if (f.mode !== "all") p.set("mode", f.mode);
  if (f.runType !== "all") p.set("runType", f.runType);
  if (f.section !== "all") p.set("section", f.section);
  if (f.result !== "all") p.set("result", f.result);
  if (f.primaryOnly) p.set("primaryOnly", "1");
  p.set("limit", "200");
  const qs = p.toString();
  return `/api/admin/students/${studentId}/attempts${qs ? `?${qs}` : ""}`;
}

export function StudentAttemptLogPanel({ studentId }: { studentId: string }) {
  const [filters, setFilters] = React.useState<Filters>({
    mode: "all",
    runType: "all",
    section: "all",
    result: "all",
    primaryOnly: false,
  });
  const [rows, setRows] = React.useState<AttemptRow[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, filtered: 0 });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(buildQuery(studentId, filters), {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        setRows((json.attempts ?? []) as AttemptRow[]);
        setMeta({
          total: json.total ?? 0,
          filtered: json.filtered ?? 0,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, filters]);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const selectCls =
    "h-9 rounded-md border border-input bg-background px-2 text-sm min-w-0";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Question attempt log</CardTitle>
        <p className="text-xs text-ink-muted">
          Every question answered across all sessions — filter by mode, run type,
          section, or result.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-ink-muted">
              Mode
            </span>
            <select
              value={filters.mode}
              onChange={(e) => setFilter("mode", e.target.value)}
              className={`${selectCls} w-full`}
            >
              {MODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-ink-muted">
              Run type
            </span>
            <select
              value={filters.runType}
              onChange={(e) => setFilter("runType", e.target.value)}
              className={`${selectCls} w-full`}
            >
              {RUN_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-ink-muted">
              Section
            </span>
            <select
              value={filters.section}
              onChange={(e) => setFilter("section", e.target.value)}
              className={`${selectCls} w-full`}
            >
              <option value="all">All sections</option>
              {SECTIONS.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} · {s.title}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-ink-muted">
              Result
            </span>
            <select
              value={filters.result}
              onChange={(e) => setFilter("result", e.target.value)}
              className={`${selectCls} w-full`}
            >
              {RESULT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-end gap-2 pb-1">
            <input
              id="primary-only"
              type="checkbox"
              checked={filters.primaryOnly}
              onChange={(e) => setFilter("primaryOnly", e.target.checked)}
              className="rounded border-input"
            />
            <span className="text-xs text-ink-muted">Primary only (no extra tries)</span>
          </label>
        </div>

        <p className="text-xs text-ink-muted">
          Showing {rows.length} of {meta.filtered} matching
          {meta.filtered !== meta.total ? ` (${meta.total} total loaded)` : ""}
        </p>

        <div className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-ink-muted">Loading attempts…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-ink-muted">No attempts match these filters.</p>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-ink-muted uppercase tracking-wide">
                  <th className="pb-2 pr-3 font-medium">Question</th>
                  <th className="pb-2 pr-3 font-medium w-16">Section</th>
                  <th className="pb-2 pr-3 font-medium w-24">Mode</th>
                  <th className="pb-2 pr-3 font-medium w-16">Type</th>
                  <th className="pb-2 pr-3 font-medium w-20">Result</th>
                  <th className="pb-2 font-medium w-28">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-border/60 align-top hover:bg-elevated/40"
                  >
                    <td className="py-2.5 pr-3 max-w-md">
                      <Link
                        href={`/admin/students/${studentId}/sessions/${a.sessionId}`}
                        className="text-ink hover:text-primary line-clamp-2"
                      >
                        {a.promptPreview}
                      </Link>
                      {a.isSibling && (
                        <span className="text-[10px] text-ink-muted block mt-0.5">
                          extra try
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-primary tabular-nums">
                      {a.sectionCode}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-ink-muted">
                      {MODE_LABELS[a.mode] ?? a.mode}
                    </td>
                    <td className="py-2.5 pr-3 text-xs capitalize text-ink-muted">
                      {a.runType === "unknown" ? "—" : a.runType}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge
                        variant={a.isCorrect ? "success" : "danger"}
                        className="text-[10px]"
                      >
                        {a.isCorrect ? "correct" : "wrong"}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-xs text-ink-muted whitespace-nowrap">
                      {fmtDateTime(a.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
