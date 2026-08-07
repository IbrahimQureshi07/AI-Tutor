import type { SupabaseClient } from "@supabase/supabase-js";
import { MOCK_SMOKE_TOTAL } from "@/lib/mock/pick-questions";
import { FINAL_PASS_PCT, type Portion } from "@/lib/final/pick-questions";

const RECENT_MISTAKES_DAYS = 30;
const PARTIAL_RETAKE_WINDOW_DAYS = 180; // SC PSI gives 6 months to pass the remaining portion.

/* ------------------------------ types ----------------------------------- */

export type GateStatus = {
  unlocked: boolean;
  reasons: string[]; // reasons it's locked, empty if unlocked
  details: {
    bestRecentMockPct: number | null;
    avgLast2MockPct: number | null;
    daysSinceLastMistakes: number | null;
    /**
     * True if the user has finished at least one Mock **smoke** session.
     * That waives the strict Mock score + recent Mistakes gates so you can
     * exercise the Final flow without passing a full mock.
     */
    smokeMockCompleted: boolean;
  };
  /**
   * If the user passed exactly one portion in their most recent Final and
   * is still inside the 6-month partial-retake window, this is set.
   */
  partialRetake: PartialRetakeState | null;
};

export type PartialRetakeState = {
  active: boolean;
  passedPortion: Portion;
  needPortion: Portion;
  windowEndsAt: string;
  daysRemaining: number;
};

type SessionRow = {
  id: string;
  config: Record<string, unknown> | null;
  score_pct: number | null;
  finished_at: string | null;
  status: string;
};

/* ------------------------------ helpers --------------------------------- */

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

async function getFinishedFinalSessions(
  supabase: SupabaseClient,
  userId: string,
): Promise<SessionRow[]> {
  const { data } = await supabase
    .from("sessions")
    .select("id, config, score_pct, finished_at, status")
    .eq("user_id", userId)
    .eq("mode", "final")
    .eq("status", "finished")
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(10);
  return (data ?? []) as SessionRow[];
}

async function getRecentMockSessions(
  supabase: SupabaseClient,
  userId: string,
  limit = 5,
): Promise<{ score_pct: number | null }[]> {
  const { data } = await supabase
    .from("sessions")
    .select("score_pct, finished_at")
    .eq("user_id", userId)
    .eq("mode", "mock")
    .eq("status", "finished")
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as { score_pct: number | null }[];
}

/** Finished smoke mock = QA path to open Final without 75%/70% mock or recent Mistakes. */
async function hasFinishedSmokeMock(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("sessions")
    .select("config")
    .eq("user_id", userId)
    .eq("mode", "mock")
    .eq("status", "finished")
    .not("finished_at", "is", null)
    .limit(20);
  for (const row of data ?? []) {
    const cfg = row.config as { length?: string; target_total?: number } | null;
    if (cfg?.length === "smoke" || cfg?.target_total === MOCK_SMOKE_TOTAL) {
      return true;
    }
  }
  return false;
}

async function getMostRecentMistakes(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ finished_at: string | null } | null> {
  const { data } = await supabase
    .from("sessions")
    .select("finished_at")
    .eq("user_id", userId)
    .eq("mode", "mistakes")
    .eq("status", "finished")
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data ?? null) as { finished_at: string | null } | null;
}

/**
 * Read the dual-portion result the Final report writer stores in
 * session.config.report. Falls back to combined-score parsing if the report
 * isn't there (legacy sessions).
 */
function readPortionResult(s: SessionRow): {
  nationalPct: number | null;
  statePct: number | null;
  nationalPassed: boolean | null;
  statePassed: boolean | null;
  passed: boolean;
} {
  const report = (s.config as { report?: Record<string, unknown> } | null)
    ?.report as
    | {
        nationalPct?: number;
        statePct?: number;
        nationalPassed?: boolean;
        statePassed?: boolean;
        passed?: boolean;
      }
    | undefined;
  if (report) {
    return {
      nationalPct: report.nationalPct ?? null,
      statePct: report.statePct ?? null,
      nationalPassed: report.nationalPassed ?? null,
      statePassed: report.statePassed ?? null,
      passed: !!report.passed,
    };
  }
  // Legacy: only combined score available. Treat ≥ pass as full-pass.
  const combined = Number(s.score_pct ?? 0);
  const passed = combined >= FINAL_PASS_PCT;
  return {
    nationalPct: null,
    statePct: null,
    nationalPassed: null,
    statePassed: null,
    passed,
  };
}

/* ------------------------------ partial-retake -------------------------- */

/**
 * If the most recent Final passed exactly one portion AND we're still
 * inside the 6-month partial-retake window, the next Final should auto-
 * select the missing portion.
 *
 * If a later Final fully passed BOTH portions, the partial state is cleared.
 */
