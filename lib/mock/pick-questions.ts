import type { SupabaseClient } from "@supabase/supabase-js";
import { SECTIONS, type SectionCode } from "@/lib/constants";
import type { QuestionRow } from "@/lib/supabase/types";
import { shuffle } from "@/lib/utils";
import { allocateSectionCounts } from "@/lib/practice/pick-questions";
import { datasetBankOnly } from "@/lib/questions/dataset-bank";

/**
 * SC salesperson exam: 120 scored items, 80 National (A1–A6) + 40 State (B1–B6).
 * The Mock Exam mirrors that ratio exactly.
 */
export const MOCK_TOTAL = 120;
export const MOCK_SMOKE_TOTAL = 20;
export const MOCK_NATIONAL = 80;
export const MOCK_STATE = 40;
export const MOCK_DURATION_MIN = 240;
export const MOCK_PASS_PCT = 70;

/**
 * Weighted weakness model.
 *
 * We blend signals from three modes when deciding per-section allocation:
 *   - assessment  → weight 1  (oldest, diagnostic baseline)
 *   - practice    → weight 2  (real-run accuracy)
 *   - mistakes    → weight 3  (most recent; closest to "what the student still doesn't know")
 *
 * Siblings (is_sibling = true) are excluded — they are extra tries, not signal.
 */
const MODE_WEIGHTS: Record<string, number> = {
  assessment: 1,
  practice: 2,
  mistakes: 3,
};

/**
 * Realistic exam difficulty distribution (per section, global).
 * This intentionally does NOT personalize difficulty — a Mock has to feel
 * like an exam. The adaptivity lives in section-level *allocation*, not in
 * skewing an individual section's mix.
 */
const EXAM_DIFFICULTY = { easy: 0.35, medium: 0.4, hard: 0.25 } as const;

/** Don't surface a question the user just saw — stale-cache memory, not recall. */
const RECENT_EXCLUDE_MS = 60 * 60 * 1000;

type SectionSignal = {
  total: number;
  correct: number;
  accuracy: number;
};

export type MockComposition = {
  sectionBreakdown: Array<{
    code: SectionCode;
    title: string;
    group: "National" | "State";
    questions: number;
    weaknessScore: number;
    sampledAttempts: number;
    accuracyPct: number;
  }>;
  nationalTotal: number;
  stateTotal: number;
  totalQuestions: number;
  difficultyCounts: { easy: number; medium: number; hard: number };
};

export type MockPick = {
  questions: QuestionRow[];
  composition: MockComposition;
};

/* -------------------------- weakness model -------------------------- */

async function fetchWeightedSignal(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<string, SectionSignal>> {
  // Pull enough history to be meaningful without being absurd. The view
  // v_user_section_mastery rolls ALL attempts equally, which hides the
  // "recent mistakes matter more" signal we want here — so we go to attempts
  // directly and join the question's section via a lateral-ish select.
  const { data } = await supabase
    .from("attempts")
    .select(
      "is_correct, mode, question:questions(section_code), is_sibling",
    )
    .eq("user_id", userId)
    .eq("is_sibling", false)
    .in("mode", ["assessment", "practice", "mistakes"])
    .order("created_at", { ascending: false })
    .limit(4000);

  const byCode = new Map<string, { wTotal: number; wCorrect: number; raw: number }>();
  for (const row of (data ?? []) as unknown as Array<{
    is_correct: boolean;
    mode: string;
    question:
      | { section_code?: string | null }
      | Array<{ section_code?: string | null }>
      | null;
  }>) {
    const q = row.question;
    const code = Array.isArray(q) ? q[0]?.section_code : q?.section_code;
    if (!code) continue;
    const w = MODE_WEIGHTS[row.mode] ?? 1;
    const slot = byCode.get(code) ?? { wTotal: 0, wCorrect: 0, raw: 0 };
    slot.wTotal += w;
    if (row.is_correct) slot.wCorrect += w;
    slot.raw += 1;
    byCode.set(code, slot);
  }

  const out = new Map<string, SectionSignal>();
  for (const [code, s] of byCode) {
    out.set(code, {
      total: s.raw,
      correct: Math.round(s.wCorrect / Math.max(1, s.wTotal) * s.raw),
      accuracy: s.wTotal > 0 ? (s.wCorrect / s.wTotal) * 100 : 0,
    });
  }
  return out;
}

/**
 * Public helper: top-N weakest sections for the Mock intro preview.
 * Uses the same weighted-signal model (mistakes 3×, practice 2×, assessment 1×).
 *
 * Sections with zero attempts are treated as "unknown, not weak" and ranked
 * last so we don't mislead the student.
 */
export async function getMockWeaknessPreview(
  supabase: SupabaseClient,
  userId: string,
  limit = 3,
): Promise<{
  weakest: Array<{
    code: SectionCode;
    title: string;
    group: "National" | "State";
    accuracy: number;
    sampled: number;
  }>;
  signalSize: number;
}> {
  const signal = await fetchWeightedSignal(supabase, userId);
  let signalSize = 0;
  for (const s of signal.values()) signalSize += s.total;

  const rows = SECTIONS.map((s) => {
    const sig = signal.get(s.code);
    const hasData = (sig?.total ?? 0) > 0;
    return {
      code: s.code,
      title: s.title,
      group: s.group as "National" | "State",
      accuracy: hasData ? Math.round(sig!.accuracy) : 100,
      sampled: sig?.total ?? 0,
      rankable: hasData,
    };
  });

  rows.sort((a, b) => {
    if (a.rankable !== b.rankable) return a.rankable ? -1 : 1;
    return a.accuracy - b.accuracy;
  });

  return {
    weakest: rows
      .slice(0, limit)
      .map(({ code, title, group, accuracy, sampled }) => ({
        code,
        title,
        group,
        accuracy,
        sampled,
      })),
    signalSize,
  };
}

/* -------------------------- question fetching -------------------------- */

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
  return new Set(
    ((data ?? []) as { question_id: string }[]).map((r) => r.question_id),
  );
}

