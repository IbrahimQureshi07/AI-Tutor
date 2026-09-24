"use client";

import * as React from "react";
import { Globe } from "lucide-react";
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
    description: "Locks Assessment for every student.",
  },
  {
    mode: "practice",
    label: "Practice",
    description: "Locks Practice for every student.",
  },
  {
    mode: "mistakes",
    label: "Mistakes",
    description: "Locks Mistakes Test for every student.",
  },
  {
    mode: "mock",
    label: "Mock Exam",
    description: "Locks Mock Exam for every student, including paid accounts.",
  },
  {
    mode: "final",
    label: "Final Test",
    description: "Locks Final Test for every student, including paid accounts.",
  },
];

type LocksResponse = {
  settingsTableReady?: boolean;
  disabledModes?: ModeKey[];
  error?: string;
};

export function GlobalModeLockPanel() {
  const [disabledModes, setDisabledModes] = React.useState<ModeKey[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [settingsTableReady, setSettingsTableReady] = React.useState(true);
  const [busyMode, setBusyMode] = React.useState<ModeKey | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/admin/mode-locks", {
          cache: "no-store",
          signal: controller.signal,
        });
        const json = (await res.json().catch(() => ({}))) as LocksResponse;
        if (!res.ok) {
          toast.error(json.error ?? "Could not load global section locks.");
          return;
        }
        setDisabledModes(json.disabledModes ?? []);
        setSettingsTableReady(json.settingsTableReady !== false);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          toast.error("Could not load global section locks.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, []);

  async function setModeLocked(mode: ModeKey, locked: boolean) {
    const previous = disabledModes;
    const optimistic = locked
      ? [...new Set([...disabledModes, mode])]
      : disabledModes.filter((item) => item !== mode);

    setDisabledModes(optimistic);
    setBusyMode(mode);
    try {
      const res = await fetch("/api/admin/mode-locks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, locked }),
      });
      const json = (await res.json().catch(() => ({}))) as LocksResponse;
      if (!res.ok) {
        setDisabledModes(previous);
        if (json.settingsTableReady === false) setSettingsTableReady(false);
        toast.error(json.error ?? "Could not update global section lock.");
        return;
      }

      setDisabledModes(json.disabledModes ?? optimistic);
      setSettingsTableReady(json.settingsTableReady !== false);
      const label = MODE_ROWS.find((row) => row.mode === mode)?.label ?? mode;
      toast.success(
        `${label} ${locked ? "locked for all students" : "unlocked for all students"}.`,
      );
    } catch {
      setDisabledModes(previous);
      toast.error("Could not update global section lock.");
    } finally {
      setBusyMode(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          Global section locks
        </CardTitle>
        <p className="text-xs text-ink-muted leading-relaxed">
          Lock a section for every student at once. This is separate from
          per-student locks — a student is blocked if either lock is on.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-ink-muted">Loading global section locks…</p>
        ) : !settingsTableReady ? (
          <div className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-ink-muted leading-relaxed">
            Settings table not found yet. Run{" "}
            <strong>0007_app_settings.sql</strong> on Supabase before using these
            controls.
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
                        {locked ? "Locked for all" : "Open"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
                  </div>
                  <Switch
                    checked={locked}
                    disabled={busyMode !== null}
                    onCheckedChange={(checked) => setModeLocked(mode, checked)}
                    aria-label={`${locked ? "Unlock" : "Lock"} ${label} for all students`}
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
