"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Lightbulb,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, pct } from "@/lib/utils";
import type { QuestionRow, ResultLabel } from "@/lib/supabase/types";
import { useChatSheet } from "@/components/chat/chat-sheet-provider";
import { formatSectionDisplayLabel } from "@/lib/sections/display-label";

type Props = {
  sessionId: string;
  questions: QuestionRow[];
  startedAt: number;
  resultsPath: string;
};

type Phase =
  | "ask"           // first attempt
  | "hint"          // wrong, showing hint, second attempt
  | "feedback";     // both attempts done, showing reveal + label

type State = {
  selected: "A" | "B" | "C" | "D" | null;
  firstSelected: "A" | "B" | "C" | "D" | null;
  phase: Phase;
  hint: string | null;
  hintLoading: boolean;
  label: ResultLabel | null;
  attemptStart: number;
};

function newState(): State {
  return {
    selected: null,
    firstSelected: null,
    phase: "ask",
    hint: null,
    hintLoading: false,
    label: null,
    attemptStart: Date.now(),
  };
}

const LABEL_COPY: Record<ResultLabel, { title: string; tone: string; sub: string }> = {
  mastered: {
    title: "Mastered",
    tone: "text-success",
    sub: "First-try correct. Locked in.",
  },
  soft_miss: {
    title: "Soft miss",
    tone: "text-warn",
    sub: "Wrong first, right after the hint. Reachable.",
  },
  hard_miss: {
    title: "Hard miss",
    tone: "text-danger",
    sub: "Wrong both tries — we'll teach this concept from the ground up.",
  },
};

