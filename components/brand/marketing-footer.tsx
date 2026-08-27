import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import {
  BRAND,
  brandMailtoSales,
  brandTelHref,
} from "@/lib/brand";

const PHONE_ROWS = [
  { key: "tollFree" as const, label: "Toll-free" },
  { key: "sales" as const, label: "Sales" },
  { key: "support" as const, label: "Support" },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/60 mt-24 bg-surface/40">
      <div className="container py-12 md:py-14 space-y-10">
        {/* OSHA grant — no deadline */}
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.06] px-5 py-5 md:px-6 md:py-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {BRAND.oshaGrant.headline}
          </p>
          <p className="mt-2 text-sm text-ink-muted leading-relaxed max-w-3xl">
            {BRAND.oshaGrant.body}
          </p>
          <a
            href={brandMailtoSales()}
            className="mt-3 inline-flex text-sm font-medium text-primary underline underline-offset-2 hover:text-primary/90"
          >
            Email {BRAND.email.sales}
          </a>
        </div>

        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
          <div className="space-y-3">
            <BrandLogo href="/" size="md" />
            <p className="text-sm text-ink-muted leading-relaxed max-w-sm">
              {BRAND.legalName}. {BRAND.tagline}.
            </p>
            <p className="text-xs text-ink-muted">
              © {new Date().getFullYear()} {BRAND.legalName}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink mb-3">
              Sales &amp; Support
            </p>
            <ul className="space-y-2.5 text-sm">
              {PHONE_ROWS.map((row) => (
                <li key={row.key} className="flex items-center gap-2.5 text-ink-muted">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-primary/80" />
                  <span className="w-16 shrink-0 text-ink-muted/80">{row.label}</span>
                  <a
                    href={brandTelHref(row.key)}
                    className="font-medium text-ink hover:text-primary transition-colors tabular-nums"
                  >
                    {BRAND.phones[row.key]}
                  </a>
                </li>
              ))}
              <li className="flex items-center gap-2.5 text-ink-muted pt-1">
                <Mail className="h-3.5 w-3.5 shrink-0 text-primary/80" />
                <span className="w-16 shrink-0 text-ink-muted/80">Email</span>
                <a
                  href={brandMailtoSales()}
                  className="font-medium text-ink hover:text-primary transition-colors break-all"
                >
                  {BRAND.email.sales}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink mb-3">
              Explore
            </p>
            <ul className="space-y-2.5 text-sm text-ink-muted">
              <li>
                <Link href="/try" className="hover:text-ink transition-colors">
                  Try free demo
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-ink transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-ink transition-colors">
                  Log in
                </Link>
              </li>
            </ul>
            <p className="mt-6 text-xs text-ink-muted">Made for future REALTORS®.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
