"use client";

import * as React from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { ModeKey } from "@/lib/constants";

const MODE_ROWS: Array<{
  mode: ModeKey;
  label: string;
  description: string;
}> = [
  {
    mode: "assessment",
    label: "Assessment",
    description: "Diagnostic assessment and its existing sessions.",
  },
  {
    mode: "practice",
    label: "Practice",
    description: "Practice runs, AI coach, hints, and sibling questions.",
  },
  {
    mode: "mistakes",
    label: "Mistakes",
    description: "Personal mistakes test and its existing sessions.",
  },
  {
    mode: "mock",
    label: "Mock Exam",
    description: "Mock exam access, even when the student has paid.",
  },
  {
    mode: "final",
    label: "Final Test",
    description: "Final test access, even when the student has paid.",
  },
];

type LocksResponse = {
  migrationApplied?: boolean;
  disabledModes?: ModeKey[];
  error?: string;
};

export function ModeLockPanel({
  studentId,
  studentRole,
}: {
  studentId: string;
  studentRole: "student" | "admin";
}) {
  const [disabledModes, setDisabledModes] = React.useState<ModeKey[]>([]);
  const [loading, setLoading] = React.useState(studentRole !== "admin");
  const [migrationApplied, setMigrationApplied] = React.useState(true);
  const [busyMode, setBusyMode] = React.useState<ModeKey | null>(null);

  React.useEffect(() => {
    if (studentRole === "admin") {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/students/${studentId}/mode-locks`,
          { cache: "no-store", signal: controller.signal },
        );
        const json = (await res.json().catch(() => ({}))) as LocksResponse;
        if (!res.ok) {
          if (json.migrationApplied === false) setMigrationApplied(false);
          else toast.error(json.error ?? "Could not load section locks.");
          return;
        }
        setDisabledModes(json.disabledModes ?? []);
        setMigrationApplied(json.migrationApplied !== false);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          toast.error("Could not load section locks.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [studentId, studentRole]);

  async function setModeLocked(mode: ModeKey, locked: boolean) {
    const previous = disabledModes;
    const optimistic = locked
      ? [...new Set([...disabledModes, mode])]
      : disabledModes.filter((item) => item !== mode);

    setDisabledModes(optimistic);
    setBusyMode(mode);
    try {
      const res = await fetch(
        `/api/admin/students/${studentId}/mode-locks`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode, locked }),
        },
      );
      const json = (await res.json().catch(() => ({}))) as LocksResponse;
      if (!res.ok) {
        setDisabledModes(previous);
        if (json.migrationApplied === false) setMigrationApplied(false);
        toast.error(json.error ?? "Could not update section lock.");
        return;
      }

      setDisabledModes(json.disabledModes ?? optimistic);
      const label = MODE_ROWS.find((row) => row.mode === mode)?.label ?? mode;
      toast.success(`${label} ${locked ? "locked" : "unlocked"}.`);
    } catch {
      setDisabledModes(previous);
      toast.error("Could not update section lock.");
    } finally {
      setBusyMode(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LockKeyhole className="h-4 w-4 text-primary" />
          Section locks
        </CardTitle>
        <p className="text-xs text-ink-muted leading-relaxed">
          These admin locks are separate from payment access. Turning a lock on
          blocks that section until an admin turns it off.
        </p>
      </CardHeader>
      <CardContent>
        {studentRole === "admin" ? (
          <div className="flex items-start gap-2 rounded-xl border border-border bg-elevated/50 px-4 py-3 text-sm text-ink-muted">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            Admin accounts cannot be section-locked.
          </div>
        ) : loading ? (
          <p className="text-sm text-ink-muted">Loading section locks…</p>
        ) : !migrationApplied ? (
          <div className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-ink-muted leading-relaxed">
            Run migration{" "}
            <strong>0008_profile_disabled_modes.sql</strong> on Supabase before
            using these controls.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border">
            {MODE_ROWS.map(({ mode, label, description }) => {
              const locked = disabledModes.includes(mode);
              return (
                <div
                  key={mode}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink">{label}</span>
                      <Badge
                        variant={locked ? "warn" : "outline"}
                        className="text-[10px]"
                      >
                        {locked ? "Locked" : "Open"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
                  </div>
                  <Switch
                    checked={locked}
                    disabled={busyMode !== null}
                    onCheckedChange={(checked) =>
                      setModeLocked(mode, checked)
                    }
                    aria-label={`${locked ? "Unlock" : "Lock"} ${label}`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
