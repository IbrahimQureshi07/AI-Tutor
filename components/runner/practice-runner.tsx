"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Lightbulb,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Loader2,
  RefreshCw,
  History,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, pct, timeAgo } from "@/lib/utils";
import type { QuestionRow, ResultLabel } from "@/lib/supabase/types";
import { useChatSheet } from "@/components/chat/chat-sheet-provider";
import type { QuestionOrigin } from "@/lib/mistakes/pick-questions";
import { CoachChat, type CoachState } from "@/components/practice/coach-chat";
import { formatSectionDisplayLabel } from "@/lib/sections/display-label";

type RunnerMode = "practice" | "mistakes";
type SiblingDifficulty = "same" | "harder";

/** Per-question shared budget (question + Socratic chat). Practice only. */
const QUESTION_BUDGET_SEC = 120;

type Props = {
  sessionId: string;
  questions: QuestionRow[];
  startedAt: number;
  resultsPath: string;
  mode?: RunnerMode;
  siblingDifficulty?: SiblingDifficulty;
  /** Per-question provenance (from Mistakes picker). Keyed by question id. */
  questionOrigins?: Record<string, QuestionOrigin>;
};

type Phase =
  | "ask"          // first attempt on the primary question
  | "reveal"       // primary answered correctly — showing explanation, can advance
  | "sibling-loading"
  | "sibling-ask"  // primary wrong; explanation shown; now answering sibling
  | "sibling-done"; // sibling answered; parent relabelled; advance

type Slot = {
  // primary
  primary: QuestionRow;
  phase: Phase;
  primarySelected: "A" | "B" | "C" | "D" | null;
  primaryStartedAt: number;
  primaryAttemptId: string | null;
  label: ResultLabel | null;
  hint: string | null;
  hintLoading: boolean;
  hintUsed: boolean;

  // socratic coach (practice only)
  coachState: CoachState;
  coached: boolean;
  /** Wall-clock deadline for this question's shared 2-min budget (ms). */
  deadline: number | null;
  /** Set true once the timer expires so the slot can't be re-armed. */
  timedOut: boolean;

  // sibling
  sibling: QuestionRow | null;
  siblingSource: "ai" | "bank" | null;
  siblingSelected: "A" | "B" | "C" | "D" | null;
  siblingStartedAt: number | null;
  siblingError: string | null;
};

function slotFor(q: QuestionRow): Slot {
  return {
    primary: q,
    phase: "ask",
    primarySelected: null,
    primaryStartedAt: Date.now(),
    primaryAttemptId: null,
    label: null,
    hint: null,
    hintLoading: false,
    hintUsed: false,
    coachState: "choosing",
    coached: false,
    deadline: null,
    timedOut: false,
    sibling: null,
    siblingSource: null,
    siblingSelected: null,
    siblingStartedAt: null,
    siblingError: null,
  };
}

const LABEL_COPY: Record<ResultLabel, { title: string; tone: string; sub: string }> = {
  mastered: {
    title: "Mastered",
    tone: "text-success",
    sub: "First try, clean. Locked in.",
  },
  soft_miss: {
    title: "Recovered",
    tone: "text-warn",
    sub: "Missed the first, nailed the follow-up. Reachable.",
  },
  hard_miss: {
    title: "Needs review",
    tone: "text-danger",
    sub: "Missed both. We'll keep showing this concept.",
  },
};

