"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SECTIONS } from "@/lib/constants";
import {
  formatOptionWithWording,
  resolveQuestionContentOrigin,
  sessionRunTypeLabel,
  type SessionRunType,
} from "@/lib/admin/session-history";
import { cn } from "@/lib/utils";

type Attempt = {
  id: string;
  sectionCode: string;
  prompt: string;
  promptPreview: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  userAnswer: string | null;
  correctOption: string;
  isCorrect: boolean;
  isSibling: boolean;
  hinted: boolean;
  timeSpentMs: number;
  createdAt: string;
  questionSource?: string | null;
  isAiGenerated?: boolean;
  contentOrigin?: {
    kind: "dataset" | "llm";
    label: string;
    detail: string;
  };
};

type SessionDetail = {
  id: string;
  mode: string;
  runType: string;
  status: "in_progress" | "finished" | "abandoned";
  startedAt: string;
  finishedAt: string | null;
  scorePct: number | null;
  answered: number;
  total: number;
  correct: number;
  durationMs: number | null;
  attempts: Attempt[];
};

const MODE_LABELS: Record<string, string> = {
  assessment: "Assessment",
  practice: "Practice",
  mistakes: "Mistakes",
  mock: "Mock Exam",
  final: "Final Test",
};

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

function statusBadgeVariant(
  status: SessionDetail["status"],
): "success" | "warn" | "outline" {
  if (status === "finished") return "success";
  if (status === "in_progress") return "warn";
  return "outline";
}

function attemptOptions(a: Attempt) {
  return {
    optionA: a.optionA,
    optionB: a.optionB,
    optionC: a.optionC,
    optionD: a.optionD,
  };
}

