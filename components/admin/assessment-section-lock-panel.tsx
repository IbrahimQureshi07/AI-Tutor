"use client";

import * as React from "react";
import { ListChecks, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { SECTIONS, type SectionCode } from "@/lib/constants";

type LocksResponse = {
  migrationApplied?: boolean;
  disabledAssessmentSections?: SectionCode[];
  error?: string;
};

const NATIONAL = SECTIONS.filter((s) => s.group === "National");
const STATE = SECTIONS.filter((s) => s.group === "State");

export function AssessmentSectionLockPanel({
  studentId,
  studentRole,
}: {
  studentId: string;
  studentRole: "student" | "admin";
}) {
  const [disabledSections, setDisabledSections] = React.useState<SectionCode[]>(
    [],
  );
  const [loading, setLoading] = React.useState(studentRole !== "admin");
  const [migrationApplied, setMigrationApplied] = React.useState(true);
  const [busySection, setBusySection] = React.useState<SectionCode | null>(
    null,
  );

  React.useEffect(() => {
    if (studentRole === "admin") {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/students/${studentId}/assessment-section-locks`,
          { cache: "no-store", signal: controller.signal },
        );
        const json = (await res.json().catch(() => ({}))) as LocksResponse;
        if (!res.ok) {
          if (json.migrationApplied === false) setMigrationApplied(false);
          else
            toast.error(
              json.error ?? "Could not load Assessment section locks.",
            );
          return;
        }
        setDisabledSections(json.disabledAssessmentSections ?? []);
        setMigrationApplied(json.migrationApplied !== false);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          toast.error("Could not load Assessment section locks.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [studentId, studentRole]);

  async function setSectionLocked(section: SectionCode, locked: boolean) {
    const previous = disabledSections;
    const optimistic = locked
      ? [...new Set([...disabledSections, section])]
      : disabledSections.filter((code) => code !== section);

    setDisabledSections(optimistic);
    setBusySection(section);
    try {
      const res = await fetch(
        `/api/admin/students/${studentId}/assessment-section-locks`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ section, locked }),
        },
      );
      const json = (await res.json().catch(() => ({}))) as LocksResponse;
      if (!res.ok) {
        setDisabledSections(previous);
        if (json.migrationApplied === false) setMigrationApplied(false);
        toast.error(json.error ?? "Could not update Assessment section lock.");
        return;
      }

      setDisabledSections(json.disabledAssessmentSections ?? optimistic);
      const title =
        SECTIONS.find((s) => s.code === section)?.title ?? section;
      toast.success(
        `${section} · ${title} ${locked ? "locked" : "unlocked"}.`,
      );
    } catch {
      setDisabledSections(previous);
      toast.error("Could not update Assessment section lock.");
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
                    <span className="text-sm font-medium text-ink">
                      {s.code}
                    </span>
                    <span className="text-sm text-ink-muted truncate">
                      {s.title}
                    </span>
                    <Badge
                      variant={locked ? "warn" : "outline"}
                      className="text-[10px]"
                    >
                      {locked ? "Locked" : "Open"}
                    </Badge>
                  </div>
                </div>
                <Switch
                  checked={locked}
                  disabled={busySection !== null}
                  onCheckedChange={(checked) =>
                    setSectionLocked(s.code, checked)
                  }
                  aria-label={`${locked ? "Unlock" : "Lock"} ${s.code}`}
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
          <ListChecks className="h-4 w-4 text-primary" />
          Assessment section locks
        </CardTitle>
        <p className="text-xs text-ink-muted leading-relaxed">
          Lock individual Assessment sections (A1–B6) for this student. Locked
          sections stay blocked in Assessment until an admin unlocks them —
          separate from full Assessment mode lock above.
        </p>
      </CardHeader>
      <CardContent>
        {studentRole === "admin" ? (
          <div className="flex items-start gap-2 rounded-xl border border-border bg-elevated/50 px-4 py-3 text-sm text-ink-muted">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            Admin accounts cannot have Assessment sections locked.
          </div>
        ) : loading ? (
          <p className="text-sm text-ink-muted">
            Loading Assessment section locks…
          </p>
        ) : !migrationApplied ? (
          <div className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-ink-muted leading-relaxed">
            Run migration{" "}
            <strong>0009_profile_disabled_assessment_sections.sql</strong> on
            Supabase before using these controls.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionGroup title="National" rows={NATIONAL} />
            <SectionGroup title="State" rows={STATE} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