async function fetchLevel(
  supabase: SupabaseClient,
  section: string,
  level: "easy" | "medium" | "hard",
  need: number,
  excludeIds: Set<string>,
): Promise<QuestionRow[]> {
  if (need <= 0) return [];
  const { data } = await datasetBankOnly(
    supabase
      .from("questions")
      .select("*")
      .eq("section_code", section)
      .eq("pool", "standard")
      .eq("level", level)
      .is("parent_question_id", null),
  ).limit(Math.max(need * 6, 40));
  const pool = ((data ?? []) as QuestionRow[]).filter(
    (q) => !excludeIds.has(q.id),
  );
  return shuffle(pool).slice(0, need);
}

async function fetchSectionFallback(
  supabase: SupabaseClient,
  section: string,
  need: number,
  excludeIds: Set<string>,
): Promise<QuestionRow[]> {
  if (need <= 0) return [];
  const { data } = await datasetBankOnly(
    supabase
      .from("questions")
      .select("*")
      .eq("section_code", section)
      .eq("pool", "standard")
      .is("parent_question_id", null),
  ).limit(200);
  const pool = ((data ?? []) as QuestionRow[]).filter(
    (q) => !excludeIds.has(q.id),
  );
  return shuffle(pool).slice(0, need);
}

function splitCounts(
  total: number,
  easyPct: number,
  medPct: number,
  hardPct: number,
): { easy: number; medium: number; hard: number } {
  const norm = easyPct + medPct + hardPct || 1;
  let e = Math.round((total * easyPct) / norm);
  let m = Math.round((total * medPct) / norm);
  let h = total - e - m;
  if (h < 0) {
    h = 0;
    m = Math.max(0, total - e);
  }
  if (m < 0) m = 0;
  if (e < 0) e = 0;
  let sum = e + m + h;
  while (sum < total) {
    if (h <= m && h <= e) h++;
    else if (m <= e) m++;
    else e++;
    sum++;
  }
  while (sum > total) {
    if (h >= m && h >= e && h > 0) h--;
    else if (m >= e && m > 0) m--;
    else if (e > 0) e--;
    else break;
    sum--;
  }
  return { easy: e, medium: m, hard: h };
}

async function pickForSection(
  supabase: SupabaseClient,
  section: SectionCode,
  count: number,
  excludeIds: Set<string>,
): Promise<QuestionRow[]> {
  if (count <= 0) return [];
  const { easy, medium, hard } = splitCounts(
    count,
    EXAM_DIFFICULTY.easy,
    EXAM_DIFFICULTY.medium,
    EXAM_DIFFICULTY.hard,
  );

  const picked: QuestionRow[] = [];
  const take = (rows: QuestionRow[]) => {
    for (const q of rows) {
      if (picked.length >= count) break;
      if (excludeIds.has(q.id)) continue;
      excludeIds.add(q.id);
      picked.push(q);
    }
  };

  take(await fetchLevel(supabase, section, "easy", easy, excludeIds));
  take(await fetchLevel(supabase, section, "medium", medium, excludeIds));
  take(await fetchLevel(supabase, section, "hard", hard, excludeIds));

  const short = count - picked.length;
  if (short > 0) {
    take(await fetchSectionFallback(supabase, section, short, excludeIds));
  }
  return picked.slice(0, count);
}

