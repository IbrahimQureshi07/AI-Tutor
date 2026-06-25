import { generateText } from "ai";
import { getModel } from "@/lib/ai/provider";

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

STYLE:
- ≤2 short sentences, then ONE guiding question on its own line.
- Total under 80 words. No bullet points. Plain warm prose.
- Always end with a question the student can answer next turn.`;

function buildLeakFilters(correctLetter: string, correctText: string) {
  const letterRe = new RegExp(
    `\\b(option\\s+|answer\\s+is\\s+|choose\\s+|pick\\s+|go\\s+with\\s+|it'?s\\s+)?${correctLetter}\\b\\.?`,
    "gi",
  );
  const phraseRe =
    /\b(the\s+)?(answer|correct(\s+(answer|option|choice))?)\s+is\b[^.?!]*[.?!]/gi;
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
  return out.replace(/\s{2,}/g, " ").trim();
}

type CoachMessage = { role: "user" | "assistant"; content: string };

type QuestionForCoach = {
  section_code: string;
  prompt: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation: string | null;
};

export async function generateDemoCoachReply(
  q: QuestionForCoach,
  messages: CoachMessage[],
  maxTurns: number,
): Promise<{ reply: string; capped: boolean; remaining_turns: number }> {
  const userTurns = messages.filter((m) => m.role === "user").length;
  if (userTurns > maxTurns) {
    return {
      reply:
        "We're out of turns — pick the letter you're leaning toward and tell yourself one reason why.",
      capped: true,
      remaining_turns: 0,
    };
  }

  const correctLetter = q.correct_option as "A" | "B" | "C" | "D";
  const correctText =
    (q as Record<string, string>)[`option_${correctLetter.toLowerCase()}`];

  const hasAI =
    !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;
  if (!hasAI) {
    const last = messages[messages.length - 1]?.content ?? "";
    return {
      reply: last
        ? "I hear you. Re-read the prompt and circle the qualifier — which two options feel closest?"
        : "Tell me which two options feel close, and what's tipping you toward one over the other.",
      capped: false,
      remaining_turns: Math.max(0, maxTurns - userTurns),
    };
  }

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
    return {
      reply: scrub(text, correctLetter, correctText),
      capped: userTurns >= maxTurns,
      remaining_turns: Math.max(0, maxTurns - userTurns),
    };
  } catch (e) {
    console.error("demo coach AI error", e);
    return {
      reply:
        "Slow down and underline the qualifier in the prompt. Which two options feel closest, and why?",
      capped: false,
      remaining_turns: Math.max(0, maxTurns - userTurns),
    };
  }
}
