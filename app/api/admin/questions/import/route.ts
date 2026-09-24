import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { adminGuardResponse, adminMisconfiguredResponse } from "@/lib/admin/admin-http";
import { validateQuestionForm } from "@/lib/admin/question-form-validate";
import { ensureConceptExists } from "@/lib/admin/ensure-concept";

export const dynamic = "force-dynamic";

type RowError = {
  /** 1-indexed CSV row number (including header row as row 1). */
  row: number;
  errors: string[];
};

function detectDelimiter(raw: string): "," | ";" {
  const line = raw.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const semi = (line.match(/;/g) ?? []).length;
  const comma = (line.match(/,/g) ?? []).length;
  return semi > comma ? ";" : ",";
}

function normalizeKey(k: string): string {
  return k
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/^option_(a|b|c|d)$/i, "option_$1")
    .replace(/^option(a|b|c|d)$/i, "option_$1");
}

function normalizeRow(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row ?? {})) {
    out[normalizeKey(k)] = typeof v === "string" ? v : String(v ?? "");
  }
  // Alias client-friendly headers to app fields
  if (out.section && !out.section_code) out.section_code = out.section;
  if (out.concept && !out.concept_id) out.concept_id = out.concept;
  if (out.question && !out.prompt) out.prompt = out.question;
  if (out.correct && !out.correct_option) out.correct_option = out.correct;
  return out;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if (!guard.ok) {
    return adminGuardResponse(guard);
  }

  const url = new URL(request.url);
  const commit = url.searchParams.get("commit") === "1" || url.searchParams.get("commit") === "true";

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data." }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }

  const raw = await file.text();
  if (!raw.trim()) {
    return NextResponse.json({ error: "CSV is empty." }, { status: 400 });
  }

  const delimiter = detectDelimiter(raw);
  let rows: Record<string, unknown>[];
  try {
    rows = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: true,
      relax_column_count: true,
      delimiter,
    }) as Record<string, unknown>[];
  } catch {
    return NextResponse.json(
      { error: "Could not parse CSV. Make sure it has a header row." },
      { status: 400 },
    );
  }

  const errors: RowError[] = [];
  const valid: Array<ReturnType<typeof validateQuestionForm> & { ok: true }> = [];
  const bySection: Record<string, number> = {};

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // header row = 1
    const normalized = normalizeRow(rows[i] as Record<string, unknown>);
    const checked = validateQuestionForm({
      section_code: normalized.section_code,
      concept_id: normalized.concept_id || null,
      level: normalized.level,
      prompt: normalized.prompt,
      option_a: normalized.option_a,
      option_b: normalized.option_b,
      option_c: normalized.option_c,
      option_d: normalized.option_d,
      correct_option: normalized.correct_option,
      explanation: normalized.explanation || null,
    });
    if (!checked.ok) {
      errors.push({ row: rowNum, errors: checked.errors });
      continue;
    }
    valid.push(checked as ReturnType<typeof validateQuestionForm> & { ok: true });
    const code = checked.data.section_code;
    bySection[code] = (bySection[code] ?? 0) + 1;
  }

  if (!commit) {
    return NextResponse.json({
      commit: false,
      mode: "append",
      totalRows: rows.length,
      validRows: valid.length,
      invalidRows: errors.length,
      bySection,
      errors: errors.slice(0, 200),
    });
  }

  // Append-only: insert new rows; never update or delete existing questions.
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return adminMisconfiguredResponse();
  }
  // Ensure any new concepts exist before inserting questions (FK safety).
  try {
    const concepts = new Set<string>();
    for (const v of valid) {
      if (v.data.concept_id) concepts.add(v.data.concept_id);
    }
    for (const cid of concepts) {
      await ensureConceptExists(admin, cid);
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create concepts." },
      { status: 500 },
    );
  }
  // Append-only: insert new rows; never update or delete existing questions.
  const payload = valid.map((v) => ({
    ...v.data,
    pool: "standard" as const,
    source: "csv_import" as const,
    hint: null as null,
  }));

  let inserted = 0;
  if (payload.length) {
    const { error: insErr } = await admin.from("questions").insert(payload);
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    inserted = payload.length;
  }

  return NextResponse.json({
    commit: true,
    mode: "append",
    totalRows: rows.length,
    validRows: valid.length,
    invalidRows: errors.length,
    inserted,
    bySection,
    errors: errors.slice(0, 200),
  });
}

