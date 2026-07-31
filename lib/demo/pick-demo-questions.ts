import type { SupabaseClient } from "@supabase/supabase-js";
import { SECTIONS } from "@/lib/constants";
import type { QuestionRow } from "@/lib/supabase/types";
import { shuffle } from "@/lib/utils";
import { DEMO_QUESTION_COUNT } from "@/lib/demo/constants";

const SELECT =
  "id, section_code, topic_id, concept_id, level, prompt, option_a, option_b, option_c, option_d, correct_option, hint, explanation, source";

/** Fixed-size guest preview — one question per section where possible. */
export async function pickDemoQuestions(
  admin: SupabaseClient,
  count = DEMO_QUESTION_COUNT,
): Promise<QuestionRow[]> {
  const { data, error } = await admin
    .from("questions")
    .select(SELECT)
    .in("level", ["easy", "medium"])
    .eq("is_ai_generated", false)
    .limit(500);

  if (error || !data?.length) {
    throw new Error(error?.message ?? "No questions available for demo");
  }

  const bySection = new Map<string, QuestionRow[]>();
  for (const row of data as QuestionRow[]) {
    const list = bySection.get(row.section_code) ?? [];
    list.push(row);
    bySection.set(row.section_code, list);
  }

  const picked: QuestionRow[] = [];
  const sectionOrder = shuffle([...SECTIONS.map((s) => s.code)]);

  for (const code of sectionOrder) {
    if (picked.length >= count) break;
    const pool = bySection.get(code);
    if (!pool?.length) continue;
    picked.push(shuffle(pool)[0]);
  }

  if (picked.length < count) {
    const used = new Set(picked.map((q) => q.id));
    const rest = shuffle((data as QuestionRow[]).filter((q) => !used.has(q.id)));
    for (const q of rest) {
      if (picked.length >= count) break;
      picked.push(q);
    }
  }

  return shuffle(picked).slice(0, count);
}
