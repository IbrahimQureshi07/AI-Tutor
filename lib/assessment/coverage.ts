import type { SupabaseClient } from "@supabase/supabase-js";
import { SECTIONS, type SectionCode } from "@/lib/constants";

/**
 * Coverage decays after this window. Older finished assessments don't keep
 * a section "covered" — the student must re-assess. This stops a stale
 * 0/15 result from gating Practice access for life.
 */
export const COVERAGE_FRESHNESS_DAYS = 7;

export type SectionFreshness = {
  code: SectionCode;
  /** Most recent finished assessment session timestamp that included this section. */
  lastAssessedAt: string | null;
  /** Whole days since lastAssessedAt (null if never). */
  daysSinceAssessed: number | null;
  /** True iff lastAssessedAt is within COVERAGE_FRESHNESS_DAYS. */
  fresh: boolean;
};

export type AssessmentCoverage = {
  /** Sections currently fresh-assessed (within freshness window). */
  covered: SectionCode[];
  /** Sections not fresh-assessed (never assessed OR stale). */
  missing: SectionCode[];
  /** True only when every section is currently fresh. */
  allCovered: boolean;
  /** Sections assessed at least once (any time). */
  coveredEver: SectionCode[];
  /** Sections never assessed (no finished assessment attempts ever). */
  missingEver: SectionCode[];
  /** True once the user has ever assessed every section at least once. */
  allCoveredEver: boolean;
  /** First missing section in canonical order (A1 → B6), or null. */
  nextSection: SectionCode | null;
  /** Sections that *had* coverage but are now expired (subset of missing). */
  stale: SectionCode[];
  /** Per-section freshness detail for UI display. */
  freshness: SectionFreshness[];
  /** Days used for the freshness window — mirrored to the client. */
  freshnessDays: number;
};

const ALL_CODES = SECTIONS.map((s) => s.code) as SectionCode[];

export function emptyCoverage(): AssessmentCoverage {
  return {
    covered: [],
    missing: [...ALL_CODES],
    allCovered: false,
    coveredEver: [],
    missingEver: [...ALL_CODES],
    allCoveredEver: false,
    nextSection: ALL_CODES[0] ?? null,
    stale: [],
    freshness: ALL_CODES.map((code) => ({
      code,
      lastAssessedAt: null,
      daysSinceAssessed: null,
      fresh: false,
    })),
    freshnessDays: COVERAGE_FRESHNESS_DAYS,
  };
}

/**
 * A section is "covered" if the user has at least one attempt belonging to
 * a FINISHED assessment session whose finished_at is within the freshness
 * window. We pick the *latest* such session per section, so the most
 * recent assessment is what counts for both the gate and per-section data
 * surfaced elsewhere.
 */
export async function getAssessmentCoverage(
  supabase: SupabaseClient,
  userId: string,
): Promise<AssessmentCoverage> {
  const { data: sessionRows } = await supabase
    .from("sessions")
    .select("id, finished_at")
    .eq("user_id", userId)
    .eq("mode", "assessment")
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false });

  const sessions = (sessionRows ?? []) as Array<{
    id: string;
    finished_at: string | null;
  }>;
  if (!sessions.length) return emptyCoverage();

  // Keep a quick lookup of finished_at per session id.
  const finishedAtBySession = new Map<string, string>();
  for (const s of sessions) {
    if (s.finished_at) finishedAtBySession.set(s.id, s.finished_at);
  }

  const sessionIds = sessions.map((s) => s.id);

  const { data: attemptRows } = await supabase
    .from("attempts")
    .select("session_id, question:questions(section_code)")
    .eq("user_id", userId)
    .in("session_id", sessionIds);

  // For each section, find the LATEST finished_at of any session that
  // included an attempt in that section.
  const lastBySection = new Map<string, string>();
  for (const row of (attemptRows ?? []) as Array<{
    session_id: string;
    question:
      | { section_code: string }
      | { section_code: string }[]
      | null;
  }>) {
    const q = row.question;
    const code = Array.isArray(q) ? q[0]?.section_code : q?.section_code;
    if (!code) continue;
    const finishedAt = finishedAtBySession.get(row.session_id);
    if (!finishedAt) continue;
    const prev = lastBySection.get(code);
    if (!prev || finishedAt > prev) {
      lastBySection.set(code, finishedAt);
    }
  }

  const now = Date.now();
  const cutoffMs = COVERAGE_FRESHNESS_DAYS * 24 * 60 * 60 * 1000;

  const freshness: SectionFreshness[] = ALL_CODES.map((code) => {
    const lastAssessedAt = lastBySection.get(code) ?? null;
    if (!lastAssessedAt) {
      return {
        code,
        lastAssessedAt: null,
        daysSinceAssessed: null,
        fresh: false,
      };
    }
    const ageMs = now - new Date(lastAssessedAt).getTime();
    const daysSinceAssessed = Math.max(0, Math.floor(ageMs / (24 * 60 * 60 * 1000)));
    return {
      code,
      lastAssessedAt,
      daysSinceAssessed,
      fresh: ageMs <= cutoffMs,
    };
  });

  const covered = freshness.filter((f) => f.fresh).map((f) => f.code);
  const missing = freshness.filter((f) => !f.fresh).map((f) => f.code);
  const stale = freshness
    .filter((f) => !f.fresh && f.lastAssessedAt !== null)
    .map((f) => f.code);

  const coveredEver = ALL_CODES.filter((code) => lastBySection.has(code));
  const missingEver = ALL_CODES.filter((code) => !lastBySection.has(code));

  return {
    covered,
    missing,
    allCovered: missing.length === 0,
    coveredEver,
    missingEver,
    allCoveredEver: missingEver.length === 0,
    nextSection: missing[0] ?? null,
    stale,
    freshness,
    freshnessDays: COVERAGE_FRESHNESS_DAYS,
  };
}
