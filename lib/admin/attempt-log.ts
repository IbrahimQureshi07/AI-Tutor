import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatOptionWithWording,
  resolveQuestionContentOrigin,
  resolveSessionRunType,
  sessionModeLabel,
  type QuestionContentOrigin,
  type SessionMode,
  type SessionRunType,
} from "@/lib/admin/session-history";

export type AttemptLogFilters = {
  mode?: SessionMode | "all";
  /** smoke | full | other (custom/quick/deep/unknown) | all */
  runType?: "smoke" | "full" | "other" | "all";
  section?: string | "all";
  result?: "correct" | "wrong" | "all";
  /** Dataset bank vs LLM-generated sibling questions. */
  source?: "dataset" | "llm" | "all";
  /** Primary attempts only (exclude GPT extra tries). Default false. */
  primaryOnly?: boolean;
  limit?: number;
};

export type AttemptLogRow = {
  id: string;
  sessionId: string;
  mode: SessionMode;
  runType: SessionRunType;
  sectionCode: string;
  promptPreview: string;
  isCorrect: boolean;
  isSibling: boolean;
  contentOrigin: QuestionContentOrigin;
  createdAt: string;
};

export type AttemptLogResult = {
  attempts: AttemptLogRow[];
  total: number;
  filtered: number;
};

export type AttemptDetailCard = {
  id: string;
  questionId: string;
  parentQuestionId: string | null;
  /** Attempt-level link: sibling → primary attempt (most reliable). */
  parentAttemptId: string | null;
  sectionCode: string;
  prompt: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  userAnswer: string | null;
  correctOption: string;
  studentPick: string;
  correctPick: string;
  isCorrect: boolean;
  isSibling: boolean;
  hinted: boolean;
  contentOrigin: QuestionContentOrigin;
  createdAt: string;
  relation: "focus" | "primary" | "extra_try" | "retry";
  relationLabel: string;
};

export type AttemptDetailResult = {
  focus: AttemptDetailCard;
  related: AttemptDetailCard[];
  sessionId: string;
  mode: SessionMode;
  runType: SessionRunType;
  modeLabel: string;
};

function runTypeBucket(type: SessionRunType): "smoke" | "full" | "other" {
  if (type === "smoke") return "smoke";
  if (type === "full") return "full";
  return "other";
}

function truncatePrompt(prompt: string, max = 140): string {
  if (prompt.length <= max) return prompt;
  return `${prompt.slice(0, max - 1)}…`;
}

type QuestionJoin = {
  id?: string;
  section_code?: string;
  prompt?: string;
  option_a?: string | null;
  option_b?: string | null;
  option_c?: string | null;
  option_d?: string | null;
  correct_option?: string | null;
  source?: string | null;
  is_ai_generated?: boolean | null;
  parent_question_id?: string | null;
};

type RawAttemptRow = {
  id: string;
  session_id: string;
  question_id: string;
  user_answer: string | null;
  is_correct: boolean;
  is_sibling?: boolean;
  parent_attempt_id?: string | null;
  hinted?: boolean;
  created_at: string;
  mode?: string;
  question?: QuestionJoin | null;
  session?: { mode?: string; config?: unknown } | null;
};

function normalizeRawAttempt(row: RawAttemptRow): RawAttemptRow {
  return {
    ...row,
    is_sibling: Boolean(row.is_sibling),
    parent_attempt_id: row.parent_attempt_id ?? null,
  };
}

function relationLabelFor(
  relation: AttemptDetailCard["relation"],
  card: Pick<AttemptDetailCard, "hinted">,
): string {
  if (relation === "primary") return "Primary question";
  if (relation === "extra_try") return "LLM / extra try";
  if (relation === "retry") {
    return card.hinted ? "Retry (with hint)" : "Retry";
  }
  return "Selected attempt";
}

