"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, Upload, Trash2 } from "lucide-react";
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
import {
  describeQuestionFilter,
  hasQuestionDeleteScope,
  parseQuestionSection,
} from "@/lib/admin/question-list-filters";
import {
  BULK_DELETE_CONFIRM_PHRASE,
  confirmDangerousAction,
  toastAdminError,
} from "@/lib/admin/question-ui-guards";

type ImportPreview = {
  commit: boolean;
  mode?: "append";
  totalRows: number;
  validRows: number;
  invalidRows: number;
  bySection?: Record<string, number>;
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
  is_ai_generated?: boolean | null;
};

type QuestionListResponse = {
  questions: QuestionItem[];
  offset: number;
  limit: number;
  nextOffset: number;
  hasMore: boolean;
  totalMatching?: number | null;
};

type ListSource = "dataset" | "llm" | "both";
type ListGroup = "all" | "national" | "state";

type FormState = Omit<QuestionItem, "id" | "is_ai_generated">;

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
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [selectiveExporting, setSelectiveExporting] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [listSource, setListSource] = React.useState<ListSource>("both");
  const [listSection, setListSection] = React.useState<string>("all");
  const [listGroup, setListGroup] = React.useState<ListGroup>("all");
  const [offset, setOffset] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);
  const [totalMatching, setTotalMatching] = React.useState<number | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [selectingAllMatching, setSelectingAllMatching] = React.useState(false);
  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const [importFile, setImportFile] = React.useState<File | null>(null);
  const [importPreview, setImportPreview] = React.useState<ImportPreview | null>(null);
  const [exportSection, setExportSection] = React.useState<string>("all");
  const [exportGroup, setExportGroup] = React.useState<"all" | "national" | "state">(
    "all",
  );
  const [exportSource, setExportSource] = React.useState<
    "dataset" | "llm" | "both"
  >("dataset");
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const load = React.useCallback(
    async (args?: {
      q?: string;
      offset?: number;
      append?: boolean;
      source?: ListSource;
      section?: string;
      group?: ListGroup;
    }) => {
      setLoading(true);
      try {
        const q = args?.q ?? query;
        const off = args?.offset ?? 0;
        const source = args?.source ?? listSource;
        const section = args?.section ?? listSection;
        const group = args?.group ?? listGroup;
        const url = new URL("/api/admin/questions", window.location.origin);
        if (q.trim()) url.searchParams.set("q", q.trim());
        url.searchParams.set("offset", String(off));
        url.searchParams.set("limit", "200");
        url.searchParams.set("source", source);
        if (section !== "all") {
          url.searchParams.set("section", section);
        } else if (group !== "all") {
          url.searchParams.set("group", group);
        }

        const res = await fetch(url.toString(), { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as Partial<QuestionListResponse> & {
          error?: string;
        };
        if (!res.ok) {
          toastAdminError(res, json, "Could not load questions.");
          return;
        }
        const next = (json.questions ?? []) as QuestionItem[];
        if (args?.append) {
          setItems((prev) => [...prev, ...next]);
        } else {
          setItems(next);
          setSelectedIds(new Set());
        }
        setOffset(Number(json.nextOffset ?? next.length ?? 0));
        setHasMore(Boolean(json.hasMore));
        setTotalMatching(
          typeof json.totalMatching === "number" ? json.totalMatching : null,
        );
      } finally {
        setLoading(false);
      }
    },
    [query, listSource, listSection, listGroup],
  );

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      void load({ q: query, offset: 0, append: false });
    }, 250);
    return () => window.clearTimeout(t);
  }, [load, query, listSource, listSection, listGroup]);

  async function loadMore() {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      await load({ q: query, offset, append: true });
    } finally {
      setLoadingMore(false);
    }
  }

  const selectedCount = selectedIds.size;
  const visibleSelectedCount = items.reduce(
    (n, q) => n + (selectedIds.has(q.id) ? 1 : 0),
    0,
  );
  const allVisibleSelected =
    items.length > 0 && visibleSelectedCount === items.length;

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const q of items) next.add(q.id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function toggleSelectVisible() {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const q of items) next.delete(q.id);
        return next;
      });
      return;
    }
    selectVisible();
  }

  async function selectAllMatching() {
    setSelectingAllMatching(true);
    try {
      const url = new URL("/api/admin/questions", window.location.origin);
      url.searchParams.set("idsOnly", "1");
      url.searchParams.set("source", listSource);
      if (query.trim()) url.searchParams.set("q", query.trim());
      if (listSection !== "all") {
        url.searchParams.set("section", listSection);
      } else if (listGroup !== "all") {
        url.searchParams.set("group", listGroup);
      }
      const res = await fetch(url.toString(), { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as {
        ids?: string[];
        total?: number;
        capped?: boolean;
        error?: string;
      };
      if (!res.ok) {
        toastAdminError(res, json, "Could not select matching questions.");
        return;
      }
      const ids = Array.isArray(json.ids) ? json.ids : [];
      setSelectedIds(new Set(ids));
      if (json.capped) {
        toast.message(`Selected first ${ids.length} matching questions (cap reached).`);
      } else {
        toast.success(`Selected ${ids.length} matching question(s).`);
      }
    } catch {
      toast.error("Could not select matching questions.");
    } finally {
      setSelectingAllMatching(false);
    }
  }

  function currentFilterDescription(): string {
    return describeQuestionFilter({
      source: listSource,
      section: parseQuestionSection(listSection),
      group: listGroup,
      q: query.trim(),
    });
  }

  function canBulkDeleteByFilter(): boolean {
    return hasQuestionDeleteScope({
      source: listSource,
      section: parseQuestionSection(listSection),
      group: listGroup,
      q: query.trim(),
    });
  }

  async function deleteAllMatching() {
    if (!canBulkDeleteByFilter()) {
      toast.error(
        "Add a source, section, group, or search filter before bulk delete.",
      );
      return;
    }
    if (totalMatching == null || totalMatching < 1) {
      toast.error("No matching questions to delete.");
      return;
    }

    const filterLabel = currentFilterDescription();
    const ok = confirmDangerousAction({
      summary: "Delete ALL matching questions permanently?",
      details: [
        `Count: ${totalMatching}`,
        `Filter: ${filterLabel}`,
        "Related attempts will also be removed.",
      ],
      typeToConfirm: BULK_DELETE_CONFIRM_PHRASE,
    });
    if (!ok) return;

    setBulkDeleting(true);
    try {
      const res = await fetch("/api/admin/questions/bulk-delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "filter",
          source: listSource,
          section: listSection,
          group: listGroup,
          q: query.trim() || undefined,
          confirmCount: totalMatching,
          confirmPhrase: BULK_DELETE_CONFIRM_PHRASE,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastAdminError(res, json, "Could not bulk delete questions.");
        if (res.status === 409) {
          await load({ q: query, offset: 0, append: false });
        }
        return;
      }
      const deleted = Number(json.deleted ?? 0);
      toast.success(`Deleted ${deleted} matching question(s).`);
      setSelectedIds(new Set());
      resetForm();
      await load({ q: query, offset: 0, append: false });
    } catch {
      toast.error("Could not bulk delete questions.");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function deleteSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const ok = confirmDangerousAction({
      summary: `Delete ${ids.length} selected question(s) permanently?`,
      details: ["Related attempts will also be removed."],
      typeToConfirm: BULK_DELETE_CONFIRM_PHRASE,
    });
    if (!ok) return;

    setBulkDeleting(true);
    try {
      const res = await fetch("/api/admin/questions/bulk-delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "ids",
          ids,
          confirmPhrase: BULK_DELETE_CONFIRM_PHRASE,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastAdminError(res, json, "Could not delete selected questions.");
        return;
      }
      const deleted = Number(json.deleted ?? 0);
      toast.success(`Deleted ${deleted} selected question(s).`);
      if (editingId && selectedIds.has(editingId)) resetForm();
      setSelectedIds(new Set());
      await load({ q: query, offset: 0, append: false });
    } catch {
      toast.error("Could not delete selected questions.");
    } finally {
      setBulkDeleting(false);
    }
  }

  function patch<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function startEdit(q: QuestionItem) {
    setEditingId(q.id);
    setForm({
      section_code: q.section_code,
      concept_id: q.concept_id,
      level: q.level,
      prompt: q.prompt,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: q.correct_option,
      explanation: q.explanation,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function previewPrompt(prompt: string, max = 160): string {
    const cleaned = prompt.replace(/\s+/g, " ").trim();
    if (cleaned.length <= max) return cleaned;
    return `${cleaned.slice(0, max - 1)}…`;
  }

  async function deleteQuestion(q: QuestionItem) {
    const sourceLabel = q.is_ai_generated ? "LLM" : "Dataset";
    const preview = previewPrompt(q.prompt);
    const ok = confirmDangerousAction({
      summary: "Delete this question permanently?",
      details: [
        `${formatSectionDisplayLabel(q.section_code)} · ${sourceLabel}`,
        `"${preview}"`,
        "Related attempts will also be removed.",
      ],
    });
    if (!ok) return;

    setDeletingId(q.id);
    try {
      const res = await fetch("/api/admin/questions", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: q.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastAdminError(res, json, "Could not delete question.");
        return;
      }
      setItems((prev) => prev.filter((item) => item.id !== q.id));
      setSelectedIds((prev) => {
        if (!prev.has(q.id)) return prev;
        const next = new Set(prev);
        next.delete(q.id);
        return next;
      });
      if (editingId === q.id) resetForm();
      toast.success(
        q.is_ai_generated ? "LLM question deleted." : "Dataset question deleted.",
      );
    } catch {
      toast.error("Could not delete question.");
    } finally {
      setDeletingId(null);
    }
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
        toastAdminError(res, json, "Could not preview CSV.");
        setImportPreview(null);
        return;
      }
      setImportPreview({
        commit: false,
        mode: "append",
        totalRows: Number(json.totalRows ?? 0),
        validRows: Number(json.validRows ?? 0),
        invalidRows: Number(json.invalidRows ?? 0),
        bySection:
          json.bySection && typeof json.bySection === "object"
            ? (json.bySection as Record<string, number>)
            : {},
        errors: Array.isArray(json.errors) ? (json.errors as ImportPreview["errors"]) : [],
      });
      toast.success("Preview ready — append only (existing questions stay).");
    } catch {
      toast.error("Could not preview CSV.");
      setImportPreview(null);
    } finally {
      setImporting(false);
    }
  }

  function formatSectionBreakdown(bySection: Record<string, number> | undefined): string {
    if (!bySection) return "";
    return Object.entries(bySection)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, n]) => `${code}: ${n}`)
      .join(", ");
  }

  async function commitImport(file: File) {
    if (!importPreview || importPreview.validRows < 1) return;

    const breakdown = formatSectionBreakdown(importPreview.bySection);
    const ok = confirmDangerousAction({
      summary: "Append these questions to the bank?",
      details: [
        `Count: ${importPreview.validRows} valid row(s)`,
        breakdown ? `Sections: ${breakdown}` : "Sections: (none)",
        "Mode: append only — existing questions are not replaced or deleted.",
        "Example: an A1-only CSV adds A1 questions; other sections are untouched.",
      ],
    });
    if (!ok) return;

    setImporting(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/admin/questions/import?commit=1", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json().catch(() => ({}))) as Partial<ImportPreview> & {
        error?: string;
      };
      if (!res.ok) {
        toastAdminError(res, json, "Could not import CSV.");
        return;
      }
      const inserted = Number(json.inserted ?? 0);
      const sections = formatSectionBreakdown(
        json.bySection && typeof json.bySection === "object"
          ? (json.bySection as Record<string, number>)
          : importPreview.bySection,
      );
      toast.success(
        sections
          ? `Appended ${inserted} question(s) (${sections}).`
          : inserted
            ? `Appended ${inserted} question(s).`
            : "Import complete.",
      );
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
              : null;
        toastAdminError(
          res,
          { error: apiError },
          "Could not save question.",
        );
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
      // Default full dataset export — LLM always excluded (unchanged).
      const res = await fetch("/api/admin/questions/export?source=dataset", {
        cache: "no-store",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toastAdminError(res, json, "Could not export CSV.");
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

  async function downloadSelectiveCsv() {
    setSelectiveExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("source", exportSource);
      if (exportSection !== "all") {
        params.set("section", exportSection);
      } else if (exportGroup !== "all") {
        params.set("group", exportGroup);
      }
      const res = await fetch(
        `/api/admin/questions/export?${params.toString()}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toastAdminError(res, json, "Could not export CSV.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const matched = /filename="([^"]+)"/.exec(disposition);
      a.href = url;
      a.download = matched?.[1] ?? `questions-export.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const count = res.headers.get("X-Row-Count") ?? "0";
      const sourceLabel =
        exportSource === "dataset"
          ? "dataset"
          : exportSource === "llm"
            ? "LLM"
            : "dataset + LLM";
      toast.success(`Downloaded ${count} ${sourceLabel} question(s).`);
    } catch {
      toast.error("Could not export CSV.");
    } finally {
      setSelectiveExporting(false);
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
            Manage the question bank. Selective import appends CSV rows (e.g.
            A1-only file → A1 adds). Dataset export excludes LLM follow-ups;
            use selective download for filtered exports.
          </p>
          <p className="mt-2 text-xs text-ink-muted">
            Admin only. Deletes and bulk actions need confirmation; bulk delete
            also requires typing DELETE.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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

      <Card>
        <CardHeader>
          <CardTitle>Selective import</CardTitle>
          <p className="text-xs text-ink-muted leading-relaxed">
            Upload a CSV to <span className="text-ink">append</span> questions.
            Only sections present in the file are added (e.g. an A1-only file
            adds A1). Existing bank rows are never replaced or deleted. Use
            template CSV for the correct columns.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
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
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              <Upload className="h-4 w-4" />
              {importing ? "Working…" : "Choose CSV to append"}
            </Button>
          </div>

          {(importFile || importPreview) && (
            <div className="space-y-3 rounded-xl border border-border p-3">
              <div className="text-sm">
                <span className="font-medium">File:</span>{" "}
                <span className="text-ink-muted">{importFile?.name ?? "—"}</span>
                <span className="text-ink-muted"> · Mode: append</span>
              </div>

              {importing && <p className="text-sm text-ink-muted">Working…</p>}

              {importPreview && (
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">{importPreview.validRows}</span>{" "}
                    valid row(s)
                    {" · "}
                    <span
                      className={
                        importPreview.invalidRows
                          ? "font-medium text-danger"
                          : "font-medium"
                      }
                    >
                      {importPreview.invalidRows}
                    </span>{" "}
                    invalid row(s)
                    {" · "}
                    <span className="text-ink-muted">
                      {importPreview.totalRows} total
                    </span>
                  </p>

                  {importPreview.bySection &&
                    Object.keys(importPreview.bySection).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(importPreview.bySection)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([code, n]) => (
                            <span
                              key={code}
                              className="rounded-md border border-border bg-elevated/30 px-2 py-1 text-xs text-ink"
                            >
                              {code}: {n}
                            </span>
                          ))}
                      </div>
                    )}

                  {importPreview.invalidRows > 0 &&
                    importPreview.errors.length > 0 && (
                      <div className="rounded-lg border border-border/70 bg-elevated/20 p-3">
                        <p className="text-xs font-medium text-ink-muted mb-2">
                          Fix these rows and re-upload (showing up to{" "}
                          {importPreview.errors.length}):
                        </p>
                        <div className="space-y-1">
                          {importPreview.errors.slice(0, 30).map((e) => (
                            <p
                              key={`${e.row}-${e.errors[0]}`}
                              className="text-xs text-ink-muted"
                            >
                              <span className="font-medium text-ink">
                                Row {e.row}:
                              </span>{" "}
                              {e.errors.join(" · ")}
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
                      onClick={() =>
                        importFile ? void previewImport(importFile) : null
                      }
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
                      onClick={() =>
                        importFile ? void commitImport(importFile) : null
                      }
                    >
                      Append {importPreview.validRows} question
                      {importPreview.validRows === 1 ? "" : "s"}
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
                      Append is disabled until all rows are valid.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Selective download</CardTitle>
          <p className="text-xs text-ink-muted leading-relaxed">
            Download a filtered CSV. Default source is dataset only. Choose LLM
            only to export AI sibling questions, or both. A specific section
            overrides National / SC group.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wide text-ink-muted">
                Source
              </span>
              <select
                value={exportSource}
                onChange={(e) =>
                  setExportSource(e.target.value as "dataset" | "llm" | "both")
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="dataset">Dataset only</option>
                <option value="llm">LLM only</option>
                <option value="both">Dataset + LLM</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wide text-ink-muted">
                Section
              </span>
              <select
                value={exportSection}
                onChange={(e) => setExportSection(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All sections</option>
                {SECTIONS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {formatSectionDisplayLabel(s.code)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wide text-ink-muted">
                Group
              </span>
              <select
                value={exportGroup}
                onChange={(e) =>
                  setExportGroup(
                    e.target.value as "all" | "national" | "state",
                  )
                }
                disabled={exportSection !== "all"}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
              >
                <option value="all">All groups</option>
                <option value="national">National (A1–A6)</option>
                <option value="state">SC / State (B1–B6)</option>
              </select>
            </label>
            <div className="flex items-end">
              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={selectiveExporting}
                onClick={() => void downloadSelectiveCsv()}
              >
                <Download className="h-4 w-4" />
                {selectiveExporting ? "Preparing…" : "Download filtered CSV"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
          <p className="text-xs text-ink-muted leading-relaxed">
            Same filters as selective download. Search + filters update the list
            below. Use checkboxes to select for upcoming bulk actions.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search question text, concept (e.g. B5.fair_housing), or section (A1/B3)…"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wide text-ink-muted">
                Source
              </span>
              <select
                value={listSource}
                onChange={(e) => setListSource(e.target.value as ListSource)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="both">Dataset + LLM</option>
                <option value="dataset">Dataset only</option>
                <option value="llm">LLM only</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wide text-ink-muted">
                Section
              </span>
              <select
                value={listSection}
                onChange={(e) => setListSection(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All sections</option>
                {SECTIONS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {formatSectionDisplayLabel(s.code)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wide text-ink-muted">
                Group
              </span>
              <select
                value={listGroup}
                onChange={(e) => setListGroup(e.target.value as ListGroup)}
                disabled={listSection !== "all"}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
              >
                <option value="all">All groups</option>
                <option value="national">National (A1–A6)</option>
                <option value="state">SC / State (B1–B6)</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-ink-muted">
            Newest first. Use “Load more” for the next page. A specific section
            overrides National / SC group.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Latest questions</CardTitle>
            <p className="text-xs text-ink-muted">
              {totalMatching != null
                ? `${totalMatching} matching`
                : loading
                  ? "…"
                  : `${items.length} loaded`}
              {selectedCount > 0 ? ` · ${selectedCount} selected` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={items.length === 0 || loading || bulkDeleting}
              onClick={toggleSelectVisible}
            >
              {allVisibleSelected ? "Unselect visible" : "Select visible"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading || selectingAllMatching || bulkDeleting}
              onClick={() => void selectAllMatching()}
            >
              {selectingAllMatching ? "Selecting…" : "Select all matching"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={selectedCount === 0 || bulkDeleting}
              onClick={clearSelection}
            >
              Clear selection
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={
                bulkDeleting ||
                loading ||
                !canBulkDeleteByFilter() ||
                totalMatching == null ||
                totalMatching < 1
              }
              onClick={() => void deleteAllMatching()}
              title={
                canBulkDeleteByFilter()
                  ? undefined
                  : "Add a source, section, group, or search filter first"
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
              {bulkDeleting
                ? "Deleting…"
                : totalMatching != null && totalMatching > 0
                  ? `Delete all matching (${totalMatching})`
                  : "Delete all matching"}
            </Button>
            {selectedCount > 0 && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={bulkDeleting}
                onClick={() => void deleteSelected()}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete selected ({selectedCount})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-ink-muted">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-ink-muted">No questions found.</p>
          ) : (
            <div className="space-y-2">
              {items.map((q) => {
                const checked = selectedIds.has(q.id);
                return (
                  <div
                    key={q.id}
                    className="rounded-xl border border-border p-3 flex items-start justify-between gap-3"
                  >
                    <label className="flex min-w-0 flex-1 items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0 accent-primary"
                        checked={checked}
                        onChange={() => toggleSelected(q.id)}
                        aria-label={`Select question ${q.section_code}`}
                      />
                      <div className="min-w-0">
                        <p className="text-xs text-ink-muted">
                          {formatSectionDisplayLabel(q.section_code)} · {q.level}
                          {q.is_ai_generated ? " · LLM" : " · Dataset"}
                          {q.concept_id ? ` · ${q.concept_id}` : ""}
                        </p>
                        <p className="text-sm text-ink line-clamp-2">{q.prompt}</p>
                      </div>
                    </label>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(q)}
                        disabled={deletingId === q.id}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => void deleteQuestion(q)}
                        disabled={deletingId === q.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deletingId === q.id ? "Deleting…" : "Delete"}
                      </Button>
                    </div>
                  </div>
                );
              })}

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

