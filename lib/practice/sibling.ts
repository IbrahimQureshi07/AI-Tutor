import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai/provider";
import { createAdminClient } from "@/lib/supabase/admin";
import type { QuestionRow } from "@/lib/supabase/types";
import { shuffle } from "@/lib/utils";
import {
  rejectBlockedQuestions,
  withBlockedExcluded,
} from "@/lib/questions/blocked-ids";

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
   national concepts for A-series).
6. Exactly ONE option must be unambiguously correct. The other three must be
   clearly wrong. The explanation must prove the letter you mark — every
   figure, party, and outcome you defend in the explanation MUST appear in
   options[correct_option], never only in a distractor.
7. If any option is "All of the above" / "All of these" / similar, and every
   other option is individually valid, that inclusive option MUST be correct.
8. Never name a letter other than correct_option as the right answer.`;

const SIBLING_SYSTEM_SAME = `${SIBLING_SYSTEM_BASE}
9. Keep the cognitive level honest to the requested difficulty (do not get easier).`;

const SIBLING_SYSTEM_HARDER = `${SIBLING_SYSTEM_BASE}
9. Make the question MEANINGFULLY HARDER than the original:
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
  explanation: z.string().min(1).max(1200),
});

const LETTERS = ["A", "B", "C", "D"] as const;

const MONEY_RE = /\$[\d,]+(?:\.\d{1,2})?/g;
const NUMBER_RE = /\b\d[\d,]*(?:\.\d+)?\b/g;

function normalizeMoney(raw: string): string {
  return raw.replace(/[$,]/g, "").replace(/\.00$/, "");
}

function extractMoneys(text: string): string[] {
  return (text.match(MONEY_RE) ?? []).map(normalizeMoney);
}

function extractNumbers(text: string): string[] {
  return (text.match(NUMBER_RE) ?? []).map((n) => n.replace(/,/g, ""));
}

/**
 * Reject siblings where correct_option disagrees with the explanation
 * (e.g. key says D/$300 credit while explanation defends $200 credit).
 */
export function siblingKeyMatchesExplanation(
  parsed: z.infer<typeof Schema>,
): boolean {
  const letter = parsed.correct_option;
  const explanation = parsed.explanation.trim();
  if (!explanation) return false;

  const explLower = explanation.toLowerCase();

  // Explicit wrong-letter claims in the explanation.
  for (const L of LETTERS) {
    if (L === letter) continue;
    const wrongLetterClaim =
      new RegExp(
        String.raw`(?:correct(?:\s+answer)?|answer|right\s+(?:choice|option)|key)\s*(?:is|:)\s*(?:option\s*)?${L}\b`,
        "i",
      ).test(explanation) ||
      new RegExp(
        String.raw`(?:option\s*)?${L}\s+is\s+(?:the\s+)?(?:correct|right|answer)`,
        "i",
      ).test(explanation) ||
      new RegExp(
        String.raw`why\s+(?:option\s*)?${L}\s+is\s+correct`,
        "i",
      ).test(explanation);
    if (wrongLetterClaim) return false;
  }

  const correctText = parsed.options[letter];
  const correctMoneys = new Set(extractMoneys(correctText));
  const explMoneys = extractMoneys(explanation);
  const explMoneySet = new Set(explMoneys);

  // Amounts exclusive to the keyed option must appear in the explanation
  // when the explanation itself cites money (classic settlement / proration bugs).
  const exclusiveCorrect = [...correctMoneys].filter((m) => {
    for (const L of LETTERS) {
      if (L === letter) continue;
      if (extractMoneys(parsed.options[L]).includes(m)) return false;
    }
    return true;
  });

  if (explMoneys.length > 0 && exclusiveCorrect.length > 0) {
    const mentionsExclusive = exclusiveCorrect.some((m) => explMoneySet.has(m));
    if (!mentionsExclusive) return false;
  }

  // Explanation cites a dollar amount that only exists on a wrong option.
  // Fail unless it also cites at least one amount exclusive to the keyed option.
  for (const L of LETTERS) {
    if (L === letter) continue;
    const exclusiveWrong = extractMoneys(parsed.options[L]).filter(
      (m) => !correctMoneys.has(m),
    );
    const citesWrongOnly = exclusiveWrong.some((m) => explMoneySet.has(m));
    if (!citesWrongOnly) continue;
    if (
      exclusiveCorrect.length === 0 ||
      !exclusiveCorrect.some((m) => explMoneySet.has(m))
    ) {
      return false;
    }
  }

  // Plain numeric exclusivity when options differ by bare numbers (no $).
  if (explMoneys.length === 0) {
    const correctNums = new Set(extractNumbers(correctText));
    const explNums = new Set(extractNumbers(explanation));
    const exclusiveCorrectNums = [...correctNums].filter((n) => {
      for (const L of LETTERS) {
        if (L === letter) continue;
        if (extractNumbers(parsed.options[L]).includes(n)) return false;
      }
      return true;
    });
    if (exclusiveCorrectNums.length > 0 && explNums.size > 0) {
      if (!exclusiveCorrectNums.some((n) => explNums.has(n))) return false;
    }
  }

  // Substantial unique phrase from a wrong option appears in the explanation
  // while the correct option's distinctive phrase does not.
  const correctNorm = correctText.toLowerCase().replace(/\s+/g, " ").trim();
  for (const L of LETTERS) {
    if (L === letter) continue;
    const wrongNorm = parsed.options[L]
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    if (wrongNorm.length < 24) continue;
    // Prefer a mid-length distinctive slice so tiny shared prefixes don't false-positive.
    const slice =
      wrongNorm.length > 48 ? wrongNorm.slice(8, 48) : wrongNorm.slice(0, 28);
    if (slice.length < 20) continue;
    if (!explLower.includes(slice)) continue;
    const correctSlice =
      correctNorm.length > 48
        ? correctNorm.slice(8, 48)
        : correctNorm.slice(0, 28);
    if (correctSlice.length >= 20 && explLower.includes(correctSlice)) continue;
    return false;
  }

  return true;
}

