import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { ModeKey } from "@/lib/constants";
import type { QuestionRow } from "@/lib/supabase/types";
import { shuffle } from "@/lib/utils";
import { datasetBankOnly } from "@/lib/questions/dataset-bank";

type StartArgs = {
  mode: ModeKey;
  config?: Record<string, unknown>;
};

export async function startSession({ mode, config = {} }: StartArgs) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("sessions")
    .insert({ user_id: user.id, mode, config })
    .select("id, started_at")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to start session");
  return { sessionId: data.id, startedAt: data.started_at };
}

export async function getSession(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await supabase
    .from("sessions")
    .select("id, user_id, mode, started_at, finished_at, score_pct, duration_ms, config, status")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();
  if (error || !data) redirect("/dashboard");
  return data;
}

/**
 * Pull questions for a session. Strategy depends on mode.
 */
export async function getQuestionsForMode(
  mode: ModeKey,
  opts: { count: number; sectionCodes?: string[]; pool?: "standard" | "final_holdout" } = { count: 20 },
): Promise<QuestionRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const pool = opts.pool ?? (mode === "final" ? "final_holdout" : "standard");

  if (mode === "mistakes") {
    const { data: mistakes } = await supabase
      .from("v_user_mistakes")
      .select("question_id")
      .eq("user_id", user.id)
      .eq("resolved", false)
      .limit(opts.count * 2);

    const ids = (mistakes ?? []).map((m) => m.question_id);
    if (!ids.length) return [];
    const { data: qs } = await datasetBankOnly(
      supabase.from("questions").select("*").in("id", ids),
    ).limit(opts.count);
    return shuffle((qs ?? []) as QuestionRow[]).slice(0, opts.count);
  }

  if (mode === "assessment") {
    // 2 questions per section across A1..B6
    const sections = opts.sectionCodes ?? [
      "A1","A2","A3","A4","A5","A6","B1","B2","B3","B4","B5","B6",
    ];
    const perSection = Math.max(1, Math.floor(opts.count / sections.length));
    const all: QuestionRow[] = [];
    for (const code of sections) {
      const { data } = await datasetBankOnly(
        supabase
          .from("questions")
          .select("*")
          .eq("section_code", code)
          .eq("pool", "standard"),
      ).limit(50);
      const picks = shuffle((data ?? []) as QuestionRow[]).slice(0, perSection);
      all.push(...picks);
    }
    return shuffle(all).slice(0, opts.count);
  }

  if (mode === "mock" || mode === "final") {
    // SC format: 80 National (A1–A6) + 40 State (B1–B6)
    const nationalCount = Math.round(opts.count * (2 / 3));
    const stateCount = opts.count - nationalCount;
    const { data: nat } = await datasetBankOnly(
      supabase
        .from("questions")
        .select("*")
        .in("section_code", ["A1","A2","A3","A4","A5","A6"])
        .eq("pool", pool),
    ).limit(nationalCount * 3);
    const { data: st } = await datasetBankOnly(
      supabase
        .from("questions")
        .select("*")
        .in("section_code", ["B1","B2","B3","B4","B5","B6"])
        .eq("pool", pool),
    ).limit(stateCount * 3);
    const combined = [
      ...shuffle((nat ?? []) as QuestionRow[]).slice(0, nationalCount),
      ...shuffle((st ?? []) as QuestionRow[]).slice(0, stateCount),
    ];
    return shuffle(combined);
  }

  // practice: callers should use pickPracticeQuestions() from lib/practice/pick-questions.ts
  const { data } = await datasetBankOnly(
    supabase.from("questions").select("*").eq("pool", "standard"),
  ).limit(opts.count * 3);
  return shuffle((data ?? []) as QuestionRow[]).slice(0, opts.count);
}

export async function attachQuestionsToSession(sessionId: string, ids: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("sessions")
    .update({ config: { question_ids: ids } })
    .eq("id", sessionId)
    .eq("user_id", user.id);
}
