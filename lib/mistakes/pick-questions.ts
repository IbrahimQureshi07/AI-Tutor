import type { SupabaseClient } from "@supabase/supabase-js";
import { SECTIONS, type SectionCode } from "@/lib/constants";
import type { QuestionRow } from "@/lib/supabase/types";
import { shuffle } from "@/lib/utils";
import { allocateSectionCounts } from "@/lib/practice/pick-questions";

/**
 * Mistakes-test sizing — matches Practice so the experience feels symmetrical.
 */
export const MISTAKES_TOTAL = 110;
/** Quick run to exercise Mistakes + mock flows without 110 questions. */
export const MISTAKES_SMOKE_TOTAL = 10;

/**
 * Real exam composition: 80 national + 40 state of 120 scored items.
 * We use the same ratio for the *filler* slots so weak national/state coverage
 * stays in proportion to what the actual test will look like.
 */
const NATIONAL_SHARE = 80 / 120;

/** Don't surface a question the user just touched. Hot context = no learning. */
const RECENT_EXCLUDE_MS = 30 * 60 * 1000;

type MasteryRow = {
  section_code: string;
  total: number;
  correct: number;
  accuracy: number | null;
};

type MistakeRow = {
  question_id: string;
  last_wrong_at: string | null;
  times_wrong: number;
  times_correct: number;
};

export type OriginMode = "assessment" | "practice" | "mistakes";

/**
 * Per-question provenance info for the Mistakes runner UI.
 *
 * - source: "mistake" → user has missed this question before in some session.
 *           "new"     → freshly-picked filler from the bank (never seen).
 * - firstMissedMode / firstMissedAt: where the user originally got it wrong.
 * - timesWrong: total non-sibling wrong attempts.
 */
export type QuestionOrigin = {
  source: "mistake" | "new";
  firstMissedMode?: OriginMode;
  firstMissedAt?: string;
  timesWrong?: number;
};

export type MistakesPick = {
  questions: QuestionRow[];
  mistakeCount: number;
  fillerCount: number;
  origins: Record<string, QuestionOrigin>;
};

async function fetchMistakes(
  supabase: SupabaseClient,
  userId: string,
): Promise<MistakeRow[]> {
  const { data } = await supabase
    .from("v_user_mistakes")
    .select("question_id, last_wrong_at, times_wrong, times_correct, resolved")
    .eq("user_id", userId)
    .eq("resolved", false)
    .limit(500);

  return ((data ?? []) as (MistakeRow & { resolved: boolean })[]).map((r) => ({
    question_id: r.question_id,
    last_wrong_at: r.last_wrong_at,
    times_wrong: r.times_wrong,
    times_correct: r.times_correct,
  }));
}

function rankMistakes(rows: MistakeRow[]): MistakeRow[] {
  return [...rows].sort((a, b) => {
    if (b.times_wrong !== a.times_wrong) {
      return b.times_wrong - a.times_wrong;
    }
    const ad = a.last_wrong_at ? new Date(a.last_wrong_at).getTime() : 0;
    const bd = b.last_wrong_at ? new Date(b.last_wrong_at).getTime() : 0;
    return bd - ad;
  });
}

async function fetchQuestionsByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<QuestionRow[]> {
  if (!ids.length) return [];
  const { data } = await supabase
    .from("questions")
    .select("*")
    .in("id", ids)
    .eq("is_ai_generated", false);

  const byId = new Map<string, QuestionRow>(
    ((data ?? []) as QuestionRow[]).map((q) => [q.id, q]),
  );
  // Preserve the priority order from `ids`.
  return ids.map((id) => byId.get(id)).filter(Boolean) as QuestionRow[];
}

async function fetchRecentQuestionIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const since = new Date(Date.now() - RECENT_EXCLUDE_MS).toISOString();
  const { data } = await supabase
    .from("attempts")
    .select("question_id")
    .eq("user_id", userId)
    .gte("created_at", since)
    .limit(500);
  return new Set(((data ?? []) as { question_id: string }[]).map((r) => r.question_id));
}

