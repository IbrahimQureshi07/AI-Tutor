import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isUserAdmin } from "@/lib/auth/bootstrap-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, ArrowRight, Calendar } from "lucide-react";
import { getFinalGateStatus } from "@/lib/final/completion";
import { getFinalPoolStatus } from "@/lib/final/pick-questions";
import { FinalStartPicker } from "@/components/final/final-start-picker";

export default async function FinalTestIntro() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isAdmin = await isUserAdmin(supabase, user);
  const [gate, pool] = await Promise.all([
    getFinalGateStatus(supabase, user.id, isAdmin),
    getFinalPoolStatus(supabase, user.id),
  ]);

  if (!gate.unlocked) {
    return (
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-3xl border border-border bg-surface p-8 md:p-12 shadow-soft">
          <div className="absolute inset-0 mesh-gradient opacity-30" aria-hidden />
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-2xl bg-muted grid place-items-center">
                <Lock className="h-5 w-5 text-ink-muted" />
              </div>
              <Badge variant="outline">Final Test is locked</Badge>
            </div>
            <h1 className="mt-5 font-serif text-4xl md:text-5xl font-semibold tracking-tight">
              Not ready yet — that&apos;s the point.
            </h1>
            <p className="mt-3 text-lg text-ink-muted max-w-2xl">
              The Final Test pulls from a held-out question pool — questions
              you&apos;ve never seen. Each attempt burns part of that pool, so
              we only let you in once recent signal says you&apos;re likely to
              pass. This protects the integrity of the measurement.
            </p>
            <div className="mt-5">
              <h3 className="text-sm font-semibold mb-2">
                What&apos;s blocking right now:
              </h3>
              <ul className="space-y-1.5 text-sm text-ink-muted">
                {gate.reasons.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-warn" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
            <GateDetail gate={gate} />
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/mock-exam">
                  Go to Mock Exam
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/mistakes">Mistakes Test</Link>
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

  return <FinalStartPicker gate={gate} pool={pool} />;
}

function GateDetail({
  gate,
}: {
  gate: Awaited<ReturnType<typeof getFinalGateStatus>>;
}) {
  const d = gate.details;
  const strictMock =
    (d.bestRecentMockPct != null && d.bestRecentMockPct >= 75) ||
    (d.avgLast2MockPct != null && d.avgLast2MockPct >= 70);
  const smokeQaPath = d.smokeMockCompleted && d.smokeUnlocksFinal && !strictMock;
  // Smoke finished but didn't unlock (not an admin) — explain why, so it
  // doesn't look like a bug.
  const smokeDidNotUnlock = d.smokeMockCompleted && !d.smokeUnlocksFinal && !strictMock;
  return (
    <Card className="mt-5">
      <CardContent className="pt-5">
        <h4 className="text-sm font-semibold mb-2 inline-flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5" />
          Readiness signals
        </h4>
        {smokeQaPath && (
          <p className="mb-3 text-sm text-success">
            You finished a Mock smoke test — strict mock score requirements
            are waived so you can try the Final.
          </p>
        )}
        {smokeDidNotUnlock && (
          <p className="mb-3 text-sm text-ink-muted">
            Heads up: a Mock <strong>smoke test</strong> is quick
            practice/QA only — it doesn&apos;t unlock the Final Test. Take a
            full Mock Exam to unlock it.
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <Signal
            label="Most recent Mock"
            value={
              smokeQaPath
                ? `${d.bestRecentMockPct == null ? "—" : `${Math.round(d.bestRecentMockPct)}%`} (waived — smoke QA)`
                : d.bestRecentMockPct == null
                  ? "No mock yet"
                  : `${Math.round(d.bestRecentMockPct)}% (need ≥75%)`
            }
            ok={strictMock || smokeQaPath}
          />
          <Signal
            label="Avg of last 2 Mocks"
            value={
              smokeQaPath
                ? "Not required (smoke QA)"
                : d.avgLast2MockPct == null
                  ? "Not enough mocks"
                  : `${d.avgLast2MockPct}% (need ≥70%)`
            }
            ok={strictMock || smokeQaPath}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Signal({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="rounded-xl border border-border px-3 py-2">
      <div className="text-xs text-ink-muted">{label}</div>
      <div
        className={
          "text-sm font-medium " + (ok ? "text-success" : "text-ink-muted")
        }
      >
        {value}
      </div>
    </div>
  );
}
