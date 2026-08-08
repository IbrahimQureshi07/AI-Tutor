"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Timer, Beaker, Check, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  MOCK_TOTAL,
  MOCK_SMOKE_TOTAL,
  MOCK_DURATION_MIN,
  MOCK_PASS_PCT,
} from "@/lib/mock/pick-questions";
import { formatSectionDisplayLabel } from "@/lib/sections/display-label";

type Length = "full" | "smoke";

type WeakPreview = {
  code: string;
  title: string;
  group: "National" | "State";
  accuracy: number;
  sampled: number;
};

type Props = {
  /** 3 weakest (composite weakness) sections for display. */
  weakest: WeakPreview[];
  /** Total attempts used to derive the weakness signal. */
  signalSize: number;
  /** Admins get a QA note that smoke also unlocks Final; students don't. */
  isAdmin?: boolean;
};

const SMOKE_DURATION_MIN = Math.max(
  10,
  Math.round((MOCK_SMOKE_TOTAL / MOCK_TOTAL) * MOCK_DURATION_MIN),
);

export function MockStartPicker({ weakest, signalSize, isAdmin = false }: Props) {
  const router = useRouter();
  const [length, setLength] = React.useState<Length>("full");
  const [busy, setBusy] = React.useState(false);
  const inFlight = React.useRef(false);

  async function start() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await fetch("/mock-exam/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ length }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Failed to start Mock Exam.");
        return;
      }
      const { runnerPath, sessionId } = await res.json();
      router.push(runnerPath ?? `/mock-exam/${sessionId}`);
    } catch (e) {
      console.error(e);
      toast.error("Network error — try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const OPTIONS: Array<{
    id: Length;
    label: string;
    count: number;
    durationMin: number;
    blurb: string;
    bullets: string[];
    badge?: string;
  }> = [
    {
      id: "full",
      label: "Full Mock Exam",
      count: MOCK_TOTAL,
      durationMin: MOCK_DURATION_MIN,
      blurb:
        "The real thing: 120 questions (80 National + 40 SC), 240-minute timer, 70% to pass. Adaptive — weak sections get extra weight.",
      bullets: [
        "Exactly 80 national / 40 state like the official test",
        "Per-section allocation weighted by your mistakes (3×), practice (2×), assessment (1×)",
        "Realistic 35/40/25 easy/medium/hard mix per section",
      ],
      badge: "Exam-shaped",
    },
    {
      id: "smoke",
      label: "Smoke test (20)",
      count: MOCK_SMOKE_TOTAL,
      durationMin: SMOKE_DURATION_MIN,
      blurb:
        "Same picker, scaled down. Use it to validate the flow and pacing before committing to the full 4-hour sitting.",
      bullets: [
        "Identical adaptive logic, ~1/6 the length",
        "Pass bar stays at 70%",
        isAdmin
          ? "Great QA before the real mock — also unlocks Final Test for testing"
          : "Practice/QA only — doesn't unlock the Final Test. Take a full Mock Exam for that.",
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 md:p-12 shadow-soft">
        <div className="absolute inset-0 mesh-gradient opacity-30" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-primary/15 grid place-items-center">
              <Timer className="h-5 w-5 text-primary" />
            </div>
            <Badge variant="outline" className="capitalize">
              Mock Exam
            </Badge>
          </div>
          <h1 className="mt-5 font-serif text-5xl font-semibold tracking-tight">
            Simulate the real thing — adaptively.
          </h1>
          <p className="mt-3 text-lg text-ink-muted max-w-2xl">
            Built from your weakness signal across{" "}
            <span className="font-medium text-ink">{signalSize}</span> recent
            attempts. Mistakes weigh 3×, practice 2×, assessment 1× — because
            what you just missed is the most honest signal.
          </p>

          {weakest.length > 0 && (
            <div className="mt-5 rounded-2xl border border-border bg-elevated/60 px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-ink-muted mb-2">
                <TrendingDown className="h-3.5 w-3.5" />
                Expect more questions from your weakest sections:
              </div>
              <div className="flex flex-wrap gap-2">
                {weakest.map((w) => (
                  <span
                    key={w.code}
                    className="inline-flex items-center gap-2 rounded-full bg-surface border border-border px-3 py-1"
                  >
                    <span className="font-medium text-ink leading-snug max-w-[240px]">
                      {formatSectionDisplayLabel(w.code)}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {w.accuracy}% acc
                    </Badge>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {OPTIONS.map((opt) => {
              const active = length === opt.id;
              const Icon = opt.id === "full" ? Timer : Beaker;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLength(opt.id)}
                  className={cn(
                    "text-left rounded-2xl border p-5 transition-all focus-ring",
                    active
                      ? "border-primary bg-primary-soft/40 shadow-soft"
                      : "border-border bg-surface hover:border-primary/50",
                  )}
                  aria-pressed={active}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-9 w-9 rounded-xl grid place-items-center",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-ink-muted",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-ink">{opt.label}</div>
                        <div className="text-xs text-ink-muted">
                          {opt.count} questions · {opt.durationMin} min ·{" "}
                          {MOCK_PASS_PCT}% pass
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {opt.badge && (
                        <Badge variant="outline" className="text-[10px]">
                          {opt.badge}
                        </Badge>
                      )}
                      {active && (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-ink-muted leading-relaxed">
                    {opt.blurb}
                  </p>
                  <ul className="mt-3 space-y-1.5 text-xs text-ink-muted">
                    {opt.bullets.map((b) => (
                      <li key={b} className="flex gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex items-center gap-3 flex-wrap">
            <Button size="lg" onClick={start} disabled={busy}>
              {busy
                ? "Starting…"
                : length === "smoke"
                  ? `Start ${MOCK_SMOKE_TOTAL}-question smoke mock`
                  : `Start full ${MOCK_TOTAL}-question Mock Exam`}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3">How the Mock stays realistic</h3>
          <ul className="space-y-2.5 text-sm text-ink-muted">
            {[
              "Fixed 80 National / 40 State split — the exam's structure is non-negotiable.",
              "Section allocation is adaptive: weak sections (based on weighted accuracy) get more slots, with a floor so every section is still covered.",
              "Difficulty per section stays 35/40/25 easy/medium/hard — the exam doesn't ease up on you, so neither does this.",
              "Questions you've seen in the last hour are skipped so you're testing recall, not short-term memory.",
              "No hints, no AI chat. Flag-and-review navigator with auto-submit when time runs out.",
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
