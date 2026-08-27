"use client";

import * as React from "react";
import { useChat } from "ai/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatMarkdown } from "@/components/chat/chat-markdown";
import { VoiceInputButton } from "@/components/chat/voice-input-button";
import { motion, AnimatePresence } from "framer-motion";
import { BRAND } from "@/lib/brand";
import { BrandLogo } from "@/components/brand/brand-logo";

const SEEDS = [
  "What's the difference between a dual agent and a designated agent in SC?",
  "Explain the SC License Law trust account rules.",
  "Give me 5 hard practice questions on Financing (A4).",
  "Quiz me on Property Ownership, easy → medium → hard.",
  "What must appear on a SC purchase agreement?",
  "Explain the Due-on-Sale clause like I'm five.",
];

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } =
    useChat({ api: "/api/chat" });

  const bottomRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2.5 text-sm text-ink-muted">
          <BrandLogo href={null} size="sm" showName={false} />
          <span>
            {BRAND.shortName} {BRAND.productName}
          </span>
          <Badge variant="outline">Chat</Badge>
        </div>
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">
          Ask anything. Anytime.
        </h1>
        <p className="mt-1 text-ink-muted max-w-xl">
          Your 24/7 tutor from {BRAND.shortName}. Ask about concepts, request a
          practice drill, or get deeper explanations of any question you have
          attempted.
        </p>
      </div>

      {messages.length === 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {SEEDS.map((s) => (
            <button
              key={s}
              className="text-left rounded-2xl border border-border bg-surface p-4 hover:bg-elevated transition-colors"
              onClick={() => setInput(s)}
            >
              <span className="text-sm text-ink">{s}</span>
            </button>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="pt-6 space-y-4 min-h-[320px]">
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed",
                    m.role === "user"
                      ? "whitespace-pre-wrap bg-primary text-primary-foreground"
                      : "bg-elevated border border-border text-ink",
                  )}
                >
                  {m.role === "user" ? (
                    m.content
                  ) : (
                    <ChatMarkdown content={m.content} className="text-[15px]" />
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
          <div ref={bottomRef} />
        </CardContent>
      </Card>

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-4 flex items-center gap-2 bg-surface rounded-full border border-border shadow-soft p-1.5 pl-4 pr-1.5"
      >
        <Input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask about a concept, a question, or request a quiz…"
          className="flex-1 bg-transparent border-0 focus-visible:ring-0 h-10 shadow-none"
        />
        <VoiceInputButton
          disabled={isLoading}
          className="rounded-full"
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
    </div>
  );
}
