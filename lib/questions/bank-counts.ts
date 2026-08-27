import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SECTIONS } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function fetchStandardCounts(
  supabase: SupabaseClient,
): Promise<Record<string, number>> {
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
  return Object.fromEntries(results);
}

const getCachedStandardCounts = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    return fetchStandardCounts(supabase);
  },
  ["standard-question-counts-v1"],
  { revalidate: 300 },
);

/** Per-section bank sizes for Assessment picker. Cached 5 min. */
export const getStandardQuestionCountsBySection = cache(async () => {
  try {
    return await getCachedStandardCounts();
  } catch {
    const supabase = await createClient();
    return fetchStandardCounts(supabase);
  }
});
