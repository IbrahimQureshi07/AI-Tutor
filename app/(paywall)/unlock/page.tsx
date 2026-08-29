import Link from "next/link";
import { ArrowRight, Check, Lock, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getAccessState,
  getCoursePriceLabel,
  getCoursePriceUsd,
} from "@/lib/access/check-access";
import { COURSE_FEATURES } from "@/lib/billing/course-offering";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PricingCheckoutButton } from "@/components/billing/pricing-checkout-button";
import { PaywallSignOutButton } from "@/components/billing/paywall-sign-out-button";
import { PurchaseSupportStrip } from "@/components/brand/purchase-support-strip";
import { BRAND } from "@/lib/brand";

function statusMessage(status: string, migrationApplied: boolean): string {
  if (!migrationApplied) {
    return `Upgrade once to unlock Mock Exam and Final Test. Assessment, Practice, and Mistakes are free.`;
  }
  if (status === "demo_completed") {
    return "Upgrade to unlock Mock Exam and Final Test. Your free study modes remain available.";
  }
  if (status === "expired") {
    return "Your paid exam access has expired. Upgrade again to unlock Mock Exam and Final Test.";
  }
  return "Upgrade once to unlock Mock Exam and Final Test.";
}

export default async function UnlockPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirectTo=/unlock");

  const access = await getAccessState(supabase, user);
  if (access.canUsePaidExams) redirect("/dashboard");

  const price = getCoursePriceLabel();
  const priceNum = getCoursePriceUsd();
  const headline = statusMessage(access.status, access.migrationApplied);

  return (
    <main className="container py-12 md:py-16 max-w-3xl">
      <div className="flex justify-end mb-4">
        <PaywallSignOutButton />
      </div>

      <div className="text-center mb-10">
        <Badge variant="outline" className="mb-4 border-warn/40 text-warn bg-warn/5">
          <Lock className="h-3 w-3 mr-1" />
          Mock &amp; Final access required
        </Badge>
        <h1 className="font-serif text-3xl md:text-4xl font-semibold tracking-tight text-ink">
          Unlock Mock Exam &amp; Final Test
        </h1>
        <p className="mt-4 text-ink-muted leading-relaxed max-w-xl mx-auto">
          {headline}
        </p>
      </div>

      <Card className="border-primary/20 shadow-glow overflow-hidden mb-8">
        <div className="bg-primary/5 border-b border-primary/10 px-6 py-8 text-center">
          <div className="font-serif text-5xl font-semibold text-ink tabular-nums">
            {price}
          </div>
          <p className="text-sm text-ink-muted mt-2">One-time payment · unlock Mock + Final</p>
        </div>
        <CardContent className="p-6 space-y-4">
          <PricingCheckoutButton priceUsd={priceNum} />
          <p className="text-xs text-center text-ink-muted leading-relaxed">
            Secure card checkout via Stripe is connecting soon. If you already paid
            offline, your program coordinator can grant access from the admin panel.
          </p>
          <div className="text-center">
            <Button asChild variant="link" size="sm">
              <Link href="/pricing">
                Compare plans &amp; FAQ
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <PurchaseSupportStrip className="mb-10" />

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-serif text-xl font-semibold">
            What you get for {price}
          </h2>
        </div>
        <ul className="grid sm:grid-cols-2 gap-3">
          {COURSE_FEATURES.map((f) => (
            <li
              key={f.title}
              className="flex gap-2.5 rounded-xl border border-border bg-surface px-3 py-3"
            >
              <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-ink">{f.title}</p>
                <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">
                  {f.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 text-center text-xs text-ink-muted">
        © {new Date().getFullYear()} {BRAND.legalName}
      </p>
    </main>
  );
}
