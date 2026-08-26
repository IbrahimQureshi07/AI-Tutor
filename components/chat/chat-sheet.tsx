"use client";

import * as React from "react";
import { useChat } from "ai/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Sparkles, Send, X, Loader2, BookOpen } from "lucide-react";
import type { ChatQuestionContext } from "./chat-sheet-provider";
import { ChatMarkdown } from "./chat-markdown";
import { VoiceInputButton } from "./voice-input-button";
import { motion, AnimatePresence } from "framer-motion";
import { formatSectionDisplayLabel } from "@/lib/sections/display-label";

/** Auto-sent when Ask AI opens with a question — guides without asking for a letter. */
const COACH_PROMPT =
  "Walk me through this question with a simple example. Help me reason toward the right idea — don't tell me the letter.";

export function ChatSheet({
  open,
  onOpenChange,
  questionContext,
  onClearContext,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  questionContext?: ChatQuestionContext;
  onClearContext: () => void;
}) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages,
    setInput,
    append,
  } = useChat({
    api: "/api/chat",
    body: { questionContext },
  });

  const viewportRef = React.useRef<HTMLDivElement>(null);
  const lastSeededIdRef = React.useRef<string | null>(null);
  const autoSentIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    viewportRef.current?.scrollTo({ top: 999999, behavior: "smooth" });
  }, [messages, isLoading]);

  // New question context → reset thread and show the coaching prompt in the input.
  React.useEffect(() => {
    if (!open || !questionContext) return;
    if (lastSeededIdRef.current === questionContext.id) return;
    lastSeededIdRef.current = questionContext.id;
    autoSentIdRef.current = null;
    setMessages([]);
    setInput(COACH_PROMPT);
  }, [open, questionContext, setMessages, setInput]);

  // Auto-send the coaching prompt — student does not need to press Send.
  // Wait until the reset above has cleared the thread (messages.length === 0)
  // so a question switch never skips seeding because old messages linger.
  React.useEffect(() => {
    if (!open || !questionContext) return;
    if (lastSeededIdRef.current !== questionContext.id) return;
    if (autoSentIdRef.current === questionContext.id) return;
    if (messages.length > 0) return;
    autoSentIdRef.current = questionContext.id;
    void append({ role: "user", content: COACH_PROMPT }).then(() => {
      setInput("");
    });
  }, [open, questionContext, messages.length, append, setInput]);

  function handleNewChat() {
    lastSeededIdRef.current = null;
    autoSentIdRef.current = null;
    setMessages([]);
    onClearContext();
    setInput("");
  }

  const suggested = [
    "What's the difference between a designated agent and a dual agent in SC?",
    "Quiz me on amortization — easy, medium, then hard.",
    "Explain riparian vs. littoral rights with an example.",
    "What must appear on a SC closing disclosure?",
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="p-0 flex flex-col">
        <SheetHeader className="flex flex-row items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/15 grid place-items-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <SheetTitle>AI Tutor</SheetTitle>
              <SheetDescription>
                Ask anything about the SC real estate exam.
              </SheetDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleNewChat}>
            New chat
          </Button>
        </SheetHeader>

        {questionContext && (
          <div className="px-6 pt-4">
            <div className="rounded-xl border border-border bg-elevated p-3 text-xs">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <Badge variant="outline" className="gap-1 text-left whitespace-normal font-normal leading-snug">
                  <BookOpen className="h-3 w-3 shrink-0" />
                  {formatSectionDisplayLabel(questionContext.section_code)}
                </Badge>
                <button
                  className="text-ink-muted hover:text-ink"
                  onClick={onClearContext}
                  aria-label="Remove context"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-ink line-clamp-3">{questionContext.prompt}</p>
              {questionContext.user_answer ? (
                <div className="mt-2 text-ink-muted">
                  Your answer:{" "}
                  <b className="text-ink">{questionContext.user_answer}</b>
                </div>
              ) : null}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          <div
            ref={viewportRef}
            className="px-6 py-5 space-y-4 thin-scroll overflow-y-auto h-full"
          >
            {messages.length === 0 && !questionContext && (
              <div className="space-y-3">
                <p className="text-sm text-ink-muted">Try asking:</p>
                <div className="space-y-2">
                  {suggested.map((s) => (
                    <button
                      key={s}
                      className="w-full text-left rounded-xl border border-border bg-surface p-3 text-sm hover:bg-elevated transition-colors"
                      onClick={() => setInput(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "flex",
                    m.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      m.role === "user"
                        ? "whitespace-pre-wrap bg-primary text-primary-foreground"
                        : "bg-elevated border border-border text-ink",
                    )}
                  >
                    {m.role === "user" ? (
                      m.content
                    ) : (
                      <ChatMarkdown content={m.content} />
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (
              <div className="flex items-center gap-2 text-ink-muted text-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Thinking…
              </div>
            )}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-border p-4 flex items-center gap-2"
        >
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about a concept, a question, or request a quiz…"
            className="flex-1"
            autoFocus
          />
          <VoiceInputButton
            disabled={isLoading}
            onAppendTranscript={(t) =>
              setInput((prev) => {
                const base = prev.trimEnd();
                return base ? `${base} ${t}` : t;
              })
            }
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