export function AssessmentRunner({
  sessionId,
  questions,
  startedAt,
  resultsPath,
}: Props) {
  const router = useRouter();
  const total = questions.length;
  const [index, setIndex] = React.useState(0);
  const [states, setStates] = React.useState<State[]>(() =>
    questions.map(() => newState()),
  );
  const [finishing, setFinishing] = React.useState(false);

  const q = questions[index];
  const s = states[index];
  const { open: openChat } = useChatSheet();

  const setCurrent = React.useCallback(
    (patch: Partial<State>) =>
      setStates((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...patch };
        return next;
      }),
    [index],
  );

  async function recordAttempt(
    attempt: 1 | 2,
    answer: "A" | "B" | "C" | "D" | null,
    isCorrect: boolean,
    label: ResultLabel | null,
    hinted: boolean,
  ) {
    const now = Date.now();
    const body = JSON.stringify({
      session_id: sessionId,
      question_id: q.id,
      mode: "assessment",
      user_answer: answer,
      is_correct: isCorrect,
      hinted,
      retried: attempt === 2,
      time_spent_ms: Math.max(0, now - s.attemptStart),
      attempt_number: attempt,
      result_label: label,
    });
    let lastErr = "";
    for (let tryIdx = 0; tryIdx < 4; tryIdx++) {
      try {
        const res = await fetch("/api/attempts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        });
        if (res.ok) return;
        lastErr = await res.text().catch(() => res.statusText);
      } catch (e) {
        lastErr = String(e);
      }
      await new Promise((r) => setTimeout(r, 120 * (tryIdx + 1)));
    }
    console.error("[assessment] recordAttempt failed after retries", lastErr);
  }

  async function fetchHint(wrongLetter: "A" | "B" | "C" | "D" | null) {
    setCurrent({ hintLoading: true });
    try {
      const res = await fetch("/api/hint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question_id: q.id,
          wrong_answer: wrongLetter,
        }),
      });
      const json = await res.json();
      setCurrent({ hint: json.hint ?? "Re-read the question — focus on the key qualifier.", hintLoading: false });
    } catch (e) {
      console.error("fetchHint", e);
      setCurrent({
        hint: "Re-read the question carefully — find the exact qualifier.",
        hintLoading: false,
      });
    }
  }

  async function answer(letter: "A" | "B" | "C" | "D") {
    if (s.phase === "feedback") return;
    const isCorrect = letter === q.correct_option;

    if (s.phase === "ask") {
      if (isCorrect) {
        // First-try correct (with or without a proactively-shown hint) =
        // mastered. Hint usage is captured in the `hinted` column but does
        // not downgrade the label.
        const label: ResultLabel = "mastered";
        await recordAttempt(1, letter, true, label, !!s.hint);
        setCurrent({
          selected: letter,
          firstSelected: letter,
          phase: "feedback",
          label,
        });
        return;
      }
      // wrong first → persist attempt 1 before hint UI so finish/PDF never races DB
      await recordAttempt(1, letter, false, null, false);
      setCurrent({
        selected: null,
        firstSelected: letter,
        phase: "hint",
      });
      fetchHint(letter);
      return;
    }

    // phase === "hint" → second attempt
    if (isCorrect) {
      const label: ResultLabel = "soft_miss";
      await recordAttempt(2, letter, true, label, true);
      setCurrent({ selected: letter, phase: "feedback", label });
    } else {
      const label: ResultLabel = "hard_miss";
      await recordAttempt(2, letter, false, label, true);
      setCurrent({ selected: letter, phase: "feedback", label });
    }
  }

  async function requestHintBeforeAnswer() {
    // Show a hint proactively. Using the hint before answering does NOT
    // penalize the student — first-try correct is still "mastered".
    if (s.phase !== "ask" || s.hint) return;
    await fetchHint(null);
  }

  function next() {
    if (index < total - 1) {
      setIndex(index + 1);
      setStates((prev) => {
        const n = [...prev];
        n[index + 1] = { ...n[index + 1], attemptStart: Date.now() };
        return n;
      });
    } else {
      finish();
    }
  }

  async function finish() {
    if (finishing) return;
    setFinishing(true);

    // Score = % mastered; soft/hard misses count 0.
    const correct = states.filter((x) => x.label === "mastered").length;
    const score = pct(correct, total);

    try {
      await fetch(`/api/sessions/${sessionId}/finish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          score_pct: score,
          duration_ms: Date.now() - startedAt,
        }),
      });
    } catch (e) {
      console.error("finish", e);
    }

    router.replace(resultsPath);
  }

  if (!q) {
    return (
      <div className="text-center py-20 text-ink-muted">
        No questions loaded.
      </div>
    );
  }

  const optionMap: Record<"A" | "B" | "C" | "D", string> = {
    A: q.option_a,
    B: q.option_b,
    C: q.option_c,
    D: q.option_d,
  };

  const correctLetter = q.correct_option;
  const showFeedback = s.phase === "feedback";

  // Live counters
  const counts = {
    mastered: states.filter((x) => x.label === "mastered").length,
    soft: states.filter((x) => x.label === "soft_miss").length,
    hard: states.filter((x) => x.label === "hard_miss").length,
  };

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium text-ink">
            Question {index + 1}{" "}
            <span className="text-ink-muted">/ {total}</span>
          </span>
          <Counter label="Mastered" n={counts.mastered} tone="text-success" />
          <Counter label="Soft miss" n={counts.soft} tone="text-warn" />
          <Counter label="Hard miss" n={counts.hard} tone="text-danger" />
        </div>
        <Button variant="outline" size="sm" onClick={finish} disabled={finishing}>
          {finishing ? "Finishing…" : "Finish early"}
        </Button>
      </div>
      <Progress value={pct(index + (showFeedback ? 1 : 0), total)} />

      <AnimatePresence mode="wait">
        <motion.div
          key={q.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          className="rounded-3xl border border-border bg-surface p-6 md:p-8 shadow-soft"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="text-left whitespace-normal font-normal leading-snug max-w-[min(100%,22rem)]">
                {formatSectionDisplayLabel(q.section_code)}
              </Badge>
              <span className="text-ink-muted capitalize">· {q.level}</span>
              {q.concept_id && (
                <span
                  className="text-ink-muted text-xs hidden md:inline truncate max-w-[16rem]"
                  title={q.concept_id}
                >
                  · {q.concept_id.split(".").slice(1).join(".")}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
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
                  user_answer: s.selected,
                })
              }
            >
              <Sparkles className="h-3.5 w-3.5" /> Ask AI
            </Button>
          </div>

          <h2 className="mt-5 font-serif text-2xl md:text-3xl leading-snug text-ink">
            {q.prompt}
          </h2>

          {/* HINT panel */}
          <AnimatePresence>
            {(s.phase === "hint" || s.hintLoading || !!s.hint) && (
              <motion.div
                key="hint"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-5 rounded-2xl border border-warn/30 bg-warn/10 p-4 text-sm text-ink flex gap-3"
              >
                <Lightbulb className="h-4 w-4 text-warn shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-widest text-warn mb-0.5 flex items-center gap-2">
                    Hint
                    {s.hintLoading && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                  </div>
                  {s.hint ? (
                    <p className="whitespace-pre-wrap">{s.hint}</p>
                  ) : (
                    <p className="text-ink-muted">Thinking…</p>
                  )}
                  {s.firstSelected && s.phase === "hint" && (
                    <p className="text-xs text-ink-muted mt-2">
                      You picked{" "}
                      <span className="font-medium text-ink">
                        {s.firstSelected}
                      </span>
                      . One more try.
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* OPTIONS */}
          <div className="mt-6 grid gap-3">
            {(["A", "B", "C", "D"] as const).map((letter) => {
              const isFirstWrong =
                s.firstSelected === letter && s.firstSelected !== correctLetter && s.phase !== "ask";
              const isSecondPick = s.selected === letter && showFeedback;
              const isCorrect = showFeedback && letter === correctLetter;
              const isWrong =
                showFeedback && isSecondPick && letter !== correctLetter;

              const disabled =
                showFeedback || (s.phase === "hint" && letter === s.firstSelected);

              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => answer(letter)}
                  disabled={disabled}
                  className={cn(
                    "group w-full text-left rounded-2xl border p-4 transition-all focus-ring flex items-start gap-4",
                    !disabled &&
                      "hover:border-primary/60 hover:bg-elevated active:scale-[0.998]",
                    isCorrect && "border-success bg-success/10",
                    isWrong && "border-danger bg-danger/10",
                    isFirstWrong && !isCorrect && "border-danger/50 bg-danger/5 opacity-70",
                    !isCorrect &&
                      !isWrong &&
                      !isFirstWrong &&
                      "border-border bg-surface",
                  )}
                >
                  <span
                    className={cn(
                      "shrink-0 h-8 w-8 rounded-full grid place-items-center text-sm font-semibold border",
                      isCorrect &&
                        "bg-success text-primary-foreground border-transparent",
                      (isWrong || isFirstWrong) &&
                        "bg-danger text-primary-foreground border-transparent",
                      !isCorrect &&
                        !isWrong &&
                        !isFirstWrong &&
                        "bg-muted text-ink-muted border-border",
                    )}
                  >
                    {letter}
                  </span>
                  <span className="text-ink text-[15px] leading-relaxed flex-1">
                    {optionMap[letter]}
                  </span>
                  {isCorrect && <CheckCircle2 className="h-5 w-5 text-success" />}
                  {(isWrong || isFirstWrong) && (
                    <XCircle className="h-5 w-5 text-danger" />
                  )}
                </button>
              );
            })}
          </div>

          {/* FEEDBACK panel */}
          <AnimatePresence>
            {showFeedback && s.label && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-6 space-y-3"
              >
                <div className="rounded-2xl border border-border bg-elevated p-4">
                  <div className="flex items-center gap-2">
                    {s.label === "mastered" ? (
                      <CheckCircle2 className={cn("h-4 w-4", LABEL_COPY[s.label].tone)} />
                    ) : (
                      <AlertTriangle className={cn("h-4 w-4", LABEL_COPY[s.label].tone)} />
                    )}
                    <div className={cn("font-semibold", LABEL_COPY[s.label].tone)}>
                      {LABEL_COPY[s.label].title}
                    </div>
                  </div>
                  <p className="text-sm text-ink-muted mt-1">
                    {LABEL_COPY[s.label].sub}
                  </p>
                  {q.explanation && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="text-xs uppercase tracking-widest text-ink-muted mb-1">
                        Why <span className="font-mono">{correctLetter}</span> is correct
                      </div>
                      <p className="text-sm text-ink leading-relaxed">
                        {q.explanation}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer actions */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <div>
              {s.phase === "ask" && !s.hint && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={requestHintBeforeAnswer}
                  disabled={s.hintLoading}
                >
                  {s.hintLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading hint…
                    </>
                  ) : (
                    <>
                      <Lightbulb className="h-3.5 w-3.5" /> Show hint first
                    </>
                  )}
                </Button>
              )}
            </div>
            {showFeedback && (
              <Button onClick={next} size="lg">
                {index === total - 1 ? "Finish assessment" : "Next question"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Counter({
  label,
  n,
  tone,
}: {
  label: string;
  n: number;
  tone: string;
}) {
  return (
    <span
      className={cn(
        "hidden md:inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs",
        tone,
      )}
    >
      {label} <span className="tabular-nums font-semibold">{n}</span>
    </span>
  );
}
