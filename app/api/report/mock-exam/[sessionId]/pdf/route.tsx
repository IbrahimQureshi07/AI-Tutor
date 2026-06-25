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
import { buildMockReport } from "@/lib/mock/report";
import { MOCK_PASS_PCT } from "@/lib/mock/pick-questions";
import { MockPdf } from "@/lib/pdf/mock-pdf";
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
    const passPct = (cfg.passPct as number | undefined) ?? MOCK_PASS_PCT;
    const length = (cfg.length as "full" | "smoke" | undefined) ?? "full";
    const composition = (cfg.composition as Parameters<typeof buildMockReport>[0]["composition"]) ?? null;
    const aiNote = (cfg.mock_note as string | undefined) ?? "";

    const normalizedAttempts = attempts
      .filter((a) => !!a.question)
      .map((a) => ({
        question: a.question as QuestionRow,
        user_answer: a.user_answer,
        is_correct: a.is_correct,
      }));

    const total = normalizedAttempts.length;
    const correct = normalizedAttempts.filter((a) => a.is_correct).length;
    const scorePct =
      session.score_pct != null
        ? Math.round(Number(session.score_pct))
        : total > 0
          ? Math.round((correct / total) * 100)
          : 0;

    const report = buildMockReport({
      attempts: normalizedAttempts.map((a) => ({
        is_correct: a.is_correct,
        question: {
          section_code: a.question.section_code,
          level: a.question.level,
        },
      })),
      composition,
      passPct,
    });

    const generatedAt = new Date().toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    const element = React.createElement(MockPdf, {
      sessionId,
      score: scorePct,
      total,
      correct,
      durationMs: session.duration_ms ?? 0,
      passPct,
      length,
      nationalCorrect: report.nationalCorrect,
      nationalTotal: report.nationalTotal,
      stateCorrect: report.stateCorrect,
      stateTotal: report.stateTotal,
      sections: report.sections,
      difficulty: report.difficulty,
      verdict: report.verdict,
      calibration: report.calibration,
      aiNote,
      generatedAt,
    }) as unknown as React.ReactElement<DocumentProps>;

    const buffer = await renderToBuffer(element);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="mock-exam-report-${sessionId.slice(0, 8)}.pdf"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err) {
    console.error("[Mock PDF] render failed:", err);
    return NextResponse.json(
      { error: "PDF generation failed", detail: String(err) },
      { status: 500 },
    );
  }
}
