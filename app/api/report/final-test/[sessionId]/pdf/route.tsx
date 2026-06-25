export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import {
  accessDeniedResponse,
  requireFullAccess,
} from "@/lib/access/require-access";
import { buildFinalReport, predictedPassProbability } from "@/lib/final/report";
import { FINAL_PASS_PCT } from "@/lib/final/pick-questions";
import { loadJourney } from "@/lib/journey/load";
import { FinalPdf } from "@/lib/pdf/final-pdf";
import type { DocumentProps } from "@react-pdf/renderer";
import type { QuestionRow } from "@/lib/supabase/types";

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

    /* Load session */
    const { data: session } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    /* Load attempts */
    const { data: rawAttempts } = await supabase
      .from("attempts")
      .select("*, question:questions(*)")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    const attempts = (rawAttempts ?? []) as Array<{
      question: QuestionRow | null;
      user_answer: "A" | "B" | "C" | "D" | null;
      is_correct: boolean;
    }>;

    const cfg = (session.config ?? {}) as Record<string, unknown>;
    const passPct = (cfg.passPct as number | undefined) ?? FINAL_PASS_PCT;

    const normalizedAttempts = attempts
      .filter((a) => !!a.question)
      .map((a) => ({
        question: a.question as QuestionRow,
        user_answer: a.user_answer,
        is_correct: a.is_correct,
      }));

    const report = buildFinalReport({
      attempts: normalizedAttempts.map((a) => ({
        is_correct: a.is_correct,
        question: {
          section_code: a.question.section_code,
          level: a.question.level,
        },
      })),
      passPct,
    });

    const probability = predictedPassProbability(report);

    /* Load journey for page 2 */
    const journey = await loadJourney(supabase, user.id);

    const generatedAt = new Date().toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    const element = React.createElement(FinalPdf, {
      sessionId,
      durationMs: session.duration_ms ?? 0,
      passPct,
      report,
      predictedPassProbability: probability,
      journey,
      generatedAt,
    }) as unknown as React.ReactElement<DocumentProps>;

    const buffer = await renderToBuffer(element);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="final-test-report-${sessionId.slice(0, 8)}.pdf"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err) {
    console.error("[Final PDF] render failed:", err);
    return NextResponse.json(
      { error: "PDF generation failed", detail: String(err) },
      { status: 500 },
    );
  }
}
