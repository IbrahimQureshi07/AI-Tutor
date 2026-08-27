import Link from "next/link";
import { requireAppUser } from "@/lib/auth/request-session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, ArrowRight } from "lucide-react";
import {
  hasFinishedPractice,
  getPracticeProgress,
} from "@/lib/practice/completion";
import { MISTAKES_TOTAL } from "@/lib/mistakes/pick-questions";
import { MistakesStartPicker } from "@/components/mistakes/mistakes-start-picker";

export default async function MistakesIntro() {
  const { supabase, user } = await requireAppUser();

  const [practiceDone, poolRes, progress] = await Promise.all([
    hasFinishedPractice(supabase, user.id),
    supabase
      .from("v_user_mistakes")
      .select("question_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("resolved", false),
    getPracticeProgress(supabase, user.id),
  ]);

  const mistakeCount = poolRes.count ?? 0;

  if (!practiceDone) {
    const remainingToUnlock = Math.max(
      0,
      progress.bestSessionThreshold - progress.bestSessionAttempts,
    );
    const totalLabel =
      progress.bestSessionTotal > 0 ? progress.bestSessionTotal : 110;
    const progressLine =
      progress.bestSessionAttempts > 0
        ? `Closest practice run so far: ${progress.bestSessionAttempts} / ${totalLabel} answered. ${remainingToUnlock} more to unlock Mistakes.`
        : "You haven't finished a practice run yet. Run a 10-question smoke test from Practice to unlock this faster.";

    return (
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 md:p-12 shadow-soft">
          <div className="absolute inset-0 mesh-gradient opacity-30" aria-hidden />
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-2xl bg-muted grid place-items-center">
                <Lock className="h-5 w-5 text-ink-muted" />
              </div>
              <Badge variant="outline">Mistakes Test is locked</Badge>
            </div>
            <h1 className="mt-5 font-serif text-4xl md:text-5xl font-semibold tracking-tight">
              Finish a practice run first.
            </h1>
            <p className="mt-3 text-lg text-ink-muted max-w-2xl">
              Mistakes Test re-drills{" "}
              <span className="font-medium text-ink">
                everything you&apos;ve missed
              </span>{" "}
              in Assessment and Practice, then tops up (up to{" "}
              <span className="font-medium text-ink">{MISTAKES_TOTAL}</span>{" "}
              questions in full mode) with weighted medium + hard from your
              weakest sections. You can also run a{" "}
              <span className="font-medium text-ink">10-question smoke</span>{" "}
              Mistakes session after unlock.
            </p>
            <p className="mt-2 text-sm text-ink-muted">{progressLine}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/practice">
                  Go to Practice
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return <MistakesStartPicker unresolvedMistakeCount={mistakeCount} />;
}
