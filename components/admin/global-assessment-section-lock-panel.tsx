"use client";

import * as React from "react";
import { Globe2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { SECTIONS, type SectionCode } from "@/lib/constants";

type LocksResponse = {
  settingsTableReady?: boolean;
  disabledAssessmentSections?: SectionCode[];
  error?: string;
};

const NATIONAL = SECTIONS.filter((s) => s.group === "National");
const STATE = SECTIONS.filter((s) => s.group === "State");

export function GlobalAssessmentSectionLockPanel() {
  const [disabledSections, setDisabledSections] = React.useState<SectionCode[]>(
    [],
  );
  const [loading, setLoading] = React.useState(true);
  const [settingsTableReady, setSettingsTableReady] = React.useState(true);
  const [busySection, setBusySection] = React.useState<SectionCode | null>(
    null,
  );

  React.useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/admin/assessment-section-locks", {
          cache: "no-store",
          signal: controller.signal,
        });
        const json = (await res.json().catch(() => ({}))) as LocksResponse;
        if (!res.ok) {
          toast.error(
            json.error ?? "Could not load global Assessment section locks.",
          );
          return;
        }
        setDisabledSections(json.disabledAssessmentSections ?? []);
        setSettingsTableReady(json.settingsTableReady !== false);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          toast.error("Could not load global Assessment section locks.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, []);

  async function setSectionLocked(section: SectionCode, locked: boolean) {
    const previous = disabledSections;
    const optimistic = locked
      ? [...new Set([...disabledSections, section])]
      : disabledSections.filter((code) => code !== section);

    setDisabledSections(optimistic);
    setBusySection(section);
    try {
      const res = await fetch("/api/admin/assessment-section-locks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ section, locked }),
      });
      const json = (await res.json().catch(() => ({}))) as LocksResponse;
      if (!res.ok) {
        setDisabledSections(previous);
        if (json.settingsTableReady === false) setSettingsTableReady(false);
        toast.error(
          json.error ?? "Could not update global Assessment section lock.",
        );
        return;
      }

      setDisabledSections(json.disabledAssessmentSections ?? optimistic);
      setSettingsTableReady(json.settingsTableReady !== false);
      const title = SECTIONS.find((s) => s.code === section)?.title ?? section;
      toast.success(
        `${section} · ${title} ${
          locked ? "locked for all students" : "unlocked for all students"
        }.`,
      );
    } catch {
      setDisabledSections(previous);
      toast.error("Could not update global Assessment section lock.");
    } finally {
      setBusySection(null);
    }
  }

  function SectionGroup({
    title,
    rows,
  }: {
    title: string;
    rows: ReadonlyArray<(typeof SECTIONS)[number]>;
  }) {
    return (
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wide text-ink-muted px-1">
          {title}
        </p>
        <div className="divide-y divide-border rounded-xl border border-border">
          {rows.map((s) => {
            const locked = disabledSections.includes(s.code);
            return (
              <div
                key={s.code}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{s.code}</span>
                    <span className="text-sm text-ink-muted truncate">
                      {s.title}
                    </span>
                    <Badge
                      variant={locked ? "warn" : "outline"}
                      className="text-[10px]"
                    >
                      {locked ? "Locked for all" : "Open"}
                    </Badge>
                  </div>
                </div>
                <Switch
                  checked={locked}
                  disabled={busySection !== null}
                  onCheckedChange={(checked) =>
                    setSectionLocked(s.code, checked)
                  }
                  aria-label={`${locked ? "Unlock" : "Lock"} ${s.code} for all students`}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe2 className="h-4 w-4 text-primary" />
          Global Assessment section locks
        </CardTitle>
        <p className="text-xs text-ink-muted leading-relaxed">
          Lock Assessment sections (A1–B6) for every student at once. Separate
          from per-student locks and from full Assessment mode lock — a section
          is blocked if either global or student lock is on.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-ink-muted">
            Loading global Assessment section locks…
          </p>
        ) : !settingsTableReady ? (
          <div className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-ink-muted leading-relaxed">
            Settings table not found yet. Run{" "}
            <strong>0007_app_settings.sql</strong> on Supabase before using these
            controls.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionGroup title="National" rows={NATIONAL} />
            <SectionGroup title="State" rows={STATE} />
          </div>
        )}
        <p className="mt-3 flex items-start gap-2 text-[11px] text-ink-muted leading-relaxed">
          <ListChecks className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          Tip: use student-page Assessment section locks for one learner only.
        </p>
      </CardContent>
    </Card>
  );
}
