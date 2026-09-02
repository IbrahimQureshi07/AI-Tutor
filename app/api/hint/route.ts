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

const Body = z.object({
  question_id: z.string().uuid(),
  wrong_answer: z.enum(["A", "B", "C", "D"]).nullable(),
});

const HINT_SYSTEM = `You are a South Carolina real estate salesperson exam tutor giving a SOCRATIC HINT.

ABSOLUTE RULES:
1. Never name or reveal the correct option letter (A/B/C/D) and never say which option is right.
2. Never copy the correct option's text word-for-word.
3. Do NOT give the answer away. Steer the student's thinking instead.

Style:
- Exactly 2 short sentences, then ONE short question on its own line. Total under 90 words.
- Plain, warm, exam-coach voice. No bullet lists.
- If a wrong answer was given, name the misconception pattern (not the correct letter).
- Anchor with the key term, rule, formula, or SC-specific distinction the question hinges on.
- Numeric-cutoff rule (mandatory): if the reasoning hinges on a numeric threshold (units, %, days, miles, etc.), explicitly name the cutoff and tell the student to find the option that crosses/violates it (e.g., "more than 4 units") without giving the letter.
- End with one guiding question that points at the reasoning step, not the answer.`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const guard = await requireFreeAccess(supabase);
  if (!guard.ok) return accessDeniedResponse(guard);

  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { data: q, error } = await supabase
    .from("questions")
    .select(
      "id, section_code, prompt, option_a, option_b, option_c, option_d, correct_option, hint, explanation",
    )
    .eq("id", parsed.data.question_id)
    .single();
  if (error || !q) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }

  // Fast path: AI not configured → use stored hint, or a generic nudge.
  const hasAI = !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;
  if (!hasAI) {
    return NextResponse.json({
      hint:
        q.hint?.trim() ||
        "Re-read the question carefully — focus on the exact verb (must, may, never) and any SC-specific qualifier. The trap is usually a near-synonym option.",
    });
  }

  const wrongLetter = parsed.data.wrong_answer;
  const wrongText = wrongLetter
    ? (q as Record<string, string>)[`option_${wrongLetter.toLowerCase()}`]
    : null;

  const userPrompt = [
    `Section: ${q.section_code}`,
    `Question: ${q.prompt}`,
    `Options:`,
    `A) ${q.option_a}`,
    `B) ${q.option_b}`,
    `C) ${q.option_c}`,
    `D) ${q.option_d}`,
    "",
    `Correct option (DO NOT reveal): ${q.correct_option}`,
    wrongText
      ? `Student picked: ${wrongLetter} ("${wrongText}"). Address why that one is tempting without telling them which is right.`
      : `Student is stuck and hasn't answered yet.`,
    q.explanation ? `Reference explanation (tutor only): ${q.explanation}` : "",
    "",
    "Write the hint now (2-3 sentences, end with a guiding question).",
  ].join("\n");

  try {
    const { text } = await generateText({
      model: getModel(),
      system: HINT_SYSTEM,
      prompt: userPrompt,
      temperature: 0.28,
      maxTokens: 160,
    });

    let hint = text.trim();
    // Belt-and-suspenders: never let the letter slip through.
    const letterRe = new RegExp(
      `\\b(option\\s*)?${q.correct_option}\\b\\.?`,
      "gi",
    );
    hint = hint.replace(letterRe, "the correct option");

    return NextResponse.json({ hint });
  } catch (e) {
    console.error("hint AI error", e);
    return NextResponse.json({
      hint:
        q.hint?.trim() ||
        "Slow down and underline the key qualifier in the prompt — the right answer matches every word of the question, not just most of them.",
    });
  }
}
