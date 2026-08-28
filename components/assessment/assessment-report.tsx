"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  RotateCcw,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Lock,
  TrendingUp,
  BookOpen,
  GraduationCap,
  Flag,
  Target,
  Gauge,
  Clock,
  Hourglass,
  Trophy,
  Activity,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatMs } from "@/lib/utils";
import type {
  AssessmentSummary,
  ConceptStat,
  RawAttempt,
} from "@/lib/assessment/summary";
import { useChatSheet } from "@/components/chat/chat-sheet-provider";
import { toast } from "sonner";
import { formatSectionDisplayLabel } from "@/lib/sections/display-label";
import type { KpiHelpKey } from "@/components/kpi/kpi-help-copy";
import { KpiInsightByKey } from "@/components/kpi/kpi-insight-tooltip";

// SC salesperson exam pass line.
const PASS_THRESHOLD = 70;

type Tone = "success" | "warn-strong" | "warn-soft" | "danger";

const LABELS = {
  mastered: "Locked in",
  soft_miss: "Recovered",
  hard_miss: "Needs review",
} as const;

const TONES: Record<Tone, { text: string; bg: string; ring: string; soft: string }> = {
  success: {
    text: "text-success",
    bg: "bg-success/10",
    ring: "border-success/25",
    soft: "bg-success",
  },
  "warn-strong": {
    text: "text-warn",
    bg: "bg-warn/10",
    ring: "border-warn/25",
    soft: "bg-warn",
  },
  "warn-soft": {
    text: "text-warn",
    bg: "bg-warn/5",
    ring: "border-warn/15",
    soft: "bg-warn/40",
  },
  danger: {
    text: "text-danger",
    bg: "bg-danger/10",
    ring: "border-danger/25",
    soft: "bg-danger",
  },
};

type Coverage = {
  covered: string[];
  missing: string[];
  allCovered: boolean;
  coveredEver?: string[];
  missingEver?: string[];
  allCoveredEver?: boolean;
  nextSection: string | null;
};

type Props = {
  sessionId: string;
  durationMs: number;
  summary: AssessmentSummary;
  tutorLetter: string | null;
  conceptTitles: Record<string, string>;
  sectionTitles: Record<string, string>;
  attempts: RawAttempt[];
  lengthLabel: "quick" | "deep" | "smoke" | null;
  coverage: Coverage;
};

