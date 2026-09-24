"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Target,
  Zap,
  Telescope,
  CheckCircle2,
  Lightbulb,
  FlaskConical,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSectionDisplayLabel } from "@/lib/sections/display-label";

type Section = {
  code: string;
  title: string;
  group: "National" | "State";
  count: number;
};

type SectionFreshness = {
  code: string;
  lastAssessedAt: string | null;
  daysSinceAssessed: number | null;
  fresh: boolean;
};

type Coverage = {
  covered: string[];
  missing: string[];
  allCovered: boolean;
  nextSection: string | null;
  stale?: string[];
  freshness?: SectionFreshness[];
  freshnessDays?: number;
};

type Length = "quick" | "deep" | "smoke";

const LENGTH_PER_SECTION: Record<Length, number> = {
  quick: 15,
  deep: 35,
  smoke: 2,
};

export function AssessmentPicker({
  sections,
  initialPicked,
  coverage,
  lockedSections = [],
}: {
  sections: Section[];
  initialPicked?: string[];
  coverage?: Coverage;
  /** Admin-locked Assessment sections (A1–B6) — shown disabled. */
  lockedSections?: string[];
}) {
  const router = useRouter();
  const lockedSet = React.useMemo(
    () => new Set(lockedSections),
    [lockedSections],
  );
  const [length, setLength] = React.useState<Length>("quick");
  const [picked, setPicked] = React.useState<Set<string>>(() => {
    const eligibleCodes = new Set(
      sections
        .filter((s) => s.count > 0 && !lockedSet.has(s.code))
        .map((s) => s.code),
    );
    if (initialPicked && initialPicked.length) {
      return new Set(initialPicked.filter((c) => eligibleCodes.has(c)));
    }
    return new Set(eligibleCodes);
  });
  const [pending, setPending] = React.useState(false);

  const coveredSet = React.useMemo(
    () => new Set(coverage?.covered ?? []),
    [coverage?.covered],
  );
  const staleSet = React.useMemo(
    () => new Set(coverage?.stale ?? []),
    [coverage?.stale],
  );
  const freshnessByCode = React.useMemo(() => {
    const m = new Map<string, SectionFreshness>();
    for (const f of coverage?.freshness ?? []) m.set(f.code, f);
    return m;
  }, [coverage?.freshness]);
  const freshnessDays = coverage?.freshnessDays ?? 7;

  const eligible = sections.filter(
    (s) => s.count > 0 && !lockedSet.has(s.code),
  );
  const allSelected = eligible.length > 0 && picked.size === eligible.length;
  const totalQuestions = picked.size * LENGTH_PER_SECTION[length];
  const lockedCount = sections.filter((s) => lockedSet.has(s.code)).length;

  function togglePick(code: string) {
    if (lockedSet.has(code)) return;
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }
  function toggleAll() {
    if (allSelected) setPicked(new Set());
    else setPicked(new Set(eligible.map((s) => s.code)));
  }
  function pickGroup(group: "National" | "State") {
    setPicked(
      new Set(
        eligible.filter((s) => s.group === group).map((s) => s.code),
      ),
    );
  }

  async function start() {
    const sectionsToStart = Array.from(picked).filter(
      (code) => !lockedSet.has(code),
    );
    if (!sectionsToStart.length) {
      toast.error(
        lockedCount > 0
          ? "All selected sections are locked by an administrator."
          : "Pick at least one section.",
      );
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/assessment/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          length,
          sections: sectionsToStart,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not start.");
      router.push(json.runnerPath);
    } catch (e) {
      toast.error((e as Error).message);
      setPending(false);
    }
  }

  const coveredCount = coverage?.covered.length ?? 0;
  const totalSections = sections.length;
  const progressPct = totalSections
    ? Math.round((100 * coveredCount) / totalSections)
    : 0;
  const showCoverage = !!coverage && !coverage.allCovered;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 md:p-12 shadow-soft"
      >
        <div className="absolute inset-0 mesh-gradient opacity-30" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-primary/15 grid place-items-center">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <Badge variant="outline">Assessment</Badge>
            {coverage?.allCovered && (
              <Badge variant="outline" className="text-success border-success/30">
                All sections covered
              </Badge>
            )}
          </div>
          <h1 className="mt-5 font-serif text-5xl font-semibold tracking-tight">
            {coverage?.allCovered
              ? "You've mapped every section."
              : "Find out where you stand."}
          </h1>
          <p className="mt-3 text-lg text-ink-muted max-w-2xl">
            {coverage?.allCovered
              ? "Every section has a baseline. Retake any section to refresh your scores, or jump straight into Practice."
              : "We'll measure each section you pick — easy, medium, and hard mixed. Get one wrong? You'll see a hint and one more chance. Practice unlocks once every section has a baseline."}
          </p>

          {showCoverage && coverage && (
            <div className="mt-6 rounded-2xl border border-border bg-elevated/60 p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm">
                  <Lock className="h-4 w-4 text-ink-muted" />
                  <span className="font-medium text-ink">
                    Practice unlocks at 12/12 sections
                  </span>
                  <span className="text-ink-muted">
                    · {coveredCount}/{totalSections} fresh
                  </span>
                </div>
                {coverage.nextSection && (
                  <span className="text-xs text-ink-muted">
                    Next up: <b className="text-ink">{formatSectionDisplayLabel(coverage.nextSection)}</b>
                  </span>
                )}
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {(staleSet.size > 0 || (coverage.freshness?.length ?? 0) > 0) && (
                <div className="mt-3 text-[11px] text-ink-muted">
                  Coverage decays after {freshnessDays} days — re-assess to
                  refresh.{staleSet.size > 0
                    ? ` ${staleSet.size} section${staleSet.size === 1 ? "" : "s"} stale.`
                    : ""}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Length selector */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">1. How deep do you want to go?</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <LengthOption
              label="Quick check"
              minutes="~20 min"
              detail={`15 questions × selected sections (${15 * picked.size} total)`}
              icon={<Zap className="h-4 w-4" />}
              active={length === "quick"}
              onClick={() => setLength("quick")}
            />
            <LengthOption
              label="Deep diagnostic"
              minutes="~60 min"
              detail={`35 questions × selected sections (${35 * picked.size} total)`}
              icon={<Telescope className="h-4 w-4" />}
              active={length === "deep"}
              onClick={() => setLength("deep")}
            />
            <LengthOption
              label="Smoke test"
              minutes="~2 min / section"
              detail={`2 questions × selected sections (${2 * picked.size} total) — for testing flows, hints, and results.`}
              icon={<FlaskConical className="h-4 w-4" />}
              active={length === "smoke"}
              onClick={() => setLength("smoke")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section picker */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h3 className="font-semibold">2. Which sections?</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => pickGroup("National")}>
                National only
              </Button>
              <Button size="sm" variant="ghost" onClick={() => pickGroup("State")}>
                SC only
              </Button>
              <Button size="sm" variant="outline" onClick={toggleAll}>
                {allSelected ? "Clear all" : "Select all"}
              </Button>
            </div>
          </div>

          {lockedCount > 0 && (
            <p className="mb-3 text-xs text-ink-muted">
              {lockedCount} section{lockedCount === 1 ? "" : "s"} locked by an
              administrator and cannot be selected.
            </p>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {sections.map((s) => {
              const adminLocked = lockedSet.has(s.code);
              const disabled = s.count === 0 || adminLocked;
              const active = !adminLocked && picked.has(s.code);
              const done = coveredSet.has(s.code);
              const stale = staleSet.has(s.code);
              const fr = freshnessByCode.get(s.code);
              return (
                <button
                  key={s.code}
                  type="button"
                  disabled={disabled}
                  onClick={() => togglePick(s.code)}
                  title={
                    adminLocked
                      ? "This section is locked by an administrator"
                      : s.count === 0
                        ? "No questions available"
                        : undefined
                  }
                  className={cn(
                    "group relative text-left rounded-2xl border p-3 transition-all focus-ring",
                    "flex items-center gap-3",
                    disabled && "opacity-40 cursor-not-allowed",
                    adminLocked && "opacity-55",
                    !disabled && active && "border-primary bg-primary-soft/40",
                    !disabled && !active && "border-border bg-surface hover:bg-elevated",
                  )}
                >
                  <div
                    className={cn(
                      "h-9 w-9 rounded-xl grid place-items-center text-[10px] font-semibold leading-tight border shrink-0 px-1 text-center",
                      active
                        ? "bg-primary text-primary-foreground border-transparent"
                        : "bg-muted text-ink-muted border-border",
                    )}
                  >
                    {s.group === "National" ? "Nat" : "SC"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink leading-snug">
                      {formatSectionDisplayLabel(s.code)}
                    </div>
                    <div className="text-xs text-ink-muted">
                      {adminLocked ? (
                    <span className="inline-flex items-center gap-1 text-warn">
                      <Lock className="h-3 w-3" />
                      This section is locked by an administrator
                    </span>
                  ) : (
                        <>
                          {s.count.toLocaleString()} questions
                          {done && fr?.daysSinceAssessed != null && (
                            <span className="ml-1 text-success">
                              · fresh
                              {fr.daysSinceAssessed === 0
                                ? " · today"
                                : ` · ${fr.daysSinceAssessed}d ago`}
                            </span>
                          )}
                          {!done && stale && fr?.daysSinceAssessed != null && (
                            <span className="ml-1 text-warn">
                              · stale · {fr.daysSinceAssessed}d ago
                            </span>
                          )}
                          {done && fr?.daysSinceAssessed == null && (
                            <span className="ml-1 text-success">· assessed</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {adminLocked ? (
                    <Lock className="h-4 w-4 text-warn shrink-0" />
                  ) : active ? (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  ) : done ? (
                    <CheckCircle2 className="h-4 w-4 text-success/70 shrink-0" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-warn" /> How the 2-chance flow works
          </h3>
          <ul className="space-y-2.5 text-sm text-ink-muted">
            <li className="flex gap-2"><Dot /> First try right (no hint) → <b className="text-success">mastered</b>.</li>
            <li className="flex gap-2"><Dot /> Hint used then right → still counts as <b className="text-success">mastered</b>; using the hint is encouraged.</li>
            <li className="flex gap-2"><Dot /> Second try right after a wrong → <b className="text-warn">soft miss</b>. Reachable.</li>
            <li className="flex gap-2"><Dot /> Wrong twice → <b className="text-danger">hard miss</b>. We&apos;ll teach this from scratch.</li>
            <li className="flex gap-2"><Dot /> No section is auto-revealed. Hints come from AI, tailored to the question.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Sticky footer summary */}
      <div className="sticky bottom-4 z-20">
        <div className="rounded-2xl border border-border bg-surface/95 backdrop-blur p-4 shadow-soft flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            <div className="font-medium text-ink">
              {picked.size} section{picked.size === 1 ? "" : "s"} ·{" "}
              {totalQuestions.toLocaleString()} questions
            </div>
            <div className="text-ink-muted text-xs">
              ≈ {Math.round((totalQuestions * 60) / 60)} minutes at 60 sec / question
            </div>
          </div>
          <Button size="lg" onClick={start} disabled={pending || !picked.size}>
            {pending ? "Building your set…" : "Start assessment"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Dot() {
  return <span className="mt-2 h-1 w-1 rounded-full bg-primary shrink-0" />;
}

function LengthOption({
  label,
  minutes,
  detail,
  icon,
  active,
  onClick,
}: {
  label: string;
  minutes: string;
  detail: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left rounded-2xl border p-4 transition-all focus-ring",
        active
          ? "border-primary bg-primary-soft/40 shadow-soft"
          : "border-border bg-surface hover:bg-elevated",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium text-ink">
          <span
            className={cn(
              "h-7 w-7 rounded-lg grid place-items-center",
              active ? "bg-primary text-primary-foreground" : "bg-muted text-ink-muted",
            )}
          >
            {icon}
          </span>
          {label}
        </div>
        <span className="text-xs text-ink-muted">{minutes}</span>
      </div>
      <p className="mt-2 text-sm text-ink-muted">{detail}</p>
    </button>
  );
}
