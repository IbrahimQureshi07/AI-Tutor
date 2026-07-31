import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

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
  "id, section_code, concept_id, topic_id, level, pool, prompt, option_a, option_b, option_c, option_d, correct_option, hint, explanation, source";

const PAGE = 1000;

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

export async function GET() {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.reason === "unauthorized" ? "unauthorized" : "forbidden" },
      { status: guard.reason === "unauthorized" ? 401 : 403 },
    );
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 503 });
  }

  const all: ExportRow[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await admin
      .from("questions")
      .select(SELECT)
      .eq("is_ai_generated", false)
      .order("section_code", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const chunk = asExportRows(data);
    all.push(...chunk);
    if (chunk.length < PAGE) break;
    from += PAGE;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const csv = toCsv(all);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dataset-questions-${stamp}.csv"`,
      "Cache-Control": "no-store",
      "X-Row-Count": String(all.length),
    },
  });
}
