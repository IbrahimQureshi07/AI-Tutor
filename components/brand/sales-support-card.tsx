import { Mail, Phone } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

/** Settings / account surfaces — Sales, Support, and OSHA grant (no deadline). */
export function SalesSupportCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales &amp; Support</CardTitle>
        <CardDescription>
          Reach {BRAND.legalName} for course help or enrollment questions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ul className="space-y-2.5 text-sm">
          {PHONE_ROWS.map((row) => (
            <li
              key={row.key}
              className="flex items-center gap-2.5 text-ink-muted"
            >
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
          <li className="flex items-center gap-2.5 text-ink-muted pt-0.5">
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

        <div className="rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {BRAND.oshaGrant.headline}
          </p>
          <p className="mt-1.5 text-sm text-ink-muted leading-relaxed">
            {BRAND.oshaGrant.body}
          </p>
          <a
            href={brandMailtoSales()}
            className="mt-2.5 inline-flex text-sm font-medium text-primary underline underline-offset-2 hover:text-primary/90"
          >
            Email {BRAND.email.sales}
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
