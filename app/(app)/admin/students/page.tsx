"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ModeKey = "assessment" | "practice" | "mistakes" | "mock" | "final";

type StudentRow = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: "student" | "admin";
  isActive: boolean;
  createdAt: string | null;
  lastActive: string | null;
  coverageSections: number;
  totalSections: number;
  overallAccuracy: number;
  totalAttempts: number;
  completed: Record<ModeKey, number>;
  bestMock: number | null;
  lastMock: number | null;
  unresolvedMistakes: number;
};

type Filter = "all" | "students" | "active" | "inactive" | "at_risk";

const MODE_BADGES: { key: ModeKey; label: string }[] = [
  { key: "assessment", label: "Assess" },
  { key: "practice", label: "Practice" },
  { key: "mistakes", label: "Mistakes" },
  { key: "mock", label: "Mock" },
  { key: "final", label: "Final" },
];

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";
  const diff = Date.now() - then;
  const day = 24 * 60 * 60 * 1000;
  if (diff < 60 * 1000) return "just now";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m ago`;
  if (diff < day) return `${Math.floor(diff / (60 * 60 * 1000))}h ago`;
  const days = Math.floor(diff / day);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function isInactive7d(iso: string | null): boolean {
  if (!iso) return true;
  return Date.now() - new Date(iso).getTime() > 7 * 24 * 60 * 60 * 1000;
}

export default function AdminStudentsPage() {
  const [rows, setRows] = React.useState<StudentRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/students", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(json.error ?? "Could not load students.");
          return;
        }
        if (!cancelled) setRows((json.students ?? []) as StudentRow[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.fullName ?? ""} ${r.email ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      switch (filter) {
        case "students":
          return r.role === "student";
        case "active":
          return r.isActive && !isInactive7d(r.lastActive);
        case "inactive":
          return !r.isActive || isInactive7d(r.lastActive);
        case "at_risk":
          return (
            r.totalAttempts > 0 &&
            (r.overallAccuracy < 70 || (r.bestMock != null && r.bestMock < 70))
          );
        default:
          return true;
      }
    });
  }, [rows, query, filter]);

  const counts = React.useMemo(() => {
    const total = rows.length;
    const active = rows.filter(
      (r) => r.isActive && !isInactive7d(r.lastActive),
    ).length;
    const avgReadiness = rows.length
      ? Math.round(
          rows.reduce((a, r) => a + r.overallAccuracy, 0) / rows.length,
        )
      : 0;
    return { total, active, avgReadiness };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Students</h1>
        <p className="text-ink-muted mt-1 text-sm">
          Track activity, coverage, and progress for everyone in the program.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Total users" value={counts.total} />
        <SummaryCard label="Active (7d)" value={counts.active} />
        <SummaryCard label="Avg accuracy" value={`${counts.avgReadiness}%`} />
      </div>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle>All users</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email…"
              className="h-9 max-w-xs"
            />
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["all", "All"],
                  ["students", "Students"],
                  ["active", "Active"],
                  ["inactive", "Inactive"],
                  ["at_risk", "At risk"],
                ] as [Filter, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                    filter === key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-ink-muted hover:bg-elevated",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-ink-muted">Loading students…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-ink-muted">No matching users.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((s) => (
                <StudentCard key={s.id} s={s} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-2xl font-serif font-semibold tabular-nums text-ink">
          {value}
        </div>
        <div className="text-xs text-ink-muted mt-1 uppercase tracking-wide">
          {label}
        </div>
      </CardContent>
    </Card>
  );
}

function StudentCard({ s }: { s: StudentRow }) {
  const inactive = !s.isActive || isInactive7d(s.lastActive);
  const accTone =
    s.totalAttempts === 0
      ? "outline"
      : s.overallAccuracy >= 70
        ? "success"
        : s.overallAccuracy >= 50
          ? "warn"
          : "danger";

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-ink truncate">
              {s.fullName || "Unnamed user"}
            </p>
            {s.role === "admin" && (
              <Badge variant="secondary" className="text-[10px]">admin</Badge>
            )}
            <Badge variant={s.isActive ? "success" : "outline"} className="text-[10px]">
              {s.isActive ? "active" : "deactivated"}
            </Badge>
          </div>
          <p className="text-xs text-ink-muted truncate">{s.email ?? "—"}</p>
        </div>
        <div className="text-right">
          <div className={cn("text-xs", inactive ? "text-danger" : "text-ink-muted")}>
            Last active: {timeAgo(s.lastActive)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {MODE_BADGES.map((m) => {
          const done = s.completed[m.key] > 0;
          return (
            <Badge
              key={m.key}
              variant={done ? "success" : "outline"}
              className="text-[10px]"
            >
              {m.label}
              {done && s.completed[m.key] > 1 ? ` ×${s.completed[m.key]}` : ""}
            </Badge>
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <Metric label="Coverage" value={`${s.coverageSections}/${s.totalSections}`} />
        <Metric
          label="Accuracy"
          value={s.totalAttempts ? `${s.overallAccuracy}%` : "—"}
          tone={accTone}
        />
        <Metric label="Best mock" value={s.bestMock != null ? `${s.bestMock}%` : "—"} />
        <Metric
          label="Open mistakes"
          value={s.unresolvedMistakes}
          tone={s.unresolvedMistakes > 0 ? "warn" : "outline"}
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "success" | "warn" | "danger" | "outline";
}) {
  const toneCls =
    tone === "success"
      ? "text-success"
      : tone === "warn"
        ? "text-warn"
        : tone === "danger"
          ? "text-danger"
          : "text-ink";
  return (
    <div className="rounded-lg border border-border/70 bg-elevated/30 px-3 py-2">
      <div className={cn("text-sm font-semibold tabular-nums", toneCls)}>{value}</div>
      <div className="text-[10px] text-ink-muted uppercase tracking-wide mt-0.5">
        {label}
      </div>
    </div>
  );
}
