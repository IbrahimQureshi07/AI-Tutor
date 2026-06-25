"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Send,
  Lock,
  Clock3,
  CheckCircle2,
  ArrowRight,
  GraduationCap,
  Hand,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChatMarkdown } from "@/components/chat/chat-markdown";
import { VoiceInputButton } from "@/components/chat/voice-input-button";

/* =====================================================================
 * CoachChat
 *
 * The Socratic in-question coach used in Practice mode.
 *
 *   - Entry: "Let's talk it out" (answers below imply solo — tap when you want the coach).
 *   - Once chat opens, lives inside the SAME 2-minute question budget.
 *   - 4 student turns max (server-enforced too).
 *   - Server output is post-filtered for answer-letter leaks; here we
 *     reveal it character-by-character so it feels alive without the
 *     unpredictability of token streaming.
 *   - When the parent timer hits 0, or the student commits an answer,
 *     the chat locks visually so they can't pull more help mid-answer.
 *
 * Visual goals: warm, modern, alive. Soft gradients, gentle motion,
 * deliberate typography. No flashy shake effects or rainbow gradients.
 * ===================================================================== */

const MAX_USER_TURNS = 4;

export type CoachState = "closed" | "choosing" | "open" | "locked";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** When false, this assistant message is still typing in. */
  fullyRevealed?: boolean;
};

export function CoachChat({
  questionId,
  questionPrompt,
  state,
  onChooseTalk,
  onLock,
  onCoachUsed,
  secondsLeft,
  totalSeconds,
  coachApiPath = "/api/practice/coach",
  maxUserTurns = MAX_USER_TURNS,
}: {
  questionId: string;
  questionPrompt: string;
  state: CoachState;
  onChooseTalk: () => void;
  onLock: () => void;
  /** Called the first time the student exchanges a turn with the coach. */
  onCoachUsed?: () => void;
  /** Whole-question budget remaining (seconds), driven by parent. */
  secondsLeft: number;
  totalSeconds: number;
  coachApiPath?: string;
  maxUserTurns?: number;
}) {
  // ---- Solo path — slim reminder bar; answers below stay the default ----
  if (state === "closed") {
    return (
      <CoachClosedBar
        secondsLeft={secondsLeft}
        totalSeconds={totalSeconds}
        onChangeMyMind={onChooseTalk}
      />
    );
  }

  // ---- entry / "choose your path" ----
  if (state === "choosing") {
    return (
      <CoachEntry
        onTalk={onChooseTalk}
        secondsLeft={secondsLeft}
        totalSeconds={totalSeconds}
      />
    );
  }

  return (
    <CoachConversation
      key={questionId}
      questionId={questionId}
      questionPrompt={questionPrompt}
      onLock={onLock}
      onCoachUsed={onCoachUsed}
      secondsLeft={secondsLeft}
      totalSeconds={totalSeconds}
      locked={state === "locked"}
      coachApiPath={coachApiPath}
      maxUserTurns={maxUserTurns}
    />
  );
}

/* ===================================================================== */
/*  CLOSED BAR — slim, just to keep the timer visible                    */
/* ===================================================================== */

function CoachClosedBar({
  secondsLeft,
  totalSeconds,
  onChangeMyMind,
}: {
  secondsLeft: number;
  totalSeconds: number;
  onChangeMyMind: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-elevated/60 px-4 py-2.5"
    >
      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <Hand className="h-3.5 w-3.5 text-ink-muted" />
        Solo run — coach standing by.
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onChangeMyMind}
          className="text-[11px] text-ink-muted hover:text-primary inline-flex items-center gap-1"
        >
          <Sparkles className="h-3 w-3" /> Changed my mind
        </button>
        <TimerRing seconds={secondsLeft} total={totalSeconds} compact />
      </div>
    </motion.div>
  );
}

/* ===================================================================== */
/*  ENTRY — optional Socratic coach (answers below = solo)              */
/* ===================================================================== */

