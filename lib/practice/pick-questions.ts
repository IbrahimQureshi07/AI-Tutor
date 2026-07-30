import type { SupabaseClient } from "@supabase/supabase-js";
import { SECTIONS, type SectionCode } from "@/lib/constants";
import type { QuestionRow } from "@/lib/supabase/types";
import { shuffle } from "@/lib/utils";
import {
  type DebriefPlan,
  FOCUS_MULTIPLIER,
  AVOID_MULTIPLIER,
  FOCUS_FLOOR,
  sanitizePlan,
} from "@/lib/coach/debrief-plan";
import { datasetBankOnly } from "@/lib/questions/dataset-bank";

/** SC salesperson exam mix: 80 national + 40 state = 120 scored items. */
export const PRACTICE_TOTAL = 110;
/** Smoke-test length for verifying flows without grinding 110 questions. */
export const PRACTICE_SMOKE_TOTAL = 10;
const NATIONAL_SHARE = 80 / 120;

type MasteryRow = {
  section_code: string;
  total: number;
  correct: number;
  accuracy: number | null;
};

/** Weak: e/m/h roughly equal, easy slightly lower. Strong: more medium + hard. */
const WEAK_MIX = { easy: 0.25, medium: 0.375, hard: 0.375 } as const;
const STRONG_MIX = { easy: 0.12, medium: 0.38, hard: 0.5 } as const;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Blend difficulty mix from accuracy (0–100) and sample size. */
export function difficultyPercents(
  accuracyPct: number,
  totalAttempts: number,
): { easy: number; medium: number; hard: number } {
  if (totalAttempts < 5) {
    return { ...WEAK_MIX };
  }
  if (accuracyPct < 58) {
    return { ...WEAK_MIX };
  }
  if (accuracyPct > 78) {
    return { ...STRONG_MIX };
  }
  const t = (accuracyPct - 58) / 20;
  return {
    easy: lerp(WEAK_MIX.easy, STRONG_MIX.easy, t),
    medium: lerp(WEAK_MIX.medium, STRONG_MIX.medium, t),
    hard: lerp(WEAK_MIX.hard, STRONG_MIX.hard, t),
  };
}

/** Higher = weaker section (needs more questions). */
function weaknessWeight(
  section: string,
  mastery: Map<string, { total: number; accuracy: number }>,
  alpha: number,
  multipliers?: Map<string, number>,
): number {
  const m = mastery.get(section);
  const base =
    !m || m.total === 0
      ? 0.92
      : Math.pow(1 - Math.min(100, Math.max(0, m.accuracy)) / 100 + 0.04, alpha) + 0.08;
  const mult = multipliers?.get(section) ?? 1;
  return base * mult;
}

/**
 * Distribute `pool` questions across `sections`: each starts at `minPer`,
 * then remaining slots go one-at-a-time to whichever section maximizes
 * weakness/(currentCount+1) so weak sections gain more without starving others.
 */