async function fetchSectionLevel(
  supabase: SupabaseClient,
  section: string,
  level: "medium" | "hard",
  need: number,
  excludeIds: Set<string>,
): Promise<QuestionRow[]> {
  if (need <= 0) return [];
  const { data } = await supabase
    .from("questions")
    .select("*")
    .eq("section_code", section)
    .eq("pool", "standard")
    .eq("level", level)
    .is("parent_question_id", null)
    .eq("is_ai_generated", false)
    .limit(Math.min(400, Math.max(need * 6, 30)));

  const pool = ((data ?? []) as QuestionRow[]).filter((q) => !excludeIds.has(q.id));
  return shuffle(pool).slice(0, need);
}

/**
 * For a set of mistake question_ids, find the FIRST mode the user got it wrong
 * in (and when). This is what we surface in the runner UI as "First missed in
 * Assessment · 4d ago" so the student can recall the context.
 */
async function fetchFirstMisses(
  supabase: SupabaseClient,
  userId: string,
  ids: string[],
): Promise<Map<string, { mode: OriginMode; at: string }>> {
  const out = new Map<string, { mode: OriginMode; at: string }>();
  if (!ids.length) return out;
  const { data } = await supabase
    .from("attempts")
    .select("question_id, mode, created_at")
    .eq("user_id", userId)
    .eq("is_correct", false)
    .eq("is_sibling", false)
    .in("question_id", ids)
    .order("created_at", { ascending: true });

  for (const row of (data ?? []) as {
    question_id: string;
    mode: string;
    created_at: string;
  }[]) {
    if (out.has(row.question_id)) continue;
    if (row.mode !== "assessment" && row.mode !== "practice" && row.mode !== "mistakes") {
      continue;
    }
    out.set(row.question_id, {
      mode: row.mode as OriginMode,
      at: row.created_at,
    });
  }
  return out;
}

async function fetchSectionFallback(
  supabase: SupabaseClient,
  section: string,
  need: number,
  excludeIds: Set<string>,
): Promise<QuestionRow[]> {
  if (need <= 0) return [];
  const { data } = await supabase
    .from("questions")
    .select("*")
    .eq("section_code", section)
    .eq("pool", "standard")
    .in("level", ["medium", "hard"])
    .is("parent_question_id", null)
    .eq("is_ai_generated", false)
    .limit(200);
  const pool = ((data ?? []) as QuestionRow[]).filter((q) => !excludeIds.has(q.id));
  return shuffle(pool).slice(0, need);
}

/**
 * Build the Mistakes-test question list:
 *  Pass 1 — every unresolved hard/soft miss (sorted by wrongness, recency)
 *  Pass 2 — fill the rest with weighted medium+hard bank questions
 *           (national/state mirrors the real exam; weak sections get more)
 */