function CoachEntry({
  onTalk,
  secondsLeft,
  totalSeconds,
}: {
  onTalk: () => void;
  secondsLeft: number;
  totalSeconds: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="relative overflow-hidden rounded-3xl border border-border bg-surface p-5 md:p-6 shadow-soft"
    >
      <div
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 80% at 80% 0%, hsl(var(--primary) / 0.10), transparent 70%), radial-gradient(50% 70% at 0% 100%, hsl(var(--primary) / 0.06), transparent 70%)",
        }}
        aria-hidden
      />

      <div className="relative flex items-start gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <CoachAvatar pulse />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-ink">Your tutor is here</span>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                Practice only
              </Badge>
            </div>
            <p className="text-sm text-ink-muted mt-0.5">
              Tap answers below to choose (solo by default), then{" "}
              <span className="text-ink">Lock in answer</span> — or open the coach
              anytime for a Socratic walk-through.
            </p>
          </div>
        </div>
        <TimerRing seconds={secondsLeft} total={totalSeconds} compact />
      </div>

      <div className="relative mt-5">
        <ChoiceCard
          accent="primary"
          icon={<Sparkles className="h-4 w-4" />}
          eyebrow="Walk me through it"
          title="Let's talk it out"
          subtitle="Socratic — I won't give you the letter, just light the path."
          onClick={onTalk}
          highlight
          attentionSignal
        />
      </div>

      <p className="relative mt-4 text-[11px] text-ink-muted flex items-center gap-1.5">
        <Clock3 className="h-3 w-3" />
        Same {Math.round(totalSeconds / 60)}-minute clock either way. Coaching marks
        your attempt as <em>coached</em>, not solo mastered.
      </p>
    </motion.div>
  );
}

