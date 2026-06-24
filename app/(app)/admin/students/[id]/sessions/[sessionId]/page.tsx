"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SECTIONS } from "@/lib/constants";

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
  attempts: Array<{
    id: string;
    sectionCode: string;
    promptPreview: string;
    userAnswer: string | null;
    correctOption: string;
    isCorrect: boolean;
    isSibling: boolean;
    hinted: boolean;
    timeSpentMs: number;
    createdAt: string;
  }>;
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
          <Badge variant="secondary">{session.runType}</Badge>
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
            {MODE_LABELS[session.mode] ?? session.mode} · {session.runType} run
          </p>
        </CardHeader>
        <CardContent className="space-y-4 overflow-x-auto">
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

          {filteredAttempts.length === 0 ? (
            <p className="text-sm text-ink-muted">No attempts match these filters.</p>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-ink-muted uppercase tracking-wide">
                  <th className="pb-2 pr-3 font-medium">Question</th>
                  <th className="pb-2 pr-3 font-medium w-16">Section</th>
                  <th className="pb-2 pr-3 font-medium w-16">Answer</th>
                  <th className="pb-2 pr-3 font-medium w-16">Key</th>
                  <th className="pb-2 pr-3 font-medium w-20">Result</th>
                  <th className="pb-2 pr-3 font-medium w-24">Type</th>
                  <th className="pb-2 font-medium w-28">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttempts.map((a) => (
                  <tr key={a.id} className="border-b border-border/60 align-top">
                    <td className="py-2.5 pr-3 text-ink max-w-md">
                      <span className="line-clamp-2">{a.promptPreview}</span>
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-primary tabular-nums">
                      {a.sectionCode}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">{a.userAnswer ?? "—"}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{a.correctOption}</td>
                    <td className="py-2.5 pr-3">
                      <Badge
                        variant={a.isCorrect ? "success" : "danger"}
                        className="text-[10px]"
                      >
                        {a.isCorrect ? "correct" : "wrong"}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-ink-muted">
                      {a.isSibling ? "extra try" : a.hinted ? "hinted" : "primary"}
                    </td>
                    <td className="py-2.5 text-xs text-ink-muted whitespace-nowrap">
                      {fmtDateTime(a.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
