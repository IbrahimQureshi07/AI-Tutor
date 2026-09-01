"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SECTIONS } from "@/lib/constants";
import { formatSectionDisplayLabel } from "@/lib/sections/display-label";
import { validateQuestionForm } from "@/lib/admin/question-form-validate";
import {
  buildQuestionCsvTemplate,
  QUESTION_CSV_TEMPLATE_FILENAME,
} from "@/lib/admin/question-csv-template";

type ImportPreview = {
  commit: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: Array<{ row: number; errors: string[] }>;
  inserted?: number;
};

type QuestionItem = {
  id: string;
  section_code: string;
  concept_id: string | null;
  level: "easy" | "medium" | "hard";
  prompt: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "A" | "B" | "C" | "D";
  explanation: string | null;
};

type QuestionListResponse = {
  questions: QuestionItem[];
  offset: number;
  limit: number;
  nextOffset: number;
  hasMore: boolean;
};

type FormState = Omit<QuestionItem, "id">;

const EMPTY_FORM: FormState = {
  section_code: "",
  concept_id: null,
  level: "medium",
  prompt: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct_option: "A",
  explanation: null,
};

export default function AdminQuestionsPage() {
  const [items, setItems] = React.useState<QuestionItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [offset, setOffset] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);
  const [importFile, setImportFile] = React.useState<File | null>(null);
  const [importPreview, setImportPreview] = React.useState<ImportPreview | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const load = React.useCallback(async (args?: { q?: string; offset?: number; append?: boolean }) => {
    setLoading(true);
    try {
      const q = args?.q ?? query;
      const off = args?.offset ?? 0;
      const url = new URL("/api/admin/questions", window.location.origin);
      if (q.trim()) url.searchParams.set("q", q.trim());
      url.searchParams.set("offset", String(off));
      url.searchParams.set("limit", "200");

      const res = await fetch(url.toString(), { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as Partial<QuestionListResponse> & {
        error?: string;
      };
      if (!res.ok) {
        toast.error(json.error ?? "Could not load questions.");
        return;
      }
      const next = (json.questions ?? []) as QuestionItem[];
      if (args?.append) {
        setItems((prev) => [...prev, ...next]);
      } else {
        setItems(next);
      }
      setOffset(Number(json.nextOffset ?? next.length ?? 0));
      setHasMore(Boolean(json.hasMore));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      void load({ q: query, offset: 0, append: false });
    }, 250);
    return () => window.clearTimeout(t);
  }, [load, query]);

  async function loadMore() {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      await load({ q: query, offset, append: true });
    } finally {
      setLoadingMore(false);
    }
  }

  function patch<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function startEdit(q: QuestionItem) {
    setEditingId(q.id);
    const { id: _id, ...rest } = q;
    void _id;
    setForm(rest);
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function previewImport(file: File) {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/admin/questions/import", { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as Partial<ImportPreview> & {
        error?: string;
      };
      if (!res.ok) {
        toast.error(json.error ?? "Could not preview CSV.");
        setImportPreview(null);
        return;
      }
      setImportPreview({
        commit: false,
        totalRows: Number(json.totalRows ?? 0),
        validRows: Number(json.validRows ?? 0),
        invalidRows: Number(json.invalidRows ?? 0),
        errors: Array.isArray(json.errors) ? (json.errors as ImportPreview["errors"]) : [],
      });
      toast.success("Preview ready.");
    } catch {
      toast.error("Could not preview CSV.");
      setImportPreview(null);
    } finally {
      setImporting(false);
    }
  }

  async function commitImport(file: File) {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/admin/questions/import?commit=1", { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as Partial<ImportPreview> & {
        error?: string;
      };
      if (!res.ok) {
        toast.error(json.error ?? "Could not import CSV.");
        return;
      }
      const inserted = Number(json.inserted ?? 0);
      toast.success(inserted ? `Imported ${inserted} question(s).` : "Import complete.");
      setImportFile(null);
      setImportPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load({ q: query, offset: 0, append: false });
    } catch {
      toast.error("Could not import CSV.");
    } finally {
      setImporting(false);
    }
  }

  async function saveQuestion(e: React.FormEvent) {
    e.preventDefault();

    const checked = validateQuestionForm(form);
    if (!checked.ok) {
      toast.error(checked.errors[0] ?? "Please fix the form errors.");
      if (checked.errors.length > 1) {
        toast.message(`${checked.errors.length - 1} more issue(s)`, {
          description: checked.errors.slice(1).join(" · "),
        });
      }
      return;
    }

    setSaving(true);
    try {
      const body = checked.data;

      const res = await fetch("/api/admin/questions", {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...body } : body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const apiError =
          typeof json.error === "string"
            ? json.error
            : Array.isArray(json.errors)
              ? json.errors[0]
              : "Could not save question.";
        toast.error(apiError);
        return;
      }
      toast.success(editingId ? "Question updated." : "Question created.");
      resetForm();
      await load({ q: query, offset: 0, append: false });
    } finally {
      setSaving(false);
    }
  }

  async function downloadDatasetCsv() {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/questions/export", { cache: "no-store" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? "Could not export CSV.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `dataset-questions-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const count = res.headers.get("X-Row-Count");
      toast.success(
        count
          ? `Downloaded ${count} dataset questions (LLM excluded).`
          : "Dataset CSV downloaded (LLM excluded).",
      );
    } catch {
      toast.error("Could not export CSV.");
    } finally {
      setExporting(false);
    }
  }

  function downloadTemplateCsv() {
    const csv = buildQuestionCsvTemplate();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = QUESTION_CSV_TEMPLATE_FILENAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Template downloaded — keep the header row, add your questions below.");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Questions</h1>
          <p className="text-ink-muted mt-1 text-sm">
            Create or update question bank entries. Download the template to
            prepare a bulk CSV (header row once, then one question per row).
            Dataset export excludes LLM-generated follow-ups.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadTemplateCsv}
          >
            <Download className="h-4 w-4" />
            Download template CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <Upload className="h-4 w-4" />
            Upload CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={() => void downloadDatasetCsv()}
          >
            <Download className="h-4 w-4" />
            {exporting ? "Preparing CSV…" : "Download dataset CSV"}
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setImportFile(f);
          setImportPreview(null);
          if (f) void previewImport(f);
        }}
      />

      {(importFile || importPreview) && (
        <Card>
          <CardHeader>
            <CardTitle>Bulk upload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">
              <span className="font-medium">File:</span>{" "}
              <span className="text-ink-muted">{importFile?.name ?? "—"}</span>
            </div>

            {importing && <p className="text-sm text-ink-muted">Working…</p>}

            {importPreview && (
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">{importPreview.validRows}</span> valid row(s)
                  {" · "}
                  <span className={importPreview.invalidRows ? "font-medium text-danger" : "font-medium"}>
                    {importPreview.invalidRows}
                  </span>{" "}
                  invalid row(s)
                </p>

                {importPreview.invalidRows > 0 && importPreview.errors.length > 0 && (
                  <div className="rounded-lg border border-border/70 bg-elevated/20 p-3">
                    <p className="text-xs font-medium text-ink-muted mb-2">
                      Fix these rows and re-upload (showing up to {importPreview.errors.length}):
                    </p>
                    <div className="space-y-1">
                      {importPreview.errors.slice(0, 30).map((e) => (
                        <p key={`${e.row}-${e.errors[0]}`} className="text-xs text-ink-muted">
                          <span className="font-medium text-ink">Row {e.row}:</span> {e.errors.join(" · ")}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={!importFile || importing}
                    variant="outline"
                    onClick={() => (importFile ? void previewImport(importFile) : null)}
                  >
                    Re-check
                  </Button>
                  <Button
                    type="button"
                    disabled={
                      !importFile ||
                      importing ||
                      importPreview.invalidRows > 0 ||
                      importPreview.validRows === 0
                    }
                    onClick={() => (importFile ? void commitImport(importFile) : null)}
                  >
                    Import valid rows
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={importing}
                    onClick={() => {
                      setImportFile(null);
                      setImportPreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    Clear
                  </Button>
                </div>

                {importPreview.invalidRows > 0 && (
                  <p className="text-xs text-ink-muted">
                    Import is disabled until all rows are valid.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit question" : "Add question"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveQuestion} className="grid gap-3 md:grid-cols-2">
            <Field label="Topic / Section">
              <select
                value={form.section_code}
                onChange={(e) => patch("section_code", e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                required
              >
                <option value="" disabled>
                  Select a section…
                </option>
                {SECTIONS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {formatSectionDisplayLabel(s.code)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Difficulty">
              <select
                value={form.level}
                onChange={(e) => patch("level", e.target.value as FormState["level"])}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="easy">easy</option>
                <option value="medium">medium</option>
                <option value="hard">hard</option>
              </select>
            </Field>
            <Field label="Question" className="md:col-span-2">
              <Input
                value={form.prompt}
                onChange={(e) => patch("prompt", e.target.value)}
                required
              />
            </Field>
            <Field label="Option A"><Input value={form.option_a} onChange={(e) => patch("option_a", e.target.value)} required /></Field>
            <Field label="Option B"><Input value={form.option_b} onChange={(e) => patch("option_b", e.target.value)} required /></Field>
            <Field label="Option C"><Input value={form.option_c} onChange={(e) => patch("option_c", e.target.value)} required /></Field>
            <Field label="Option D"><Input value={form.option_d} onChange={(e) => patch("option_d", e.target.value)} required /></Field>
            <Field label="Correct option">
              <select
                value={form.correct_option}
                onChange={(e) => patch("correct_option", e.target.value as FormState["correct_option"])}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </Field>
            <Field label="Concept (optional)">
              <Input
                value={form.concept_id ?? ""}
                onChange={(e) => patch("concept_id", e.target.value || null)}
                placeholder="e.g. A1.forms_of_ownership"
              />
            </Field>
            <Field label="Explanation" className="md:col-span-2">
              <Input value={form.explanation ?? ""} onChange={(e) => patch("explanation", e.target.value || null)} />
            </Field>
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Update question" : "Create question"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel edit
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Find questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search question text, concept (e.g. B5.fair_housing), or section (A1/B3)…"
          />
          <p className="text-xs text-ink-muted">
            Shows newest results first. Use search + “Load more” to reach any question without loading the whole bank.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Latest questions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-ink-muted">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-ink-muted">No questions found.</p>
          ) : (
            <div className="space-y-2">
              {items.map((q) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-border p-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-ink-muted">
                      {formatSectionDisplayLabel(q.section_code)} · {q.level}
                      {q.concept_id ? ` · ${q.concept_id}` : ""}
                    </p>
                    <p className="text-sm text-ink line-clamp-2">{q.prompt}</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => startEdit(q)}>
                    Edit
                  </Button>
                </div>
              ))}

              {hasMore && (
                <div className="pt-2">
                  <Button type="button" variant="outline" disabled={loadingMore} onClick={loadMore}>
                    {loadingMore ? "Loading…" : "Load more"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </label>
  );
}

