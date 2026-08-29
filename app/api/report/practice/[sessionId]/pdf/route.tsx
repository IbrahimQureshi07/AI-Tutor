export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import {
  accessDeniedResponse,
  requireFreeAccess,
} from "@/lib/access/require-access";
import { buildPracticeStats, type PracticeAttempt } from "@/lib/practice/results";
import { PracticePdf } from "@/lib/pdf/practice-pdf";
import type { DocumentProps } from "@react-pdf/renderer";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const supabase = await createClient();

    const guard = await requireFreeAccess(supabase);
    if (!guard.ok) return accessDeniedResponse(guard);
    const { user } = guard;

    /* Load session */
    const { data: session } = await supabase
      .from("sessions")
      .select("id, duration_ms, config")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    /* Load attempts */
    const { data: rawAttempts } = await supabase
      .from("attempts")
      .select(
        "question_id, attempt_number, is_correct, result_label, user_answer, hinted, retried, coached, is_sibling, parent_attempt_id, time_spent_ms, created_at, question:questions(*)",
      )
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    const attempts = ((rawAttempts ?? []) as unknown) as PracticeAttempt[];
    const stats = buildPracticeStats(attempts);

    /* AI note from cached config */
    const cfg = (session.config ?? {}) as Record<string, unknown>;
    const aiNote = (cfg.practice_note as string | undefined) ?? "";

    const generatedAt = new Date().toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    const element = React.createElement(PracticePdf, {
      stats,
      sessionId,
      durationMs: session.duration_ms ?? 0,
      aiNote,
      generatedAt,
    }) as unknown as React.ReactElement<DocumentProps>;

    const buffer = await renderToBuffer(element);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="practice-report-${sessionId.slice(0, 8)}.pdf"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err) {
    console.error("[Practice PDF] render failed:", err);
    return NextResponse.json(
      { error: "PDF generation failed", detail: String(err) },
      { status: 500 },
    );
  }
}