function ChoiceCard({
  accent,
  icon,
  eyebrow,
  title,
  subtitle,
  onClick,
  highlight,
  attentionSignal,
}: {
  accent: "primary" | "muted";
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  highlight?: boolean;
  /** Soft pulse so the coach path stays discoverable while answers are visible. */
  attentionSignal?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className={cn(
        "group relative w-full overflow-hidden text-left rounded-2xl border p-4 focus-ring",
        highlight
          ? "border-primary/40 bg-gradient-to-br from-primary-soft/60 via-primary-soft/20 to-surface shadow-soft"
          : "border-border bg-surface hover:bg-elevated",
        attentionSignal && "ring-2 ring-primary/40 ring-offset-2 ring-offset-surface",
      )}
    >
      {attentionSignal && (
        <span
          className="pointer-events-none absolute top-3 right-3 flex h-2.5 w-2.5"
          aria-hidden
        >
          <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
        </span>
      )}
      {highlight && (
        <span
          className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/15 blur-3xl"
          aria-hidden
        />
      )}
      <div className="relative flex items-start gap-3">
        <span
          className={cn(
            "h-9 w-9 rounded-xl grid place-items-center shrink-0",
            accent === "primary"
              ? "bg-primary text-primary-foreground shadow-soft"
              : "bg-muted text-ink-muted",
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-ink-muted">
            {eyebrow}
          </div>
          <div className="mt-0.5 font-semibold text-ink leading-tight">
            {title}
          </div>
          <p className="mt-1 text-xs text-ink-muted leading-snug">{subtitle}</p>
        </div>
        <ArrowRight
          className={cn(
            "h-4 w-4 self-center shrink-0 transition-transform",
            "group-hover:translate-x-0.5",
            accent === "primary" ? "text-primary" : "text-ink-muted",
          )}
        />
      </div>
    </motion.button>
  );
}

/* ===================================================================== */
/*  CONVERSATION                                                          */
/* ===================================================================== */

function CoachConversation({
  questionId,
  questionPrompt,
  onLock,
  onCoachUsed,
  secondsLeft,
  totalSeconds,
  locked,
  coachApiPath,
  maxUserTurns,
}: {
  questionId: string;
  questionPrompt: string;
  onLock: () => void;
  onCoachUsed?: () => void;
  secondsLeft: number;
  totalSeconds: number;
  locked: boolean;
  coachApiPath: string;
  maxUserTurns: number;
}) {
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "kickoff",
      role: "assistant",
      content:
        "I won't hand you the letter — but I'll walk with you. Tell me what you're thinking, or which two options feel close.",
      fullyRevealed: true,
    },
  ]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [remainingTurns, setRemainingTurns] = React.useState(maxUserTurns);
  const usedRef = React.useRef(false);

  const viewportRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    viewportRef.current?.scrollTo({
      top: viewportRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  const inputDisabled = locked || sending || remainingTurns <= 0;

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || inputDisabled) return;
    if (!usedRef.current) {
      usedRef.current = true;
      onCoachUsed?.();
    }

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const res = await fetch(coachApiPath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question_id: questionId,
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const json = await res.json();
      const reply: string =
        json?.reply ??
        "I'm thinking — re-read the prompt and tell me what jumps out.";
      const remaining: number =
        typeof json?.remaining_turns === "number"
          ? json.remaining_turns
          : Math.max(0, remainingTurns - 1);
      setRemainingTurns(remaining);

      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: reply,
        fullyRevealed: false,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e) {
      console.error("coach send", e);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-err-${Date.now()}`,
          role: "assistant",
          content:
            "I lost the thread — try once more. What's tipping you toward one option over the other?",
          fullyRevealed: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  // useCallback so AssistantBubble's effect deps don't change every parent
  // render (the parent re-renders 1×/sec because of the timer tick) — without
  // this, every typewriter restarts at 0 on every tick = infinite loop.
  const markRevealed = React.useCallback((id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, fullyRevealed: true } : m)),
    );
  }, []);

  const turnsUsed = maxUserTurns - remainingTurns;
  const turnsLow = remainingTurns <= 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-surface shadow-soft",
        locked ? "border-border opacity-90" : "border-primary/30",
      )}
    >
      {/* Ambient gradient backdrop */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(70% 60% at 90% 0%, hsl(var(--primary) / 0.12), transparent 70%), radial-gradient(50% 50% at 0% 100%, hsl(var(--primary) / 0.06), transparent 70%)",
        }}
        aria-hidden
      />

      {/* HEADER */}
      <div className="relative flex items-center justify-between gap-3 px-5 md:px-6 pt-5 pb-3 border-b border-border/60">
        <div className="flex items-center gap-3 min-w-0">
          <CoachAvatar pulse={!locked && sending} />
          <div className="min-w-0">
            <div className="font-semibold text-ink leading-tight flex items-center gap-2">
              Tutor
              {!locked && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  online
                </span>
              )}
            </div>
            <div className="text-[11px] text-ink-muted">
              Socratic — never reveals the letter
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <TurnDots used={turnsUsed} total={maxUserTurns} />
          <TimerRing seconds={secondsLeft} total={totalSeconds} compact />
        </div>
      </div>

      {/* CONVERSATION VIEWPORT */}
      <div
        ref={viewportRef}
        className="relative max-h-[22rem] min-h-[12rem] overflow-y-auto thin-scroll px-5 md:px-6 py-4 space-y-3"
      >
        <ContextChip prompt={questionPrompt} />
        <AnimatePresence initial={false}>
          {messages.map((m) =>
            m.role === "user" ? (
              <UserBubble key={m.id} text={m.content} />
            ) : (
              <AssistantBubble
                key={m.id}
                id={m.id}
                text={m.content}
                fullyRevealed={!!m.fullyRevealed}
                onDone={markRevealed}
              />
            ),
          )}
        </AnimatePresence>
        {sending && <TypingBubble />}
      </div>

      {/* INPUT / SUGGESTIONS */}
      <div className="relative border-t border-border/60 px-5 md:px-6 py-3 space-y-2.5">
        {!locked && remainingTurns > 0 && messages.length <= 2 && (
          <SuggestionChips
            onPick={(s) => send(s)}
            disabled={inputDisabled}
          />
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2"
        >
          <div
            className={cn(
              "relative flex-1 rounded-2xl border bg-elevated transition-all",
              !inputDisabled
                ? "border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15"
                : "border-border opacity-60",
              turnsLow && !locked && "border-warn/40",
            )}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={inputDisabled}
              placeholder={
                locked
                  ? "Chat locked — pick your letter."
                  : remainingTurns <= 0
                    ? "Out of turns — pick your letter."
                    : "Type what you're thinking…"
              }
              className="w-full bg-transparent px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted/70 focus:outline-none"
              autoFocus
            />
          </div>
          <VoiceInputButton
            disabled={inputDisabled}
            className="rounded-2xl"
            onAppendTranscript={(t) =>
              setInput((prev) => {
                const base = prev.trimEnd();
                return base ? `${base} ${t}` : t;
              })
            }
          />
          <Button
            type="submit"
            size="icon"
            disabled={inputDisabled || !input.trim()}
            className="rounded-2xl"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[11px] text-ink-muted flex items-center gap-1.5">
            {locked ? (
              <>
                <Lock className="h-3 w-3" /> Chat locked. Lock in your letter
                below.
              </>
            ) : remainingTurns <= 0 ? (
              <>
                <Lock className="h-3 w-3" /> Out of turns — commit your letter
                below.
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" />
                {remainingTurns} turn{remainingTurns === 1 ? "" : "s"} left ·
                I&apos;ll never tell you the letter.
              </>
            )}
          </div>
          <Button
            size="sm"
            variant={locked ? "outline" : "soft"}
            onClick={onLock}
            disabled={locked}
            className="rounded-2xl"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {locked ? "Coach closed" : "I'm ready — lock in"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/* ===================================================================== */
/*  Sub-components                                                        */
/* ===================================================================== */

function CoachAvatar({ pulse }: { pulse?: boolean }) {
  return (
    <div className="relative h-10 w-10 shrink-0">
      {pulse && (
        <span
          className="absolute inset-0 rounded-2xl bg-primary/30 animate-ping"
          aria-hidden
        />
      )}
      <div className="relative h-10 w-10 rounded-2xl bg-gradient-to-br from-primary to-primary/70 grid place-items-center shadow-soft">
        <GraduationCap className="h-5 w-5 text-primary-foreground" />
      </div>
      <span
        className={cn(
          "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface",
          pulse ? "bg-warn" : "bg-success",
        )}
      />
    </div>
  );
}

function TimerRing({
  seconds,
  total,
  compact,
}: {
  seconds: number;
  total: number;
  compact?: boolean;
}) {
  const size = compact ? 44 : 64;
  const stroke = compact ? 4 : 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, seconds / total));
  const dashOffset = c * (1 - pct);
  const tone =
    seconds <= 10
      ? "text-danger"
      : seconds <= 30
        ? "text-warn"
        : "text-primary";
  const m = Math.floor(seconds / 60);
  const s = Math.max(0, seconds % 60);
  const label = `${m}:${String(s).padStart(2, "0")}`;
  const pulse = seconds <= 10 && seconds > 0;

  return (
    <div
      className={cn(
        "relative shrink-0",
        pulse && "motion-safe:animate-pulse",
      )}
      style={{ width: size, height: size }}
      aria-label={`Time remaining ${label}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke="currentColor"
          strokeOpacity={0.12}
          className="text-ink"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke="currentColor"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dashOffset}
          className={cn("transition-[stroke-dashoffset,color] duration-500", tone)}
        />
      </svg>
      <div
        className={cn(
          "absolute inset-0 grid place-items-center text-[11px] font-semibold tabular-nums leading-none",
          tone,
        )}
      >
        {label}
      </div>
    </div>
  );
}