export default function AdminSessionDetailPage() {
  const params = useParams<{ id: string; sessionId: string }>();
  const studentId = params?.id;
  const sessionId = params?.sessionId;
  const [session, setSession] = React.useState<SessionDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [sectionFilter, setSectionFilter] = React.useState("all");
  const [resultFilter, setResultFilter] = React.useState("all");
  const [primaryOnly, setPrimaryOnly] = React.useState(false);

  React.useEffect(() => {
    if (!studentId || !sessionId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/students/${studentId}/sessions/${sessionId}`,
          { cache: "no-store" },
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(json.error ?? "Could not load session.");
          return;
        }
        if (!cancelled) setSession(json.session as SessionDetail);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, sessionId]);

  const filteredAttempts = React.useMemo(() => {
    if (!session) return [];
    let list = session.attempts;
    if (primaryOnly) list = list.filter((a) => !a.isSibling);
    if (sectionFilter !== "all") {
      list = list.filter((a) => a.sectionCode === sectionFilter);
    }
    if (resultFilter === "correct") list = list.filter((a) => a.isCorrect);
    if (resultFilter === "wrong") list = list.filter((a) => !a.isCorrect);
    return list;
  }, [session, primaryOnly, sectionFilter, resultFilter]);

  if (loading) {
    return <p className="text-sm text-ink-muted">Loading session…</p>;
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <Link
          href={`/admin/students/${studentId}`}
          className="inline-flex text-sm text-ink-muted hover:text-ink"
        >
          ← Back to student
        </Link>
        <p className="text-sm text-ink-muted">Session not found.</p>
      </div>
    );
  }

  const wrong = session.attempts.filter((a) => !a.isCorrect && !a.isSibling).length;

  const selectCls =
    "h-9 rounded-md border border-input bg-background px-2 text-sm w-full";

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/students/${studentId}`}
        className="inline-flex text-sm text-ink-muted hover:text-ink"
      >
        ← Back to student
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight">
            {MODE_LABELS[session.mode] ?? session.mode} session
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Started {fmtDateTime(session.startedAt)}
            {session.finishedAt && ` · Finished ${fmtDateTime(session.finishedAt)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {sessionRunTypeLabel(session.runType as SessionRunType, session.mode)}
          </Badge>
          <Badge variant={statusBadgeVariant(session.status)}>{session.status}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Score" value={session.scorePct != null ? `${session.scorePct}%` : "—"} />
        <MiniStat
          label="Answered"
          value={`${session.answered}/${session.total || "?"}`}
        />
        <MiniStat label="Correct" value={session.correct} />
        <MiniStat label="Duration" value={fmtDurationMs(session.durationMs)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Question attempts</CardTitle>
          <p className="text-xs text-ink-muted">
            {session.attempts.length} total · {wrong} wrong (primary) ·{" "}
            {MODE_LABELS[session.mode] ?? session.mode} ·{" "}
            {sessionRunTypeLabel(session.runType as SessionRunType, session.mode)}
            . Full question text with student pick vs correct key wording. Dataset
            vs LLM badge shows where the question content came from.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3 max-w-xl">
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wide text-ink-muted">
                Section
              </span>
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className={selectCls}
              >
                <option value="all">All sections</option>
                {SECTIONS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wide text-ink-muted">
                Result
              </span>
              <select
                value={resultFilter}
                onChange={(e) => setResultFilter(e.target.value)}
                className={selectCls}
              >
                <option value="all">All</option>
                <option value="correct">Correct</option>
                <option value="wrong">Wrong</option>
              </select>
            </label>
            <label className="flex items-end gap-2 pb-1">
              <input
                type="checkbox"
                checked={primaryOnly}
                onChange={(e) => setPrimaryOnly(e.target.checked)}
                className="rounded border-input"
              />
              <span className="text-xs text-ink-muted">Primary only</span>
            </label>
          </div>

          <p className="text-xs text-ink-muted">
            Showing {filteredAttempts.length} of {session.attempts.length}
          </p>

          <div className="rounded-lg border border-border/60 bg-elevated/30 px-3 py-2 text-[11px] text-ink-muted space-y-1">
            <p>
              <span className="font-medium text-ink">Dataset</span> — imported CSV
              / question bank (not AI-written).
            </p>
            <p>
              <span className="font-medium text-ink">LLM generated</span> — AI
              follow-up created after a miss (may appear as primary later if
              reused from the bank).
            </p>
            <p>
              <span className="font-medium text-ink">primary / extra try</span> —
              attempt type in this session (extra try = sibling follow-up turn).
            </p>
          </div>

          {filteredAttempts.length === 0 ? (
            <p className="text-sm text-ink-muted">No attempts match these filters.</p>
          ) : (
            <div className="space-y-3">
              {filteredAttempts.map((a, i) => {
                const opts = attemptOptions(a);
                const studentPick = formatOptionWithWording(a.userAnswer, opts);
                const correctKey = formatOptionWithWording(a.correctOption, opts);
                const origin =
                  a.contentOrigin ??
                  resolveQuestionContentOrigin({
                    source: a.questionSource,
                    isAiGenerated: a.isAiGenerated,
                  });
                return (
                  <div
                    key={a.id}
                    className={cn(
                      "rounded-xl border border-border/70 bg-elevated/20 p-4 space-y-3",
                      !a.isCorrect && "border-danger/25",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-ink-muted tabular-nums">
                          #{i + 1}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-medium text-primary">
                          {a.sectionCode}
                        </Badge>
                        <Badge
                          variant={origin.kind === "llm" ? "warn" : "secondary"}
                          className="text-[10px]"
                          title={origin.detail}
                        >
                          {origin.label}
                        </Badge>
                        <Badge
                          variant={a.isCorrect ? "success" : "danger"}
                          className="text-[10px]"
                        >
                          {a.isCorrect ? "correct" : "wrong"}
                        </Badge>
                        <span className="text-xs text-ink-muted">
                          {a.isSibling ? "extra try" : a.hinted ? "hinted" : "primary"}
                        </span>
                      </div>
                      <span className="text-xs text-ink-muted whitespace-nowrap">
                        {fmtDateTime(a.createdAt)}
                      </span>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-ink-muted mb-1">
                        Question
                      </div>
                      <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                        {a.prompt || a.promptPreview || "—"}
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
                            a.isCorrect ? "text-success" : "text-danger",
                          )}
                        >
                          {studentPick}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-surface/60 p-3">
                        <div className="text-[10px] uppercase tracking-wide text-ink-muted mb-1">
                          Correct answer (key)
                        </div>
                        <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                          {correctKey}
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
                            ["A", a.optionA],
                            ["B", a.optionB],
                            ["C", a.optionC],
                            ["D", a.optionD],
                          ] as const
                        ).map(([letter, text]) => (
                          <li key={letter} className="leading-relaxed">
                            <span className="font-medium text-ink">{letter}.</span>{" "}
                            {text || "—"}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="text-xl font-serif font-semibold tabular-nums">{value}</div>
        <div className="text-[10px] text-ink-muted uppercase tracking-wide mt-1">
          {label}
        </div>
      </CardContent>
    </Card>
  );
}
