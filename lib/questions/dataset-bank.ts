/**
 * Dataset-only bank filter for student-facing question picks.
 *
 * AI practice siblings (is_ai_generated = true) may still be created for a
 * one-off follow-up after a miss, but must never be drawn into normal
 * Assessment / Practice / Mistakes / Mock / Final / Demo pools.
 *
 * Do NOT apply this when loading a question by id for an existing attempt
 * (hint, coach, results) — those need the exact row that was shown.
 */

type EqBoolChain<T> = {
  eq: (column: string, value: boolean) => T;
};

export function datasetBankOnly<T extends EqBoolChain<T>>(query: T): T {
  return query.eq("is_ai_generated", false);
}