function mapDetailCard(
  row: RawAttemptRow,
  relation: AttemptDetailCard["relation"],
): AttemptDetailCard {
  const q = row.question ?? null;
  const optionA = (q?.option_a ?? "").trim();
  const optionB = (q?.option_b ?? "").trim();
  const optionC = (q?.option_c ?? "").trim();
  const optionD = (q?.option_d ?? "").trim();
  const opts = { optionA, optionB, optionC, optionD };
  const userAnswer = row.user_answer ?? null;
  const correctOption = (q?.correct_option ?? "—").trim() || "—";
  const contentOrigin = resolveQuestionContentOrigin({
    source: q?.source,
    isAiGenerated: q?.is_ai_generated,
  });
  const isSibling = Boolean(row.is_sibling);
  const hinted = Boolean(row.hinted);

  let relationLabel = "Selected attempt";
  if (relation === "primary") relationLabel = "Primary question";
  else if (relation === "extra_try") relationLabel = "LLM / extra try";
  else if (relation === "retry") {
    relationLabel = hinted ? "Retry (with hint)" : "Retry";
  } else if (isSibling) {
    relationLabel = "Selected · extra try";
  } else if (hinted) {
    relationLabel = "Selected · hinted";
  }

  return {
    id: row.id,
    questionId: row.question_id,
    parentQuestionId: q?.parent_question_id ?? null,
    parentAttemptId: row.parent_attempt_id ?? null,
    sectionCode: q?.section_code ?? "—",
    prompt: (q?.prompt ?? "").trim() || "—",
    optionA,
    optionB,
    optionC,
    optionD,
    userAnswer,
    correctOption,
    studentPick: formatOptionWithWording(userAnswer, opts),
    correctPick: formatOptionWithWording(correctOption, opts),
    isCorrect: Boolean(row.is_correct),
    isSibling,
    hinted,
    contentOrigin,
    createdAt: row.created_at,
    relation,
    relationLabel,
  };
}

function classifyRelated(
  focus: AttemptDetailCard,
  other: AttemptDetailCard,
): AttemptDetailCard["relation"] | null {
  // Attempt-level link from practice runner (authoritative).
  if (other.parentAttemptId === focus.id) return "extra_try";
  if (focus.parentAttemptId === other.id) return "primary";
  if (
    focus.parentAttemptId &&
    other.parentAttemptId === focus.parentAttemptId
  ) {
    return "extra_try";
  }

  const rootId = focus.parentQuestionId ?? focus.questionId;

  if (other.questionId === focus.questionId) return "retry";

  if (
    other.parentQuestionId === rootId ||
    other.parentQuestionId === focus.questionId
  ) {
    return "extra_try";
  }

  if (
    focus.parentQuestionId &&
    other.questionId === focus.parentQuestionId &&
    !other.isSibling
  ) {
    return "primary";
  }

  if (
    focus.parentQuestionId &&
    other.parentQuestionId === focus.parentQuestionId
  ) {
    return "extra_try";
  }

  return null;
}

function chronoFallbackRelated(
  focus: AttemptDetailCard,
  sessionCards: AttemptDetailCard[],
): AttemptDetailCard | null {
  const focusTs = new Date(focus.createdAt).getTime();
  if (!focus.isSibling) {
    const next = sessionCards
      .filter(
        (o) =>
          o.id !== focus.id &&
          o.isSibling &&
          new Date(o.createdAt).getTime() >= focusTs &&
          new Date(o.createdAt).getTime() - focusTs < 30 * 60 * 1000,
      )
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )[0];
    return next
      ? {
          ...next,
          relation: "extra_try",
          relationLabel: "LLM / extra try",
        }
      : null;
  }

  const prev = sessionCards
    .filter(
      (o) =>
        o.id !== focus.id &&
        !o.isSibling &&
        focusTs >= new Date(o.createdAt).getTime() &&
        focusTs - new Date(o.createdAt).getTime() < 30 * 60 * 1000,
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
  return prev
    ? {
        ...prev,
        relation: "primary",
        relationLabel: "Primary question",
      }
    : null;
}

