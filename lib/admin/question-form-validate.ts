import { SECTIONS, type SectionCode } from "@/lib/constants";

const VALID_SECTIONS = new Set<string>(SECTIONS.map((s) => s.code));
const VALID_LEVELS = new Set(["easy", "medium", "hard"]);
const VALID_CORRECT = new Set(["A", "B", "C", "D"]);

export type QuestionFormInput = {
  section_code: string;
  concept_id?: string | null;
  level: string;
  prompt: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation?: string | null;
};

export type ValidatedQuestionForm = {
  section_code: SectionCode;
  concept_id: string | null;
  level: "easy" | "medium" | "hard";
  prompt: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "A" | "B" | "C" | "D";
  explanation: string | null;
};

function trim(v: string | null | undefined): string {
  return (v ?? "").trim();
}

/**
 * Validates a single admin question (manual form or CSV row).
 * Returns trimmed payload on success, or a list of human-readable errors.
 */
export function validateQuestionForm(
  input: QuestionFormInput,
): { ok: true; data: ValidatedQuestionForm } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  const section_code = trim(input.section_code).toUpperCase();
  const level = trim(input.level).toLowerCase();
  const prompt = trim(input.prompt);
  const option_a = trim(input.option_a);
  const option_b = trim(input.option_b);
  const option_c = trim(input.option_c);
  const option_d = trim(input.option_d);
  const correct_option = trim(input.correct_option).toUpperCase();
  const concept_id = trim(input.concept_id) || null;
  const explanation = trim(input.explanation) || null;

  if (!section_code) {
    errors.push("Select a topic / section.");
  } else if (!VALID_SECTIONS.has(section_code)) {
    errors.push("Section must be one of A1–A6 or B1–B6.");
  }

  if (!VALID_LEVELS.has(level)) {
    errors.push("Difficulty must be easy, medium, or hard.");
  }

  if (!prompt) {
    errors.push("Question text is required.");
  } else if (prompt.length < 8) {
    errors.push("Question text is too short (min 8 characters).");
  }

  if (!option_a) errors.push("Option A cannot be blank.");
  if (!option_b) errors.push("Option B cannot be blank.");
  if (!option_c) errors.push("Option C cannot be blank.");
  if (!option_d) errors.push("Option D cannot be blank.");

  if (!VALID_CORRECT.has(correct_option)) {
    errors.push("Correct option must be A, B, C, or D.");
  }

  if (concept_id && section_code && !concept_id.toUpperCase().startsWith(`${section_code}.`)) {
    errors.push(
      `Concept ID should start with the section code (e.g. ${section_code}.topic_name).`,
    );
  }

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    data: {
      section_code: section_code as SectionCode,
      concept_id,
      level: level as "easy" | "medium" | "hard",
      prompt,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option: correct_option as "A" | "B" | "C" | "D",
      explanation,
    },
  };
}
