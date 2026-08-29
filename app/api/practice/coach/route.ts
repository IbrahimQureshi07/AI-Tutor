import { NextResponse } from "next/server";
import { generateText } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  accessDeniedResponse,
  requireFreeAccess,
} from "@/lib/access/require-access";
import { getModel } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Socratic Coach Chat — Practice mode only.
 *
 * Hard contract:
 *  - Never reveals the correct option letter or copies the right option's text.
 *  - Cap of 4 student messages per question (server-enforced).
 *  - One short reply per turn (≤120 tokens, 2 sentences + question).
 *  - Output filter scrubs leaked answer references as belt-and-suspenders.
 *  - Used only inside the per-question 2-minute budget on the client.
 *
 * The endpoint is intentionally NOT streaming — we want the whole text in
 * hand so we can post-filter before the student ever sees it. The client
 * does a typewriter reveal so it still feels alive.
 */

const Message = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

const Body = z.object({
  question_id: z.string().uuid(),
  messages: z.array(Message).min(1).max(20),
});

const MAX_USER_TURNS = 4;

const SYSTEM = `You are a warm, patient SC real estate exam tutor running a SOCRATIC COACHING session.

ABSOLUTE RULES — VIOLATING ANY OF THESE IS A FAILURE:
1. NEVER reveal or hint at the correct option letter (A, B, C, or D).
2. NEVER quote or paraphrase the correct option's text.
3. NEVER use phrases like "the answer is", "correct option", "right choice", "go with", or similar.
4. NEVER eliminate options by name. Don't say "it's not B" or "rule out A".
5. If asked directly for the answer, say: "I won't hand you the letter — but tell me which two options you're stuck between and we'll narrow it together."

YOUR JOB:
- Ask the student what they're thinking BEFORE you teach.
- Mirror their reasoning back; find the flaw with one Socratic question.
- Use a tiny concrete analogy when something is abstract (one sentence max).
- Anchor every reply on the key term, rule, formula, or SC-specific qualifier the question hinges on.

STYLE:
- ≤2 short sentences, then ONE guiding question on its own line.
- Total under 80 words. No bullet points. No bold. Plain warm prose.
- Always end with a question the student can answer next turn.
- If the student commits to a letter in their reply, do NOT confirm or deny it. Instead: "Lock that in on the answer grid below — what made you land there?"

If this is the FIRST turn (no prior assistant message), open with:
- One short sentence acknowledging the topic, then ONE question asking what they're thinking or which two options feel close.`;

/** Patterns that would leak the correct option. Applied after generation. */
function buildLeakFilters(correctLetter: string, correctText: string) {
  // Match standalone letter mentions like "B.", "(B)", "option B", "answer is B".
  const letterRe = new RegExp(
    `\\b(option\\s+|answer\\s+is\\s+|choose\\s+|pick\\s+|go\\s+with\\s+|it'?s\\s+)?${correctLetter}\\b\\.?`,
    "gi",
  );
  // Match "the answer is X", "correct (option|answer) is X" etc, regardless of letter.
  const phraseRe =
    /\b(the\s+)?(answer|correct(\s+(answer|option|choice))?)\s+is\b[^.?!]*[.?!]/gi;
  // Match a verbatim copy of the correct option text (substring of ≥6 words).
  const words = correctText.split(/\s+/).filter(Boolean);
  const verbatim =
    words.length >= 6
      ? new RegExp(
          words.slice(0, Math.min(words.length, 12)).join("\\s+"),
          "gi",
        )
      : null;
  return { letterRe, phraseRe, verbatim };
}

function scrub(text: string, correctLetter: string, correctText: string) {
  const { letterRe, phraseRe, verbatim } = buildLeakFilters(
    correctLetter,
    correctText,
  );
  let out = text;
  if (verbatim) out = out.replace(verbatim, "[the right idea]");
  out = out.replace(letterRe, "that one");
  out = out.replace(
    phraseRe,
    "Let's keep narrowing — what's making one option feel stronger?",
  );
  // Collapse double spaces / orphan punctuation introduced by replacements.
  out = out.replace(/\s{2,}/g, " ").trim();
  return out;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const guard = await requireFreeAccess(supabase);
  if (!guard.ok) return accessDeniedResponse(guard);

  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const { question_id, messages } = parsed.data;

  // 4-turn cap, server-enforced. Last message must be the new user message.
  const userTurns = messages.filter((m) => m.role === "user").length;
  if (userTurns > MAX_USER_TURNS) {
    return NextResponse.json({
      reply:
        "We're out of turns — pick the letter you're leaning toward and tell yourself one reason why.",
      capped: true,
      remaining_turns: 0,
    });
  }

  const { data: q, error } = await supabase
    .from("questions")
    .select(
      "id, section_code, prompt, option_a, option_b, option_c, option_d, correct_option, hint, explanation",
    )
    .eq("id", question_id)
    .single();
  if (error || !q) {
    return NextResponse.json({ error: "question not found" }, { status: 404 });
  }

  const correctLetter = q.correct_option as "A" | "B" | "C" | "D";
  const correctText =
    (q as Record<string, string>)[`option_${correctLetter.toLowerCase()}`];

  // No-AI fallback: still useful, deterministic Socratic nudge.
  const hasAI =
    !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;
  if (!hasAI) {
    const last = messages[messages.length - 1]?.content ?? "";
    const reply = last
      ? "I hear you. Re-read the prompt and circle the qualifier — the option that matches every word of the question is the one to lock. Which two are you stuck between?"
      : "Tell me which two options feel close, and what's tipping you toward one over the other.";
    return NextResponse.json({
      reply,
      capped: false,
      remaining_turns: Math.max(0, MAX_USER_TURNS - userTurns),
    });
  }

  // System addendum so the model has the ground truth (used internally,
  // never exposed). The output filter is the safety net if it slips.
  const systemAddendum = `

CURRENT QUESTION (for your reference only — never reveal):
Section: ${q.section_code}
Prompt: ${q.prompt}
Options:
A) ${q.option_a}
B) ${q.option_b}
C) ${q.option_c}
D) ${q.option_d}
Correct: ${correctLetter}
${q.explanation ? `Why it's correct (tutor-only): ${q.explanation}` : ""}`;

  try {
    const { text } = await generateText({
      model: getModel(),
      system: SYSTEM + systemAddendum,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: 0.32,
      maxTokens: 180,
    });

    const safe = scrub(text, correctLetter, correctText);
    return NextResponse.json({
      reply: safe,
      capped: userTurns >= MAX_USER_TURNS,
      remaining_turns: Math.max(0, MAX_USER_TURNS - userTurns),
    });
  } catch (e) {
    console.error("coach AI error", e);
    return NextResponse.json({
      reply:
        "I'm having trouble thinking right now — slow down and underline the qualifier in the prompt. Which two options feel closest, and why?",
      capped: false,
      remaining_turns: Math.max(0, MAX_USER_TURNS - userTurns),
    });
  }
}
