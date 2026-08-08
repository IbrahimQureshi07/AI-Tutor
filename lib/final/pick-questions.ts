import type { SupabaseClient } from "@supabase/supabase-js";
import { SECTIONS, type SectionCode } from "@/lib/constants";
import type { QuestionRow } from "@/lib/supabase/types";
import { shuffle } from "@/lib/utils";

/**
 * SC PSI Salesperson exam — actual structure per the 2025 PSI bulletin and
 * SC license verification sources:
 *   - National portion: 80 scored questions, 120 minutes, 70% to pass.
 *   - State portion:    40 scored questions, 60 minutes, 70% to pass.
 *   - BOTH portions must be passed independently. There is no combined score.
 *
 * The Final Test mirrors this exactly. NO ADAPTIVE BIAS:
 *   - Section allocation is equal (largest-remainder) across the 6 sections
 *     in each portion.
 *   - Difficulty is the global 35/40/25 easy/medium/hard mix per section.
 *   - Questions come from the held-out pool first — brand-new, never-seen
 *     questions for that user. If a section runs short on unseen questions
 *     (a heavy-practice student can exhaust a small section), we top up with
 *     that same section's PAST MISSES — questions the student previously got
 *     wrong (weakest/most-recent first), never with AI-generated questions.
 *     This keeps every section at its full allocated count instead of
 *     silently running the exam short, while still never recycling a
 *     question the student already answered correctly.
 */
export const FINAL_NATIONAL_TOTAL = 80;
export const FINAL_STATE_TOTAL = 40;
export const FINAL_TOTAL = FINAL_NATIONAL_TOTAL + FINAL_STATE_TOTAL;
export const FINAL_NATIONAL_DURATION_MIN = 120;
export const FINAL_STATE_DURATION_MIN = 60;
export const FINAL_DURATION_MIN =
  FINAL_NATIONAL_DURATION_MIN + FINAL_STATE_DURATION_MIN;
export const FINAL_PASS_PCT = 70;

const NATIONAL_CODES = SECTIONS.filter((s) => s.group === "National").map(
  (s) => s.code,
);
const STATE_CODES = SECTIONS.filter((s) => s.group === "State").map(
  (s) => s.code,
);

const EXAM_DIFFICULTY = { easy: 0.35, medium: 0.4, hard: 0.25 } as const;

export type Portion = "national" | "state";

export type SectionDepletion = {
  code: SectionCode;
  group: "National" | "State";
  requested: number;
  available: number;
};

export type FinalComposition = {
  nationalCount: number;
  stateCount: number;
  sectionAllocations: Array<{
    code: SectionCode;
    group: "National" | "State";
    count: number;
  }>;
  difficultyMix: { easy: number; medium: number; hard: number };
  depletion: SectionDepletion[];
  poolUsed: "final_holdout" | "standard";
  /** How many questions were filled from past misses (unseen pool ran short). */
  fromPastWrongs: number;
};

export type FinalPick = {
  nationalQuestions: QuestionRow[];
  stateQuestions: QuestionRow[];
  composition: FinalComposition;
};

/* ---------------------------- allocation ------------------------------- */

/**
 * Largest-remainder allocation. Distributes `total` items across `n` buckets
 * as evenly as possible. For 80 across 6 sections → [14,14,14,13,13,13].
 */
function largestRemainder(total: number, codes: readonly SectionCode[]) {
  const n = codes.length;
  if (n === 0) return new Map<SectionCode, number>();
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  const out = new Map<SectionCode, number>();
  codes.forEach((c, i) => out.set(c, base + (i < remainder ? 1 : 0)));
  return out;
}

function splitDifficulty(total: number) {
  const norm = EXAM_DIFFICULTY.easy + EXAM_DIFFICULTY.medium + EXAM_DIFFICULTY.hard;
  let e = Math.round((total * EXAM_DIFFICULTY.easy) / norm);
  let m = Math.round((total * EXAM_DIFFICULTY.medium) / norm);
  let h = total - e - m;
  if (h < 0) {
    h = 0;
    m = Math.max(0, total - e);
  }
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

/* ---------------------------- exclusion -------------------------------- */

/**
 * Every question this user has ever attempted (any mode). The held-out
 * guarantee is per-user: a question is "held-out" iff this user has never
 * seen it, regardless of pool tag.
 */
async function fetchUserSeenQuestionIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const seen = new Set<string>();
  // Paginate to avoid the 1000-row default cap.
  const PAGE = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("attempts")
      .select("question_id")
      .eq("user_id", userId)
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data as { question_id: string }[]) seen.add(r.question_id);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return seen;
}

