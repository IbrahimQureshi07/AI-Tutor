import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAccessState, getCoursePriceLabel, getCoursePriceUsd } from "@/lib/access/check-access";
import {
  COURSE_FEATURES,
  COURSE_PRICE_NOTE,
  PRICING_FAQ,
} from "@/lib/billing/course-offering";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PricingCheckoutButton } from "@/components/billing/pricing-checkout-button";

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = user ? await getAccessState(supabase, user) : null;
  const hasAccess = access?.hasFullAccess ?? false;
  const price = getCoursePriceLabel();
  const priceNum = getCoursePriceUsd();

  return (
    <main className="container py-16 md:py-24 max-w-4xl">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <Badge variant="outline" className="mb-4 border-primary/30">
          <Sparkles className="h-3 w-3 text-primary mr-1" />
          One-time course access
        </Badge>
        <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight text-ink">
          Unlock the full SC Real Estate prep course
        </h1>
        <p className="mt-4 text-ink-muted text-lg leading-relaxed">
          After your free preview, purchase once to access every study mode, the
          full question bank, AI tutor chat, mock exams, and progress reports.
        </p>
      </div>

      <Card className="border-primary/20 shadow-glow mb-12 overflow-hidden">
        <div className="bg-primary/5 border-b border-primary/10 px-6 py-8 text-center">
          <div className="font-serif text-5xl md:text-6xl font-semibold text-ink tabular-nums">
            {price}
          </div>
          <p className="text-sm text-ink-muted mt-2">One-time payment · full course access</p>
          <p className="text-xs text-ink-muted mt-3 max-w-md mx-auto">{COURSE_PRICE_NOTE}</p>
        </div>
        <CardContent className="p-6 md:p-8">
          {hasAccess ? (
            <div className="text-center space-y-4">
              <p className="text-success font-medium">
                You already have full course access.
              </p>
              <Button asChild size="lg">
                <Link href="/dashboard">
                  Go to dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          ) : user ? (
            <div className="space-y-4">
              <p className="text-sm text-ink-muted text-center">
                Signed in as <span className="text-ink">{user.email}</span>.
              </p>
              <Button asChild size="lg" className="w-full">
                <Link href="/unlock">
                  Continue to unlock
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <PricingCheckoutButton priceUsd={priceNum} />
              <p className="text-xs text-center text-ink-muted">
                Online card checkout connects soon. Your coordinator can also grant
                access after offline payment.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <Button asChild size="lg" className="w-full">
                  <Link href={`/signup?redirectTo=${encodeURIComponent("/pricing")}`}>
                    Create account
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="w-full">
                  <Link href={`/login?redirectTo=${encodeURIComponent("/pricing")}`}>
                    Log in to purchase
                  </Link>
                </Button>
              </div>
              <p className="text-xs text-center text-ink-muted">
                Not ready to buy?{" "}
                <Link href="/try" className="text-primary hover:underline">
                  Try 5 questions free
                </Link>{" "}
                — no account needed.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="mb-14">
        <h2 className="font-serif text-2xl font-semibold mb-6">
          Everything included in {price}
        </h2>
        <ul className="grid sm:grid-cols-2 gap-4">
          {COURSE_FEATURES.map((f) => (
            <li
              key={f.title}
              className="flex gap-3 rounded-2xl border border-border bg-surface p-4"
            >
              <Check className="h-5 w-5 text-success shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-ink text-sm">{f.title}</p>
                <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                  {f.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl">Common questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {PRICING_FAQ.map((item) => (
              <div key={item.q}>
                <p className="text-sm font-medium text-ink">{item.q}</p>
                <p className="text-sm text-ink-muted mt-1 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
