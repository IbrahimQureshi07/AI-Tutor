import { AssessmentPicker } from "@/components/assessment/assessment-picker";
import { SECTIONS, type SectionCode } from "@/lib/constants";
import { getAssessmentCoverage } from "@/lib/assessment/coverage";
import { getStandardQuestionCountsBySection } from "@/lib/questions/bank-counts";
import { requireAppUser } from "@/lib/auth/request-session";

export default async function AssessmentIntro({
  searchParams,
}: {
  searchParams?: Promise<{ sections?: string | string[] }>;
}) {
  const { supabase, user } = await requireAppUser();

  const sp = (await searchParams) ?? {};
  const raw = Array.isArray(sp.sections) ? sp.sections.join(",") : sp.sections ?? "";
  const requested = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean) as SectionCode[];
  const validCodes = new Set(SECTIONS.map((s) => s.code));
  const preselect = requested.filter((c) => validCodes.has(c));

  const [counts, coverage] = await Promise.all([
    getStandardQuestionCountsBySection(),
    getAssessmentCoverage(supabase, user.id),
  ]);
  const sections = SECTIONS.map((s) => ({ ...s, count: counts[s.code] ?? 0 }));

  let initialPicked: SectionCode[];
  if (preselect.length) {
    initialPicked = preselect;
  } else if (!coverage.allCovered) {
    initialPicked = coverage.missing;
  } else {
    initialPicked = sections.filter((s) => s.count > 0).map((s) => s.code as SectionCode);
  }

  return (
    <AssessmentPicker
      sections={sections}
      initialPicked={initialPicked}
      coverage={coverage}
    />
  );
}