export async function loadAttemptLog(
  client: SupabaseClient,
  userId: string,
  filters: AttemptLogFilters = {},
): Promise<AttemptLogResult> {
  const limit = Math.min(filters.limit ?? 200, 500);

  const { data: rows } = await client
    .from("attempts")
    .select(
      "id, mode, session_id, is_correct, is_sibling, created_at, question:questions(section_code, prompt, source, is_ai_generated), session:sessions(mode, config)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);

  const all: AttemptLogRow[] = [];

  for (const row of rows ?? []) {
    const q = row.question as {
      section_code?: string;
      prompt?: string;
      source?: string | null;
      is_ai_generated?: boolean | null;
    } | null;
    const sess = row.session as { mode?: string; config?: unknown } | null;
    const sessionMode = (sess?.mode ?? row.mode) as SessionMode;
    const runType = resolveSessionRunType(
      sessionMode,
      (sess?.config as Record<string, unknown> | null) ?? null,
    );
    const contentOrigin = resolveQuestionContentOrigin({
      source: q?.source,
      isAiGenerated: q?.is_ai_generated,
    });

    all.push({
      id: row.id as string,
      sessionId: row.session_id as string,
      mode: sessionMode,
      runType,
      sectionCode: q?.section_code ?? "—",
      promptPreview: truncatePrompt(q?.prompt ?? "—"),
      isCorrect: Boolean(row.is_correct),
      isSibling: Boolean(row.is_sibling),
      contentOrigin,
      createdAt: row.created_at as string,
    });
  }

  let filtered = all;

  if (filters.primaryOnly) {
    filtered = filtered.filter((a) => !a.isSibling);
  }

  if (filters.mode && filters.mode !== "all") {
    filtered = filtered.filter((a) => a.mode === filters.mode);
  }

  if (filters.runType && filters.runType !== "all") {
    filtered = filtered.filter(
      (a) => runTypeBucket(a.runType) === filters.runType,
    );
  }

  if (filters.section && filters.section !== "all") {
    filtered = filtered.filter((a) => a.sectionCode === filters.section);
  }

  if (filters.result === "correct") {
    filtered = filtered.filter((a) => a.isCorrect);
  } else if (filters.result === "wrong") {
    filtered = filtered.filter((a) => !a.isCorrect);
  }

  if (filters.source === "dataset" || filters.source === "llm") {
    filtered = filtered.filter((a) => a.contentOrigin.kind === filters.source);
  }

  return {
    attempts: filtered.slice(0, limit),
    total: all.length,
    filtered: filtered.length,
  };
}

const DETAIL_SELECT =
  "id, mode, session_id, question_id, user_answer, is_correct, is_sibling, parent_attempt_id, hinted, created_at, question:questions(id, section_code, prompt, option_a, option_b, option_c, option_d, correct_option, source, is_ai_generated, parent_question_id), session:sessions(mode, config)";

const DETAIL_SELECT_FALLBACK =
  "id, mode, session_id, question_id, user_answer, is_correct, hinted, created_at, question:questions(id, section_code, prompt, option_a, option_b, option_c, option_d, correct_option, source, is_ai_generated, parent_question_id), session:sessions(mode, config)";

async function selectAttemptRows(
  build: (
    select: string,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>,
): Promise<RawAttemptRow[]> {
  const primary = await build(DETAIL_SELECT);
  if (!primary.error) {
    return ((primary.data as RawAttemptRow[] | null) ?? []).map(
      normalizeRawAttempt,
    );
  }
  const fallback = await build(DETAIL_SELECT_FALLBACK);
  return ((fallback.data as RawAttemptRow[] | null) ?? []).map(
    normalizeRawAttempt,
  );
}

async function selectAttemptMaybe(
  build: (
    select: string,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>,
): Promise<RawAttemptRow | null> {
  const primary = await build(DETAIL_SELECT);
  if (!primary.error && primary.data) {
    return normalizeRawAttempt(primary.data as RawAttemptRow);
  }
  if (!primary.error && !primary.data) return null;

  const fallback = await build(DETAIL_SELECT_FALLBACK);
  if (fallback.error || !fallback.data) return null;
  return normalizeRawAttempt(fallback.data as RawAttemptRow);
}

/** Pull parent / children linked via attempts.parent_attempt_id. */
async function fetchAttemptLinkedRows(
  client: SupabaseClient,
  userId: string,
  focus: RawAttemptRow,
): Promise<RawAttemptRow[]> {
  const rows: RawAttemptRow[] = [];

  const children = await selectAttemptRows((select) =>
    client
      .from("attempts")
      .select(select)
      .eq("user_id", userId)
      .eq("parent_attempt_id", focus.id)
      .order("created_at", { ascending: true })
      .limit(20),
  );
  rows.push(...children);

  if (focus.parent_attempt_id) {
    const parent = await selectAttemptMaybe((select) =>
      client
        .from("attempts")
        .select(select)
        .eq("user_id", userId)
        .eq("id", focus.parent_attempt_id!)
        .maybeSingle(),
    );
    if (parent) rows.push(parent);

    const coSiblings = await selectAttemptRows((select) =>
      client
        .from("attempts")
        .select(select)
        .eq("user_id", userId)
        .eq("parent_attempt_id", focus.parent_attempt_id!)
        .neq("id", focus.id)
        .order("created_at", { ascending: true })
        .limit(20),
    );
    rows.push(...coSiblings);
  }

  return rows;
}

export async function loadAttemptDetail(
  client: SupabaseClient,
  userId: string,
  attemptId: string,
): Promise<AttemptDetailResult | null> {
  const focusRaw = await selectAttemptMaybe((select) =>
    client
      .from("attempts")
      .select(select)
      .eq("id", attemptId)
      .eq("user_id", userId)
      .maybeSingle(),
  );
  if (!focusRaw) return null;

  const focus = mapDetailCard(focusRaw, "focus");

  const sess = focusRaw.session;
  const sessionMode = (sess?.mode ?? focusRaw.mode ?? "practice") as SessionMode;
  const runType = resolveSessionRunType(
    sessionMode,
    (sess?.config as Record<string, unknown> | null) ?? null,
  );

  const [sessionRows, linkedRows] = await Promise.all([
    selectAttemptRows((select) =>
      client
        .from("attempts")
        .select(select)
        .eq("session_id", focusRaw.session_id)
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(500),
    ),
    fetchAttemptLinkedRows(client, userId, focusRaw),
  ]);

  const byId = new Map<string, RawAttemptRow>();
  for (const row of [...sessionRows, ...linkedRows]) {
    byId.set(row.id, row);
  }

  const poolCards: AttemptDetailCard[] = [];
  for (const row of byId.values()) {
    poolCards.push(
      mapDetailCard(row, row.id === focus.id ? "focus" : "retry"),
    );
  }

  const related: AttemptDetailCard[] = [];
  const seen = new Set<string>();
  for (const card of poolCards) {
    if (card.id === focus.id) continue;
    const relation = classifyRelated(focus, card);
    if (!relation) continue;
    seen.add(card.id);
    related.push({
      ...card,
      relation,
      relationLabel: relationLabelFor(relation, card),
    });
  }

  if (related.length === 0) {
    const neighbor = chronoFallbackRelated(focus, poolCards);
    if (neighbor && !seen.has(neighbor.id)) related.push(neighbor);
  }

  related.sort((a, b) => {
    const rank = (r: AttemptDetailCard["relation"]) =>
      r === "primary" ? 0 : r === "retry" ? 1 : 2;
    const d = rank(a.relation) - rank(b.relation);
    if (d !== 0) return d;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return {
    focus,
    related: related.slice(0, 6),
    sessionId: focusRaw.session_id,
    mode: sessionMode,
    runType,
    modeLabel: sessionModeLabel(sessionMode),
  };
}

export { sessionModeLabel };
