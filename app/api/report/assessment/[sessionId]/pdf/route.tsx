export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import {
  accessDeniedResponse,
  requireFullAccess,
} from "@/lib/access/require-access";
import { buildSummary } from "@/lib/assessment/summary";
import { AssessmentPdf } from "@/lib/pdf/assessment-pdf";
import type { DocumentProps } from "@react-pdf/renderer";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const supabase = await createClient();

    const guard = await requireFullAccess(supabase);
    if (!guard.ok) return accessDeniedResponse(guard);
    const { user } = guard;

    const { data: session } = await supabase
      .from("sessions")
      .select("id, duration_ms, config, started_at")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const config = (session.config ?? {}) as Record<string, unknown>;
    const tutorLetter: string | null =
      (config.tutor_letter as string | undefined) ?? null;

    /* Always rebuild from DB; retry when total=0 (replica lag / race after Finish). */
    const selectAttempts =
      () =>
      supabase
        .from("attempts")
        .select(
          "question_id, attempt_number, is_correct, result_label, time_spent_ms, question:questions(id, section_code, concept_id, level)",
        )
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

    let attempts = (await selectAttempts()).data;
    let summary = buildSummary(
      ((attempts ?? []) as unknown) as Parameters<typeof buildSummary>[0],
    );

    for (let i = 0; i < 6 && summary.total < 1; i++) {
      await sleep(220 * (i + 1));
      attempts = (await selectAttempts()).data;
      summary = buildSummary(
        ((attempts ?? []) as unknown) as Parameters<typeof buildSummary>[0],
      );
    }

    if (summary.total < 1) {
      return NextResponse.json(
        {
          error:
            "No graded attempts for this session yet. Refresh the page and try again.",
        },
        { status: 409 },
      );
    }

    const conceptIds = [
      ...summary.weakest_concepts.map((c) => c.concept_id),
      ...summary.strongest_concepts.map((c) => c.concept_id),
    ];
    const conceptTitles: Record<string, string> = {};
    if (conceptIds.length) {
      const { data: rows } = await supabase
        .from("concepts")
        .select("id, title")
        .in("id", conceptIds);
      for (const r of rows ?? []) conceptTitles[r.id] = r.title;
    }

    const generatedAt = new Date().toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    const element = React.createElement(AssessmentPdf, {
      summary,
      sessionId,
      durationMs: session.duration_ms ?? 0,
      conceptTitles,
      tutorLetter,
      generatedAt,
    }) as unknown as React.ReactElement<DocumentProps>;

    const buffer = await renderToBuffer(element);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="assessment-report-${sessionId.slice(0, 8)}.pdf"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err) {
    console.error("[PDF] render failed:", err);
    return NextResponse.json(
      { error: "PDF generation failed", detail: String(err) },
      { status: 500 },
    );
  }
}
