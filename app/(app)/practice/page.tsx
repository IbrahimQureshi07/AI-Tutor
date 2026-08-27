import Link from "next/link";
import { Lock, ArrowRight, Target, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SECTIONS } from "@/lib/constants";
import { formatSectionDisplayLabel } from "@/lib/sections/display-label";
import { getAssessmentCoverage } from "@/lib/assessment/coverage";
import { PracticeStartPicker } from "@/components/practice/practice-start-picker";
import { requireAppUser } from "@/lib/auth/request-session";

export default async function PracticeIntro() {
  const { supabase, user } = await requireAppUser();

  const coverage = await getAssessmentCoverage(supabase, user.id);

  if (!coverage.allCovered) {
    return <PracticeLocked coverage={coverage} />;
  }

  return <PracticeStartPicker />;
}

function PracticeLocked({
  coverage,
}: {
  coverage: Awaited<ReturnType<typeof getAssessmentCoverage>>;
}) {
  const totalSections = SECTIONS.length;
  const coveredCount = coverage.covered.length;
  const nextCode = coverage.nextSection;
  const nextTitle = nextCode
    ? SECTIONS.find((s) => s.code === nextCode)?.title ?? ""
    : "";
  const missingParam = coverage.missing.join(",");

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 md:p-12 shadow-soft">
        <div className="absolute inset-0 mesh-gradient opacity-30" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-muted grid place-items-center">
              <Lock className="h-5 w-5 text-ink-muted" />
            </div>
            <Badge variant="outline">Practice is locked</Badge>
          </div>
          <h1 className="mt-5 font-serif text-4xl md:text-5xl font-semibold tracking-tight">
            Finish the assessment first.
          </h1>
          <p className="mt-3 text-lg text-ink-muted max-w-2xl">
            Practice adapts to your weak spots — but we need a baseline on every
            section before it can do that. You&apos;ve covered{" "}
            <span className="font-medium text-ink">
              {coveredCount} of {totalSections}
            </span>{" "}
            sections so far.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {nextCode && (
              <Button asChild size="lg">
                <Link href={`/assessment?sections=${missingParam}`}>
                  Continue with {nextCode}: {nextTitle}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button asChild size="lg" variant="outline">
              <Link href="/assessment">
                <Target className="h-4 w-4" /> Open assessment
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h3 className="font-semibold">Section coverage</h3>
            <span className="text-xs text-ink-muted">
              {coveredCount}/{totalSections} completed
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {SECTIONS.map((s) => {
              const done = coverage.covered.includes(s.code);
              return (
                <div
                  key={s.code}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
                >
                  <div className="shrink-0">
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <Circle className="h-5 w-5 text-ink-muted/50" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink leading-snug">
                      {formatSectionDisplayLabel(s.code)}
                    </div>
                    <div className="text-xs text-ink-muted">
                      {done ? "Assessed" : "Not yet assessed"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