type SiblingParsed = z.infer<typeof Schema>;

async function requestSiblingDraft({
  parent,
  targetDifficulty,
  targetLevel,
  repairNote,
}: {
  parent: QuestionRow;
  targetDifficulty: SiblingDifficulty;
  targetLevel: "easy" | "medium" | "hard";
  repairNote?: string;
}): Promise<SiblingParsed> {
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
    repairNote
      ? `CRITICAL REPAIR: ${repairNote} Re-emit a full JSON object. correct_option MUST match the option your explanation defends (same figures / outcome).`
      : targetDifficulty === "harder"
        ? "Write ONE fresh question on the SAME concept that is meaningfully harder than the original. Four plausible options. JSON only."
        : "Write ONE fresh question on the SAME concept at the SAME difficulty. Four plausible options. JSON only.",
  ]
    .filter(Boolean)
    .join("\n");

  const { text } = await generateText({
    model: getModel(),
    system:
      targetDifficulty === "harder"
        ? SIBLING_SYSTEM_HARDER
        : SIBLING_SYSTEM_SAME,
    prompt: userPrompt,
    // Slightly cooler than before — reduces key/explanation drift.
    temperature: targetDifficulty === "harder" ? 0.5 : 0.4,
    maxTokens: 700,
  });

  return Schema.parse(extractJson(text));
}

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
  const blockedOut = withBlockedExcluded(excludeIds);

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

  let pool = rejectBlockedQuestions(sameConcept as QuestionRow[]);
  pool = pool.filter((q) => !blockedOut.has(q.id));

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
    pool = rejectBlockedQuestions(sameLevel as QuestionRow[]).filter(
      (q) => !blockedOut.has(q.id),
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
    pool = rejectBlockedQuestions(sameSection as QuestionRow[]).filter(
      (q) => !blockedOut.has(q.id),
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
    try {
      let parsed: SiblingParsed | null = null;
      let repairNote: string | undefined;

      for (let attempt = 0; attempt < 2; attempt++) {
        const draft = await requestSiblingDraft({
          parent,
          targetDifficulty,
          targetLevel,
          repairNote,
        });

        if (siblingKeyMatchesExplanation(draft)) {
          parsed = draft;
          break;
        }

        console.warn(
          "sibling key/explanation mismatch; regenerating once",
          {
            correct_option: draft.correct_option,
            explanation: draft.explanation.slice(0, 160),
          },
        );
        repairNote =
          `Previous draft keyed ${draft.correct_option} but the explanation defended a different option/figures. ` +
          `Set correct_option to the letter whose option text your explanation proves, or rewrite the explanation to match ${draft.correct_option}.`;
      }

      if (!parsed) {
        throw new Error(
          "sibling rejected: correct_option does not match explanation after retry",
        );
      }

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
        explanation: parsed.explanation.trim(),
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