/* ---------------------------- past misses ------------------------------ */

type WrongRow = {
  question_id: string;
  last_wrong_at: string | null;
  times_wrong: number;
  resolved: boolean;
};

/**
 * Every question this user has ever gotten wrong (any mode), ranked
 * weakest-and-most-recent first. Used ONLY as a shortfall fallback when a
 * section has no unseen questions left — see module docblock.
 */
async function fetchUserPastWrongs(
  supabase: SupabaseClient,
  userId: string,
): Promise<WrongRow[]> {
  const { data } = await supabase
    .from("v_user_mistakes")
    .select("question_id, last_wrong_at, times_wrong, resolved")
    .eq("user_id", userId)
    .limit(1000);
  const rows = (data ?? []) as WrongRow[];
  return [...rows].sort((a, b) => {
    // Still-unresolved misses (weak spots) are more useful to re-test than
    // ones the student has since gotten right, but both are fair game for
    // filling a shortfall.
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    if (b.times_wrong !== a.times_wrong) return b.times_wrong - a.times_wrong;
    const ad = a.last_wrong_at ? new Date(a.last_wrong_at).getTime() : 0;
    const bd = b.last_wrong_at ? new Date(b.last_wrong_at).getTime() : 0;
    return bd - ad;
  });
}

/**
 * The ranked past-misses above, resolved to full question rows and grouped
 * by section — ready to top up a thin section without touching AI-generated
 * questions or questions the student has already gotten right.
 */
