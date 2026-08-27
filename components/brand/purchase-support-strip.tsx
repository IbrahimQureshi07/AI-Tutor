import { Phone } from "lucide-react";
import {
  BRAND,
  brandMailtoSales,
  brandTelHref,
} from "@/lib/brand";
import { cn } from "@/lib/utils";

/** Compact Sales/Support + optional OSHA note for pricing / unlock. */
export function PurchaseSupportStrip({
  showOsha = true,
  className,
}: {
  showOsha?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-2xl border border-border bg-surface px-5 py-4 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink mb-2.5">
          Questions? Contact {BRAND.shortName}
        </p>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-6 gap-y-2 text-ink-muted">
          <a
            href={brandTelHref("support")}
            className="inline-flex items-center gap-2 hover:text-primary transition-colors"
          >
            <Phone className="h-3.5 w-3.5 text-primary/80" />
            Support {BRAND.phones.support}
          </a>
          <a
            href={brandTelHref("sales")}
            className="inline-flex items-center gap-2 hover:text-primary transition-colors"
          >
            <Phone className="h-3.5 w-3.5 text-primary/80" />
            Sales {BRAND.phones.sales}
          </a>
          <a
            href={brandTelHref("tollFree")}
            className="inline-flex items-center gap-2 hover:text-primary transition-colors"
          >
            <Phone className="h-3.5 w-3.5 text-primary/80" />
            Toll-free {BRAND.phones.tollFree}
          </a>
        </div>
      </div>

      {showOsha ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.06] px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {BRAND.oshaGrant.headline}
          </p>
          <p className="mt-1.5 text-sm text-ink-muted leading-relaxed">
            {BRAND.oshaGrant.body}
          </p>
          <a
            href={brandMailtoSales()}
            className="mt-2 inline-flex text-sm font-medium text-primary underline underline-offset-2 hover:text-primary/90"
          >
            Email {BRAND.email.sales}
          </a>
        </div>
      ) : null}
    </div>
  );
}
