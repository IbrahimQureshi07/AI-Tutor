/**
 * Client-facing CSV format for bulk question upload.
 * Headers are row 1 only — each following row is one question.
 * System fills: id, pool=standard, source=csv_import, hint=null.
 */
export const QUESTION_CSV_HEADERS = [
  "section",
  "concept",
  "level",
  "question",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct",
  "explanation",
] as const;

export type QuestionCsvHeader = (typeof QUESTION_CSV_HEADERS)[number];

/** One example row so the client sees the expected shape. */
const EXAMPLE_ROW: Record<QuestionCsvHeader, string> = {
  section: "A1",
  concept: "A1.forms_of_ownership_jt_tic_tbe",
  level: "medium",
  question: "Unlike tenants in common, joint tenants",
  option_a: "own distinct portions of the physical property",
  option_b: "cannot will their interest to a party outside the tenancy",
  option_c: "may own unequal shares of the property",
  option_d: "cannot sell their interest to outside parties",
  correct: "B",
  explanation:
    "Joint tenancy includes survivorship — interests pass without probate, but joint tenants cannot will their share outside the tenancy.",
};

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Empty template: header + 1 example row (client replaces/adds data rows). */
export function buildQuestionCsvTemplate(): string {
  const header = QUESTION_CSV_HEADERS.join(",");
  const example = QUESTION_CSV_HEADERS.map((h) =>
    csvEscape(EXAMPLE_ROW[h]),
  ).join(",");
  return `${header}\r\n${example}\r\n`;
}

export const QUESTION_CSV_TEMPLATE_FILENAME = "question-upload-template.csv";