export function allocateSectionCounts(
  pool: number,
  sections: readonly SectionCode[],
  mastery: Map<string, { total: number; accuracy: number }>,
  opts: {
    minPer: number;
    alpha?: number;
    /** Per-section weight multipliers (e.g. focus=2, avoid=0.4). */
    multipliers?: Map<string, number>;
    /** Section-specific floors (e.g. focus sections with ≥ N questions). */
    floors?: Map<string, number>;
  },
): Map<SectionCode, number> {
  const alpha = opts.alpha ?? 1.75;
  const minPer = opts.minPer;
  const counts = new Map<SectionCode, number>();
  for (const s of sections) counts.set(s, 0);

  if (pool <= 0) return counts;

  const getFloor = (s: SectionCode) =>
    Math.max(minPer, opts.floors?.get(s) ?? 0);

  const floorTotal = sections.reduce((acc, s) => acc + getFloor(s), 0);

  if (pool < floorTotal) {
    let left = pool;
    while (left > 0) {
      let best: SectionCode = sections[0];
      let bestScore = -Infinity;
      for (const s of sections) {
        const w = weaknessWeight(s, mastery, alpha, opts.multipliers);
        const c = counts.get(s) ?? 0;
        const score = w / (c + 1);
        if (score > bestScore) {
          bestScore = score;
          best = s;
        }
      }
      counts.set(best, (counts.get(best) ?? 0) + 1);
      left--;
    }
    return counts;
  }

  for (const s of sections) counts.set(s, getFloor(s));
  let left = pool - floorTotal;
  while (left > 0) {
    let best: SectionCode = sections[0];
    let bestScore = -Infinity;
    for (const s of sections) {
      const w = weaknessWeight(s, mastery, alpha, opts.multipliers);
      const c = counts.get(s) ?? 0;
      const score = w / (c + 1);
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    counts.set(best, (counts.get(best) ?? 0) + 1);
    left--;
  }
  return counts;
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
  if (m < 0) {
    m = 0;
    e = Math.max(0, total - h);
  }
  if (e < 0) {
    e = 0;
    h = Math.max(0, total - m);
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

async function fetchLevel(
  supabase: SupabaseClient,
  section: string,
  level: "easy" | "medium" | "hard",
  need: number,
): Promise<QuestionRow[]> {
  if (need <= 0) return [];
  const { data } = await datasetBankOnly(
    supabase
      .from("questions")
      .select("*")
      .eq("section_code", section)
      .eq("pool", "standard")
      .eq("level", level),
  ).limit(Math.min(500, need * 6));
  return shuffle((data ?? []) as QuestionRow[]).slice(0, need);
}

async function fillShortfall(
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
      .eq("pool", "standard"),
  ).limit(400);
  const pool = shuffle((data ?? []) as QuestionRow[]).filter(
    (q) => !excludeIds.has(q.id),
  );
  return pool.slice(0, need);
}

async function pickForSection(
  supabase: SupabaseClient,
  section: SectionCode,
  count: number,
  mastery: Map<string, { total: number; accuracy: number }>,
  difficultyBias?: DebriefPlan["difficultyBias"],
): Promise<QuestionRow[]> {
  if (count <= 0) return [];
  const m = mastery.get(section);
  const acc = m?.total ? m.accuracy : 55;
  const totalAtt = m?.total ?? 0;
  let { easy: ep, medium: mp, hard: hp } = difficultyPercents(acc, totalAtt);
  if (difficultyBias === "harder") {
    ep = Math.max(0.05, ep - 0.05);
    mp = Math.max(0.1, mp - 0.05);
    hp = hp + 0.1;
  } else if (difficultyBias === "review") {
    ep = ep + 0.1;
    mp = mp + 0.05;
    hp = Math.max(0.1, hp - 0.15);
  }
  const { easy, medium, hard } = splitCounts(count, ep, mp, hp);

  const picked: QuestionRow[] = [];
  const seen = new Set<string>();

  const take = (rows: QuestionRow[]) => {
    for (const q of rows) {
      if (picked.length >= count) break;
      if (seen.has(q.id)) continue;
      seen.add(q.id);
      picked.push(q);
    }
  };

  take(await fetchLevel(supabase, section, "easy", easy));
  take(await fetchLevel(supabase, section, "medium", medium));
  take(await fetchLevel(supabase, section, "hard", hard));

  const short = count - picked.length;
  if (short > 0) {
    take(await fillShortfall(supabase, section, short, seen));
  }

  return picked.slice(0, count);
}

/**
 * Build a practice question list. `total` defaults to PRACTICE_TOTAL (110); the
 * shorter PRACTICE_SMOKE_TOTAL (10) is supported for end-to-end flow testing.
 *
 * National/state mirrors the real exam, per-section counts come from weakness,
 * per-section easy/medium/hard mix from strength.
 *
 * For very small totals (e.g. 10) we drop the per-section minimum floor so the
 * weakness signal isn't drowned by enforcing one question per section across
 * 12 sections.
 */
export async function pickPracticeQuestions(
  supabase: SupabaseClient,
  userId: string,
  total: number = PRACTICE_TOTAL,
  planInput?: DebriefPlan | null,
): Promise<QuestionRow[]> {
  const plan = planInput ? sanitizePlan(planInput) : null;
  const target = Math.max(1, Math.floor(total));

  const nationalTarget = Math.round(target * NATIONAL_SHARE);
  let stateTarget = target - nationalTarget;
  if (nationalTarget + stateTarget !== target) {
    stateTarget = target - nationalTarget;
  }
  const nationalCodes = SECTIONS.filter((s) => s.group === "National").map(
    (s) => s.code,
  );
  const stateCodes = SECTIONS.filter((s) => s.group === "State").map(
    (s) => s.code,
  );

  const { data: rows } = await supabase
    .from("v_user_section_mastery")
    .select("section_code, total, correct, accuracy")
    .eq("user_id", userId);

  const mastery = new Map<string, { total: number; accuracy: number }>();
  for (const r of (rows ?? []) as MasteryRow[]) {
    mastery.set(r.section_code, {
      total: r.total,
      accuracy: Number(r.accuracy ?? 0),
    });
  }

  // Floors only make sense at full length. For a 10-question smoke run, use 0
  // so allocation can concentrate on the weakest 6–8 sections.
  const nationalMin = target >= 60 ? 2 : 0;
  const stateMin = target >= 60 ? 1 : 0;

  const multipliers = new Map<string, number>();
  const floors = new Map<string, number>();
  if (plan) {
    for (const code of plan.focus ?? []) {
      multipliers.set(code, FOCUS_MULTIPLIER);
      if (target >= 15) floors.set(code, FOCUS_FLOOR);
    }
    for (const code of plan.avoid ?? []) {
      if (!multipliers.has(code)) multipliers.set(code, AVOID_MULTIPLIER);
    }
  }

  const nationalCounts = allocateSectionCounts(
    nationalTarget,
    nationalCodes,
    mastery,
    { minPer: nationalMin, alpha: 1.75, multipliers, floors },
  );
  const stateCounts = allocateSectionCounts(
    stateTarget,
    stateCodes,
    mastery,
    { minPer: stateMin, alpha: 1.75, multipliers, floors },
  );

  const bias = plan?.difficultyBias;
  const out: QuestionRow[] = [];
  for (const code of nationalCodes) {
    const n = nationalCounts.get(code) ?? 0;
    out.push(...(await pickForSection(supabase, code, n, mastery, bias)));
  }
  for (const code of stateCodes) {
    const n = stateCounts.get(code) ?? 0;
    out.push(...(await pickForSection(supabase, code, n, mastery, bias)));
  }

  const shuffled = shuffle(out);
  if (shuffled.length >= target) {
    return shuffled.slice(0, target);
  }

  const need = target - shuffled.length;
  const { data: filler } = await datasetBankOnly(
    supabase.from("questions").select("*").eq("pool", "standard"),
  ).limit(need * 4);
  const ids = new Set(shuffled.map((q) => q.id));
  const extra = shuffle((filler ?? []) as QuestionRow[]).filter(
    (q) => !ids.has(q.id),
  );
  return shuffle([...shuffled, ...extra]).slice(0, target);
}
