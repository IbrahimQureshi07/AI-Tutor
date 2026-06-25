import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { GuestDemoRunner } from "@/components/demo/guest-demo-runner";
import { Badge } from "@/components/ui/badge";

export default function TryDemoPage() {
  return (
    <main className="container py-12 md:py-16 max-w-4xl">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <Badge variant="outline" className="mb-4 border-primary/30">
          <Sparkles className="h-3 w-3 text-primary mr-1" />
          No signup required
        </Badge>
        <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight text-ink">
          Try 5 questions free
        </h1>
        <p className="mt-4 text-ink-muted text-lg leading-relaxed">
          Sample real SC exam-style questions with a taste of the AI tutor coach.
          One preview per device — then unlock the full course when you&apos;re
          ready.
        </p>
        <p className="mt-3 text-sm text-ink-muted">
          Already decided?{" "}
          <Link
            href="/pricing"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            View pricing
            <ArrowRight className="h-3 w-3" />
          </Link>
        </p>
      </div>

      <GuestDemoRunner />
    </main>
  );
}
