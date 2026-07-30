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
  /** Full question stem (admin review). */
  prompt: string;
  /** Short preview kept for compact lists. */
  promptPreview: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  /** Student pick letter A–D. */
  userAnswer: string | null;
  /** Bank correct letter A–D. */
  correctOption: string;
  isCorrect: boolean;
  isSibling: boolean;
  hinted: boolean;
  timeSpentMs: number;
  createdAt: string;
  /** Raw questions.source from DB. */
  questionSource: string | null;
  /** questions.is_ai_generated */
  isAiGenerated: boolean;
  /** Content origin for admin badges. */
  contentOrigin: QuestionContentOrigin;
};

export type QuestionContentOrigin = {
  kind: "dataset" | "llm";
  /** Short badge text, e.g. "Dataset" or "LLM generated". */
  label: string;
  /** Optional detail for tooltip / secondary text. */
  detail: string;
};

/**
 * Classify whether a question row came from the imported bank or AI sibling gen.
 * LLM: is_ai_generated, or source ai_sibling / ai_sibling_harder.
 * Everything else → Dataset (CSV import / manual bank).
 */
export function resolveQuestionContentOrigin(meta: {
  source?: string | null;
  isAiGenerated?: boolean | null;
}): QuestionContentOrigin {
  const source = (meta.source ?? "").trim().toLowerCase();
  const aiFlag = meta.isAiGenerated === true;
  const aiFromSource =
    source === "ai_sibling" ||
    source === "ai_sibling_harder" ||
    source.startsWith("ai_");

  if (aiFlag || aiFromSource) {
    if (source === "ai_sibling_harder") {
      return {
        kind: "llm",
        label: "LLM generated",
        detail: "AI harder follow-up (extra try) saved into the question bank",
      };
    }
    if (source === "ai_sibling" || aiFlag) {
      return {
        kind: "llm",
        label: "LLM generated",
        detail: "AI follow-up question saved into the question bank",
      };
    }
    return {
      kind: "llm",
      label: "LLM generated",
      detail: source ? `source: ${source}` : "AI-generated question",
    };
  }

  return {
    kind: "dataset",
    label: "Dataset",
    detail: source
      ? `Imported / bank question (source: ${source})`
      : "Imported CSV / question bank",
  };
}

/** "B — wording" for admin review; falls back to letter only. */
export function formatOptionWithWording(
  letter: string | null | undefined,
  options: {
    optionA?: string | null;
    optionB?: string | null;
    optionC?: string | null;
    optionD?: string | null;
  },
): string {
  if (!letter || letter === "—") return "—";
  const key = letter.trim().toUpperCase();
  const map: Record<string, string | null | undefined> = {
    A: options.optionA,
    B: options.optionB,
    C: options.optionC,
    D: options.optionD,
  };
  const text = (map[key] ?? "").trim();
  if (!text) return key;
  return `${key} — ${text}`;
}

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
      "id, question_id, user_answer, is_correct, is_sibling, hinted, time_spent_ms, created_at, question:questions(section_code, prompt, option_a, option_b, option_c, option_d, correct_option, source, is_ai_generated)",
    )
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const attempts: SessionAttemptRow[] = (rawAttempts ?? []).map((row) => {
    const q = row.question as {
      section_code?: string;
      prompt?: string;
      option_a?: string | null;
      option_b?: string | null;
      option_c?: string | null;
      option_d?: string | null;
      correct_option?: string;
      source?: string | null;
      is_ai_generated?: boolean | null;
    } | null;
    const prompt = (q?.prompt ?? "").trim();
    const questionSource = q?.source ?? null;
    const isAiGenerated = Boolean(q?.is_ai_generated);
    return {
      id: row.id as string,
      questionId: row.question_id as string,
      sectionCode: q?.section_code ?? "—",
      prompt: prompt || "—",
      promptPreview: prompt.length > 120 ? `${prompt.slice(0, 117)}…` : prompt || "—",
      optionA: (q?.option_a ?? "").trim(),
      optionB: (q?.option_b ?? "").trim(),
      optionC: (q?.option_c ?? "").trim(),
      optionD: (q?.option_d ?? "").trim(),
      userAnswer: (row.user_answer as string | null) ?? null,
      correctOption: q?.correct_option ?? "—",
      isCorrect: Boolean(row.is_correct),
      isSibling: Boolean(row.is_sibling),
      hinted: Boolean(row.hinted),
      timeSpentMs: (row.time_spent_ms as number) ?? 0,
      createdAt: row.created_at as string,
      questionSource,
      isAiGenerated,
      contentOrigin: resolveQuestionContentOrigin({
        source: questionSource,
        isAiGenerated,
      }),
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