function computePartialRetake(
  sessions: SessionRow[],
  now: Date,
): PartialRetakeState | null {
  // Find most recent session in chronological order.
  for (const s of sessions) {
    if (!s.finished_at) continue;
    const r = readPortionResult(s);
    // If this session passed both, the journey is done.
    if (r.passed && r.nationalPassed !== false && r.statePassed !== false) {
      return null;
    }
    // If this session passed exactly one portion (per dual-portion data),
    // start the 6-month clock from here.
    const npassed = r.nationalPassed === true;
    const spassed = r.statePassed === true;
    if (npassed !== spassed) {
      const finishedAt = new Date(s.finished_at);
      const windowEnd = new Date(finishedAt);
      windowEnd.setDate(windowEnd.getDate() + PARTIAL_RETAKE_WINDOW_DAYS);
      const daysRemaining = Math.max(0, daysBetween(windowEnd, now));
      return {
        active: daysRemaining > 0,
        passedPortion: npassed ? "national" : "state",
        needPortion: npassed ? "state" : "national",
        windowEndsAt: windowEnd.toISOString(),
        daysRemaining,
      };
    }
    // First non-conforming session breaks the search; legacy/full-fail
    // sessions don't carry partial state.
    return null;
  }
  return null;
}

/* ------------------------------ gate ----------------------------------- */

/**
 * Gate logic for Final Test access.
 *
 * Conditions ALL must be met (unless partial-retake is active):
 *
 *   1. Most recent Mock score ≥ 75%   OR
 *      Average of last 2 Mocks ≥ 70%
 *      OR (QA) at least one **finished Mock smoke** session — any score.
 *
 *   2. At least one Mistakes session finished in the last 30 days
 *      (waived if (1) satisfied via smoke-mock QA path).
 *
 * No cooldown between attempts — the held-out/unseen-pool check on the
 * question picker already guards against re-serving seen questions, so a
 * time-based retake lock isn't needed and only frustrates students who are
 * ready to try again immediately.
 *
 * Partial-retake mode is allowed regardless of new Mock scores — the user
 * already proved readiness for one portion; we just want a fresh attempt
 * on the missing one inside the 6-month window.
 */
export async function getFinalGateStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<GateStatus> {
  const now = new Date();
  const [mocks, mistakes, finals, smokeMockCompleted] = await Promise.all([
    getRecentMockSessions(supabase, userId, 5),
    getMostRecentMistakes(supabase, userId),
    getFinishedFinalSessions(supabase, userId),
    hasFinishedSmokeMock(supabase, userId),
  ]);

  const mockPcts = mocks
    .map((m) => (m.score_pct == null ? null : Number(m.score_pct)))
    .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));

  const bestRecentMockPct = mockPcts.length > 0 ? mockPcts[0] : null;
  const avgLast2MockPct =
    mockPcts.length >= 2
      ? Math.round((mockPcts[0] + mockPcts[1]) / 2)
      : mockPcts.length === 1
        ? mockPcts[0]
        : null;

  const daysSinceLastMistakes = mistakes?.finished_at
    ? daysBetween(now, new Date(mistakes.finished_at))
    : null;

  const partial = computePartialRetake(finals, now);

  const mockOkStrict =
    (bestRecentMockPct != null && bestRecentMockPct >= 75) ||
    (avgLast2MockPct != null && avgLast2MockPct >= 70);
  const mockOkQa = smokeMockCompleted;

  const reasons: string[] = [];

  // Gate 1: Mock readiness — only enforced if we're NOT in a partial-retake
  // window (in which case the user already cleared the bar).
  if (!partial?.active) {
    if (!mockOkStrict && !mockOkQa) {
      reasons.push(
        bestRecentMockPct == null
          ? "Take at least one Mock Exam first (full mock ≥70–75% or finish a smoke mock to open Final for testing)."
          : `Need a Mock score ≥75% (most recent: ${Math.round(bestRecentMockPct)}%), average ≥70% over last 2, or finish a Mock smoke test for QA access.`,
      );
    }
  }

  // Gate 2: Recent Mistakes activity — relaxed in partial-retake (you've
  // already validated readiness for one side). Also waived when smoke-mock
  // QA path satisfied gate 1 (so you can test Final without a fresh Mistakes).
  if (!partial?.active) {
    const mistakesWaived = smokeMockCompleted && !mockOkStrict;
    if (
      !mistakesWaived &&
      (daysSinceLastMistakes == null ||
        daysSinceLastMistakes > RECENT_MISTAKES_DAYS)
    ) {
      reasons.push(
        `Run a Mistakes Test in the last ${RECENT_MISTAKES_DAYS} days for recent recall signal.`,
      );
    }
  }

  return {
    unlocked: reasons.length === 0,
    reasons,
    details: {
      bestRecentMockPct,
      avgLast2MockPct,
      daysSinceLastMistakes,
      smokeMockCompleted,
    },
    partialRetake: partial,
  };
}
