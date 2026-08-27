import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/auth/request-session";
import type { QuestionRow } from "@/lib/supabase/types";

export async function loadSessionAndQuestions(sessionId: string) {
  const { supabase, user } = await requireAppUser();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, mode, started_at, finished_at, score_pct, duration_ms, config, status")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) redirect("/dashboard");

  const ids: string[] = (session.config as Record<string, unknown>)?.question_ids as string[] ?? [];
  if (!ids.length) {
    return { session, questions: [] as QuestionRow[] };
  }

  const { data: rows } = await supabase
    .from("questions")
    .select("*")
    .in("id", ids);

  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  const questions = ids.map((id) => byId.get(id)).filter(Boolean) as QuestionRow[];

  return { session, questions };
}

export async function loadSessionAttempts(sessionId: string) {
  const { supabase, user } = await requireAppUser();

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();
  if (!session) redirect("/dashboard");

  const { data: attempts } = await supabase
    .from("attempts")
    .select("*, question:questions(*)")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return { session, attempts: attempts ?? [] };
}
