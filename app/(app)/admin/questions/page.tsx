"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SECTIONS } from "@/lib/constants";
import { formatSectionDisplayLabel } from "@/lib/sections/display-label";

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
  const [saving, setSaving] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/questions", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "Could not load questions.");
        return;
      }
      setItems((json.questions ?? []) as QuestionItem[]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

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

  async function saveQuestion(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        section_code: form.section_code,
        concept_id: form.concept_id || null,
        level: form.level,
        prompt: form.prompt,
        option_a: form.option_a,
        option_b: form.option_b,
        option_c: form.option_c,
        option_d: form.option_d,
        correct_option: form.correct_option,
        explanation: form.explanation || null,
      };

      const res = await fetch("/api/admin/questions", {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...body } : body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "Could not save question.");
        return;
      }
      toast.success(editingId ? "Question updated." : "Question created.");
      resetForm();
      await load();
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Questions</h1>
          <p className="text-ink-muted mt-1 text-sm">
            Create or update question bank entries. CSV export is dataset-only
            (excludes LLM-generated follow-ups).
          </p>
        </div>
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
            <Field label="Concept ID"><Input value={form.concept_id ?? ""} onChange={(e) => patch("concept_id", e.target.value || null)} /></Field>
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
                <div key={q.id} className="rounded-xl border border-border p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-ink-muted">
                      {formatSectionDisplayLabel(q.section_code)} · {q.level}
                    </p>
                    <p className="text-sm text-ink line-clamp-2">{q.prompt}</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => startEdit(q)}>
                    Edit
                  </Button>
                </div>
              ))}
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