/* -------------------------- main picker -------------------------- */

/**
 * Build an adaptive Mock Exam list.
 *
 *  1. Fetch weighted weakness signal (assessment=1, practice=2, mistakes=3).
 *  2. Allocate sections:
 *     - National pool gets exactly (total × 2/3), State gets the rest.
 *     - Within each pool, weak sections get more slots with a minimum floor
 *       so the exam still *covers* every section.
 *  3. Per section, fill with 35/40/25 easy/medium/hard (realistic distribution).
 *  4. Exclude questions seen in the last hour and AI-sibling rows.
 *  5. Shuffle final list.
 */
export async function pickMockQuestions(
  supabase: SupabaseClient,
  userId: string,
  total: number = MOCK_TOTAL,
): Promise<MockPick> {
  const target = Math.max(1, Math.floor(total));
  const nationalTarget = Math.round(target * (MOCK_NATIONAL / MOCK_TOTAL));
  const stateTarget = target - nationalTarget;

  const signal = await fetchWeightedSignal(supabase, userId);
  const mastery = new Map<string, { total: number; accuracy: number }>();
  for (const [code, s] of signal) {
    mastery.set(code, { total: s.total, accuracy: s.accuracy });
  }

  const nationalCodes = SECTIONS.filter((s) => s.group === "National").map(
    (s) => s.code,
  );
  const stateCodes = SECTIONS.filter((s) => s.group === "State").map(
    (s) => s.code,
  );

  // Floors: full mock guarantees every national section ≥ 8, every state ≥ 3.
  // Scale floors down for a smoke mock (target < MOCK_TOTAL).
  const scale = target / MOCK_TOTAL;
  const natFloor = Math.max(1, Math.floor(8 * scale));
  const stFloor = Math.max(1, Math.floor(3 * scale));

  const nationalCounts = allocateSectionCounts(
    nationalTarget,
    nationalCodes,
    mastery,
    { minPer: natFloor, alpha: 1.5 },
  );
  const stateCounts = allocateSectionCounts(
    stateTarget,
    stateCodes,
    mastery,
    { minPer: stFloor, alpha: 1.5 },
  );

  const excludeIds = await fetchRecentQuestionIds(supabase, userId);

  const picked: QuestionRow[] = [];
  for (const code of nationalCodes) {
    const n = nationalCounts.get(code) ?? 0;
    picked.push(...(await pickForSection(supabase, code, n, excludeIds)));
  }
  for (const code of stateCodes) {
    const n = stateCounts.get(code) ?? 0;
    picked.push(...(await pickForSection(supabase, code, n, excludeIds)));
  }

  // If any section bank was thin, top up from the rest of the bank so the
  // student still sees exactly `target` questions — keep exclusions honored.
  const stillNeed = target - picked.length;
  if (stillNeed > 0) {
    const { data } = await datasetBankOnly(
      supabase
        .from("questions")
        .select("*")
        .eq("pool", "standard")
        .is("parent_question_id", null),
    ).limit(stillNeed * 6);
    const extra = ((data ?? []) as QuestionRow[]).filter(
      (q) => !excludeIds.has(q.id),
    );
    picked.push(...shuffle(extra).slice(0, stillNeed));
  }

  const finalList = shuffle(picked).slice(0, target);

  // Build composition summary for UI + session config.
  const countBySection = new Map<string, number>();
  const difficultyCounts = { easy: 0, medium: 0, hard: 0 };
  for (const q of finalList) {
    countBySection.set(
      q.section_code,
      (countBySection.get(q.section_code) ?? 0) + 1,
    );
    difficultyCounts[q.level] = (difficultyCounts[q.level] ?? 0) + 1;
  }

  const sectionBreakdown = SECTIONS.map((s) => {
    const sig = signal.get(s.code);
    const acc = sig?.accuracy ?? 100;
    const weakness = Math.max(0, 100 - acc);
    return {
      code: s.code,
      title: s.title,
      group: s.group as "National" | "State",
      questions: countBySection.get(s.code) ?? 0,
      weaknessScore: Math.round(weakness),
      sampledAttempts: sig?.total ?? 0,
      accuracyPct: Math.round(acc),
    };
  });

  return {
    questions: finalList,
    composition: {
      sectionBreakdown,
      nationalTotal: nationalTarget,
      stateTotal: stateTarget,
      totalQuestions: finalList.length,
      difficultyCounts,
    },
  };
}
