import { SECTIONS, type SectionCode } from "@/lib/constants";

export type QuestionSourceFilter = "dataset" | "llm" | "both";
export type QuestionGroupFilter = "all" | "national" | "state";

const SECTION_CODES = new Set(SECTIONS.map((s) => s.code));

export function cleanQuestionSearch(q: string | null | undefined): string {
  return (q ?? "").trim().replace(/[%_]/g, "").slice(0, 120);
}

/**
 * Quote a PostgREST filter value so commas / parens / spaces don't break
 * `.or()` parsing. Double-quotes inside the value are escaped by doubling.
 */
export function postgrestQuote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function parseQuestionSource(
  raw: string | null | undefined,
): QuestionSourceFilter {
  if (raw === "dataset" || raw === "llm") return raw;
  return "both";
}

export function parseQuestionGroup(
  raw: string | null | undefined,
): QuestionGroupFilter {
  if (raw === "national" || raw === "state") return raw;
  return "all";
}

export function parseQuestionSection(
  raw: string | null | undefined,
): SectionCode | "all" {
  if (!raw || raw === "all") return "all";
  const code = raw.trim().toUpperCase();
  if (SECTION_CODES.has(code as SectionCode)) return code as SectionCode;
  return "all";
}

export function resolveQuestionSectionCodes(
  section: SectionCode | "all",
  group: QuestionGroupFilter,
): string[] | null {
  if (section !== "all") return [section];
  if (group === "national") {
    return SECTIONS.filter((s) => s.group === "National").map((s) => s.code);
  }
  if (group === "state") {
    return SECTIONS.filter((s) => s.group === "State").map((s) => s.code);
  }
  return null;
}

type FilterableQuery = {
  eq: (column: string, value: unknown) => FilterableQuery;
  in: (column: string, values: string[]) => FilterableQuery;
  or: (filters: string) => FilterableQuery;
};

export function applyQuestionListFilters<T extends FilterableQuery>(
  query: T,
  opts: {
    source: QuestionSourceFilter;
    sectionCodes: string[] | null;
    q: string;
  },
): T {
  let next = query;
  if (opts.source === "dataset") {
    next = next.eq("is_ai_generated", false) as T;
  } else if (opts.source === "llm") {
    next = next.eq("is_ai_generated", true) as T;
  }
  if (opts.sectionCodes) {
    next = next.in("section_code", opts.sectionCodes) as T;
  }
  if (opts.q) {
    const maybeSection = opts.q.toUpperCase();
    const isSection = /^[AB][1-6]$/.test(maybeSection);
    const like = postgrestQuote(`%${opts.q}%`);
    next = next.or(
      [
        `prompt.ilike.${like}`,
        `concept_id.ilike.${like}`,
        isSection ? `section_code.eq.${postgrestQuote(maybeSection)}` : null,
      ]
        .filter(Boolean)
        .join(","),
    ) as T;
  }
  return next;
}

/** True when filters narrow the bank (blocks accidental wipe-all). */
export function hasQuestionDeleteScope(opts: {
  source: QuestionSourceFilter;
  section: SectionCode | "all";
  group: QuestionGroupFilter;
  q: string;
}): boolean {
  return (
    opts.source !== "both" ||
    opts.section !== "all" ||
    opts.group !== "all" ||
    opts.q.length > 0
  );
}

export function describeQuestionFilter(opts: {
  source: QuestionSourceFilter;
  section: SectionCode | "all";
  group: QuestionGroupFilter;
  q: string;
}): string {
  const parts: string[] = [];
  if (opts.source === "dataset") parts.push("Dataset only");
  else if (opts.source === "llm") parts.push("LLM only");
  else parts.push("Dataset + LLM");

  if (opts.section !== "all") parts.push(`Section ${opts.section}`);
  else if (opts.group === "national") parts.push("National (A1–A6)");
  else if (opts.group === "state") parts.push("SC / State (B1–B6)");
  else parts.push("All sections");

  if (opts.q) parts.push(`Search “${opts.q}”`);
  return parts.join(" · ");
}
