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
import { buildMistakesStats, type MistakesAttempt } from "@/lib/mistakes/results";
import { MistakesPdf } from "@/lib/pdf/mistakes-pdf";
import type { DocumentProps } from "@react-pdf/renderer";

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
      .select("id, duration_ms, config")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { data: rawAttempts } = await supabase
      .from("attempts")
      .select(
        "question_id, attempt_number, is_correct, user_answer, hinted, retried, time_spent_ms, created_at, question:questions(*)",
      )
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    const attempts = ((rawAttempts ?? []) as unknown) as MistakesAttempt[];
    const stats = buildMistakesStats(attempts);

    const cfg = (session.config ?? {}) as Record<string, unknown>;
    const aiNote = (cfg.mistakes_note as string | undefined) ?? "";

    const generatedAt = new Date().toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    const element = React.createElement(MistakesPdf, {
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
        "Content-Disposition": `attachment; filename="mistakes-report-${sessionId.slice(0, 8)}.pdf"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err) {
    console.error("[Mistakes PDF] render failed:", err);
    return NextResponse.json(
      { error: "PDF generation failed", detail: String(err) },
      { status: 500 },
    );
  }
}
