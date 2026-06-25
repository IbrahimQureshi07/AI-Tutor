import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sparkles, Target, Brain, Clock, Trophy, MessageSquare } from "lucide-react";
import { MODES } from "@/lib/constants";

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 mesh-gradient opacity-60" aria-hidden />
        <div className="container relative py-24 md:py-32">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-6 border-primary/30 bg-surface/60 backdrop-blur">
              <Sparkles className="h-3 w-3 text-primary" />
              AI-powered. Built for SC.
            </Badge>
            <h1 className="font-serif text-5xl md:text-7xl font-semibold tracking-tight text-ink leading-[1.05]">
              Pass the South Carolina real estate exam.{" "}
              <span className="text-primary">With a tutor that never sleeps.</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-ink-muted max-w-2xl">
              Practice with 1,200+ exam-style questions. Get instant hints and
              Claude-powered explanations. Watch your mastery grow across every
              section from A1 to B6.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg">
                <Link href="/try">
                  Try 5 questions free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/pricing">View pricing</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="sm:px-4">
                <Link href="/login">Log in</Link>
              </Button>
            </div>
            <div id="stats" className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl">
              {[
                { n: "1,200+", l: "Exam-style questions" },
                { n: "+18 pts", l: "Average score lift" },
                { n: "94%", l: "Users feel ready" },
                { n: "24/7", l: "AI tutor on call" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="font-serif text-3xl md:text-4xl font-semibold text-ink">{s.n}</div>
                  <div className="text-xs md:text-sm text-ink-muted mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Modes */}
      <section id="modes" className="container py-20">
        <div className="max-w-2xl">
          <Badge variant="outline">Five ways to study</Badge>
          <h2 className="mt-4 font-serif text-4xl font-semibold tracking-tight">
            A mode for every stage of prep.
          </h2>
          <p className="mt-3 text-ink-muted">
            From diagnosing where you stand to simulating the real exam, every
            mode is designed around the South Carolina exam format.
          </p>
        </div>
        <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Object.values(MODES).map((m, i) => (
            <div
              key={m.key}
              className="group relative rounded-3xl border border-border bg-surface p-6 shadow-soft transition-all hover:shadow-glow hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-2">
                {m.key === "assessment" && <Target className="h-4 w-4 text-primary" />}
                {m.key === "practice" && <Brain className="h-4 w-4 text-primary" />}
                {m.key === "mistakes" && <Sparkles className="h-4 w-4 text-primary" />}
                {m.key === "mock" && <Clock className="h-4 w-4 text-primary" />}
                {m.key === "final" && <Trophy className="h-4 w-4 text-primary" />}
                <span className="text-xs uppercase tracking-widest text-ink-muted">
                  Mode {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-3 font-serif text-2xl font-semibold">{m.label}</h3>
              <p className="mt-2 text-sm text-ink-muted">{m.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="container py-20">
        <div className="rounded-3xl border border-border bg-surface p-8 md:p-12 shadow-soft bg-paper">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <Badge variant="outline">How it works</Badge>
              <h2 className="mt-4 font-serif text-4xl font-semibold tracking-tight">
                Diagnose. Drill. Master.
              </h2>
              <ol className="mt-6 space-y-4 text-ink-muted">
                <li className="flex gap-3">
                  <span className="font-serif text-primary text-xl">01</span>
                  <span>
                    Take a 24-question <b className="text-ink">Assessment</b> across
                    all 12 sections. We map your strengths and weaknesses.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-serif text-primary text-xl">02</span>
                  <span>
                    <b className="text-ink">Practice</b> with hints and second-try
                    retries. Missed questions go into your Mistakes pool.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-serif text-primary text-xl">03</span>
                  <span>
                    Simulate the real thing with a <b className="text-ink">Mock Exam</b>
                    . 120 questions, 240 minutes, 70% to pass.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-serif text-primary text-xl">04</span>
                  <span>
                    Ask the <b className="text-ink">AI tutor</b> anything — about
                    agency law, amortization, or that one tricky question.
                  </span>
                </li>
              </ol>
            </div>
            <div className="relative rounded-2xl border border-border bg-elevated p-6">
              <div className="flex items-center gap-2 text-xs text-ink-muted mb-4">
                <MessageSquare className="h-3.5 w-3.5" />
                AI Tutor
              </div>
              <div className="space-y-3 text-sm">
                <div className="rounded-xl bg-primary-soft/50 p-3 max-w-[85%]">
                  What&apos;s the difference between a dual agent and a designated
                  agent in SC?
                </div>
                <div className="rounded-xl bg-surface border border-border p-3 max-w-[92%]">
                  Great question. In South Carolina, a <b>dual agent</b> represents
                  both buyer and seller with limited representation. A{" "}
                  <b>designated agent</b> is assigned by the broker to represent one
                  side exclusively, even when the brokerage handles both parties…
                </div>
                <div className="rounded-xl bg-primary-soft/50 p-3 max-w-[60%]">
                  Give me a practice question on this.
                </div>
              </div>
              <div className="absolute -bottom-2 -right-2 h-10 w-10 rounded-full bg-primary/20 animate-pulse-ring" aria-hidden />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-ink text-background p-12 md:p-16">
          <div className="absolute inset-0 mesh-gradient opacity-30" aria-hidden />
          <div className="relative max-w-2xl">
            <h2 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight">
              Your exam date is coming. Be ready.
            </h2>
            <p className="mt-4 text-background/80">
              Try five real exam-style questions with a taste of the AI tutor — no
              signup required. Unlock the full course when you&apos;re ready.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
                <Link href="/try">
                  Try the free demo <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-background/30 text-background hover:bg-background/10"
              >
                <Link href="/pricing">View pricing</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
