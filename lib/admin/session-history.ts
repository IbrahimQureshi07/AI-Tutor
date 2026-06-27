import type { SupabaseClient } from "@supabase/supabase-js";
import { MOCK_SMOKE_TOTAL, MOCK_TOTAL } from "@/lib/mock/pick-questions";
import {
  PRACTICE_SMOKE_TOTAL,
  PRACTICE_TOTAL,
} from "@/lib/practice/pick-questions";
import {
  MISTAKES_SMOKE_TOTAL,
  MISTAKES_TOTAL,
} from "@/lib/mistakes/pick-questions";

export type SessionMode =
  | "assessment"
  | "practice"
  | "mistakes"
  | "mock"
  | "final";

export type SessionRunType =
  | "smoke"
  | "full"
  | "custom"
  | "quick"
  | "deep"
  | "unknown";

export type SessionHistoryRow = {
  id: string;
  mode: SessionMode;
  runType: SessionRunType;
  status: "in_progress" | "finished" | "abandoned";
  startedAt: string;
  finishedAt: string | null;
  scorePct: number | null;
  answered: number;
  total: number;
  correct: number;
  durationMs: number | null;
};

export type SessionAttemptRow = {
  id: string;
  questionId: string;
  sectionCode: string;
  promptPreview: string;
  userAnswer: string | null;
  correctOption: string;
  isCorrect: boolean;
  isSibling: boolean;
  hinted: boolean;
  timeSpentMs: number;
  createdAt: string;
};

export type SessionDetail = SessionHistoryRow & {
  userId: string;
  attempts: SessionAttemptRow[];
};

type SessionConfig = Record<string, unknown> | null;

function asConfig(raw: unknown): SessionConfig {
  if (!raw || typeof raw !== "object") return null;
  return raw as Record<string, unknown>;
}

const ASSESSMENT_PER_SECTION = {
  smoke: 2,
  quick: 15,
  deep: 35,
} as const;

function inferAssessmentFromPerSection(
  perSection: number,
): SessionRunType | null {
  if (perSection === ASSESSMENT_PER_SECTION.smoke) return "smoke";
  if (perSection === ASSESSMENT_PER_SECTION.quick) return "quick";
  if (perSection === ASSESSMENT_PER_SECTION.deep) return "deep";
  return null;
}

function inferAssessmentRunType(
  config: SessionConfig,
  target: number | null,
): SessionRunType | null {
  if (typeof config?.per_section === "number") {
    const fromPer = inferAssessmentFromPerSection(config.per_section);
    if (fromPer) return fromPer;
  }

  const sections = config?.sections;
  if (Array.isArray(sections) && sections.length > 0 && target != null && target > 0) {
    const perSection = Math.round(target / sections.length);
    const fromPer = inferAssessmentFromPerSection(perSection);
    if (fromPer) return fromPer;
  }

  if (target == null || target <= 0) return null;

  if (target <= 24) return "smoke";

  for (let sectionCount = 1; sectionCount <= 12; sectionCount += 1) {
    if (target === sectionCount * ASSESSMENT_PER_SECTION.quick) return "quick";
    if (target === sectionCount * ASSESSMENT_PER_SECTION.deep) return "deep";
    if (target === sectionCount * ASSESSMENT_PER_SECTION.smoke) return "smoke";
  }

  return null;
}

export function resolveSessionRunType(
  mode: string,
  config: SessionConfig,
): SessionRunType {
  const length = config?.length;
  if (typeof length === "string") {
    if (
      length === "smoke" ||
      length === "full" ||
      length === "custom" ||
      length === "quick" ||
      length === "deep"
    ) {
      return length;
    }
  }

  const target =
    typeof config?.target_total === "number"
      ? config.target_total
      : Array.isArray(config?.question_ids)
        ? config.question_ids.length
        : null;

  if (mode === "assessment") {
    const inferred = inferAssessmentRunType(config, target);
    if (inferred) return inferred;
  }

  if (target != null) {
    if (mode === "practice") {
      if (target === PRACTICE_SMOKE_TOTAL) return "smoke";
      if (target === PRACTICE_TOTAL) return "full";
      return "custom";
    }
    if (mode === "mistakes") {
      if (target === MISTAKES_SMOKE_TOTAL) return "smoke";
      if (target === MISTAKES_TOTAL) return "full";
      return "custom";
    }
    if (mode === "mock") {
      if (target === MOCK_SMOKE_TOTAL) return "smoke";
      if (target === MOCK_TOTAL) return "full";
      return "custom";
    }
    if (mode === "final") return "full";
  }

  return "unknown";
}

export function sessionRunTypeLabel(
  type: SessionRunType,
  mode?: SessionMode | string,
): string {
  if (type === "unknown") return "—";

  if (mode === "assessment") {
    switch (type) {
      case "quick":
        return "Quick check";
      case "deep":
        return "Deep diagnostic";
      case "smoke":
        return "Smoke test";
      default:
        break;
    }
  }

  switch (type) {
    case "smoke":
      return "Smoke";
    case "full":
      return "Full";
    case "custom":
      return "Custom";
    case "quick":
      return "Quick check";
    case "deep":
      return "Deep diagnostic";
    default:
      return "—";
  }
}

