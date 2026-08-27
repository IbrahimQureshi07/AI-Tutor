/**
 * Marketing copy for the one-time course purchase.
 * Keep claims accurate — only list features the app actually ships.
 */

import { BRAND } from "@/lib/brand";

export type CourseFeature = {
  title: string;
  description: string;
};

export const COURSE_FEATURES: CourseFeature[] = [
  {
    title: "Full exam prep path",
    description:
      "Assessment, Practice, Mistakes review, Mock exam, and Final test — structured like real SC prep.",
  },
  {
    title: "Complete question bank",
    description:
      "Exam-style items across all National (A1–A6) and South Carolina State (B1–B6) sections.",
  },
  {
    title: "AI tutor chat",
    description: `Get hints and explanations from ${BRAND.shortName} ${BRAND.productName} on practice and assessment questions — available whenever you study.`,
  },
  {
    title: "Mastery & readiness tracking",
    description:
      "Section-by-section accuracy, strengths, weaknesses, and a composite readiness estimate.",
  },
  {
    title: "Mistake resurfacing",
    description:
      "Missed questions come back until you lock them in — focused review, not random drills.",
  },
  {
    title: "Mock & final simulations",
    description:
      "Timed mock exams and a final readiness test with scored results and PDF report cards.",
  },
  {
    title: "Progress reports (PDF)",
    description:
      "Download session and progress reports to share with your broker or study partner.",
  },
  {
    title: "One-time access",
    description:
      "Pay once and use the full course through your exam date — no recurring subscription required.",
  },
];

export const PRICING_FAQ: { q: string; a: string }[] = [
  {
    q: "Is this a subscription?",
    a: "No. This is a one-time course purchase. You pay once for full access to every study mode.",
  },
  {
    q: "What happens after the free demo?",
    a: "You'll create an account and unlock the full course with a one-time payment. The demo is a short preview only.",
  },
  {
    q: "Can I try before I pay?",
    a: "Yes — a limited free preview (a few questions with AI chat) is available before you purchase.",
  },
  {
    q: "How do I pay?",
    a: "Secure card checkout via Stripe is being connected. Until then, your program coordinator can grant access after payment.",
  },
];

export const COURSE_PRICE_NOTE =
  "Price shown in USD. Your program may adjust pricing — confirm with your coordinator before paying.";
