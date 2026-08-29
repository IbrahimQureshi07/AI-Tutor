import Link from "next/link";
import { getAppShell, requireAppUser } from "@/lib/auth/request-session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, ArrowRight } from "lucide-react";
import { getAccessState, getCoursePriceLabel } from "@/lib/access/check-access";
import {
  hasFinishedMistakes,
  getMistakesProgress,
} from "@/lib/mock/completion";
import { getMockWeaknessPreview } from "@/lib/mock/pick-questions";
import { MockStartPicker } from "@/components/mock/mock-start-picker";

export default async function MockExamIntro() {
  const { supabase, user } = await requireAppUser();

  const [mistakesDone, mistakesProgress] = await Promise.all([
    hasFinishedMistakes(supabase, user.id),
    getMistakesProgress(supabase, user.id),
  ]);

  if (!mistakesDone) {
    const remaining = Math.max(
      0,
      mistakesProgress.bestSessionThreshold - mistakesProgress.bestSessionAttempts,
    );
    const totalLabel =
      mistakesProgress.bestSessionTotal > 0
        ? mistakesProgress.bestSessionTotal
        : 110;
    const progressLine =
      mistakesProgress.bestSessionAttempts > 0
        ? `Closest Mistakes run so far: ${mistakesProgress.bestSessionAttempts} / ${totalLabel} answered. ${remaining} more to unlock Mock.`
        : "You haven't finished a Mistakes Test yet. The 10-question smoke mode in Mistakes counts toward this gate.";

    return (
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 md:p-12 shadow-soft">
          <div className="absolute inset-0 mesh-gradient opacity-30" aria-hidden />
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-2xl bg-muted grid place-items-center">
                <Lock className="h-5 w-5 text-ink-muted" />
              </div>
              <Badge variant="outline">Mock Exam is locked</Badge>
            </div>
            <h1 className="mt-5 font-serif text-4xl md:text-5xl font-semibold tracking-tight">
              Finish a Mistakes Test first.
            </h1>
            <p className="mt-3 text-lg text-ink-muted max-w-2xl">
              The Mock is adaptive — it weights your{" "}
              <span className="font-medium text-ink">mistakes 3×</span>,
              practice 2×, and assessment 1×. Without a Mistakes run, there
              isn&apos;t enough recent signal to calibrate it honestly.
            </p>
            <p className="mt-2 text-sm text-ink-muted">{progressLine}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/mistakes">
                  Go to Mistakes
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

  const access = await getAccessState(supabase, user);
  if (!access.canUsePaidExams) {
    const price = getCoursePriceLabel();
    return (
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 md:p-12 shadow-soft">
          <div className="absolute inset-0 mesh-gradient opacity-30" aria-hidden />
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-2xl bg-muted grid place-items-center">
                <Lock className="h-5 w-5 text-ink-muted" />
              </div>
              <Badge variant="outline">Mock Exam is locked</Badge>
            </div>
            <h1 className="mt-5 font-serif text-4xl md:text-5xl font-semibold tracking-tight">
              Mock &amp; Final are part of the paid course.
            </h1>
            <p className="mt-3 text-lg text-ink-muted max-w-2xl">
              You can use Assessment, Practice, and Mistakes for free. To unlock the
              two exam-shaped modes (Mock + Final), upgrade for{" "}
              <span className="font-medium text-ink">{price}</span>.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/unlock">
                  Unlock Mock &amp; Final
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/pricing">View pricing</Link>
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

  const [{ weakest, signalSize }, shell] = await Promise.all([
    getMockWeaknessPreview(supabase, user.id, 3),
    getAppShell(),
  ]);

  return (
    <MockStartPicker
      weakest={weakest}
      signalSize={signalSize}
      isAdmin={shell?.showAdmin ?? false}
    />
  );
}
