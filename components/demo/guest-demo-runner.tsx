"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Lock,
  Sparkles,
  XCircle,
} from "lucide-react";
import { CoachChat, type CoachState } from "@/components/practice/coach-chat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DEMO_COACH_MAX_TURNS,
  DEMO_QUESTION_BUDGET_SEC,
} from "@/lib/demo/constants";
import type { DemoQuestionPublic } from "@/lib/demo/session-cookie";
import { formatSectionDisplayLabel } from "@/lib/sections/display-label";
import { cn } from "@/lib/utils";

type Phase = "loading" | "blocked" | "run" | "done";

type RevealState = {
  selected: "A" | "B" | "C" | "D";
  correct: boolean;
  correctOption: "A" | "B" | "C" | "D";
  explanation: string | null;
};

type StartPayload = {
  alreadyUsed: boolean;
  questions?: DemoQuestionPublic[];
  index?: number;
  total?: number;
  answered?: number;
  correct?: number;
  coachMaxTurns?: number;
  error?: string;
};

export function GuestDemoRunner() {
  const [phase, setPhase] = React.useState<Phase>("loading");
  const [error, setError] = React.useState<string | null>(null);
  const [questions, setQuestions] = React.useState<DemoQuestionPublic[]>([]);
  const [index, setIndex] = React.useState(0);
  const [stats, setStats] = React.useState({ answered: 0, correct: 0, total: 5 });
  const [reveal, setReveal] = React.useState<RevealState | null>(null);
  const [coachState, setCoachState] = React.useState<CoachState>("closed");
  const [secondsLeft, setSecondsLeft] = React.useState(DEMO_QUESTION_BUDGET_SEC);
  const [submitting, setSubmitting] = React.useState(false);
  const [selected, setSelected] = React.useState<"A" | "B" | "C" | "D" | null>(
    null,
  );

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/demo/start", { method: "POST" });
        const json = (await res.json()) as StartPayload;
        if (cancelled) return;

        if (!res.ok) {
          setError(json.error ?? "Could not start demo.");
          setPhase("blocked");
          return;
        }

        if (json.alreadyUsed) {
          setPhase("blocked");
          return;
        }

        if (!json.questions?.length) {
          setError("No demo questions available.");
          setPhase("blocked");
          return;
        }

        setQuestions(json.questions);
        setIndex(json.index ?? 0);
        setStats({
          answered: json.answered ?? 0,
          correct: json.correct ?? 0,
          total: json.total ?? json.questions.length,
        });

        if ((json.answered ?? 0) >= (json.total ?? json.questions.length)) {
          setPhase("done");
        } else {
          setPhase("run");
        }
      } catch (e) {
        console.error("demo start", e);
        if (!cancelled) {
          setError("Network error — refresh and try again.");
          setPhase("blocked");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const q = questions[index] ?? null;

  React.useEffect(() => {
    if (phase !== "run" || reveal || !q?.id) return;
    setSecondsLeft(DEMO_QUESTION_BUDGET_SEC);
    setCoachState("closed");
    setSelected(null);
  }, [q?.id, phase, reveal]);

  React.useEffect(() => {
    if (phase !== "run" || reveal) return;
    const t = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setCoachState("locked");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [phase, reveal, q?.id]);

  async function submitAnswer(letter: "A" | "B" | "C" | "D") {
    if (!q || reveal || submitting) return;
    setSubmitting(true);
    setSelected(letter);
    setCoachState("locked");

    try {
      const res = await fetch("/api/demo/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer: letter }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not submit answer.");
        setSubmitting(false);
        return;
      }

      setReveal({
        selected: letter,
        correct: json.correct,
        correctOption: json.correctOption,
        explanation: json.explanation ?? null,
      });
      setStats({
        answered: json.answered,
        correct: json.correctCount,
        total: json.total,
      });
    } catch (e) {
      console.error("demo answer", e);
      setError("Could not submit — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function goNext() {
    if (index < questions.length - 1) {
      setIndex(index + 1);
      setReveal(null);
      setSelected(null);
      setCoachState("closed");
    }
  }

  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-ink-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p>Loading your free preview…</p>
      </div>
    );
  }

  if (phase === "blocked") {
    return (
      <div className="max-w-lg mx-auto text-center py-16 space-y-6">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <Lock className="h-7 w-7 text-ink-muted" />
        </div>
        <div>
          <h2 className="font-serif text-2xl font-semibold text-ink">
            You&apos;ve already used the free preview
          </h2>
          <p className="mt-3 text-ink-muted leading-relaxed">
            This device gets one guest demo. Unlock the full course for every
            study mode, the complete question bank, and unlimited AI tutoring.
          </p>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg">
            <Link href="/pricing">
              View pricing
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/signup">Create account</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const accuracy =
      stats.answered > 0
        ? Math.round((100 * stats.correct) / stats.answered)
        : 0;
    return (
      <div className="max-w-xl mx-auto text-center py-12 space-y-8">
        <div>
          <Badge variant="outline" className="mb-4 border-primary/30">
            <Sparkles className="h-3 w-3 text-primary mr-1" />
            Preview complete
          </Badge>
          <h2 className="font-serif text-3xl md:text-4xl font-semibold text-ink">
            Nice work — that was your free taste
          </h2>
          <p className="mt-4 text-ink-muted leading-relaxed">
            You answered {stats.answered} question{stats.answered === 1 ? "" : "s"}{" "}
            and got {stats.correct} correct ({accuracy}%).
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-surface p-6 text-left space-y-3 shadow-soft">
          <p className="text-sm text-ink-muted">
            The full course unlocks every mode — Assessment, Practice, Mistakes,
            Mock, and Final — plus progress tracking, PDF reports, and unlimited
            AI coach chat.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg">
            <Link href="/pricing">
              Unlock full course
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/signup">Sign up to save progress</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!q) {
    return (
      <div className="text-center py-20 text-ink-muted">No questions loaded.</div>
    );
  }

  const options: ("A" | "B" | "C" | "D")[] = ["A", "B", "C", "D"];
  const optionMap: Record<string, string> = {
    A: q.option_a,
    B: q.option_b,
    C: q.option_c,
    D: q.option_d,
  };
  const progressPct = Math.round((100 * index) / stats.total);

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-12">
      <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
        <span className="font-medium text-ink">
          Preview question {index + 1}{" "}
          <span className="text-ink-muted">/ {stats.total}</span>
        </span>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          Free guest demo
        </Badge>
      </div>
      <Progress value={progressPct} />

      {!reveal && (
        <CoachChat
          questionId={q.id}
          questionPrompt={q.prompt}
          state={coachState}
          secondsLeft={secondsLeft}
          totalSeconds={DEMO_QUESTION_BUDGET_SEC}
          onChooseTalk={() => setCoachState("open")}
          onLock={() => setCoachState("locked")}
          coachApiPath="/api/demo/coach"
          maxUserTurns={DEMO_COACH_MAX_TURNS}
        />
      )}

      <motion.div
        key={q.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-border bg-surface p-6 md:p-8 shadow-soft"
      >
        <div className="flex items-center gap-2 text-sm text-ink-muted flex-wrap">
          <Badge
            variant="outline"
            className="text-left whitespace-normal font-normal leading-snug max-w-[min(100%,22rem)]"
          >
            {formatSectionDisplayLabel(q.section_code)}
          </Badge>
          <span>·</span>
          <span className="capitalize">{q.level}</span>
        </div>

        <h2 className="mt-5 font-serif text-2xl md:text-3xl leading-snug text-ink">
          {q.prompt}
        </h2>

        <div className="mt-6 grid gap-3">
          {options.map((letter) => {
            const isSelected = selected === letter;
            const isCorrect =
              !!reveal && letter === reveal.correctOption;
            const isWrong =
              !!reveal &&
              reveal.selected === letter &&
              letter !== reveal.correctOption;
            return (
              <button
                key={letter}
                type="button"
                disabled={!!reveal || submitting}
                onClick={() => {
                  if (reveal) return;
                  setSelected(letter);
                }}
                className={cn(
                  "group relative w-full text-left rounded-2xl border p-4 transition-all focus-ring",
                  "flex items-start gap-4",
                  !reveal && "hover:border-primary/60 hover:bg-elevated",
                  isSelected && !reveal && "border-primary bg-primary-soft/40",
                  !isSelected && !reveal && "border-border bg-surface",
                  isCorrect && "border-success bg-success/10",
                  isWrong && "border-danger bg-danger/10",
                  reveal && !isCorrect && !isWrong && "opacity-60",
                )}
              >
                <span
                  className={cn(
                    "shrink-0 h-8 w-8 rounded-full grid place-items-center text-sm font-semibold border",
                    isCorrect &&
                      "bg-success text-primary-foreground border-transparent",
                    isWrong &&
                      "bg-danger text-primary-foreground border-transparent",
                    !isCorrect &&
                      !isWrong &&
                      isSelected &&
                      "bg-primary text-primary-foreground border-transparent",
                    !isCorrect &&
                      !isWrong &&
                      !isSelected &&
                      "bg-muted text-ink-muted border-border",
                  )}
                >
                  {letter}
                </span>
                <span className="text-ink text-[15px] leading-relaxed flex-1">
                  {optionMap[letter]}
                </span>
                {isCorrect && (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                )}
                {isWrong && <XCircle className="h-5 w-5 text-danger" />}
              </button>
            );
          })}
        </div>

        {reveal?.explanation && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 rounded-2xl border border-border bg-elevated p-4"
          >
            <div className="text-xs uppercase tracking-widest text-ink-muted mb-1">
              Explanation
            </div>
            <p className="text-sm text-ink leading-relaxed">
              {reveal.explanation}
            </p>
          </motion.div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          {!reveal ? (
            <Button
              disabled={!selected || submitting}
              onClick={() => selected && submitAnswer(selected)}
            >
              {submitting ? "Checking…" : "Submit answer"}
            </Button>
          ) : index < questions.length - 1 ? (
            <Button onClick={goNext}>
              Next question
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => setPhase("done")}>
              See your results
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </motion.div>

      {error && (
        <p className="text-sm text-danger text-center">{error}</p>
      )}
    </div>
  );
}