export async function pickMistakesQuestions(
  supabase: SupabaseClient,
  userId: string,
  total: number = MISTAKES_TOTAL,
): Promise<MistakesPick> {
  const target = Math.max(1, Math.floor(total));
  const allMistakes = rankMistakes(await fetchMistakes(supabase, userId));
  const cappedMistakeIds = allMistakes
    .slice(0, target)
    .map((m) => m.question_id);
  const mistakeQs = await fetchQuestionsByIds(supabase, cappedMistakeIds);

  // Build origin metadata for the mistake bucket.
  const firstMisses = await fetchFirstMisses(
    supabase,
    userId,
    mistakeQs.map((q) => q.id),
  );
  const mistakesById = new Map(allMistakes.map((m) => [m.question_id, m]));

  const origins: Record<string, QuestionOrigin> = {};
  for (const q of mistakeQs) {
    const fm = firstMisses.get(q.id);
    const m = mistakesById.get(q.id);
    origins[q.id] = {
      source: "mistake",
      firstMissedMode: fm?.mode,
      firstMissedAt: fm?.at,
      timesWrong: m?.times_wrong,
    };
  }

  if (mistakeQs.length >= target) {
    const finalQs = shuffle(mistakeQs.slice(0, target));
    const finalIds = new Set(finalQs.map((q) => q.id));
    for (const id of Object.keys(origins)) {
      if (!finalIds.has(id)) delete origins[id];
    }
    return {
      questions: finalQs,
      mistakeCount: finalQs.length,
      fillerCount: 0,
      origins,
    };
  }

  const remaining = target - mistakeQs.length;

  const { data: masteryRows } = await supabase
    .from("v_user_section_mastery")
    .select("section_code, total, correct, accuracy")
    .eq("user_id", userId);

  const mastery = new Map<string, { total: number; accuracy: number }>();
  for (const r of (masteryRows ?? []) as MasteryRow[]) {
    mastery.set(r.section_code, {
      total: r.total,
      accuracy: Number(r.accuracy ?? 0),
    });
  }

  const nationalCodes = SECTIONS.filter((s) => s.group === "National").map(
    (s) => s.code,
  );
  const stateCodes = SECTIONS.filter((s) => s.group === "State").map(
    (s) => s.code,
  );

  const nationalCount = Math.round(remaining * NATIONAL_SHARE);
  let stateCount = remaining - nationalCount;
  if (nationalCount + stateCount !== remaining) {
    stateCount = remaining - nationalCount;
  }

  const nationalCounts = allocateSectionCounts(
    nationalCount,
    nationalCodes,
    mastery,
    { minPer: 0, alpha: 1.75 },
  );
  const stateCounts = allocateSectionCounts(
    stateCount,
    stateCodes,
    mastery,
    { minPer: 0, alpha: 1.75 },
  );

  const excludeIds = new Set<string>(mistakeQs.map((q) => q.id));
  const recent = await fetchRecentQuestionIds(supabase, userId);
  for (const id of recent) excludeIds.add(id);

  const filler: QuestionRow[] = [];

  const sectionAllocations: Array<[SectionCode, number]> = [
    ...nationalCodes.map((c) => [c, nationalCounts.get(c) ?? 0] as [SectionCode, number]),
    ...stateCodes.map((c) => [c, stateCounts.get(c) ?? 0] as [SectionCode, number]),
  ];

  for (const [code, n] of sectionAllocations) {
    if (n <= 0) continue;
    // Flat 50/50 medium/hard. Round so totals add up exactly.
    const med = Math.floor(n / 2);
    const hard = n - med;

    const medQs = await fetchSectionLevel(supabase, code, "medium", med, excludeIds);
    for (const q of medQs) excludeIds.add(q.id);

    const hardQs = await fetchSectionLevel(supabase, code, "hard", hard, excludeIds);
    for (const q of hardQs) excludeIds.add(q.id);

    let bucket = [...medQs, ...hardQs];

    // If a section ran short on med/hard, top up with the other level.
    const short = n - bucket.length;
    if (short > 0) {
      const extra = await fetchSectionFallback(supabase, code, short, excludeIds);
      for (const q of extra) excludeIds.add(q.id);
      bucket = bucket.concat(extra);
    }

    filler.push(...bucket.slice(0, n));
  }

  // Final top-up if the bank simply doesn't have enough med/hard somewhere.
  const stillNeed = target - mistakeQs.length - filler.length;
  if (stillNeed > 0) {
    const { data: extra } = await supabase
      .from("questions")
      .select("*")
      .eq("pool", "standard")
      .in("level", ["medium", "hard"])
      .is("parent_question_id", null)
      .eq("is_ai_generated", false)
      .limit(stillNeed * 6);
    const extraFiltered = ((extra ?? []) as QuestionRow[]).filter(
      (q) => !excludeIds.has(q.id),
    );
    filler.push(...shuffle(extraFiltered).slice(0, stillNeed));
  }

  // Tag every filler question as "new" — they're bank questions the picker
  // selected because the user has never seen them (or hasn't seen them recently).
  for (const q of filler) {
    if (!origins[q.id]) {
      origins[q.id] = { source: "new" };
    }
  }

  const merged = shuffle([...mistakeQs, ...filler]).slice(0, target);

  // Strip origins for any question that didn't make the final cut.
  const finalIds = new Set(merged.map((q) => q.id));
  for (const id of Object.keys(origins)) {
    if (!finalIds.has(id)) delete origins[id];
  }

  return {
    questions: merged,
    mistakeCount: mistakeQs.length,
    fillerCount: merged.length - mistakeQs.length,
    origins,
  };
}