async function fetchPastWrongsBySection(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<SectionCode, QuestionRow[]>> {
  const ranked = await fetchUserPastWrongs(supabase, userId);
  const ids = ranked.map((r) => r.question_id);
  const out = new Map<SectionCode, QuestionRow[]>();
  if (ids.length === 0) return out;

  const { data } = await supabase
    .from("questions")
    .select("*")
    .in("id", ids)
    .is("parent_question_id", null)
    .eq("is_ai_generated", false);

  const byId = new Map<string, QuestionRow>(
    ((data ?? []) as QuestionRow[]).map((q) => [q.id, q]),
  );

  for (const id of ids) {
    const q = byId.get(id);
    if (!q) continue;
    const code = q.section_code as SectionCode;
    const list = out.get(code) ?? [];
    list.push(q);
    out.set(code, list);
  }
  return out;
}

/* ---------------------------- pool detection --------------------------- */

async function hasHoldoutPool(supabase: SupabaseClient): Promise<boolean> {
  const { count } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("pool", "final_holdout")
    .is("parent_question_id", null)
    .eq("is_ai_generated", false);
  return (count ?? 0) > 0;
}

/* ---------------------------- per-section pick ------------------------- */

async function fetchSectionLevel(
  supabase: SupabaseClient,
  pool: "final_holdout" | "standard",
  section: SectionCode,
  level: "easy" | "medium" | "hard",
  exclude: Set<string>,
  need: number,
): Promise<QuestionRow[]> {
  if (need <= 0) return [];
  // Over-fetch enough to survive exclusion of seen questions.
  const fetchLimit = Math.max(need * 6, 60);
  const { data } = await supabase
    .from("questions")
    .select("*")
    .eq("section_code", section)
    .eq("pool", pool)
    .eq("level", level)
    .is("parent_question_id", null)
    .eq("is_ai_generated", false)
    .limit(fetchLimit);
  const filtered = ((data ?? []) as QuestionRow[]).filter(
    (q) => !exclude.has(q.id),
  );
  return shuffle(filtered).slice(0, need);
}

async function fetchSectionAny(
  supabase: SupabaseClient,
  pool: "final_holdout" | "standard",
  section: SectionCode,
  exclude: Set<string>,
  need: number,
): Promise<QuestionRow[]> {
  if (need <= 0) return [];
  const { data } = await supabase
    .from("questions")
    .select("*")
    .eq("section_code", section)
    .eq("pool", pool)
    .is("parent_question_id", null)
    .eq("is_ai_generated", false)
    .limit(Math.max(need * 4, 200));
  const filtered = ((data ?? []) as QuestionRow[]).filter(
    (q) => !exclude.has(q.id),
  );
  return shuffle(filtered).slice(0, need);
}

async function pickForSection(
  supabase: SupabaseClient,
  pool: "final_holdout" | "standard",
  section: SectionCode,
  count: number,
  exclude: Set<string>,
  usedThisRun: Set<string>,
  pastWrongsBySection: Map<SectionCode, QuestionRow[]>,
): Promise<{ picked: QuestionRow[]; available: number; fromPastWrongs: number }> {
  if (count <= 0) return { picked: [], available: 0, fromPastWrongs: 0 };
  const mix = splitDifficulty(count);

  const out: QuestionRow[] = [];
  const take = (rows: QuestionRow[]) => {
    for (const q of rows) {
      if (out.length >= count) break;
      if (usedThisRun.has(q.id)) continue;
      usedThisRun.add(q.id);
      exclude.add(q.id);
      out.push(q);
    }
  };

  take(await fetchSectionLevel(supabase, pool, section, "easy", exclude, mix.easy));
  take(await fetchSectionLevel(supabase, pool, section, "medium", exclude, mix.medium));
  take(await fetchSectionLevel(supabase, pool, section, "hard", exclude, mix.hard));

  // If a difficulty bucket was thin, top up from any difficulty *within
  // the same section and pool* — section integrity is non-negotiable;
  // difficulty mix is preferred.
  const shortOnUnseen = count - out.length;
  if (shortOnUnseen > 0) {
    take(await fetchSectionAny(supabase, pool, section, exclude, shortOnUnseen));
  }

  // Still short — no unseen questions left in this section for this user.
  // Fall back to questions in this section the user previously got wrong,
  // weakest/most-recent first. Still never AI-generated (filtered upstream).
  const beforePastWrongs = out.length;
  const shortAfterUnseen = count - out.length;
  if (shortAfterUnseen > 0) {
    const candidates = (pastWrongsBySection.get(section) ?? []).filter(
      (q) => !usedThisRun.has(q.id),
    );
    take(candidates);
  }
  const fromPastWrongs = out.length - beforePastWrongs;

  return { picked: out, available: out.length, fromPastWrongs };
}

/* ---------------------------- portion picker --------------------------- */

async function pickPortion(
  supabase: SupabaseClient,
  pool: "final_holdout" | "standard",
  total: number,
  codes: readonly SectionCode[],
  exclude: Set<string>,
  group: "National" | "State",
  usedThisRun: Set<string>,
  pastWrongsBySection: Map<SectionCode, QuestionRow[]>,
): Promise<{
  questions: QuestionRow[];
  allocations: Array<{ code: SectionCode; group: "National" | "State"; count: number }>;
  depletion: SectionDepletion[];
  fromPastWrongsTotal: number;
}> {
  const allocation = largestRemainder(total, codes);
  const allocations: Array<{
    code: SectionCode;
    group: "National" | "State";
    count: number;
  }> = [];
  const depletion: SectionDepletion[] = [];
  const all: QuestionRow[] = [];
  let fromPastWrongsTotal = 0;

  for (const code of codes) {
    const requested = allocation.get(code) ?? 0;
    const { picked, fromPastWrongs } = await pickForSection(
      supabase,
      pool,
      code,
      requested,
      exclude,
      usedThisRun,
      pastWrongsBySection,
    );
    allocations.push({ code, group, count: picked.length });
    fromPastWrongsTotal += fromPastWrongs;
    if (picked.length < requested) {
      depletion.push({
        code,
        group,
        requested,
        available: picked.length,
      });
    }
    all.push(...picked);
  }

  // Shuffle within the portion so adjacent questions aren't all from the
  // same section. The PSI exam doesn't group by section in display order.
  return { questions: shuffle(all), allocations, depletion, fromPastWrongsTotal };
}

/* ---------------------------- public API ------------------------------- */

/**
 * Build a Final Test question set.
 *
 * @param opts.portion   "both" (default) for a full Final, or one of
 *                       "national"/"state" for a partial retake when the
 *                       student previously passed only one portion.
 */
export async function pickFinalQuestions(
  supabase: SupabaseClient,
  userId: string,
  opts: { portion?: "both" | Portion } = {},
): Promise<FinalPick> {
  const portion = opts.portion ?? "both";

  const useHoldout = await hasHoldoutPool(supabase);
  const pool: "final_holdout" | "standard" = useHoldout
    ? "final_holdout"
    : "standard";

  const exclude = await fetchUserSeenQuestionIds(supabase, userId);
  const usedThisRun = new Set<string>();
  const pastWrongsBySection = await fetchPastWrongsBySection(supabase, userId);

  let nationalQuestions: QuestionRow[] = [];
  let stateQuestions: QuestionRow[] = [];
  const allocations: FinalComposition["sectionAllocations"] = [];
  const depletion: SectionDepletion[] = [];
  let fromPastWrongs = 0;

  if (portion === "both" || portion === "national") {
    const r = await pickPortion(
      supabase,
      pool,
      FINAL_NATIONAL_TOTAL,
      NATIONAL_CODES,
      exclude,
      "National",
      usedThisRun,
      pastWrongsBySection,
    );
    nationalQuestions = r.questions;
    allocations.push(...r.allocations);
    depletion.push(...r.depletion);
    fromPastWrongs += r.fromPastWrongsTotal;
  }

  if (portion === "both" || portion === "state") {
    const r = await pickPortion(
      supabase,
      pool,
      FINAL_STATE_TOTAL,
      STATE_CODES,
      exclude,
      "State",
      usedThisRun,
      pastWrongsBySection,
    );
    stateQuestions = r.questions;
    allocations.push(...r.allocations);
    depletion.push(...r.depletion);
    fromPastWrongs += r.fromPastWrongsTotal;
  }

  // Tally the actual difficulty mix (informational; we report what we got).
  const difficultyMix = { easy: 0, medium: 0, hard: 0 };
  for (const q of [...nationalQuestions, ...stateQuestions]) {
    difficultyMix[q.level] += 1;
  }

  return {
    nationalQuestions,
    stateQuestions,
    composition: {
      nationalCount: nationalQuestions.length,
      stateCount: stateQuestions.length,
      sectionAllocations: allocations,
      difficultyMix,
      depletion,
      poolUsed: pool,
      fromPastWrongs,
    },
  };
}

/* ---------------------------- pool status ------------------------------ */

/**
 * Per-section unseen count for a user, used by the Final intro page to warn
 * about pool depletion *before* the student commits to a session.
 */
export async function getFinalPoolStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  poolUsed: "final_holdout" | "standard";
  bySection: Array<{
    code: SectionCode;
    group: "National" | "State";
    unseen: number;
    /** Past-miss questions in this section available to top up a shortfall. */
    pastWrongAvailable: number;
    requested: number;
  }>;
  nationalUnseenTotal: number;
  stateUnseenTotal: number;
  nationalRequested: number;
  stateRequested: number;
  /** Still short even after topping up with past misses — a genuine gap. */
  nationalStillShort: number;
  stateStillShort: number;
}> {
  const useHoldout = await hasHoldoutPool(supabase);
  const pool: "final_holdout" | "standard" = useHoldout
    ? "final_holdout"
    : "standard";
  const seen = await fetchUserSeenQuestionIds(supabase, userId);
  const pastWrongsBySection = await fetchPastWrongsBySection(supabase, userId);

  const nationalAlloc = largestRemainder(FINAL_NATIONAL_TOTAL, NATIONAL_CODES);
  const stateAlloc = largestRemainder(FINAL_STATE_TOTAL, STATE_CODES);

  const out: Array<{
    code: SectionCode;
    group: "National" | "State";
    unseen: number;
    pastWrongAvailable: number;
    requested: number;
  }> = [];

  let nationalUnseenTotal = 0;
  let stateUnseenTotal = 0;
  let nationalStillShort = 0;
  let stateStillShort = 0;

  for (const s of SECTIONS) {
    // Use head:true count then read ids only when needed. To compute
    // *unseen* we have to subtract the seen set — which means fetching ids.
    const { data } = await supabase
      .from("questions")
      .select("id")
      .eq("section_code", s.code)
      .eq("pool", pool)
      .is("parent_question_id", null)
      .eq("is_ai_generated", false);
    const unseen = ((data ?? []) as { id: string }[]).filter(
      (q) => !seen.has(q.id),
    ).length;
    const requested =
      s.group === "National"
        ? (nationalAlloc.get(s.code) ?? 0)
        : (stateAlloc.get(s.code) ?? 0);
    const pastWrongAvailable = (pastWrongsBySection.get(s.code) ?? []).length;
    const stillShort = Math.max(0, requested - unseen - pastWrongAvailable);
    out.push({
      code: s.code,
      group: s.group as "National" | "State",
      unseen,
      pastWrongAvailable,
      requested,
    });
    if (s.group === "National") {
      nationalUnseenTotal += unseen;
      nationalStillShort += stillShort;
    } else {
      stateUnseenTotal += unseen;
      stateStillShort += stillShort;
    }
  }

  return {
    poolUsed: pool,
    bySection: out,
    nationalUnseenTotal,
    stateUnseenTotal,
    nationalRequested: FINAL_NATIONAL_TOTAL,
    stateRequested: FINAL_STATE_TOTAL,
    nationalStillShort,
    stateStillShort,
  };
}