export function PracticeRunner({
  sessionId,
  questions,
  startedAt,
  resultsPath,
  mode = "practice",
  siblingDifficulty = "same",
  questionOrigins,
}: Props) {
  const router = useRouter();
  const total = questions.length;
  const isMistakes = mode === "mistakes";

  const [slots, setSlots] = React.useState<Slot[]>(() =>
    questions.map((q) => slotFor(q)),
  );
  const [index, setIndex] = React.useState(0);
  const [finishing, setFinishing] = React.useState(false);
  // 1Hz tick; only used in Practice mode to drive the per-question timer.
  const [now, setNow] = React.useState(() => Date.now());
  const { open: openChat } = useChatSheet();

  const slot = slots[index];
  const coachEnabled = mode === "practice";

  const patchSlot = React.useCallback(
    (patch: Partial<Slot>) =>
      setSlots((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...patch };
        return next;
      }),
    [index],
  );

  /** Arm the deadline for the current slot the first time we land on it. */
  React.useEffect(() => {
    if (!coachEnabled) return;
    if (!slot || slot.phase !== "ask") return;
    if (slot.deadline != null) return;
    patchSlot({ deadline: Date.now() + QUESTION_BUDGET_SEC * 1000 });
  }, [coachEnabled, slot, patchSlot]);

  /** 1Hz tick — only runs while a deadline is active and we're in "ask". */
  React.useEffect(() => {
    if (!coachEnabled) return;
    if (!slot || slot.phase !== "ask" || slot.deadline == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [coachEnabled, slot?.phase, slot?.deadline]); // eslint-disable-line react-hooks/exhaustive-deps

  const secondsLeft =
    coachEnabled && slot?.deadline
      ? Math.max(0, Math.ceil((slot.deadline - now) / 1000))
      : QUESTION_BUDGET_SEC;

  async function recordPrimary(
    q: QuestionRow,
    startedAtMs: number,
    answer: "A" | "B" | "C" | "D" | null,
    isCorrect: boolean,
    label: ResultLabel | null,
    hinted: boolean,
    coached: boolean,
  ): Promise<string | null> {
    try {
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question_id: q.id,
          mode,
          user_answer: answer,
          is_correct: isCorrect,
          hinted,
          retried: false,
          time_spent_ms: Math.max(0, Date.now() - startedAtMs),
          attempt_number: 1,
          result_label: label,
          is_sibling: false,
          parent_attempt_id: null,
          coached,
        }),
      });
      const json = await res.json();
      return (json?.id as string | null) ?? null;
    } catch (e) {
      console.error("recordPrimary", e);
      return null;
    }
  }

  async function recordSibling(
    q: QuestionRow,
    startedAtMs: number,
    answer: "A" | "B" | "C" | "D",
    isCorrect: boolean,
    parentAttemptId: string | null,
  ) {
    try {
      await fetch("/api/attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question_id: q.id,
          mode,
          user_answer: answer,
          is_correct: isCorrect,
          hinted: false,
          retried: false,
          time_spent_ms: Math.max(0, Date.now() - startedAtMs),
          attempt_number: 1,
          result_label: null,
          is_sibling: true,
          parent_attempt_id: parentAttemptId,
        }),
      });
    } catch (e) {
      console.error("recordSibling", e);
    }
  }

  async function relabelParent(attemptId: string, label: ResultLabel) {
    try {
      await fetch(`/api/attempts?id=${encodeURIComponent(attemptId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ result_label: label }),
      });
    } catch (e) {
      console.error("relabelParent", e);
    }
  }

  async function fetchHint(q: QuestionRow, wrongLetter: "A" | "B" | "C" | "D") {
    patchSlot({ hintLoading: true, hintUsed: true });
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
      patchSlot({
        hint:
          json.hint ??
          "Re-read the question. Focus on the exact qualifier the right answer hinges on.",
        hintLoading: false,
      });
    } catch (e) {
      console.error("fetchHint", e);
      patchSlot({
        hint: "Re-read the question — find the key qualifier or rule.",
        hintLoading: false,
      });
    }
  }

  async function fetchSibling(q: QuestionRow) {
    patchSlot({ phase: "sibling-loading", siblingError: null });
    try {
      const excludeIds = slots.map((s) => s.primary.id);
      const res = await fetch("/api/practice/sibling", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question_id: q.id,
          exclude_ids: excludeIds,
          target_difficulty: siblingDifficulty,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      const sibling = json.question as QuestionRow | null;
      const source = (json.source as "ai" | "bank" | null) ?? null;
      if (!sibling) throw new Error("Empty sibling response.");
      patchSlot({
        sibling,
        siblingSource: source,
        phase: "sibling-ask",
        siblingStartedAt: Date.now(),
      });
      if (source === "bank") {
        toast.message("Follow-up question ready.", {
          description: "Same concept, fresh wording.",
        });
      }
    } catch (e) {
      console.error("fetchSibling", e);
      patchSlot({
        phase: "sibling-ask",
        siblingError:
          "Couldn't load a follow-up question — we'll mark this as needs review and move on.",
      });
    }
  }

  const primaryCommittingRef = React.useRef(false);

  async function commitPrimaryAnswer(
    letter: "A" | "B" | "C" | "D",
    s: Slot,
  ) {
    if (s.phase !== "ask") return;
    if (primaryCommittingRef.current) return;
    primaryCommittingRef.current = true;
    const q = s.primary;
    const isCorrect = letter === q.correct_option;
    const coached = s.coached;

    try {
      if (isCorrect) {
        patchSlot({
          primarySelected: letter,
          phase: "reveal",
          label: "mastered",
          coachState: "locked",
        });
        await recordPrimary(
          q,
          s.primaryStartedAt,
          letter,
          true,
          "mastered",
          s.hintUsed,
          coached,
        );
        toast.success(coached ? "Locked in (coached)." : "Locked in.");
        return;
      }

      patchSlot({
        primarySelected: letter,
        phase: "sibling-loading",
        label: "hard_miss",
        coachState: "locked",
      });
      const parentId = await recordPrimary(
        q,
        s.primaryStartedAt,
        letter,
        false,
        "hard_miss",
        s.hintUsed,
        coached,
      );
      patchSlot({ primaryAttemptId: parentId });
      if (!s.hint) {
        fetchHint(q, letter);
      }
      await fetchSibling(q);
    } finally {
      primaryCommittingRef.current = false;
    }
  }

  React.useEffect(() => {
    primaryCommittingRef.current = false;
  }, [index]);

  function onPrimaryOptionTap(letter: "A" | "B" | "C" | "D") {
    if (!slot || slot.phase !== "ask") return;
    if (!coachEnabled) {
      void commitPrimaryAnswer(letter, slot);
      return;
    }
    patchSlot({
      primarySelected: letter,
      coachState: slot.coachState === "choosing" ? "closed" : slot.coachState,
    });
  }

  function onPrimaryLockIn() {
    const s = slots[index];
    if (!s || s.phase !== "ask" || !s.primarySelected) return;
    void commitPrimaryAnswer(s.primarySelected, s);
  }

  /**
   * Time's up handler — when the shared 2:00 budget expires while we're
   * still in "ask", commit whatever's selected (or null = hard_miss) and
   * jump straight to the explanation. No sibling — they didn't earn it.
   */
  const expireTimeoutRef = React.useRef(false);
  React.useEffect(() => {
    if (!coachEnabled) return;
    if (!slot || slot.phase !== "ask") return;
    if (secondsLeft > 0 || slot.timedOut) return;
    if (expireTimeoutRef.current) return;
    expireTimeoutRef.current = true;
    (async () => {
      const q = slot.primary;
      const picked = slot.primarySelected;
      const isCorrect = picked != null && picked === q.correct_option;
      const label: ResultLabel = isCorrect ? "mastered" : "hard_miss";
      patchSlot({
        phase: "reveal",
        label,
        timedOut: true,
        coachState: "locked",
      });
      await recordPrimary(
        q,
        slot.primaryStartedAt,
        picked,
        isCorrect,
        label,
        slot.hintUsed,
        slot.coached,
      );
      toast.error(
        isCorrect
          ? "Time! Counted what you had."
          : "Time! Marked as needs review.",
      );
    })();
  }, [coachEnabled, slot, secondsLeft, patchSlot]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    expireTimeoutRef.current = false;
  }, [index]);

  async function onSiblingAnswer(letter: "A" | "B" | "C" | "D") {
    if (!slot || !slot.sibling || slot.phase !== "sibling-ask") return;
    if (!slot.siblingStartedAt) return;
    const sibQ = slot.sibling;
    const correct = letter === sibQ.correct_option;

    const newLabel: ResultLabel = correct ? "soft_miss" : "hard_miss";
    patchSlot({
      siblingSelected: letter,
      phase: "sibling-done",
      label: newLabel,
    });

    recordSibling(
      sibQ,
      slot.siblingStartedAt,
      letter,
      correct,
      slot.primaryAttemptId,
    );

    if (slot.primaryAttemptId && correct) {
      relabelParent(slot.primaryAttemptId, "soft_miss");
    }

    if (correct) {
      toast.success("Good — concept recovered.");
    } else {
      toast.error("We'll queue this concept up again.");
    }
  }

  async function retrySibling() {
    if (!slot) return;
    await fetchSibling(slot.primary);
  }

  function skipSibling() {
    // User can't load a sibling — record the parent as hard_miss and move on.
    patchSlot({ phase: "sibling-done", label: "hard_miss" });
  }

  function gotoNext() {
    if (index < total - 1) {
      setIndex(index + 1);
      setSlots((prev) => {
        const n = [...prev];
        // Reset start clock — deadline arms via the effect on first paint.
        n[index + 1] = {
          ...n[index + 1],
          primaryStartedAt: Date.now(),
          deadline: null,
        };
        return n;
      });
    } else {
      finish();
    }
  }

  async function finish() {
    if (finishing) return;
    setFinishing(true);

    const mastered = slots.filter((s) => s.label === "mastered").length;
    const soft = slots.filter((s) => s.label === "soft_miss").length;
    const score = pct(mastered + soft, total); // reach = first-try + recovered

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

  if (!slot) {
    return (
      <div className="text-center py-20 text-ink-muted">
        No questions loaded.
      </div>
    );
  }

  // Counters across the run.
  const counts = {
    mastered: slots.filter((s) => s.label === "mastered").length,
    soft: slots.filter((s) => s.label === "soft_miss").length,
    hard: slots.filter((s) => s.label === "hard_miss").length,
  };

  const canAdvance = slot.phase === "reveal" || slot.phase === "sibling-done";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium text-ink">
            Question {index + 1}{" "}
            <span className="text-ink-muted">/ {total}</span>
          </span>
          <Counter label="Mastered" n={counts.mastered} tone="text-success" />
          <Counter label="Recovered" n={counts.soft} tone="text-warn" />
          <Counter label="Needs review" n={counts.hard} tone="text-danger" />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={finish}
          disabled={finishing}
        >
          {finishing ? "Finishing…" : "Finish early"}
        </Button>
      </div>
      <Progress value={pct(index + (canAdvance ? 1 : 0), total)} />

      {/* COACH CHAT — practice only, only during the "ask" phase. */}
      {coachEnabled && slot.phase === "ask" && (
        <CoachChat
          questionId={slot.primary.id}
          questionPrompt={slot.primary.prompt}
          state={slot.coachState}
          secondsLeft={secondsLeft}
          totalSeconds={QUESTION_BUDGET_SEC}
          onChooseTalk={() => patchSlot({ coachState: "open" })}
          onLock={() => patchSlot({ coachState: "locked" })}
          // `coached` flips to true the first time the student actually
          // sends a message — opening the panel and immediately closing
          // shouldn't taint the score.
          onCoachUsed={() => patchSlot({ coached: true })}
        />
      )}

      {/* PRIMARY — stays fully open (revealed) while follow-up runs below */}
      <QuestionPanel
        q={slot.primary}
        index={index}
        total={total}
        variant="primary"
        disabled={slot.phase !== "ask"}
        selected={slot.primarySelected}
        showRevealed={slot.phase !== "ask"}
        hint={slot.hint}
        hintLoading={slot.hintLoading}
        explanationRevealed={slot.phase !== "ask"}
        origin={questionOrigins?.[slot.primary.id]}
        phaseBadge={
          slot.phase === "sibling-loading" ||
          slot.phase === "sibling-ask" ||
          slot.phase === "sibling-done"
            ? "Original"
            : undefined
        }
        onAnswer={onPrimaryOptionTap}
        onAskAI={() =>
          openChat({
            id: slot.primary.id,
            section_code: slot.primary.section_code,
            prompt: slot.primary.prompt,
            option_a: slot.primary.option_a,
            option_b: slot.primary.option_b,
            option_c: slot.primary.option_c,
            option_d: slot.primary.option_d,
            correct_option: slot.primary.correct_option,
            hint: slot.primary.hint,
            explanation: slot.primary.explanation,
            user_answer: slot.primarySelected,
          })
        }
      />

      {coachEnabled && slot.phase === "ask" && slot.primarySelected && (
        <div className="flex flex-col items-end gap-1 pt-1">
          <Button size="default" onClick={onPrimaryLockIn}>
            Lock in answer
          </Button>
          <span className="text-[11px] text-ink-muted">
            Tap another letter above to change your pick first.
          </span>
        </div>
      )}

      {/* SIBLING / LABEL PANEL */}
      {slot.phase === "sibling-loading" && (
        <div className="rounded-3xl border border-primary/25 bg-primary-soft/40 p-6 flex items-center gap-3 text-sm text-ink">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <div>
            <div className="font-medium">
              {isMistakes
                ? "Serving a tougher follow-up…"
                : "Serving a follow-up question…"}
            </div>
            <div className="text-xs text-ink-muted">
              {isMistakes
                ? `Same concept, harder version. Doesn't count toward your ${total} — it's a free extra try.`
                : `Same concept, different wording. This doesn't count toward your ${total} — it's a free extra try.`}
            </div>
          </div>
        </div>
      )}

      {slot.phase === "sibling-ask" && slot.sibling && (
        <div className="space-y-3">
          <SiblingChrome
            isMistakes={isMistakes}
            source={slot.siblingSource}
            total={total}
          />
          <QuestionPanel
            q={slot.sibling}
            index={index}
            total={total}
            variant="sibling"
            disabled={false}
            selected={slot.siblingSelected}
            showRevealed={false}
            hint={null}
            hintLoading={false}
            explanationRevealed={false}
            phaseBadge="Follow-up"
            onAnswer={onSiblingAnswer}
          />
        </div>
      )}

      {slot.phase === "sibling-ask" && !slot.sibling && slot.siblingError && (
        <div className="rounded-3xl border border-warn/30 bg-warn/10 p-6 text-sm text-ink">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 text-warn" />
            Follow-up unavailable
          </div>
          <p className="mt-1 text-ink-muted">{slot.siblingError}</p>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={retrySibling}>
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </Button>
            <Button size="sm" onClick={skipSibling}>
              Mark and continue
            </Button>
          </div>
        </div>
      )}

      {/* Follow-up answered: keep original open above; show follow-up reveal here */}
      {slot.phase === "sibling-done" && slot.sibling && (
        <div className="space-y-3">
          <SiblingChrome
            isMistakes={isMistakes}
            source={slot.siblingSource}
            total={total}
            done
          />
          <QuestionPanel
            q={slot.sibling}
            index={index}
            total={total}
            variant="sibling"
            disabled
            selected={slot.siblingSelected}
            showRevealed
            hint={null}
            hintLoading={false}
            explanationRevealed
            phaseBadge="Follow-up"
            onAnswer={() => {}}
          />
          {slot.label && (
            <LabelPanel
              label={slot.label}
              siblingQ={slot.sibling}
              siblingAnswer={slot.siblingSelected}
            />
          )}
        </div>
      )}

      {slot.phase === "sibling-done" && !slot.sibling && slot.label && (
        <LabelPanel label={slot.label} />
      )}

      {slot.phase === "reveal" && slot.label && (
        <LabelPanel label={slot.label} />
      )}

      {/* NEXT */}
      {canAdvance && (
        <div className="flex justify-end">
          <Button onClick={gotoNext} size="lg">
            {index === total - 1
              ? isMistakes
                ? "Finish mistakes test"
                : "Finish practice"
              : "Next question"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---------------- inner panels ---------------- */

function QuestionPanel({
  q,
  index,
  total,
  variant,
  disabled,
  selected,
  showRevealed,
  hint,
  hintLoading,
  explanationRevealed,
  origin,
  phaseBadge,
  onAnswer,
  onAskAI,
}: {
  q: QuestionRow;
  index: number;
  total: number;
  variant: "primary" | "sibling";
  disabled: boolean;
  selected: "A" | "B" | "C" | "D" | null;
  showRevealed: boolean;
  hint: string | null;
  hintLoading: boolean;
  explanationRevealed: boolean;
  origin?: QuestionOrigin;
  /** Clear label so Original greens are never confused with Follow-up text */
  phaseBadge?: string;
  onAnswer: (letter: "A" | "B" | "C" | "D") => void;
  onAskAI?: () => void;
}) {
  const opts = (["A", "B", "C", "D"] as const).map((letter) => ({
    letter,
    text: (q as unknown as Record<string, string>)[`option_${letter.toLowerCase()}`],
  }));
  const correctLetter = q.correct_option;

  return (
    <div
      className={cn(
        "rounded-3xl border p-6 md:p-8 shadow-soft",
        variant === "primary"
          ? "border-border bg-surface"
          : "border-primary/30 bg-primary-soft/20",
      )}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm flex-wrap">
          {phaseBadge && (
            <Badge
              variant={variant === "sibling" ? "default" : "outline"}
              className="text-[10px] uppercase tracking-wide"
            >
              {phaseBadge}
            </Badge>
          )}
          <Badge variant="outline" className="text-left whitespace-normal font-normal leading-snug max-w-[min(100%,22rem)]">
            {formatSectionDisplayLabel(q.section_code)}
          </Badge>
          <span className="text-ink-muted capitalize">· {q.level}</span>
          {q.concept_id && (
            <span
              className="text-ink-muted text-xs hidden md:inline truncate max-w-[18rem]"
              title={q.concept_id}
            >
              · {q.concept_id.split(".").slice(1).join(".") || q.concept_id}
            </span>
          )}
          {origin && variant === "primary" && <OriginChip origin={origin} />}
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <span>
            {variant === "primary" ? (
              <>
                Q{index + 1} <span className="opacity-60">/ {total}</span>
              </>
            ) : (
              <>Follow-up</>
            )}
          </span>
          {onAskAI && (
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onAskAI}>
              <Sparkles className="h-3.5 w-3.5" /> Ask AI
            </Button>
          )}
        </div>
      </div>

      <h2 className="mt-5 font-serif text-2xl md:text-3xl leading-snug text-ink">
        {q.prompt}
      </h2>

      {hint && (
        <div className="mt-5 rounded-2xl border border-warn/30 bg-warn/10 p-4 text-sm text-ink flex gap-3">
          <Lightbulb className="h-4 w-4 text-warn shrink-0 mt-0.5" />
          <div>
            <div className="text-xs uppercase tracking-widest text-warn mb-0.5 flex items-center gap-2">
              Hint
              {hintLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>
            <p className="whitespace-pre-wrap">{hint}</p>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-3">
        {opts.map(({ letter, text }) => {
          const isSelected = selected === letter;
          const isCorrect = showRevealed && letter === correctLetter;
          const isWrong =
            showRevealed && isSelected && letter !== correctLetter;
          return (
            <button
              key={letter}
              type="button"
              onClick={() => !disabled && onAnswer(letter)}
              disabled={disabled}
              className={cn(
                "group w-full text-left rounded-2xl border p-4 transition-all focus-ring flex items-start gap-4",
                !disabled &&
                  "hover:border-primary/60 hover:bg-elevated active:scale-[0.998]",
                isCorrect && "border-success bg-success/10",
                isWrong && "border-danger bg-danger/10",
                !isCorrect &&
                  !isWrong &&
                  !isSelected &&
                  "border-border bg-surface",
                !isCorrect &&
                  !isWrong &&
                  isSelected &&
                  !showRevealed &&
                  "border-primary bg-primary-soft/40",
                disabled && !isCorrect && !isWrong && !isSelected && "opacity-70",
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
                {text}
              </span>
              {isCorrect && <CheckCircle2 className="h-5 w-5 text-success" />}
              {isWrong && <XCircle className="h-5 w-5 text-danger" />}
            </button>
          );
        })}
      </div>

      {explanationRevealed && q.explanation && (
        <div className="mt-5 rounded-2xl border border-border bg-elevated p-4">
          <div className="text-xs uppercase tracking-widest text-ink-muted mb-1">
            Why <span className="font-mono">{correctLetter}</span> is correct
          </div>
          <p className="text-sm text-ink leading-relaxed">{q.explanation}</p>
        </div>
      )}
    </div>
  );
}

function LabelPanel({
  label,
  siblingQ,
  siblingAnswer,
}: {
  label: ResultLabel;
  siblingQ?: QuestionRow;
  siblingAnswer?: "A" | "B" | "C" | "D" | null;
}) {
  const copy = LABEL_COPY[label];
  const Icon =
    label === "mastered"
      ? CheckCircle2
      : label === "soft_miss"
        ? TrendingIcon
        : AlertTriangle;
  const correctLetter = siblingQ?.correct_option;
  return (
    <div className="rounded-3xl border border-border bg-elevated/60 p-5">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", copy.tone)} />
        <div className={cn("font-semibold", copy.tone)}>{copy.title}</div>
      </div>
      <p className="text-sm text-ink-muted mt-1">{copy.sub}</p>
      {siblingQ && siblingAnswer && correctLetter && (
        <div className="mt-3 pt-3 border-t border-border text-sm">
          <div className="text-xs uppercase tracking-widest text-ink-muted mb-1">
            Follow-up result
          </div>
          <p className="text-ink-muted">
            On this follow-up you picked{" "}
            <span
              className={cn(
                "font-medium",
                siblingAnswer === correctLetter
                  ? "text-success"
                  : "text-danger",
              )}
            >
              {siblingAnswer}
            </span>
            . Correct option was{" "}
            <span className="font-medium text-ink">{correctLetter}</span>
            .
          </p>
          {/* Full explanation lives on the follow-up card above — don't paste another question's text here. */}
        </div>
      )}
    </div>
  );
}

function SiblingChrome({
  isMistakes,
  source,
  total,
  done = false,
}: {
  isMistakes: boolean;
  source: "ai" | "bank" | null;
  total: number;
  done?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-ink-muted flex-wrap">
      <Sparkles className="h-3.5 w-3.5 text-primary" />
      <span className="uppercase tracking-wide font-medium">
        {done
          ? "Follow-up reviewed"
          : isMistakes
            ? "Extra try · same concept · harder"
            : "Extra try · same concept"}
      </span>
      {source === "ai" && (
        <Badge variant="outline" className="text-[10px]">
          AI-written
        </Badge>
      )}
      {source === "bank" && (
        <Badge variant="outline" className="text-[10px]">
          From bank
        </Badge>
      )}
      <span className="text-ink-muted">· not counted toward your {total}</span>
    </div>
  );
}

function TrendingIcon({ className }: { className?: string }) {
  // Simple arrow-up to avoid a new lucide import dance.
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

const ORIGIN_MODE_LABEL: Record<NonNullable<QuestionOrigin["firstMissedMode"]>, string> = {
  assessment: "Assessment",
  practice: "Practice",
  mistakes: "Mistakes Test",
};

function OriginChip({ origin }: { origin: QuestionOrigin }) {
  if (origin.source === "new") {
    return (
      <span
        className="ml-1 inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success"
        title="New question — never shown to you before"
      >
        <Plus className="h-3 w-3" />
        New
      </span>
    );
  }
  const modeLabel = origin.firstMissedMode
    ? ORIGIN_MODE_LABEL[origin.firstMissedMode]
    : "earlier";
  const ago = origin.firstMissedAt ? timeAgo(origin.firstMissedAt) : "";
  const timesPart =
    origin.timesWrong && origin.timesWrong > 1 ? ` · missed ${origin.timesWrong}×` : "";
  return (
    <span
      className="ml-1 inline-flex items-center gap-1 rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warn"
      title={`First missed in ${modeLabel}${ago ? ` · ${ago}` : ""}${timesPart}`}
    >
      <History className="h-3 w-3" />
      Missed in {modeLabel}
      {ago && <span className="font-normal normal-case opacity-80">· {ago}</span>}
    </span>
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
