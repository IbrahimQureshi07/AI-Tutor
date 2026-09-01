/**
 * Marketing copy for the one-time course purchase.
 * Keep claims accurate — only list features the app actually ships.
 */
export type CourseFeature = {
  title: string;
  description: string;
};

export const COURSE_FEATURES: CourseFeature[] = [
  {
    title: "Mock & Final exam sims",
    description:
      "Timed mock exams plus a final readiness test with scored results and report cards.",
  },
  {
    title: "Score + readiness reports",
    description:
      "Download PDFs for exam sessions and share results with your broker or study partner.",
  },
  {
    title: "Keep your free modes",
    description:
      "Assessment, Practice, and Mistakes stay available — upgrading just unlocks the two exam-shaped modes.",
  },
  {
    title: "One-time upgrade",
    description:
      "Pay once to unlock Mock + Final — no recurring subscription required.",
  },
];

export const PRICING_FAQ: { q: string; a: string }[] = [
  {
    q: "Is this a subscription?",
    a: "No. This is a one-time upgrade. You pay once to unlock Mock Exam and Final Test.",
  },
  {
    q: "What can I do for free?",
    a: "You can use Assessment, Practice, and Mistakes without paying. Mock Exam and Final Test are paid.",
  },
  {
    q: "Can I try before I pay?",
    a: "Yes — you can run the full learning modes (Assessment, Practice, Mistakes) for free before upgrading.",
  },
  {
    q: "How do I pay?",
    a: "Secure card checkout via Stripe is being connected. Until then, your program coordinator can grant access after payment.",
  },
];

export const COURSE_PRICE_NOTE =
  "Price shown in USD. Your program may adjust pricing — confirm with your coordinator before paying.";
