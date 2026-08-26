import type { SupabaseClient } from "@supabase/supabase-js";
import { MOCK_SMOKE_TOTAL } from "@/lib/mock/pick-questions";
import { FINAL_PASS_PCT, type Portion } from "@/lib/final/pick-questions";

const PARTIAL_RETAKE_WINDOW_DAYS = 180; // SC PSI gives 6 months to pass the remaining portion.

/* ------------------------------ types ----------------------------------- */

export type GateStatus = {
  unlocked: boolean;
  reasons: string[]; // reasons it's locked, empty if unlocked
  details: {
    /** Most recent *full* mock score (display). */
    bestRecentMockPct: number | null;
    /** Average of the two most recent *full* mocks (display). */
    avgLast2MockPct: number | null;
    /**
     * True once the student has ever cleared the Mock readiness bar
     * (any full mock ≥75%, or any consecutive full-mock pair averaging ≥70%).
     * Stays true even if later mocks score lower — Final does not re-lock.
     */
    mockGateCleared: boolean;
    /**
     * True if the user has finished at least one Mock **smoke** session.
     * Only actually waives the strict Mock score gate for admins (QA) — see
     * `smokeUnlocksFinal`. For students this is informational only.
     */
    smokeMockCompleted: boolean;
    /**
     * True iff `smokeMockCompleted` is actually allowed to unlock Final for
     * this user (admins only). Students must clear a real Mock score.
     */
    smokeUnlocksFinal: boolean;
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

async function getFinishedFullMockScores(
  supabase: SupabaseClient,
  userId: string,
  limit = 50,
): Promise<number[]> {
  const { data } = await supabase
    .from("sessions")
    .select("score_pct, finished_at, config")
    .eq("user_id", userId)
    .eq("mode", "mock")
    .eq("status", "finished")
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(limit);

  const scores: number[] = [];
  for (const row of data ?? []) {
    const cfg = row.config as { length?: string; target_total?: number } | null;
    // Smoke is practice/QA only — it must never count toward Final unlock.
    if (cfg?.length === "smoke" || cfg?.target_total === MOCK_SMOKE_TOTAL) {
      continue;
    }
    const pct = row.score_pct == null ? null : Number(row.score_pct);
    if (typeof pct === "number" && !Number.isNaN(pct)) scores.push(pct);
  }
  return scores;
}

/**
 * True if the student has EVER cleared the Mock readiness bar.
 * Once true, Final stays unlocked even if later mocks score lower.
 *
 *   - any single full mock ≥ 75%, OR
 *   - any two consecutive full mocks (by finish time) average ≥ 70%
 */
function everClearedMockGate(mockPctsNewestFirst: number[]): boolean {
  if (mockPctsNewestFirst.some((p) => p >= 75)) return true;
  for (let i = 0; i < mockPctsNewestFirst.length - 1; i++) {
    const avg = Math.round(
      (mockPctsNewestFirst[i] + mockPctsNewestFirst[i + 1]) / 2,
    );
    if (avg >= 70) return true;
  }
  return false;
}

/** Finished smoke mock = QA path to open Final without 75%/70% mock. */
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
 * Condition to unlock (unless partial-retake is active):
 *
 *   Ever cleared Mock readiness (sticky — does not re-lock later):
 *     any full Mock score ≥ 75%   OR
 *     any two consecutive full Mocks averaging ≥ 70%
 *   OR (admin/QA only) at least one **finished Mock smoke** session — any
 *   score. Smoke runs are a quick practice/QA shortcut; students must clear
 *   a real Mock score to unlock the Final — a smoke run never does.
 *
 * No cooldown between attempts and no separate recent-Mistakes requirement —
 * the held-out/unseen-pool check on the question picker already guards
 * against re-serving seen questions, so extra time-based gates just add
 * friction without protecting the measurement.
 *
 * Partial-retake mode is allowed regardless of new Mock scores — the user
 * already proved readiness for one portion; we just want a fresh attempt
 * on the missing one inside the 6-month window.
 */
export async function getFinalGateStatus(
  supabase: SupabaseClient,
  userId: string,
  isAdmin: boolean = false,
): Promise<GateStatus> {
  const now = new Date();
  const [mockPcts, finals, smokeMockCompleted] = await Promise.all([
    getFinishedFullMockScores(supabase, userId, 50),
    getFinishedFinalSessions(supabase, userId),
    hasFinishedSmokeMock(supabase, userId),
  ]);

  const bestRecentMockPct = mockPcts.length > 0 ? mockPcts[0] : null;
  const avgLast2MockPct =
    mockPcts.length >= 2
      ? Math.round((mockPcts[0] + mockPcts[1]) / 2)
      : mockPcts.length === 1
        ? mockPcts[0]
        : null;

  const partial = computePartialRetake(finals, now);

  const mockGateCleared = everClearedMockGate(mockPcts);
  const smokeUnlocksFinal = isAdmin;
  const mockOkQa = smokeMockCompleted && smokeUnlocksFinal;

  const reasons: string[] = [];

  // Gate: Mock readiness — only enforced if we're NOT in a partial-retake
  // window (in which case the user already cleared the bar).
  if (!partial?.active) {
    if (!mockGateCleared && !mockOkQa) {
      reasons.push(
        isAdmin
          ? bestRecentMockPct == null
            ? "Take at least one Mock Exam first (full mock ≥70–75% or finish a smoke mock to open Final for testing)."
            : `Need a full Mock ≥75% (or two consecutive mocks averaging ≥70%). Latest: ${Math.round(bestRecentMockPct)}%. Once cleared, Final stays unlocked.`
          : bestRecentMockPct == null
            ? "Take at least one full Mock Exam first (≥70–75%) to unlock the Final Test."
            : `Need a full Mock ≥75% (or two consecutive mocks averaging ≥70%) to unlock the Final Test. Latest: ${Math.round(bestRecentMockPct)}%. Once unlocked, it stays open.`,
      );
    }
  }

  return {
    unlocked: reasons.length === 0,
    reasons,
    details: {
      bestRecentMockPct,
      avgLast2MockPct,
      mockGateCleared,
      smokeMockCompleted,
      smokeUnlocksFinal,
    },
    partialRetake: partial,
  };
}
