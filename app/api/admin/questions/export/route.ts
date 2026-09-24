import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { adminGuardResponse, adminMisconfiguredResponse } from "@/lib/admin/admin-http";
import { SECTIONS, type SectionCode } from "@/lib/constants";

export const dynamic = "force-dynamic";

const COLUMNS = [
  "id",
  "section_code",
  "concept_id",
  "topic_id",
  "level",
  "pool",
  "prompt",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_option",
  "hint",
  "explanation",
  "source",
] as const;

type ExportRow = Record<(typeof COLUMNS)[number], string | null>;

/** Literal select so Supabase client typing stays concrete. */
const SELECT =
  "id, section_code, concept_id, topic_id, level, pool, prompt, option_a, option_b, option_c, option_d, correct_option, hint, explanation, source, is_ai_generated";

const PAGE = 1000;
const SECTION_CODES = new Set(SECTIONS.map((s) => s.code));

type SourceFilter = "dataset" | "llm" | "both";
type GroupFilter = "all" | "national" | "state";

function csvEscape(value: string | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows: ExportRow[]): string {
  const header = COLUMNS.join(",");
  const lines = rows.map((row) =>
    COLUMNS.map((col) => csvEscape(row[col])).join(","),
  );
  return [header, ...lines].join("\r\n") + "\r\n";
}

function asExportRows(data: unknown): ExportRow[] {
  if (!Array.isArray(data)) return [];
  return data.map((raw) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    const out = {} as ExportRow;
    for (const col of COLUMNS) {
      const v = row[col];
      out[col] = v == null ? null : String(v);
    }
    return out;
  });
}

function parseSource(raw: string | null): SourceFilter {
  if (raw === "llm" || raw === "both") return raw;
  return "dataset";
}

function parseGroup(raw: string | null): GroupFilter {
  if (raw === "national" || raw === "state") return raw;
  return "all";
}

function parseSection(raw: string | null): SectionCode | "all" {
  if (!raw || raw === "all") return "all";
  const code = raw.trim().toUpperCase();
  if (SECTION_CODES.has(code as SectionCode)) return code as SectionCode;
  return "all";
}

function buildFilename(opts: {
  source: SourceFilter;
  group: GroupFilter;
  section: SectionCode | "all";
  stamp: string;
}): string {
  const parts = ["questions"];
  if (opts.source === "dataset") parts.push("dataset");
  else if (opts.source === "llm") parts.push("llm");
  else parts.push("all-sources");
  if (opts.section !== "all") parts.push(opts.section);
  else if (opts.group === "national") parts.push("national");
  else if (opts.group === "state") parts.push("sc");
  parts.push(opts.stamp);
  return `${parts.join("-")}.csv`;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if (!guard.ok) {
    return adminGuardResponse(guard);
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return adminMisconfiguredResponse();
  }

  const url = new URL(request.url);
  const source = parseSource(url.searchParams.get("source"));
  const group = parseGroup(url.searchParams.get("group"));
  const section = parseSection(url.searchParams.get("section"));

  // Specific section wins over group.
  const sectionCodes: string[] | null =
    section !== "all"
      ? [section]
      : group === "national"
        ? SECTIONS.filter((s) => s.group === "National").map((s) => s.code)
        : group === "state"
          ? SECTIONS.filter((s) => s.group === "State").map((s) => s.code)
          : null;

  const all: ExportRow[] = [];
  let from = 0;

  for (;;) {
    let query = admin
      .from("questions")
      .select(SELECT)
      .order("section_code", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);

    if (source === "dataset") {
      query = query.eq("is_ai_generated", false);
    } else if (source === "llm") {
      query = query.eq("is_ai_generated", true);
    }

    if (sectionCodes) {
      query = query.in("section_code", sectionCodes);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const chunk = asExportRows(data);
    all.push(...chunk);
    if (chunk.length < PAGE) break;
    from += PAGE;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = buildFilename({ source, group, section, stamp });
  const csv = toCsv(all);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Row-Count": String(all.length),
      "X-Export-Source": source,
    },
  });
}
