import { streamText } from "ai";
import { getModel, SYSTEM_PROMPT } from "@/lib/ai/provider";
import { createClient } from "@/lib/supabase/server";
import {
  accessDeniedStreamResponse,
  requireFullAccess,
} from "@/lib/access/require-access";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const guard = await requireFullAccess(supabase);
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

  // If there is question context, prepend a structured system message so the
  // model always has the ground truth for that specific question.
  const systemAddendum = questionContext
    ? `\n\nCURRENT QUESTION CONTEXT (JSON):\n${JSON.stringify(
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
      )}\n\nUse this exact question when the student asks "this question".`
    : "";

  const result = streamText({
    model: getModel(),
    system: SYSTEM_PROMPT + systemAddendum,
    messages,
    temperature: 0.5,
    maxTokens: 900,
  });

  return result.toDataStreamResponse();
}