export function AssessmentReport({
  sessionId,
  durationMs,
  summary,
  tutorLetter,
  conceptTitles,
  sectionTitles,
  attempts,
  lengthLabel,
  coverage,
}: Props) {
  const strict = summary.accuracy_pct;
  const reach = summary.effective_pct;
  const lengthText =
    lengthLabel === "deep"
      ? "Deep diagnostic"
      : lengthLabel === "smoke"
        ? "Smoke test"
        : lengthLabel === "quick"
          ? "Quick check"
          : null;

  const nextSection = coverage.nextSection;
  const nextLabel = nextSection ? formatSectionDisplayLabel(nextSection) : "";
  const continueHref = coverage.missing.length
    ? `/assessment?sections=${coverage.missing.join(",")}`
    : "/assessment";
  const primaryCtaHref = coverage.allCoveredEver ? "/practice" : continueHref;
  const primaryCtaLabel = coverage.allCoveredEver
    ? "Start practice"
    : nextSection
      ? `Continue: ${nextLabel}`
      : "Continue assessment";

  return (
    <div className="space-y-6">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 md:p-8 shadow-soft">
        <div className="absolute inset-0 mesh-gradient opacity-20" aria-hidden />
        <div className="relative">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">Assessment results</Badge>
                {lengthText && (
                  <Badge variant="outline" className="text-ink-muted">
                    {lengthText}
                  </Badge>
                )}
              </div>
              <h1 className="mt-3 font-serif text-3xl md:text-4xl font-semibold tracking-tight">
                Your diagnostic snapshot
              </h1>
              <p className="mt-1 text-sm text-ink-muted">
                {summary.total} question{summary.total === 1 ? "" : "s"} ·{" "}
                {formatMs(durationMs)} · SC pass line is {PASS_THRESHOLD}%
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <Button asChild>
                <Link href={primaryCtaHref}>
                  <ArrowRight className="h-4 w-4" /> {primaryCtaLabel}
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/assessment">
                  <RotateCcw className="h-4 w-4" /> Retake
                </Link>
              </Button>
              <DownloadPdfButton sessionId={sessionId} allCovered={coverage.allCovered} />
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
            <CompositionRing summary={summary} />
            <div className="grid sm:grid-cols-2 gap-3">
              <MetricBlock
                icon={Target}
                title="First-try mastery"
                caption="No hint, no retry — pure recall."
                value={strict}
                threshold={PASS_THRESHOLD}
                emphasis
                insightKey="first_try_mastery"
              />
              <MetricBlock
                icon={Gauge}
                title="With support"
                caption="Right after a hint or on the second try."
                value={reach}
                threshold={PASS_THRESHOLD}
                insightKey="with_support"
              />
            </div>
          </div>

          <ExamReadinessBar strict={strict} reach={reach} />

          <CoverageNotice
            coverage={coverage}
            continueHref={continueHref}
            nextSection={nextSection}
            nextLabel={nextLabel}
          />
        </div>
      </section>

      {/* OUTCOME TILES */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatTile
          icon={Lock}
          label={LABELS.mastered}
          sub="First try, no help needed."
          value={summary.mastered}
          total={summary.total}
          tone="success"
          insightKey="locked_in"
        />
        <StatTile
          icon={TrendingUp}
          label={LABELS.soft_miss}
          sub="Right after the hint / retry."
          value={summary.soft_miss}
          total={summary.total}
          tone="warn-strong"
          insightKey="recovered"
        />
        <StatTile
          icon={BookOpen}
          label={LABELS.hard_miss}
          sub="Missed both tries."
          value={summary.hard_miss}
          total={summary.total}
          tone="danger"
          insightKey="needs_review"
        />
      </section>

      {/* PREDICTED PASS PROBABILITY */}
      <PassProbabilityPanel summary={summary} />

      {/* TUTOR LETTER */}
      {tutorLetter && (
        <TutorLetter
          text={tutorLetter}
          primaryHref={primaryCtaHref}
          primaryLabel={
            coverage.allCovered ? "Practice weak topics" : primaryCtaLabel
          }
        />
      )}

      {/* SECTION BREAKDOWN */}
      <SectionBreakdown summary={summary} sectionTitles={sectionTitles} />

      {/* TIME + SECTION RADAR */}
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <TimeInsightPanel
            summary={summary}
            durationMs={durationMs}
            sectionTitles={sectionTitles}
          />
        </div>
        <div className="lg:col-span-2">
          <SectionRadarCard
            summary={summary}
            sectionTitles={sectionTitles}
          />
        </div>
      </div>

      {/* PRIORITIES */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-danger" />
                <h3 className="font-semibold">Top to drill next</h3>
              </div>
              {coverage.allCovered ? (
                <Button asChild size="sm" variant="soft">
                  <Link href="/practice">Practice these</Link>
                </Button>
              ) : (
                <Button asChild size="sm" variant="soft">
                  <Link href={continueHref}>
                    {nextSection ? `Continue: ${nextLabel}` : "Continue assessment"}
                  </Link>
                </Button>
              )}
            </div>
            {summary.weakest_concepts.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Nothing flagged — clean run. Push into Mock Exam when
                you&apos;re ready.
              </p>
            ) : (
              <ol className="space-y-2 text-sm">
                {summary.weakest_concepts.map((c, i) => (
                  <ConceptRow
                    key={c.concept_id}
                    rank={i + 1}
                    concept={c}
                    title={conceptTitles[c.concept_id]}
                    tone="weak"
                  />
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-success" />
              <h3 className="font-semibold">Already strong</h3>
            </div>
            {summary.strongest_concepts.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Nothing locked in yet — Practice mode will get you there.
              </p>
            ) : (
              <ol className="space-y-2 text-sm">
                {summary.strongest_concepts.map((c, i) => (
                  <ConceptRow
                    key={c.concept_id}
                    rank={i + 1}
                    concept={c}
                    title={conceptTitles[c.concept_id]}
                    tone="strong"
                  />
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* QUESTION REVIEW */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">Review every question</h3>
          <ReviewList attempts={attempts} />
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Hero helpers ---------------- */

function CoverageNotice({
  coverage,
  continueHref,
  nextSection,
  nextLabel,
}: {
  coverage: Coverage;
  continueHref: string;
  nextSection: string | null;
  nextLabel: string;
}) {
  const total = coverage.covered.length + coverage.missing.length;
  const done = coverage.covered.length;
  const pct = total ? Math.round((100 * done) / total) : 0;

  if (coverage.allCovered) {
    return (
      <div className="mt-5 rounded-2xl border border-success/30 bg-success/5 p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <span className="font-medium text-ink">
            All 12 sections assessed — Practice is unlocked.
          </span>
        </div>
        <Button asChild size="sm">
          <Link href="/practice">
            <ArrowRight className="h-3.5 w-3.5" /> Start practice
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-2xl border border-border bg-elevated/60 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <Lock className="h-4 w-4 text-ink-muted" />
          <span className="font-medium text-ink">
            Practice unlocks at 12/12 sections
          </span>
          <span className="text-ink-muted">· {done}/{total} done</span>
        </div>
        {nextSection && (
          <Button asChild size="sm" variant="outline">
            <Link href={continueHref}>
              Continue: {nextLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CompositionRing({ summary }: { summary: AssessmentSummary }) {
  const size = 176;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const total = summary.total || 1;
  const pct = (n: number) => (100 * n) / total;

  const segs = [
    { value: pct(summary.mastered), cls: "text-success", opacity: 1 },
    { value: pct(summary.soft_miss), cls: "text-warn", opacity: 0.9 },
    { value: pct(summary.hard_miss), cls: "text-danger", opacity: 1 },
  ];

  let offset = 0;
  const center = size / 2;

  return (
    <KpiInsightByKey
      k="composition_ring"
      className="rounded-full shrink-0 mx-auto h-[176px] w-[176px]"
    >
      <div className="relative h-full w-full">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke="currentColor"
          className="text-ink"
          strokeOpacity={0.08}
        />
        {segs.map((s, i) => {
          if (s.value <= 0) return null;
          const dasharray = `${s.value} ${100 - s.value}`;
          const dashoffset = -offset;
          offset += s.value;
          return (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={r}
              fill="none"
              pathLength={100}
              strokeWidth={stroke}
              stroke="currentColor"
              strokeOpacity={s.opacity}
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
              strokeLinecap="butt"
              className={s.cls}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <div className="text-center">
          <div className="font-serif text-4xl font-semibold tabular-nums text-ink leading-none">
            {summary.accuracy_pct}
            <span className="text-xl text-ink-muted">%</span>
          </div>
          <div className="text-[11px] uppercase tracking-wide text-ink-muted mt-1.5">
            first-try
          </div>
        </div>
      </div>
      </div>
    </KpiInsightByKey>
  );
}

function MetricBlock({
  icon: Icon,
  title,
  caption,
  value,
  threshold,
  emphasis,
  insightKey,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  caption: string;
  value: number;
  threshold: number;
  emphasis?: boolean;
  insightKey: KpiHelpKey;
}) {
  const passed = value >= threshold;
  return (
    <KpiInsightByKey k={insightKey}>
    <div
      className={cn(
        "rounded-2xl border p-4",
        emphasis ? "border-primary/30 bg-primary-soft/30" : "border-border bg-surface",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "h-7 w-7 rounded-lg grid place-items-center shrink-0",
            emphasis ? "bg-primary/15 text-primary" : "bg-muted text-ink-muted",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium text-ink">{title}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-serif text-4xl font-semibold tabular-nums text-ink leading-none">
          {value}
          <span className="text-xl text-ink-muted">%</span>
        </span>
        <span
          className={cn(
            "text-xs font-medium",
            passed ? "text-success" : "text-ink-muted",
          )}
        >
          {passed ? "above pass line" : `${Math.max(threshold - value, 0)}% to pass`}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-ink-muted leading-snug">{caption}</p>
    </div>
    </KpiInsightByKey>
  );
}

function ExamReadinessBar({ strict, reach }: { strict: number; reach: number }) {
  return (
    <div className="mt-6 pt-5 border-t border-border/60 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <KpiInsightByKey k="exam_readiness" className="rounded-xl w-fit">
          <div className="flex items-center gap-2 py-0.5 pr-1">
          <Gauge className="h-4 w-4 text-ink-muted" />
          <span className="text-sm font-medium">Exam readiness</span>
          </div>
        </KpiInsightByKey>
        <span className="text-xs text-ink-muted">
          SC pass line · {PASS_THRESHOLD}%
        </span>
      </div>
      <MarkerBar
        label="First-try"
        pct={strict}
        color="bg-primary"
        insightKey="readiness_first_try"
      />
      <MarkerBar
        label="With support"
        pct={reach}
        color="bg-success/60"
        insightKey="readiness_with_support"
      />
    </div>
  );
}

function MarkerBar({
  label,
  pct,
  color,
  insightKey,
}: {
  label: string;
  pct: number;
  color: string;
  insightKey: KpiHelpKey;
}) {
  const passed = pct >= PASS_THRESHOLD;
  return (
    <KpiInsightByKey k={insightKey} className="rounded-xl">
    <div>
      <div className="flex items-center justify-between mb-1.5 text-xs">
        <span className="text-ink-muted">{label}</span>
        <span
          className={cn(
            "font-medium tabular-nums",
            passed ? "text-success" : "text-ink",
          )}
        >
          {pct}%
        </span>
      </div>
      <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full", color)}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-px bg-ink/60"
          style={{ left: `${PASS_THRESHOLD}%` }}
          aria-hidden
        />
      </div>
    </div>
    </KpiInsightByKey>
  );
}

/* ---------------- Stat tiles ---------------- */

function StatTile({
  icon: Icon,
  label,
  sub,
  value,
  total,
  tone,
  insightKey,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub: string;
  value: number;
  total: number;
  tone: Tone;
  insightKey: KpiHelpKey;
}) {
  const t = TONES[tone];
  const pct = total ? Math.round((100 * value) / total) : 0;
  return (
    <KpiInsightByKey k={insightKey}>
    <div className={cn("rounded-2xl border p-4", t.ring, t.bg)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("h-7 w-7 rounded-lg grid place-items-center", t.text, "bg-surface/60")}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="text-sm font-medium text-ink">{label}</span>
        </div>
        <Badge variant="outline" className="text-xs tabular-nums">
          {pct}%
        </Badge>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className={cn("font-serif text-3xl font-semibold tabular-nums", t.text)}>
          {value}
        </span>
        <span className="text-xs text-ink-muted">of {total}</span>
      </div>
      <div className="mt-1 text-xs text-ink-muted leading-snug">{sub}</div>
    </div>
    </KpiInsightByKey>
  );
}

/* ---------------- Tutor letter ---------------- */

function TutorLetter({
  text,
  primaryHref,
  primaryLabel,
}: {
  text: string;
  primaryHref: string;
  primaryLabel: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/5 via-surface to-surface p-6 md:p-8 shadow-soft">
      <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="relative flex items-start gap-4">
        <div className="relative shrink-0">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 grid place-items-center shadow-soft">
            <GraduationCap className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-success border-2 border-surface" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-semibold text-ink">Your AI tutor</span>
            <span className="text-xs text-ink-muted">
              Personalized for this run
            </span>
          </div>
          <div className="mt-3 relative rounded-2xl border border-border bg-surface p-4 md:p-5 text-sm leading-relaxed text-ink whitespace-pre-wrap">
            {text}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={primaryHref}>
                <ArrowRight className="h-3.5 w-3.5" /> {primaryLabel}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/mistakes">
                <RotateCcw className="h-3.5 w-3.5" /> Retry missed questions
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Section breakdown ---------------- */

function SectionBreakdown({
  summary,
  sectionTitles,
}: {
  summary: AssessmentSummary;
  sectionTitles: Record<string, string>;
}) {
  const national = summary.sections.filter((s) => s.code.startsWith("A"));
  const state = summary.sections.filter((s) => s.code.startsWith("B"));

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-5">
          <Flag className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Section performance</h3>
          <span className="text-xs text-ink-muted ml-2">
            First-try vs with-support, per section.
          </span>
        </div>
        <div className="grid lg:grid-cols-2 gap-x-6 gap-y-5">
          <SectionGroup
            title="National"
            rows={national}
            titles={sectionTitles}
          />
          <SectionGroup
            title="South Carolina"
            rows={state}
            titles={sectionTitles}
          />
        </div>
        <Legend />
      </CardContent>
    </Card>
  );
}

function SectionGroup({
  title,
  rows,
  titles,
}: {
  title: string;
  rows: AssessmentSummary["sections"];
  titles: Record<string, string>;
}) {
  if (!rows.length) return null;
  return (
    <div>
      <div className="text-[11px] font-medium text-ink-muted mb-3 uppercase tracking-wider">
        {title}
      </div>
      <div className="space-y-2.5">
        {rows.map((s) => (
          <SectionRow key={s.code} row={s} title={titles[s.code]} />
        ))}
      </div>
    </div>
  );
}

function SectionRow({
  row,
  title: _title,
}: {
  row: AssessmentSummary["sections"][number];
  title?: string;
}) {
  void _title;
  const s = row;
  const reach = s.total
    ? Math.round((100 * (s.mastered + s.soft_miss)) / s.total)
    : 0;
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Badge variant="outline" className="text-left whitespace-normal font-normal leading-snug">
            {formatSectionDisplayLabel(s.code)}
          </Badge>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs">
          <span className="text-ink-muted">
            <span className="font-medium text-ink tabular-nums">
              {s.accuracy}%
            </span>{" "}
            first-try
          </span>
          <span className="text-ink-muted">
            <span className="font-medium text-ink tabular-nums">{reach}%</span>{" "}
            reach
          </span>
        </div>
      </div>
      <div className="mt-2 h-2.5 w-full rounded-full bg-muted overflow-hidden flex">
        <Bar n={s.mastered} total={s.total} color="bg-success" />
        <Bar n={s.soft_miss} total={s.total} color="bg-warn" />
        <Bar n={s.hard_miss} total={s.total} color="bg-danger" />
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-5 flex items-center gap-4 flex-wrap text-xs text-ink-muted">
      <LegendDot color="bg-success" label={LABELS.mastered} />
      <LegendDot color="bg-warn" label={LABELS.soft_miss} />
      <LegendDot color="bg-danger" label={LABELS.hard_miss} />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
      {label}
    </span>
  );
}

function Bar({
  n,
  total,
  color,
}: {
  n: number;
  total: number;
  color: string;
}) {
  if (!total || !n) return null;
  const w = Math.max(2, (n / total) * 100);
  return <div className={cn("h-full", color)} style={{ width: `${w}%` }} />;
}

/* ---------------- Predicted pass probability ---------------- */

function PassProbabilityPanel({ summary }: { summary: AssessmentSummary }) {
  const p = summary.predicted;
  const combinedPct = Math.round(p.combined_probability * 100);
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">If you sat the real exam today</h3>
          </div>
          <span className="text-xs text-ink-muted">
            Modeled from your accuracy. Honest math, not a promise.
          </span>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <PortionProbCard
            label="National (80 Q · 70%)"
            portion={p.national}
            insightKey="pass_prob_national"
          />
          <PortionProbCard
            label="South Carolina (40 Q · 70%)"
            portion={p.state}
            insightKey="pass_prob_state"
          />
          <CombinedProbCard
            pct={combinedPct}
            note={
              p.national.signal === "low" || p.state.signal === "low"
                ? "Low signal — finish more sections to firm this up."
                : "Probability you clear BOTH portions on the same sitting."
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function PortionProbCard({
  label,
  portion,
  insightKey,
}: {
  label: string;
  portion: AssessmentSummary["predicted"]["national"];
  insightKey: KpiHelpKey;
}) {
  const pct = Math.round(portion.pass_probability * 100);
  const tone =
    pct >= 75 ? "success" : pct >= 50 ? "warn-strong" : "danger";
  const t = TONES[tone];
  const sigLabel =
    portion.signal === "strong"
      ? "Strong signal"
      : portion.signal === "medium"
        ? "Medium signal"
        : "Low signal";
  return (
    <KpiInsightByKey k={insightKey}>
    <div className={cn("rounded-2xl border p-4", t.ring, t.bg)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink">{label}</span>
        <Badge variant="outline" className="text-[10px] tabular-nums">
          {sigLabel}
        </Badge>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className={cn("font-serif text-4xl font-semibold tabular-nums", t.text)}>
          {pct}
          <span className="text-xl text-ink-muted">%</span>
        </span>
        <span className="text-xs text-ink-muted">pass probability</span>
      </div>
      <div className="mt-2 text-xs text-ink-muted">
        Based on {portion.mastered}/{portion.total} first-try ·{" "}
        <span className="text-ink font-medium">{portion.accuracy_pct}%</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full", t.soft)}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
    </KpiInsightByKey>
  );
}

function CombinedProbCard({ pct, note }: { pct: number; note: string }) {
  const tone =
    pct >= 60 ? "success" : pct >= 30 ? "warn-strong" : "danger";
  const t = TONES[tone];
  return (
    <KpiInsightByKey k="pass_prob_combined">
    <div className={cn("rounded-2xl border p-4", t.ring, "bg-surface")}>
      <div className="flex items-center gap-2">
        <Sparkles className={cn("h-4 w-4", t.text)} />
        <span className="text-xs font-medium text-ink">
          Both portions combined
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className={cn("font-serif text-4xl font-semibold tabular-nums", t.text)}>
          {pct}
          <span className="text-xl text-ink-muted">%</span>
        </span>
      </div>
      <p className="mt-2 text-xs text-ink-muted leading-snug">{note}</p>
    </div>
    </KpiInsightByKey>
  );
}

/* ---------------- Time insight ---------------- */

function formatSecs(ms: number): string {
  if (!ms || ms < 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

function TimeInsightPanel({
  summary,
  durationMs,
  sectionTitles,
}: {
  summary: AssessmentSummary;
  durationMs: number;
  sectionTitles: Record<string, string>;
}) {
  const sections = summary.sections;
  const totalQ = summary.total || 1;
  const overallAvg = summary.avg_time_ms || 0;
  const maxAvg = sections.reduce(
    (m, s) => Math.max(m, s.avg_time_ms || 0),
    0,
  );

  // Find the slowest and fastest section to call out at top.
  const sorted = [...sections]
    .filter((s) => s.total > 0)
    .sort((a, b) => (b.avg_time_ms || 0) - (a.avg_time_ms || 0));
  const slowest = sorted[0];
  const fastest = sorted[sorted.length - 1];

  return (
    <Card className="h-full">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Time on task</h3>
          </div>
          <span className="text-xs text-ink-muted">
            Where seconds went, and where you stalled.
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <TimeKpi
            icon={Hourglass}
            label="Total time"
            value={formatMs(durationMs || summary.total_time_ms)}
          />
          <TimeKpi
            icon={Activity}
            label="Avg / question"
            value={formatSecs(overallAvg)}
          />
          <TimeKpi
            icon={Clock}
            label="On the clock"
            value={
              totalQ
                ? `${formatSecs(summary.total_time_ms)} / ${totalQ}Q`
                : "—"
            }
          />
        </div>

        {slowest && fastest && slowest.code !== fastest.code && (
          <div className="mb-4 rounded-xl border border-border bg-elevated/40 p-3 text-xs text-ink-muted">
            Slowest:{" "}
            <span className="text-ink font-medium">
              {formatSectionDisplayLabel(slowest.code)}
            </span>{" "}
            at {formatSecs(slowest.avg_time_ms)}/Q. Fastest:{" "}
            <span className="text-ink font-medium">
              {formatSectionDisplayLabel(fastest.code)}
            </span>{" "}
            at {formatSecs(fastest.avg_time_ms)}/Q.
          </div>
        )}

        <div className="space-y-2">
          {sections.map((s) => (
            <TimeRow
              key={s.code}
              row={s}
              maxAvg={maxAvg}
              title={sectionTitles[s.code] ?? ""}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TimeKpi({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 font-serif text-2xl font-semibold tabular-nums text-ink leading-none">
        {value}
      </div>
    </div>
  );
}

function TimeRow({
  row,
  maxAvg,
  title,
}: {
  row: SectionStat;
  maxAvg: number;
  title: string;
}) {
  // Lollipop bar: width = relative time, dot color = accuracy bucket.
  const width = maxAvg > 0 ? (row.avg_time_ms / maxAvg) * 100 : 0;
  const acc = row.accuracy;
  const dotTone =
    acc >= 80
      ? "bg-success"
      : acc >= 60
        ? "bg-primary"
        : acc >= 40
          ? "bg-warn"
          : "bg-danger";
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
      <div className="flex items-center gap-2 min-w-0 w-[10rem]">
        <Badge variant="outline" className="text-left whitespace-normal font-normal leading-snug shrink-0 max-w-[11rem]">
          {formatSectionDisplayLabel(row.code)}
        </Badge>
        <span className="text-xs text-ink-muted truncate">{title}</span>
      </div>
      <div className="relative h-3 rounded-full bg-muted overflow-visible">
        <div
          className="h-full rounded-full bg-ink/15"
          style={{ width: `${Math.max(2, width)}%` }}
        />
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-surface shadow-soft",
            dotTone,
          )}
          style={{
            left: `calc(${Math.max(2, width)}% - 7px)`,
          }}
          aria-hidden
        />
      </div>
      <div className="text-xs tabular-nums text-ink-muted w-[5.5rem] text-right">
        <span className="text-ink font-medium">
          {formatSecs(row.avg_time_ms)}
        </span>{" "}
        · {acc}%
      </div>
    </div>
  );
}

type SectionStat = AssessmentSummary["sections"][number];

/* ---------------- Section radar ---------------- */

function SectionRadarCard({
  summary,
  sectionTitles,
}: {
  summary: AssessmentSummary;
  sectionTitles: Record<string, string>;
}) {
  const sections = summary.sections.filter((s) => s.total > 0);
  return (
    <Card className="h-full">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Mastery radar</h3>
          </div>
          <span className="text-xs text-ink-muted shrink-0">First-try accuracy</span>
        </div>
        <p className="text-[11px] text-ink-muted leading-snug mb-4 max-w-md">
          Each spoke is a section you assessed. Distance from the center is that
          section&apos;s first-try % (center = 0%, outer ring = 100%). The dashed
          ring marks 70% — South Carolina&apos;s typical pass bar.
        </p>
        {sections.length < 3 ? (
          <div className="text-sm text-ink-muted py-6 text-center">
            Assess at least 3 sections to see the radar.
          </div>
        ) : (
          <SectionRadarSvg
            rows={sections}
            sectionTitles={sectionTitles}
          />
        )}
      </CardContent>
    </Card>
  );
}

function SectionRadarSvg({
  rows,
  sectionTitles,
}: {
  rows: SectionStat[];
  sectionTitles: Record<string, string>;
}) {
  void sectionTitles;
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 26;
  const n = rows.length;
  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;

  // Background rings at 25/50/75/100.
  const rings = [0.25, 0.5, 0.75, 1];

  // Polygon points for the data.
  const points = rows.map((s, i) => {
    const ang = angleFor(i);
    const v = Math.max(0, Math.min(1, s.accuracy / 100));
    return [cx + Math.cos(ang) * r * v, cy + Math.sin(ang) * r * v];
  });
  const polyData = points.map((p) => p.join(",")).join(" ");

  // Pass-line ring at 70%.
  const passV = 0.7;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full h-auto block"
        role="img"
        aria-label="Radar chart: each axis is a section, distance from center is first-try accuracy percent, dashed ring is seventy percent pass bar"
      >
        {/* % scale labels along the top (12 o'clock) */}
        {[25, 50, 75, 100].map((pct) => {
          const frac = pct / 100;
          return (
            <text
              key={pct}
              x={cx + 5}
              y={cy - r * frac + 3}
              className="fill-ink-muted"
              fontSize={9}
            >
              {pct}%
            </text>
          );
        })}
        {/* Background rings */}
        {rings.map((v, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r * v}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.08}
            className="text-ink"
          />
        ))}
        {/* Pass-line ring */}
        <circle
          cx={cx}
          cy={cy}
          r={r * passV}
          fill="none"
          strokeDasharray="3 4"
          stroke="currentColor"
          strokeOpacity={0.45}
          className="text-primary"
        />
        <text
          x={cx + r * passV * 0.65}
          y={cy - r * passV * 0.65 - 4}
          className="fill-primary"
          fontSize={8}
          opacity={0.85}
        >
          70%
        </text>
        {/* Spokes */}
        {rows.map((_, i) => {
          const ang = angleFor(i);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={cx + Math.cos(ang) * r}
              y2={cy + Math.sin(ang) * r}
              stroke="currentColor"
              strokeOpacity={0.08}
              className="text-ink"
            />
          );
        })}
        {/* Data polygon */}
        <polygon
          points={polyData}
          className="fill-primary/25 stroke-primary"
          strokeWidth={1.5}
        />
        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p[0]}
            cy={p[1]}
            r={3}
            className="fill-primary"
          />
        ))}
        {/* Axis labels */}
        {rows.map((s, i) => {
          const ang = angleFor(i);
          const lr = r + 14;
          const lx = cx + Math.cos(ang) * lr;
          const ly = cy + Math.sin(ang) * lr;
          return (
            <text
              key={s.code}
              x={lx}
              y={ly}
              className="fill-ink-muted"
              fontSize={10}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {formatSectionDisplayLabel(s.code)}
            </text>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-col items-center gap-2">
        <div className="flex items-center gap-3 flex-wrap text-xs text-ink-muted justify-center">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Purple area = your first-try % per section
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-px w-4 border-t border-dashed border-primary" />
            Dashed ring = 70% pass bar
          </span>
        </div>
        <p className="text-[10px] text-ink-muted/90 text-center max-w-sm leading-snug">
          Rings at 25% / 50% / 75% / 100% help you read how close each corner is
          to the edge.
        </p>
      </div>
    </div>
  );
}

/* ---------------- Concept rows ---------------- */

function ConceptRow({
  rank,
  concept,
  title,
  tone,
}: {
  rank: number;
  concept: ConceptStat;
  title?: string;
  tone: "weak" | "strong";
}) {
  const niceTitle =
    title ??
    concept.concept_id
      .split(".")
      .slice(1)
      .join(" ")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={cn(
            "h-7 w-7 rounded-full grid place-items-center text-xs font-semibold",
            tone === "weak"
              ? "bg-danger/15 text-danger"
              : "bg-success/15 text-success",
          )}
        >
          {rank}
        </span>
        <div className="min-w-0">
          <div className="font-medium text-ink truncate">{niceTitle}</div>
          <div className="text-xs text-ink-muted truncate">
            {formatSectionDisplayLabel(concept.section_code)} · {concept.mastered}/{concept.total} clean
            {concept.hard_miss > 0 && ` · ${concept.hard_miss} missed twice`}
            {concept.soft_miss > 0 && ` · ${concept.soft_miss} recovered`}
          </div>
        </div>
      </div>
      <Badge
        variant={tone === "weak" ? "danger" : "success"}
        className="shrink-0 tabular-nums"
      >
        {concept.accuracy}%
      </Badge>
    </li>
  );
}

/* ---------------- Review list ---------------- */

function ReviewList({ attempts }: { attempts: RawAttempt[] }) {
  const byQ = new Map<string, RawAttempt>();
  for (const a of attempts) {
    if (!a.result_label) continue;
    byQ.set(a.question_id, a);
  }
  const rows = Array.from(byQ.values());
  return (
    <div className="space-y-2">
      {rows.map((a, i) => (
        <ReviewRow key={a.question_id} index={i} attempt={a} />
      ))}
    </div>
  );
}

function ReviewRow({
  index,
  attempt,
}: {
  index: number;
  attempt: RawAttempt;
}) {
  const [open, setOpen] = React.useState(false);
  const { open: openChat } = useChatSheet();
  const q = attempt.question;
  const map: Record<string, string> = {
    A: q.option_a,
    B: q.option_b,
    C: q.option_c,
    D: q.option_d,
  };
  const label = attempt.result_label;
  const Icon =
    label === "mastered"
      ? CheckCircle2
      : label === "soft_miss"
        ? AlertTriangle
        : XCircle;
  const iconTone =
    label === "mastered"
      ? "text-success bg-success/15"
      : label === "soft_miss"
        ? "text-warn bg-warn/15"
        : "text-danger bg-danger/15";

  const friendlyLabel =
    label === "mastered"
      ? LABELS.mastered
      : label === "soft_miss"
        ? LABELS.soft_miss
        : label === "hard_miss"
          ? LABELS.hard_miss
          : "";

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-elevated transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div
          className={cn(
            "h-8 w-8 rounded-full grid place-items-center shrink-0",
            iconTone,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-ink-muted">
            Q{index + 1} · {formatSectionDisplayLabel(q.section_code)} · {friendlyLabel}
          </div>
          <div className="text-sm text-ink truncate">{q.prompt}</div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-ink-muted" />
        ) : (
          <ChevronDown className="h-4 w-4 text-ink-muted" />
        )}
      </button>
      {open && (
        <div className="p-4 border-t border-border bg-elevated/40 space-y-3 text-sm">
          <div>
            <span className="text-ink-muted">Your final answer: </span>
            <span
              className={cn(
                "font-medium",
                attempt.is_correct ? "text-success" : "text-danger",
              )}
            >
              {attempt.user_answer
                ? `${attempt.user_answer}. ${map[attempt.user_answer]}`
                : "Not answered"}
            </span>
          </div>
          <div>
            <span className="text-ink-muted">Correct: </span>
            <span className="font-medium text-ink">
              {q.correct_option}. {map[q.correct_option]}
            </span>
          </div>
          {q.explanation && (
            <p className="text-ink-muted leading-relaxed">{q.explanation}</p>
          )}
          <Button
            size="sm"
            variant="soft"
            onClick={() =>
              openChat({
                id: q.id,
                section_code: q.section_code,
                prompt: q.prompt,
                option_a: q.option_a,
                option_b: q.option_b,
                option_c: q.option_c,
                option_d: q.option_d,
                correct_option: q.correct_option,
                hint: q.hint,
                explanation: q.explanation,
                user_answer: attempt.user_answer,
              })
            }
          >
            <Sparkles className="h-3.5 w-3.5" /> Ask AI about this
          </Button>
        </div>
      )}
    </div>
  );
}

/* ─── Download PDF Button ─── */
function DownloadPdfButton({
  sessionId,
  allCovered,
}: {
  sessionId: string;
  allCovered: boolean;
}) {
  const [loading, setLoading] = React.useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      /* When all 12 sections are covered, download the comprehensive
         overall report that combines data from every session. */
      const url = allCovered
        ? "/api/report/assessment/overall/pdf"
        : `/api/report/assessment/${sessionId}/pdf`;

      const res = await fetch(url);
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        const msg =
          errBody && typeof errBody === "object" && "error" in errBody
            ? String((errBody as { error?: string }).error)
            : "Failed to generate PDF";
        throw new Error(msg);
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = allCovered
        ? "overall-assessment-report.pdf"
        : `assessment-report-${sessionId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not generate PDF.";
      toast.error(msg);
      console.error("[PDF download]", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={allCovered ? "default" : "outline"}
      onClick={handleDownload}
      disabled={loading}
      className="gap-1.5"
    >
      <Download className="h-4 w-4" />
      {loading
        ? "Generating…"
        : allCovered
          ? "Download Overall Report"
          : "Download PDF"}
    </Button>
  );
}
