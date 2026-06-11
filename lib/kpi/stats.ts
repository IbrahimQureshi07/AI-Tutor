import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { SECTIONS, type SectionCode } from "@/lib/constants";

export type SectionMastery = {
  code: SectionCode;
  title: string;
  group: "National" | "State";
  total: number;
  correct: number;
  accuracy: number; // 0-100
};

export type ModeSessionTotals = {
  assessment: number;
  practice: number;
  mistakes: number;
  mock: number;
  final: number;
};

export type UserStats = {
  totalAttempts: number;
  totalCorrect: number;
  overallAccuracy: number;
  sevenDayAccuracy: number;
  attemptsToday: number;
  streakDays: number;
  readinessScore: number;
  mastery: SectionMastery[];
  recentSessions: {
    id: string;
    mode: string;
    started_at: string;
    finished_at: string | null;
    score_pct: number | null;
    duration_ms: number | null;
  }[];
  dailyActivity: { day: string; attempts: number; correct: number }[]; // last 70 days
  sparkline: number[]; // last 14 days accuracy
  topStrengths: SectionMastery[];
  topWeaknesses: SectionMastery[];
  unresolvedMistakes: number;
  /** Weighted accuracy across National (A1–A6) sections with attempts. */
  nationalAccuracy: number;
  /** Weighted accuracy across State (B1–B6) sections with attempts. */
  stateAccuracy: number;
  /** Finished sessions in the last 30 days (any mode). */
  finishedSessionsLast30: number;
  /** Sum of `duration_ms` for finished sessions in the last 30 days. */
  studyMsLast30: number;
  /** Days in the last 30 with at least one attempt (from daily rollup). */
  activeDaysLast30: number;
  /** Count of finished sessions by mode (from recent sample, capped). */
  modeTotals: ModeSessionTotals;
  /** Highest finished mock score, or null. */
  bestMockScore: number | null;
  /** Most recent finished mock score, or null. */
  lastMockScore: number | null;
  /** Most recent finished practice session score, or null. */
  lastPracticeScore: number | null;
};

function emptyModeTotals(): ModeSessionTotals {
  return { assessment: 0, practice: 0, mistakes: 0, mock: 0, final: 0 };
}

