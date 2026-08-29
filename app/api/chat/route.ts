import { streamText } from "ai";
import { getModel, SYSTEM_PROMPT } from "@/lib/ai/provider";
import { createClient } from "@/lib/supabase/server";
import {
  accessDeniedStreamResponse,
  requireFreeAccess,
} from "@/lib/access/require-access";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Socratic coaching when Ask AI opens on a specific question. */
const QUESTION_COACH_ADDENDUM = `
YOU ARE IN GUIDED-COACHING MODE for the CURRENT QUESTION below.
These rules OVERRIDE the general guideline about telling the student whether they are right or wrong.

ABSOLUTE RULES — violating any is a failure:
1. NEVER reveal or hint at the correct option letter (A, B, C, or D).
2. NEVER say "the answer is…", "correct option is…", "go with…", or "pick…".
3. NEVER quote or paraphrase the correct option's text as the right answer.
4. NEVER eliminate options by letter ("it's not B", "rule out A").
5. Do NOT say they are right or wrong by letter. Discuss the underlying rule instead.
6. If asked directly for the letter, reply: "I won't hand you the letter — let's narrow it with the concept and an example."

YOUR JOB:
- Teach the key concept / SC rule / qualifier the question hinges on.
- Give one concrete, memorable example (SC-flavored when natural).
- Help the student spot distractors by reasoning — without naming which letter is correct.
- End with a short guiding question that pushes them to choose on their own.

STYLE:
- Clear structure is fine (short bullets, bold key terms).
- Warm and precise. Prefer depth that helps them decide over one-liners.
- Plain text for all numbers and math — NO LaTeX. Write $339,000 - $285,000 = $54,000. Never use {,}, \\div, \\approx, \\[, \\], $$, or wrap formulas in [ ... ].
- Use the JSON below ONLY as private ground truth so your teaching is accurate — never echo the "correct" field.
`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const guard = await requireFreeAccess(supabase);
  if (!guard.ok) return accessDeniedStreamResponse(guard);

  const body = await req.json();
  const { messages, questionContext } = body as {
    messages: { role: "user" | "assistant" | "system"; content: string }[];
    questionContext?: {
      id: string;
      section_code: string;
      prompt: string;
      option_a: string;
      option_b: string;
      option_c: string;
      option_d: string;
      correct_option: string;
      hint?: string | null;
      explanation?: string | null;
      user_answer?: string | null;
    };
  };

  // Ground truth is for the model only — coaching addendum forbids revealing letters.
  const systemAddendum = questionContext
    ? `${QUESTION_COACH_ADDENDUM}\n\nCURRENT QUESTION CONTEXT (tutor-only JSON):\n${JSON.stringify(
        {
          section: questionContext.section_code,
          question: questionContext.prompt,
          options: {
            A: questionContext.option_a,
            B: questionContext.option_b,
            C: questionContext.option_c,
            D: questionContext.option_d,
          },
          correct: questionContext.correct_option,
          user_answer: questionContext.user_answer ?? null,
          hint: questionContext.hint ?? null,
          explanation: questionContext.explanation ?? null,
        },
        null,
        2,
      )}`
    : "";

  const result = streamText({
    model: getModel(),
    system: SYSTEM_PROMPT + systemAddendum,
    messages,
    temperature: questionContext ? 0.4 : 0.5,
    maxTokens: 900,
  });

  return result.toDataStreamResponse();
}
