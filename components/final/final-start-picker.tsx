"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  Trophy,
  Clock,
  AlertTriangle,
  Calendar,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FINAL_NATIONAL_TOTAL,
  FINAL_STATE_TOTAL,
  FINAL_NATIONAL_DURATION_MIN,
  FINAL_STATE_DURATION_MIN,
  FINAL_PASS_PCT,
} from "@/lib/final/pick-questions";
import type { GateStatus } from "@/lib/final/completion";
import { formatSectionDisplayLabel } from "@/lib/sections/display-label";

type PoolStatus = {
  poolUsed: "final_holdout" | "standard";
  bySection: Array<{
    code: string;
    group: "National" | "State";
    unseen: number;
    pastWrongAvailable: number;
    requested: number;
  }>;
  nationalUnseenTotal: number;
  stateUnseenTotal: number;
  nationalRequested: number;
  stateRequested: number;
  nationalStillShort: number;
  stateStillShort: number;
};

type Props = {
  gate: GateStatus;
  pool: PoolStatus;
};

export function FinalStartPicker({ gate, pool }: Props) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const inFlight = React.useRef(false);

  const strictMock = gate.details.mockGateCleared;
  const smokeQaUnlock =
    gate.details.smokeMockCompleted &&
    gate.details.smokeUnlocksFinal &&
    !strictMock &&
    !gate.partialRetake?.active;

  const partial = gate.partialRetake?.active ? gate.partialRetake : null;
  // Lock the picker if partial retake is active — there's only one valid action.
  const portion: "both" | "national" | "state" = partial
    ? partial.needPortion
    : "both";

  // Genuine depletion red flags — sections still short even after topping
  // up with the student's own past misses in that section (see
  // lib/final/pick-questions.ts). Running low on brand-new questions alone
  // is not a problem worth surfacing since it's silently backfilled.
  const lowSections = pool.bySection.filter(
    (s) => s.requested > 0 && s.unseen + s.pastWrongAvailable < s.requested,
  );
  const portionUnseenShort =
    (portion === "national" || portion === "both") ? pool.nationalStillShort : 0;
  const stateShort =
    (portion === "state" || portion === "both") ? pool.stateStillShort : 0;

  async function start() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await fetch("/final-test/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ portion }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Failed to start Final Test.");
        return;
      }
      const { runnerPath, sessionId } = await res.json();
      router.push(runnerPath ?? `/final-test/${sessionId}`);
    } catch (e) {
      console.error(e);
      toast.error("Network error — try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 md:p-12 shadow-soft">
        <div className="absolute inset-0 mesh-gradient opacity-30" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-primary/15 grid place-items-center">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <Badge variant="outline">Final Test</Badge>
            {partial && (
              <Badge variant="warn">
                Partial retake · {Math.max(1, partial.daysRemaining)} day
                {partial.daysRemaining === 1 ? "" : "s"} left
              </Badge>
            )}
          </div>
          <h1 className="mt-5 font-serif text-5xl font-semibold tracking-tight">
            {partial
              ? `Retake the ${partial.needPortion === "national" ? "National" : "State"} portion.`
              : "The honest readiness check."}
          </h1>
          <p className="mt-3 text-lg text-ink-muted max-w-2xl">
            Mirrors the real PSI exam exactly. Two independent portions, two
            independent timers, two independent pass bars. No hints, no AI
            chat, no retries, no adaptive difficulty.{" "}
            <span className="font-medium text-ink">Pass each portion on its own.</span>
          </p>

          {smokeQaUnlock && (
            <div className="mt-4 rounded-2xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-ink-muted">
              <span className="font-medium text-success">QA access:</span> you
              unlocked Final by finishing a Mock <strong>smoke</strong> run (no
              score requirement). For the real exam path, still aim for a full
              mock ≥75% before you rely on this score.
            </div>
          )}
          {partial && (
            <p className="mt-4 text-sm text-ink-muted">
              You already passed the {partial.passedPortion === "national" ? "National" : "State"} portion — no waiting period, just finish the missing side.
            </p>
          )}

          <div className="mt-6 grid sm:grid-cols-2 gap-3">
            <PortionTile
              label="National"
              count={FINAL_NATIONAL_TOTAL}
              durationMin={FINAL_NATIONAL_DURATION_MIN}
              dim={portion === "state"}
            />
            <PortionTile
              label="South Carolina"
              count={FINAL_STATE_TOTAL}
              durationMin={FINAL_STATE_DURATION_MIN}
              dim={portion === "national"}
            />
          </div>

          <div className="mt-4 text-xs text-ink-muted flex items-center gap-2 flex-wrap">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>
              {portion === "both"
                ? `Total: ${FINAL_NATIONAL_TOTAL + FINAL_STATE_TOTAL} questions · ${FINAL_NATIONAL_DURATION_MIN + FINAL_STATE_DURATION_MIN} min · ${FINAL_PASS_PCT}% per portion`
                : `Single portion: ${portion === "national" ? FINAL_NATIONAL_TOTAL : FINAL_STATE_TOTAL} questions · ${portion === "national" ? FINAL_NATIONAL_DURATION_MIN : FINAL_STATE_DURATION_MIN} min · ${FINAL_PASS_PCT}% to pass`}
            </span>
          </div>

          {(portionUnseenShort > 0 || stateShort > 0 || lowSections.length > 0) && (
            <PoolDepletionNote
              portionUnseenShort={portionUnseenShort}
              stateShort={stateShort}
              lowSections={lowSections}
              poolUsed={pool.poolUsed}
            />
          )}

          <div className="mt-8 flex items-center gap-3 flex-wrap">
            <Button size="lg" onClick={start} disabled={busy}>
              {busy
                ? "Starting…"
                : partial
                  ? `Start ${partial.needPortion === "national" ? "National" : "State"} retake`
                  : "Start Final Test"}
              <ArrowRight className="h-4 w-4" />
            </Button>
            {partial && (
              <span className="text-xs text-ink-muted inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Real-exam rule: 6 months to pass the missing portion.
              </span>
            )}
          </div>
        </div>
      </section>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3">Why this isn&apos;t adaptive</h3>
          <ul className="space-y-2.5 text-sm text-ink-muted">
            {[
              "Mock Exam is the coach — it leans into your weak sections so you improve.",
              "Final Test is the measurement — every test you take is the same shape so the score is honest.",
              "Questions are pulled from a held-out pool you've never seen, in equal allocation per section, with the global 35/40/25 easy/medium/hard mix.",
              "Pass per portion (National + State) — combined % is shown only for reference, just like the real PSI report.",
            ].map((b) => (
              <li key={b} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                {b}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function PortionTile({
  label,
  count,
  durationMin,
  dim,
}: {
  label: string;
  count: number;
  durationMin: number;
  dim?: boolean;
}) {
  return (
    <div
      className={
        dim
          ? "rounded-2xl border border-border bg-elevated/30 p-5 opacity-50"
          : "rounded-2xl border border-border bg-surface p-5"
      }
    >
      <div className="text-xs text-ink-muted">{label} portion</div>
      <div className="mt-1 flex items-baseline gap-3">
        <div className="font-serif text-3xl font-semibold tabular-nums">
          {count}
        </div>
        <div className="text-sm text-ink-muted inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {durationMin} min
        </div>
      </div>
      <div className="mt-2 text-xs text-ink-muted">
        Independent timer. Pass bar {FINAL_PASS_PCT}%.
      </div>
    </div>
  );
}

function PoolDepletionNote({
  portionUnseenShort,
  stateShort,
  lowSections,
  poolUsed,
}: {
  portionUnseenShort: number;
  stateShort: number;
  lowSections: Array<{
    code: string;
    group: "National" | "State";
    unseen: number;
    pastWrongAvailable: number;
    requested: number;
  }>;
  poolUsed: "final_holdout" | "standard";
}) {
  return (
    <Card className="mt-5 border-warn/30 bg-warn/5">
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-warn/15 grid place-items-center shrink-0">
            <AlertTriangle className="h-4 w-4 text-warn" />
          </div>
          <div className="flex-1 text-sm">
            <h4 className="font-semibold mb-1">A few sections are running thin.</h4>
            <p className="text-ink-muted">
              {poolUsed === "final_holdout"
                ? "The Final pool is dedicated held-out questions — questions you've never seen."
                : "There's no dedicated final-holdout pool yet, so we use unseen questions from the standard bank."}{" "}
              You&apos;ve already seen most of them, so we top up with
              questions you&apos;ve gotten wrong before in that section — never
              a question you already answered correctly, and never AI-generated.
            </p>
            <ul className="mt-3 space-y-1 text-xs text-ink-muted">
              {portionUnseenShort > 0 && (
                <li>
                  National still short by{" "}
                  <span className="font-medium text-ink">{portionUnseenShort}</span>{" "}
                  question(s) even after topping up.
                </li>
              )}
              {stateShort > 0 && (
                <li>
                  State still short by{" "}
                  <span className="font-medium text-ink">{stateShort}</span>{" "}
                  question(s) even after topping up.
                </li>
              )}
              {lowSections.slice(0, 4).map((s) => (
                <li key={s.code}>
                  <span className="font-medium text-ink">
                    {formatSectionDisplayLabel(s.code)}
                  </span>
                  : {s.unseen} unseen + {s.pastWrongAvailable} past-miss
                  question(s) available, need {s.requested}.
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-muted">
              You can still take the Final — it will only run a few questions
              short of the full count if even your past misses in that section
              run out. The measurement remains clean.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
