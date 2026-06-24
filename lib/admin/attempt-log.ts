import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveSessionRunType,
  sessionModeLabel,
  type SessionMode,
  type SessionRunType,
} from "@/lib/admin/session-history";

export type AttemptLogFilters = {
  mode?: SessionMode | "all";
  /** smoke | full | other (custom/quick/deep/unknown) | all */
  runType?: "smoke" | "full" | "other" | "all";
  section?: string | "all";
  result?: "correct" | "wrong" | "all";
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
  createdAt: string;
};

export type AttemptLogResult = {
  attempts: AttemptLogRow[];
  total: number;
  filtered: number;
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

export async function loadAttemptLog(
  client: SupabaseClient,
  userId: string,
  filters: AttemptLogFilters = {},
): Promise<AttemptLogResult> {
  const limit = Math.min(filters.limit ?? 200, 500);

  const { data: rows } = await client
    .from("attempts")
    .select(
      "id, mode, session_id, is_correct, is_sibling, created_at, question:questions(section_code, prompt), session:sessions(mode, config)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);

  const all: AttemptLogRow[] = [];

  for (const row of rows ?? []) {
    const q = row.question as { section_code?: string; prompt?: string } | null;
    const sess = row.session as { mode?: string; config?: unknown } | null;
    const sessionMode = (sess?.mode ?? row.mode) as SessionMode;
    const runType = resolveSessionRunType(
      sessionMode,
      (sess?.config as Record<string, unknown> | null) ?? null,
    );

    all.push({
      id: row.id as string,
      sessionId: row.session_id as string,
      mode: sessionMode,
      runType,
      sectionCode: q?.section_code ?? "—",
      promptPreview: truncatePrompt(q?.prompt ?? "—"),
      isCorrect: Boolean(row.is_correct),
      isSibling: Boolean(row.is_sibling),
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

  return {
    attempts: filtered.slice(0, limit),
    total: all.length,
    filtered: filtered.length,
  };
}

export { sessionModeLabel };