export async function getUserStats(
  userId: string,
  client?: SupabaseClient,
): Promise<UserStats> {
  // Existing callers pass nothing → RLS-bound server client (self only).
  // Admin callers can pass a service-role client to read any user's stats.
  const supabase = client ?? (await createClient());

  const [
    { data: masteryRows },
    { data: recent },
    { data: daily },
    { count: mistakesCount },
    { data: allAttempts },
    { data: last7Attempts },
    { count: todayCount },
    { data: finishedRecent },
    { data: finishedModes },
  ] = await Promise.all([
    supabase.from("v_user_section_mastery").select("*").eq("user_id", userId),
    supabase
      .from("sessions")
      .select("id, mode, started_at, finished_at, score_pct, duration_ms")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(8),
    supabase
      .from("v_user_daily_activity")
      .select("day, attempts, correct")
      .eq("user_id", userId)
      .gte("day", new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .order("day", { ascending: true }),
    supabase
      .from("v_user_mistakes")
      .select("question_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("resolved", false),
    supabase
      .from("attempts")
      .select("is_correct")
      .eq("user_id", userId),
    supabase
      .from("attempts")
      .select("is_correct")
      .eq("user_id", userId)
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", new Date(new Date().toDateString()).toISOString()),
    supabase
      .from("sessions")
      .select("mode, score_pct, finished_at, duration_ms, status")
      .eq("user_id", userId)
      .eq("status", "finished")
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(400),
    supabase
      .from("sessions")
      .select("mode")
      .eq("user_id", userId)
      .eq("status", "finished")
      .limit(2000),
  ]);

  const totalAttempts = allAttempts?.length ?? 0;
  const totalCorrect = allAttempts?.filter((a) => a.is_correct).length ?? 0;
  const overallAccuracy = totalAttempts
    ? Math.round((100 * totalCorrect) / totalAttempts)
    : 0;
  const sevenDayAccuracy =
    last7Attempts?.length
      ? Math.round(
          (100 * last7Attempts.filter((a) => a.is_correct).length) /
            last7Attempts.length,
        )
      : 0;
  const attemptsToday = todayCount ?? 0;

  // mastery
  const masteryMap = new Map<string, { total: number; correct: number; accuracy: number }>();
  for (const row of masteryRows ?? []) {
    masteryMap.set((row as { section_code: string }).section_code, {
      total: (row as { total: number }).total,
      correct: (row as { correct: number }).correct,
      accuracy: Number((row as { accuracy: number | null }).accuracy ?? 0),
    });
  }
  const mastery: SectionMastery[] = SECTIONS.map((s) => {
    const m = masteryMap.get(s.code);
    return {
      code: s.code,
      title: s.title,
      group: s.group,
      total: m?.total ?? 0,
      correct: m?.correct ?? 0,
      accuracy: Math.round(m?.accuracy ?? 0),
    };
  });
  const attempted = mastery.filter((m) => m.total > 0);
  const topStrengths = [...attempted]
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 3);
  const topWeaknesses = [...attempted]
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);

  // streak
  const daysSet = new Set(
    (daily ?? []).map((d) => (d as { day: string }).day as string),
  );
  let streakDays = 0;
  const now = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (daysSet.has(key)) streakDays++;
    else if (i > 0) break; // break on first gap (but allow today to be missed)
  }

  // sparkline (last 14 days accuracy)
  const sparkline: number[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayRow = (daily ?? []).find(
      (x) => (x as { day: string }).day === key,
    ) as { attempts: number; correct: number } | undefined;
    if (!dayRow || !dayRow.attempts) sparkline.push(0);
    else sparkline.push(Math.round((100 * dayRow.correct) / dayRow.attempts));
  }

  // readiness score: weighted composite (0-100)
  const mockLast = (recent ?? []).find((r) => r.mode === "mock");
  const coverageCount = attempted.length;
  const coverageScore = Math.min(100, Math.round((coverageCount / SECTIONS.length) * 100));
  const readinessScore = Math.round(
    0.45 * overallAccuracy +
      0.25 * (mockLast?.score_pct ?? 0) +
      0.15 * sevenDayAccuracy +
      0.15 * coverageScore,
  );

  const nat = mastery.filter((m) => m.group === "National");
  const st = mastery.filter((m) => m.group === "State");
  const natT = nat.reduce((a, m) => a + m.total, 0);
  const natC = nat.reduce((a, m) => a + m.correct, 0);
  const stT = st.reduce((a, m) => a + m.total, 0);
  const stC = st.reduce((a, m) => a + m.correct, 0);
  const nationalAccuracy = natT ? Math.round((100 * natC) / natT) : 0;
  const stateAccuracy = stT ? Math.round((100 * stC) / stT) : 0;

  const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dailyRows = ((daily ?? []) as { day: string; attempts: number; correct: number }[]) || [];
  let activeDaysLast30 = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row = dailyRows.find((x) => x.day === key);
    if (row && row.attempts > 0) activeDaysLast30++;
  }

  const finishedRows =
    (finishedRecent ?? []) as Array<{
      mode: string;
      score_pct: number | null;
      finished_at: string | null;
      duration_ms: number | null;
    }>;

  const modeTotals = emptyModeTotals();
  for (const row of (finishedModes ?? []) as { mode: string }[]) {
    const m = row.mode as keyof ModeSessionTotals;
    if (m in modeTotals) modeTotals[m] += 1;
  }

  let studyMsLast30 = 0;
  let finishedSessionsLast30 = 0;
  const mockScores: number[] = [];
  let lastMockScore: number | null = null;
  let lastPracticeScore: number | null = null;

  for (const row of finishedRows) {
    const finishedAt = row.finished_at ? new Date(row.finished_at) : null;
    if (finishedAt && finishedAt >= cutoff30) {
      finishedSessionsLast30++;
      studyMsLast30 += row.duration_ms ?? 0;
    }

    if (row.mode === "mock" && row.score_pct != null) {
      mockScores.push(Math.round(Number(row.score_pct)));
      if (lastMockScore === null) lastMockScore = Math.round(Number(row.score_pct));
    }
    if (row.mode === "practice" && row.score_pct != null && lastPracticeScore === null) {
      lastPracticeScore = Math.round(Number(row.score_pct));
    }
  }

  const bestMockScore =
    mockScores.length > 0 ? Math.max(...mockScores) : null;

  return {
    totalAttempts,
    totalCorrect,
    overallAccuracy,
    sevenDayAccuracy,
    attemptsToday,
    streakDays,
    readinessScore,
    mastery,
    recentSessions: recent ?? [],
    dailyActivity: dailyRows,
    sparkline,
    topStrengths,
    topWeaknesses,
    unresolvedMistakes: mistakesCount ?? 0,
    nationalAccuracy,
    stateAccuracy,
    finishedSessionsLast30,
    studyMsLast30,
    activeDaysLast30,
    modeTotals,
    bestMockScore,
    lastMockScore,
    lastPracticeScore,
  };
}
