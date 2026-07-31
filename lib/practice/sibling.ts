import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai/provider";
import { createAdminClient } from "@/lib/supabase/admin";
import type { QuestionRow } from "@/lib/supabase/types";
import { shuffle } from "@/lib/utils";

const SIBLING_SYSTEM_BASE = `You are an expert South Carolina real estate exam writer.
The student just missed a question on a specific concept. Write ONE new
multiple-choice question that tests the SAME concept so they get a genuine
"second bite" without seeing the same question again.

STRICT RULES:
1. Output VALID JSON only. No prose, no markdown fences, no commentary.
2. Shape:
   {
     "prompt": "<one exam-style question, <= 260 chars>",
     "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
     "correct_option": "A" | "B" | "C" | "D",
     "hint": "<one short socratic nudge, <= 140 chars, never reveals the letter>",
     "explanation": "<1-3 sentences, explain why the correct option is right>"
   }
3. Do NOT reuse the source question's prompt wording or answer text.
4. Distractors must be plausible common misconceptions, not obvious throwaways.
5. Stay within South Carolina salesperson exam scope (SC License Law for B-series;
   national concepts for A-series).`;

const SIBLING_SYSTEM_SAME = `${SIBLING_SYSTEM_BASE}
6. Keep the cognitive level honest to the requested difficulty (do not get easier).`;

const SIBLING_SYSTEM_HARDER = `${SIBLING_SYSTEM_BASE}
6. Make the question MEANINGFULLY HARDER than the original:
   - more nuanced phrasing, multi-step reasoning, or stricter qualifier;
   - distractors that mirror the exact trap the student just fell into;
   - never trivial vocabulary trade.`;

const Schema = z.object({
  prompt: z.string().min(8).max(600),
  options: z.object({
    A: z.string().min(1),
    B: z.string().min(1),
    C: z.string().min(1),
    D: z.string().min(1),
  }),
  correct_option: z.enum(["A", "B", "C", "D"]),
  hint: z.string().min(1).max(400).optional().nullable(),
  explanation: z.string().min(1).max(1200).optional().nullable(),
});

export type SiblingDifficulty = "same" | "harder";

export type SiblingResult = {
  question: QuestionRow;
  source: "ai" | "bank";
  difficulty: SiblingDifficulty;
};

/** Bump a level by one notch when "harder" is requested. */
function bumpLevel(level: "easy" | "medium" | "hard"): "easy" | "medium" | "hard" {
  if (level === "easy") return "medium";
  if (level === "medium") return "hard";
  return "hard";
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("sibling model did not return JSON");
  }
}

async function pickBankSibling(
  supabase: SupabaseClient,
  parent: QuestionRow,
  excludeIds: Set<string>,
  targetLevel: "easy" | "medium" | "hard",
): Promise<QuestionRow | null> {
  const { data: sameConcept } = await supabase
    .from("questions")
    .select("*")
    .eq("section_code", parent.section_code)
    .eq("pool", "standard")
    .eq("level", targetLevel)
    .eq("concept_id", parent.concept_id ?? "")
    .neq("id", parent.id)
    .eq("is_ai_generated", false)
    .limit(50);

  let pool = (sameConcept ?? []) as QuestionRow[];
  pool = pool.filter((q) => !excludeIds.has(q.id));

  if (pool.length === 0) {
    const { data: sameLevel } = await supabase
      .from("questions")
      .select("*")
      .eq("section_code", parent.section_code)
      .eq("pool", "standard")
      .eq("level", targetLevel)
      .neq("id", parent.id)
      .eq("is_ai_generated", false)
      .limit(60);
    pool = ((sameLevel ?? []) as QuestionRow[]).filter(
      (q) => !excludeIds.has(q.id),
    );
  }

  if (pool.length === 0) {
    const { data: sameSection } = await supabase
      .from("questions")
      .select("*")
      .eq("section_code", parent.section_code)
      .eq("pool", "standard")
      .neq("id", parent.id)
      .eq("is_ai_generated", false)
      .limit(60);
    pool = ((sameSection ?? []) as QuestionRow[]).filter(
      (q) => !excludeIds.has(q.id),
    );
  }

  return shuffle(pool)[0] ?? null;
}

export async function generateSiblingQuestion({
  supabase,
  parent,
  excludeIds,
  targetDifficulty = "same",
}: {
  supabase: SupabaseClient;
  parent: QuestionRow;
  excludeIds: Set<string>;
  targetDifficulty?: SiblingDifficulty;
}): Promise<SiblingResult> {
  const hasAI =
    !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;

  const targetLevel =
    targetDifficulty === "harder" ? bumpLevel(parent.level) : parent.level;

  if (hasAI) {
    const difficultyLine =
      targetDifficulty === "harder"
        ? `Target difficulty: ${targetLevel} (HARDER than the original "${parent.level}").`
        : `Target difficulty: ${targetLevel} (same as the original).`;

    const userPrompt = [
      `Section: ${parent.section_code}`,
      parent.concept_id ? `Concept: ${parent.concept_id}` : null,
      difficultyLine,
      "",
      `Original question (student JUST missed this — do not repeat):`,
      `"${parent.prompt}"`,
      "",
      `Original correct answer: ${parent.correct_option}. ${
        (parent as unknown as Record<string, string>)[
          `option_${parent.correct_option.toLowerCase()}`
        ]
      }`,
      parent.explanation ? `Reference explanation: ${parent.explanation}` : "",
      "",
      targetDifficulty === "harder"
        ? "Write ONE fresh question on the SAME concept that is meaningfully harder than the original. Four plausible options. JSON only."
        : "Write ONE fresh question on the SAME concept at the SAME difficulty. Four plausible options. JSON only.",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const { text } = await generateText({
        model: getModel(),
        system:
          targetDifficulty === "harder"
            ? SIBLING_SYSTEM_HARDER
            : SIBLING_SYSTEM_SAME,
        prompt: userPrompt,
        temperature: targetDifficulty === "harder" ? 0.65 : 0.55,
        maxTokens: 700,
      });

      const parsed = Schema.parse(extractJson(text));

      const insertRow = {
        section_code: parent.section_code,
        topic_id: parent.topic_id,
        concept_id: parent.concept_id,
        level: targetLevel,
        prompt: parsed.prompt.trim(),
        option_a: parsed.options.A.trim(),
        option_b: parsed.options.B.trim(),
        option_c: parsed.options.C.trim(),
        option_d: parsed.options.D.trim(),
        correct_option: parsed.correct_option,
        hint: parsed.hint?.trim() ?? null,
        explanation: parsed.explanation?.trim() ?? null,
        source: targetDifficulty === "harder" ? "ai_sibling_harder" : "ai_sibling",
        pool: "standard",
        parent_question_id: parent.id,
        is_ai_generated: true,
      };

      // Insert bypasses RLS: learners only have SELECT on `questions`; AI siblings
      // are server-generated and persisted with the service role (same pattern as import).
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("questions")
        .insert(insertRow)
        .select("*")
        .single();

      if (!error && data) {
        return {
          question: data as QuestionRow,
          source: "ai",
          difficulty: targetDifficulty,
        };
      }
      console.error("sibling insert failed, falling back to bank:", error);
    } catch (e) {
      console.error("sibling AI failed, falling back to bank:", e);
    }
  }

  const bank = await pickBankSibling(supabase, parent, excludeIds, targetLevel);
  if (bank) {
    return { question: bank, source: "bank", difficulty: targetDifficulty };
  }

  throw new Error("no sibling available (AI failed and bank is empty).");
}
