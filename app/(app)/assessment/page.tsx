import { redirect } from "next/navigation";
import { AssessmentPicker } from "@/components/assessment/assessment-picker";
import { createClient } from "@/lib/supabase/server";
import { SECTIONS, type SectionCode } from "@/lib/constants";
import { getAssessmentCoverage } from "@/lib/assessment/coverage";

export default async function AssessmentIntro({
  searchParams,
}: {
  searchParams?: Promise<{ sections?: string | string[] }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = (await searchParams) ?? {};
  const raw = Array.isArray(sp.sections) ? sp.sections.join(",") : sp.sections ?? "";
  const requested = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean) as SectionCode[];
  const validCodes = new Set(SECTIONS.map((s) => s.code));
  const preselect = requested.filter((c) => validCodes.has(c));

  // Per-section counts via HEAD count queries so we don't hit the
  // default 1000-row select cap when the bank grows past ~1k rows.
  const results = await Promise.all(
    SECTIONS.map((s) =>
      supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("section_code", s.code)
        .eq("pool", "standard")
        .eq("is_ai_generated", false)
        .then(({ count }) => [s.code, count ?? 0] as const),
    ),
  );
  const counts: Record<string, number> = Object.fromEntries(results);
  const sections = SECTIONS.map((s) => ({ ...s, count: counts[s.code] ?? 0 }));

  const coverage = await getAssessmentCoverage(supabase, user.id);

  // Preselection priority:
  //   1. explicit ?sections=A2,A3
  //   2. missing sections (so the next click continues coverage)
  //   3. everything with questions
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
