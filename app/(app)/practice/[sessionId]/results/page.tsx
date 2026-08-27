import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/auth/request-session";
import { SECTIONS } from "@/lib/constants";
import { PracticeResultsView } from "@/components/practice/practice-results";
import {
  buildPracticeStats,
  type PracticeAttempt,
} from "@/lib/practice/results";
import { loadPracticeBaseline } from "@/lib/practice/baseline";
import { generatePracticeNote } from "@/lib/practice/results-note";
import { loadJourney } from "@/lib/journey/load";
import { sanitizePlan, type DebriefPlan } from "@/lib/coach/debrief-plan";

export default async function PracticeResults({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { supabase, user } = await requireAppUser();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, started_at, finished_at, score_pct, duration_ms, config")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();
  if (!session) redirect("/dashboard");

  // We select `*` for attempts so optional cols (`coached`, `is_sibling`,
  // `parent_attempt_id`) come along when the migration is applied. They
  // gracefully default to falsy when the columns don't exist (Supabase
  // omits unknown columns from the select).
  const { data: rawAttempts } = await supabase
    .from("attempts")
    .select(
      "question_id, attempt_number, is_correct, result_label, user_answer, hinted, retried, coached, is_sibling, parent_attempt_id, time_spent_ms, created_at, question:questions(*)",
    )
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const attempts = ((rawAttempts ?? []) as unknown) as PracticeAttempt[];
  const stats = buildPracticeStats(attempts);

  const baseline = await loadPracticeBaseline(supabase, user.id, sessionId);
  const journey = await loadJourney(supabase, user.id);

  const sectionTitles = Object.fromEntries(
    SECTIONS.map((s) => [s.code, s.title]),
  );

  // AI note: cache to `sessions.config.practice_note` so it doesn't
  // re-generate (and re-bill) on every refresh.
  const cfg = (session.config ?? {}) as Record<string, unknown>;
  let aiNote = (cfg.practice_note as string | undefined) ?? "";
  if (!aiNote || aiNote.length < 30) {
    aiNote = await generatePracticeNote(stats, baseline, sectionTitles);
    // Best-effort cache write — don't fail the page if RLS blocks it.
    try {
      await supabase
        .from("sessions")
        .update({ config: { ...cfg, practice_note: aiNote } })
        .eq("id", sessionId)
        .eq("user_id", user.id);
    } catch (e) {
      console.warn("[practice/results] failed to cache practice_note", e);
    }
  }

  const storedPlan = cfg.debrief_plan
    ? sanitizePlan(cfg.debrief_plan as Partial<DebriefPlan>)
    : null;
  const storedCommitted = Boolean(cfg.debrief_committed);

  return (
    <PracticeResultsView
      sessionId={sessionId}
      durationMs={session.duration_ms ?? 0}
      stats={stats}
      baseline={baseline}
      aiNote={aiNote}
      journey={journey}
      initialPlan={storedPlan}
      initialPlanCommitted={storedCommitted}
    />
  );
}
