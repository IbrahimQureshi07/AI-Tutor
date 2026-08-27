import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuestionRow } from "@/lib/supabase/types";
import { shuffle } from "@/lib/utils";
import { rejectBlockedQuestions } from "@/lib/questions/blocked-ids";

/**
 * Build a balanced assessment set:
 *  - For each section, fetch a wide pool then sample by difficulty.
 *  - Difficulty mix is roughly 30% easy / 50% medium / 20% hard.
 *  - Falls back gracefully when a section is light on a level.
 *  - Across-section ordering: interleave by section so the user
 *    doesn't sit on one topic for 35 questions in a row.
 */
export async function pickAssessmentQuestions(
  supabase: SupabaseClient,
  sections: string[],
  perSection: number,
): Promise<QuestionRow[]> {
  const want = mixForCount(perSection);

  const buckets: Record<string, QuestionRow[]> = {};

  await Promise.all(
    sections.map(async (code) => {
      const { data, error } = await supabase
        .from("questions")
        .select("*")
        .eq("section_code", code)
        .eq("pool", "standard")
        .eq("is_ai_generated", false)
        .limit(1000);

      if (error || !data) {
        buckets[code] = [];
        return;
      }

      const usable = rejectBlockedQuestions(data as QuestionRow[]);

      const easy = shuffle(usable.filter((q) => q.level === "easy"));
      const med = shuffle(usable.filter((q) => q.level === "medium"));
      const hard = shuffle(usable.filter((q) => q.level === "hard"));

      const picked: QuestionRow[] = [];
      picked.push(...easy.slice(0, want.easy));
      picked.push(...med.slice(0, want.medium));
      picked.push(...hard.slice(0, want.hard));

      // Backfill from any remaining if a level was short
      const usedIds = new Set(picked.map((q) => q.id));
      const leftover = shuffle(
        usable.filter((q) => !usedIds.has(q.id)),
      );
      while (picked.length < perSection && leftover.length) {
        picked.push(leftover.shift()!);
      }

      // Concept diversity: prefer one question per concept where possible
      buckets[code] = preferConceptDiversity(picked, perSection);
    }),
  );

  // Interleave so sections rotate
  const queues = sections.map((s) => [...buckets[s]]);
  const out: QuestionRow[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const q of queues) {
      if (q.length) {
        out.push(q.shift()!);
        added = true;
      }
    }
  }
  return out;
}

function mixForCount(n: number) {
  // 30 / 50 / 20
  const easy = Math.round(n * 0.3);
  const hard = Math.round(n * 0.2);
  const medium = Math.max(0, n - easy - hard);
  return { easy, medium, hard };
}

function preferConceptDiversity(
  picks: QuestionRow[],
  cap: number,
): QuestionRow[] {
  const seen = new Map<string, number>();
  const primary: QuestionRow[] = [];
  const overflow: QuestionRow[] = [];
  for (const q of picks) {
    const key = q.concept_id ?? `__${q.section_code}_${q.id}`;
    const seenCount = seen.get(key) ?? 0;
    if (seenCount === 0) {
      primary.push(q);
      seen.set(key, 1);
    } else {
      overflow.push(q);
      seen.set(key, seenCount + 1);
    }
  }
  return [...primary, ...overflow].slice(0, cap);
}