export function sessionModeLabel(mode: SessionMode): string {
  switch (mode) {
    case "assessment":
      return "Assessment";
    case "practice":
      return "Practice";
    case "mistakes":
      return "Mistakes";
    case "mock":
      return "Mock Exam";
    case "final":
      return "Final Test";
    default:
      return mode;
  }
}

export function fmtDurationMs(ms: number | null): string {
  if (!ms || ms <= 0) return "—";
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function plannedTotal(config: SessionConfig): number {
  if (typeof config?.target_total === "number") return config.target_total;
  if (Array.isArray(config?.question_ids)) return config.question_ids.length;
  return 0;
}

type RawAttempt = {
  question_id: string;
  user_answer: string | null;
  is_correct: boolean;
  is_sibling?: boolean;
};

function summarizeAttempts(
  attempts: RawAttempt[],
  config: SessionConfig,
): { answered: number; correct: number; total: number } {
  const total = plannedTotal(config);
  const primary = attempts.filter((a) => !a.is_sibling);
  const answeredIds = new Set(
    primary.filter((a) => a.user_answer != null).map((a) => a.question_id),
  );
  const correct = primary.filter((a) => a.is_correct).length;
  return {
    answered: answeredIds.size || primary.length,
    correct,
    total,
  };
}

export async function loadSessionHistory(
  client: SupabaseClient,
  userId: string,
  opts?: { limit?: number },
): Promise<SessionHistoryRow[]> {
  const limit = opts?.limit ?? 100;
  const { data: sessions } = await client
    .from("sessions")
    .select(
      "id, mode, status, started_at, finished_at, score_pct, duration_ms, config",
    )
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (!sessions?.length) return [];

  const sessionIds = sessions.map((s) => s.id as string);
  const { data: attemptRows } = await client
    .from("attempts")
    .select("session_id, question_id, user_answer, is_correct, is_sibling")
    .eq("user_id", userId)
    .in("session_id", sessionIds);

  const attemptsBySession = new Map<string, RawAttempt[]>();
  for (const row of (attemptRows ?? []) as Array<
    RawAttempt & { session_id: string }
  >) {
    const list = attemptsBySession.get(row.session_id) ?? [];
    list.push(row);
    attemptsBySession.set(row.session_id, list);
  }

  return sessions.map((s) => {
    const config = asConfig(s.config);
    const mode = s.mode as SessionMode;
    const agg = summarizeAttempts(attemptsBySession.get(s.id) ?? [], config);
    return {
      id: s.id as string,
      mode,
      runType: resolveSessionRunType(mode, config),
      status: s.status as SessionHistoryRow["status"],
      startedAt: s.started_at as string,
      finishedAt: (s.finished_at as string | null) ?? null,
      scorePct:
        s.score_pct == null ? null : Math.round(Number(s.score_pct)),
      answered: agg.answered,
      total: agg.total,
      correct: agg.correct,
      durationMs: (s.duration_ms as number | null) ?? null,
    };
  });
}

export async function loadSessionDetail(
  client: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<SessionDetail | null> {
  const { data: session } = await client
    .from("sessions")
    .select(
      "id, user_id, mode, status, started_at, finished_at, score_pct, duration_ms, config",
    )
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!session) return null;

  const config = asConfig(session.config);
  const mode = session.mode as SessionMode;

  const { data: rawAttempts } = await client
    .from("attempts")
    .select(
      "id, question_id, user_answer, is_correct, is_sibling, hinted, time_spent_ms, created_at, question:questions(section_code, prompt, correct_option)",
    )
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const attempts: SessionAttemptRow[] = (rawAttempts ?? []).map((row) => {
    const q = row.question as {
      section_code?: string;
      prompt?: string;
      correct_option?: string;
    } | null;
    const prompt = q?.prompt ?? "";
    return {
      id: row.id as string,
      questionId: row.question_id as string,
      sectionCode: q?.section_code ?? "—",
      promptPreview: prompt.length > 120 ? `${prompt.slice(0, 117)}…` : prompt,
      userAnswer: (row.user_answer as string | null) ?? null,
      correctOption: q?.correct_option ?? "—",
      isCorrect: Boolean(row.is_correct),
      isSibling: Boolean(row.is_sibling),
      hinted: Boolean(row.hinted),
      timeSpentMs: (row.time_spent_ms as number) ?? 0,
      createdAt: row.created_at as string,
    };
  });

  const agg = summarizeAttempts(
    (rawAttempts ?? []) as RawAttempt[],
    config,
  );

  return {
    id: session.id as string,
    userId: session.user_id as string,
    mode,
    runType: resolveSessionRunType(mode, config),
    status: session.status as SessionHistoryRow["status"],
    startedAt: session.started_at as string,
    finishedAt: (session.finished_at as string | null) ?? null,
    scorePct:
      session.score_pct == null ? null : Math.round(Number(session.score_pct)),
    answered: agg.answered,
    total: agg.total,
    correct: agg.correct,
    durationMs: (session.duration_ms as number | null) ?? null,
    attempts,
  };
}
