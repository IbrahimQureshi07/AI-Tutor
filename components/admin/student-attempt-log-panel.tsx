"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SECTIONS } from "@/lib/constants";
import {
  sessionRunTypeLabel,
  type SessionRunType,
} from "@/lib/admin/session-history";
import { cn } from "@/lib/utils";

type AttemptRow = {
  id: string;
  sessionId: string;
  mode: string;
  runType: string;
  sectionCode: string;
  promptPreview: string;
  isCorrect: boolean;
  isSibling: boolean;
  contentOrigin: {
    kind: "dataset" | "llm";
    label: string;
    detail: string;
  };
  createdAt: string;
};

type DetailCard = {
  id: string;
  sectionCode: string;
  prompt: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  studentPick: string;
  correctPick: string;
  isCorrect: boolean;
  isSibling: boolean;
  hinted: boolean;
  contentOrigin: {
    kind: "dataset" | "llm";
    label: string;
    detail: string;
  };
  createdAt: string;
  relation: "focus" | "primary" | "extra_try" | "retry";
  relationLabel: string;
};

type DetailResponse = {
  focus: DetailCard;
  related: DetailCard[];
  sessionId: string;
  mode: string;
  runType: string;
  modeLabel: string;
  error?: string;
};

type Filters = {
  mode: string;
  runType: string;
  section: string;
  result: string;
  source: string;
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

const SOURCE_OPTIONS = [
  { value: "all", label: "All sources" },
  { value: "dataset", label: "Dataset" },
  { value: "llm", label: "LLM" },
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
    year: "numeric",
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
  if (f.source !== "all") p.set("source", f.source);
  if (f.primaryOnly) p.set("primaryOnly", "1");
  p.set("limit", "200");
  const qs = p.toString();
  return `/api/admin/students/${studentId}/attempts${qs ? `?${qs}` : ""}`;
}

function AttemptDetailCardView({
  card,
  emphasis,
}: {
  card: DetailCard;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-3",
        emphasis
          ? "border-primary/40 bg-primary-soft/20"
          : "border-border/70 bg-elevated/20",
        !card.isCorrect && "border-danger/25",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-ink-muted">
            {card.relationLabel}
          </span>
          <Badge variant="outline" className="text-[10px] font-medium text-primary">
            {card.sectionCode}
          </Badge>
          <Badge
            variant={card.contentOrigin.kind === "llm" ? "warn" : "secondary"}
            className="text-[10px]"
            title={card.contentOrigin.detail}
          >
            {card.contentOrigin.label}
          </Badge>
          <Badge
            variant={card.isCorrect ? "success" : "danger"}
            className="text-[10px]"
          >
            {card.isCorrect ? "correct" : "wrong"}
          </Badge>
          <span className="text-xs text-ink-muted">
            {card.isSibling ? "extra try" : card.hinted ? "hinted" : "primary"}
          </span>
        </div>
        <span className="text-xs text-ink-muted whitespace-nowrap">
          {fmtDateTime(card.createdAt)}
        </span>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wide text-ink-muted mb-1">
          Question
        </div>
        <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
          {card.prompt}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-surface/60 p-3">
          <div className="text-[10px] uppercase tracking-wide text-ink-muted mb-1">
            Student answer
          </div>
          <p
            className={cn(
              "text-sm leading-relaxed whitespace-pre-wrap",
              card.isCorrect ? "text-success" : "text-danger",
            )}
          >
            {card.studentPick}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-surface/60 p-3">
          <div className="text-[10px] uppercase tracking-wide text-ink-muted mb-1">
            Correct answer (key)
          </div>
          <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
            {card.correctPick}
          </p>
        </div>
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-ink-muted hover:text-ink select-none">
          All options (A–D)
        </summary>
        <ul className="mt-2 space-y-1.5 text-ink-muted pl-1">
          {(
            [
              ["A", card.optionA],
              ["B", card.optionB],
              ["C", card.optionC],
              ["D", card.optionD],
            ] as const
          ).map(([letter, text]) => (
            <li key={letter} className="leading-relaxed">
              <span className="font-medium text-ink">{letter}.</span> {text || "—"}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function StudentAttemptLogPanel({ studentId }: { studentId: string }) {
  const [filters, setFilters] = React.useState<Filters>({
    mode: "all",
    runType: "all",
    section: "all",
    result: "all",
    source: "all",
    primaryOnly: false,
  });
  const [rows, setRows] = React.useState<AttemptRow[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, filtered: 0 });
  const [loading, setLoading] = React.useState(true);
  const [openAttemptId, setOpenAttemptId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<DetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

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

  React.useEffect(() => {
    if (!openAttemptId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      setDetail(null);
      try {
        const res = await fetch(
          `/api/admin/students/${studentId}/attempts/${openAttemptId}`,
          { cache: "no-store" },
        );
        const json = (await res.json().catch(() => ({}))) as DetailResponse;
        if (cancelled) return;
        if (!res.ok) {
          toast.error(json.error ?? "Could not load attempt detail.");
          setOpenAttemptId(null);
          return;
        }
        setDetail(json);
      } catch {
        if (!cancelled) {
          toast.error("Could not load attempt detail.");
          setOpenAttemptId(null);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, openAttemptId]);

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
          Click a question for full detail (student answer + key). Related LLM /
          extra tries appear under that question only — not the whole session.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-ink-muted">
              Source
            </span>
            <select
              value={filters.source}
              onChange={(e) => setFilter("source", e.target.value)}
              className={`${selectCls} w-full`}
            >
              {SOURCE_OPTIONS.map((o) => (
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
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-ink-muted uppercase tracking-wide">
                  <th className="pb-2 pr-3 font-medium">Question</th>
                  <th className="pb-2 pr-3 font-medium w-16">Section</th>
                  <th className="pb-2 pr-3 font-medium w-24">Mode</th>
                  <th className="pb-2 pr-3 font-medium w-16">Type</th>
                  <th className="pb-2 pr-3 font-medium w-24">Source</th>
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
                      <button
                        type="button"
                        onClick={() => setOpenAttemptId(a.id)}
                        className="text-left text-ink hover:text-primary line-clamp-2 focus-ring rounded-sm"
                      >
                        {a.promptPreview}
                      </button>
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
                    <td className="py-2.5 pr-3 text-xs text-ink-muted">
                      {sessionRunTypeLabel(
                        a.runType as SessionRunType,
                        a.mode,
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge
                        variant={
                          a.contentOrigin?.kind === "llm" ? "secondary" : "outline"
                        }
                        className="text-[10px]"
                        title={a.contentOrigin?.detail}
                      >
                        {a.contentOrigin?.kind === "llm" ? "LLM" : "Dataset"}
                      </Badge>
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

      <Sheet
        open={openAttemptId != null}
        onOpenChange={(open) => {
          if (!open) setOpenAttemptId(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl lg:max-w-2xl overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>Attempt detail</SheetTitle>
            <SheetDescription>
              Only this question and related follow-ups (LLM / hint retry) —
              not the full session list.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {detailLoading || !detail ? (
              <p className="text-sm text-ink-muted">Loading detail…</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  <span>{detail.modeLabel}</span>
                  <span>·</span>
                  <span>
                    {sessionRunTypeLabel(
                      detail.runType as SessionRunType,
                      detail.mode,
                    )}
                  </span>
                  <Button asChild size="sm" variant="outline" className="ml-auto">
                    <Link
                      href={`/admin/students/${studentId}/sessions/${detail.sessionId}`}
                    >
                      Open full session
                    </Link>
                  </Button>
                </div>

                <AttemptDetailCardView card={detail.focus} emphasis />

                {detail.related.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                      Related ({detail.related.length})
                    </p>
                    {detail.related.map((card) => (
                      <AttemptDetailCardView key={card.id} card={card} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
