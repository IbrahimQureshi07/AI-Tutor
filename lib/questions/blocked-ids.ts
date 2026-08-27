/**
 * Dataset QA report (dataset-questions-2026-08-08.csv) — 12 flagged items.
 * App-side block only (no Supabase SQL). Keep out of student-facing picks.
 *
 * Categories:
 *  - wrong_key: correct_option contradicts explanation
 *  - duplicate_options: two choices share identical text
 *  - blank_options: missing/null option text
 */

export type BlockReason = "wrong_key" | "duplicate_options" | "blank_options";

export const BLOCKED_QUESTIONS: ReadonlyArray<{
  id: string;
  reason: BlockReason;
}> = [
  // Wrong answer key (6)
  { id: "1cbf7d6a-1875-4682-ba14-52c02049d4d1", reason: "wrong_key" },
  { id: "bce6f310-2918-4e3a-b31f-bc9c9647b059", reason: "wrong_key" },
  { id: "4f901e11-b71c-47ca-962d-e57b2e04e3cb", reason: "wrong_key" },
  { id: "b10efaa0-c7ec-488d-b56f-7a2727e552c4", reason: "wrong_key" },
  { id: "2e156604-d883-431b-bffe-9c599d789e6d", reason: "wrong_key" },
  { id: "adbb7416-9397-46d1-bda0-b1d7d8951a1c", reason: "wrong_key" },
  // Duplicate options (4)
  { id: "52739bab-6d4b-4524-be85-b9bae5412891", reason: "duplicate_options" },
  { id: "6ea6bd71-b1d9-4931-a131-dfc5ba1cbd52", reason: "duplicate_options" },
  { id: "cef30760-873c-4e20-b485-a15a720f2108", reason: "duplicate_options" },
  { id: "f8c06951-ca2e-4ed7-9145-8c498c6cdf5d", reason: "duplicate_options" },
  // Blank / missing options (2)
  { id: "c64ea4db-57af-4a15-a5a7-c15c91e1a2f8", reason: "blank_options" },
  { id: "bee15aa7-616c-448b-a7c7-5137619aba67", reason: "blank_options" },
] as const;

export const BLOCKED_QUESTION_IDS: ReadonlySet<string> = new Set(
  BLOCKED_QUESTIONS.map((q) => q.id),
);

export function isQuestionBlocked(id: string | null | undefined): boolean {
  if (!id) return false;
  return BLOCKED_QUESTION_IDS.has(id);
}

/** Drop blocked rows after a Supabase fetch. */
export function rejectBlockedQuestions<T extends { id: string }>(
  rows: T[] | null | undefined,
): T[] {
  if (!rows?.length) return [];
  return rows.filter((q) => !BLOCKED_QUESTION_IDS.has(q.id));
}

/** Merge blocked IDs into an exclude set used by pickers. */
export function withBlockedExcluded(exclude?: Iterable<string>): Set<string> {
  const out = new Set<string>(exclude ?? []);
  for (const id of BLOCKED_QUESTION_IDS) out.add(id);
  return out;
}