function TurnDots({ used, total }: { used: number; total: number }) {
  return (
    <div
      className="flex items-center gap-1"
      aria-label={`${used} of ${total} turns used`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-3 rounded-full transition-colors",
            i < used ? "bg-primary" : "bg-ink/15",
          )}
        />
      ))}
    </div>
  );
}

function ContextChip({ prompt }: { prompt: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-elevated/40 p-3 text-xs text-ink-muted">
      <span className="text-[10px] uppercase tracking-widest text-ink-muted/80">
        On the table
      </span>
      <p className="mt-1 text-ink line-clamp-3 leading-snug">{prompt}</p>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="flex justify-end"
    >
      <div className="max-w-[82%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-3.5 py-2.5 text-sm leading-relaxed shadow-soft whitespace-pre-wrap">
        {text}
      </div>
    </motion.div>
  );
}

function AssistantBubble({
  id,
  text,
  fullyRevealed,
  onDone,
}: {
  id: string;
  text: string;
  fullyRevealed: boolean;
  onDone: (id: string) => void;
}) {
  // Typewriter reveal — adds a deliberate, alive feel without depending on
  // streaming. Disabled when the message is already marked revealed (e.g.
  // the kickoff message or after a remount).
  const [shown, setShown] = React.useState(fullyRevealed ? text.length : 0);

  // Keep the latest onDone in a ref so we don't have to depend on it in the
  // effect. Otherwise every parent re-render (the timer ticks 1×/sec) would
  // reset the typewriter to 0 — infinite "starts over" loop.
  const onDoneRef = React.useRef(onDone);
  React.useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  React.useEffect(() => {
    if (fullyRevealed) {
      setShown(text.length);
      return;
    }
    setShown(0);
    let i = 0;
    // Speed: tuned so a 60-char reply takes ~1.2s — fast but readable.
    const step = Math.max(1, Math.round(text.length / 80));
    const interval = window.setInterval(() => {
      i = Math.min(text.length, i + step);
      setShown(i);
      if (i >= text.length) {
        window.clearInterval(interval);
        onDoneRef.current(id);
      }
    }, 18);
    return () => window.clearInterval(interval);
  }, [text, fullyRevealed, id]);

  const visible = text.slice(0, shown);
  const isTyping = shown < text.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex justify-start"
    >
      <div
        className={cn(
          "relative max-w-[85%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm leading-relaxed text-ink",
          "bg-elevated border border-border",
        )}
      >
        <span
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--primary) / 0.06), transparent 50%)",
          }}
          aria-hidden
        />
        <div className="relative min-w-0">
          <ChatMarkdown content={visible} />
        </div>
        {isTyping && (
          <span
            className="relative inline-block w-1 h-3.5 ml-0.5 align-middle bg-primary/70 motion-safe:animate-pulse"
            aria-hidden
          />
        )}
      </div>
    </motion.div>
  );
}

function TypingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      <div className="rounded-2xl rounded-bl-md bg-elevated border border-border px-3.5 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            initial={{ y: 0, opacity: 0.4 }}
            animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
            transition={{
              duration: 0.9,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
            className="block h-1.5 w-1.5 rounded-full bg-ink/50"
          />
        ))}
      </div>
    </motion.div>
  );
}

function SuggestionChips({
  onPick,
  disabled,
}: {
  onPick: (s: string) => void;
  disabled: boolean;
}) {
  const chips = [
    "I'm stuck between two — help me decide",
    "What's the key term here?",
    "Give me a tiny analogy",
  ];
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {chips.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onPick(c)}
          disabled={disabled}
          className={cn(
            "text-[11px] rounded-full border border-border bg-surface px-2.5 py-1",
            "text-ink-muted hover:text-ink hover:border-primary/40 hover:bg-elevated transition-colors",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
