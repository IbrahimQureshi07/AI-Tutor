import type { Journey } from "@/lib/journey/load";
import type { UserStats } from "@/lib/kpi/stats";
import {
  sessionModeLabel,
  sessionRunTypeLabel,
  type SessionHistoryRow,
  type SessionMode,
  type SessionRunType,
} from "@/lib/admin/session-history";

export type FinishedTestScore = {
  mode: SessionMode;
  label: string;
  latest: number | null;
  best: number | null;
  finishedCount: number;
};

export type ModeRunBreakdownRow = {
  mode: SessionMode;
  modeLabel: string;
  runType: SessionRunType;
  runTypeLabel: string;
  finished: number;
  partial: number;
};

const ALL_MODES: SessionMode[] = [
  "assessment",
  "practice",
  "mistakes",
  "mock",
  "final",
];

/** Latest + best scores from finished sessions only. */
export function buildFinishedTestScores(
  sessions: SessionHistoryRow[],
): FinishedTestScore[] {
  const scoresByMode = new Map<
    SessionMode,
    { latest: number | null; best: number | null; count: number }
  >();

  for (const mode of ALL_MODES) {
    scoresByMode.set(mode, { latest: null, best: null, count: 0 });
  }

  for (const s of sessions) {
    if (s.status !== "finished") continue;
    const entry = scoresByMode.get(s.mode);
    if (!entry) continue;
    entry.count += 1;
    if (s.scorePct != null) {
      if (entry.latest === null) entry.latest = s.scorePct;
      entry.best =
        entry.best == null ? s.scorePct : Math.max(entry.best, s.scorePct);
    }
  }

  return ALL_MODES.map((mode) => {
    const e = scoresByMode.get(mode)!;
    return {
      mode,
      label: sessionModeLabel(mode),
      latest: e.latest,
      best: e.best,
      finishedCount: e.count,
    };
  });
}

/** Count sessions by mode, run type, and finished vs partial. */
export function buildModeRunBreakdown(
  sessions: SessionHistoryRow[],
): ModeRunBreakdownRow[] {
  const map = new Map<
    string,
    { mode: SessionMode; runType: SessionRunType; finished: number; partial: number }
  >();

  for (const s of sessions) {
    const key = `${s.mode}:${s.runType}`;
    let row = map.get(key);
    if (!row) {
      row = { mode: s.mode, runType: s.runType, finished: 0, partial: 0 };
      map.set(key, row);
    }
    if (s.status === "finished") row.finished += 1;
    else if (s.status === "in_progress" || s.status === "abandoned") {
      row.partial += 1;
    }
  }

  const modeOrder = ALL_MODES.indexOf.bind(ALL_MODES);
  return [...map.values()]
    .filter((r) => r.finished > 0 || r.partial > 0)
    .sort((a, b) => {
      const mo = modeOrder(a.mode) - modeOrder(b.mode);
      if (mo !== 0) return mo;
      return a.runType.localeCompare(b.runType);
    })
    .map((r) => ({
      mode: r.mode,
      modeLabel: sessionModeLabel(r.mode),
      runType: r.runType,
      runTypeLabel: sessionRunTypeLabel(r.runType, r.mode),
      finished: r.finished,
      partial: r.partial,
    }));
}

export type LifetimeMetrics = {
  totalQuestions: number;
  totalCorrect: number;
  accuracy: number;
  sevenDayAccuracy: number;
  readinessScore: number;
  coverageSections: number;
  totalSections: number;
  openMistakes: number;
  activeDaysLast30: number;
  studyMsLast30: number;
};

export function buildLifetimeMetrics(
  stats: UserStats,
  coverageSections: number,
): LifetimeMetrics {
  return {
    totalQuestions: stats.totalAttempts,
    totalCorrect: stats.totalCorrect,
    accuracy: stats.overallAccuracy,
    sevenDayAccuracy: stats.sevenDayAccuracy,
    readinessScore: stats.readinessScore,
    coverageSections,
    totalSections: stats.mastery.length,
    openMistakes: stats.unresolvedMistakes,
    activeDaysLast30: stats.activeDaysLast30,
    studyMsLast30: stats.studyMsLast30,
  };
}

/** @deprecated use buildFinishedTestScores — kept for journey fallback if needed */
export function mergeJourneyScores(
  finished: FinishedTestScore[],
  journey: Journey,
): FinishedTestScore[] {
  return finished.map((row) => {
    if (row.mode === "final") return row;
    const series = journey.perMode[row.mode as keyof Journey["perMode"]];
    if (!series) return row;
    return {
      ...row,
      latest: row.latest ?? series.latest,
      best: row.best ?? series.best,
    };
  });
}
