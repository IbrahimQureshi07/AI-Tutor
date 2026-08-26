/**
 * Fortune Academy brand constants — single source of truth for UI, PDF, and meta.
 * Do not hardcode these strings elsewhere; import from here.
 */

export const BRAND = {
  /** Short display name (headers, logos) */
  shortName: "Fortune Academy",
  /** Formal / legal name (footers, PDFs) */
  legalName: "Fortune Academy of Real Estate",
  /** In-app product / feature name for the tutor chat */
  productName: "AI Tutor",
  /** One-line what we do */
  tagline: "South Carolina real estate exam prep",
  /** Browser / SEO title base */
  siteTitle: "Fortune Academy — SC Real Estate Exam Prep",
  siteDescription:
    "Fortune Academy of Real Estate — AI-powered practice for the South Carolina real estate salesperson exam.",

  phones: {
    tollFree: "800.922.2245",
    sales: "843.258.1120",
    support: "843.258.1108",
  },

  email: {
    sales: "sales@fortuneacademy.com",
  },

  /**
   * FREE OSHA grant offer — no deadline date (client requested).
   * Use on marketing/settings surfaces only.
   */
  oshaGrant: {
    headline: "FREE OSHA Certification Training",
    body: "We are currently offering FREE OSHA Certification Training through a state-funded grant program for South Carolina professionals. If you live in South Carolina and are interested in earning your OSHA certification at no cost, please make sure to fill out the form sent to your email from sales@fortuneacademy.com.",
  },

  /** Paths under /public */
  assets: {
    /** Square mark — favicon, avatar-sized marks */
    mark: "/brand/fa-mark.png",
    /** Wider logo lockup — headers where space allows */
    logo: "/brand/fa-logo.png",
  },

  /** Approximate brand orange from FA logo (for future CSS tuning) */
  colors: {
    burntOrange: "#B85F0E",
  },
} as const;

export type Brand = typeof BRAND;

/** tel: hrefs without dots */
export function brandTelHref(
  which: keyof typeof BRAND.phones,
): string {
  const digits = BRAND.phones[which].replace(/\D/g, "");
  return `tel:+1${digits}`;
}

export function brandMailtoSales(): string {
  return `mailto:${BRAND.email.sales}`;
}
