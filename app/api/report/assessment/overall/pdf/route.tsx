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
import { buildSummary } from "@/lib/assessment/summary";
import { OverallAssessmentPdf } from "@/lib/pdf/overall-assessment-pdf";
import type { DocumentProps } from "@react-pdf/renderer";

export async function GET(_req: Request) {
  try {
    const supabase = await createClient();

    const guard = await requireFullAccess(supabase);
    if (!guard.ok) return accessDeniedResponse(guard);
    const { user } = guard;

    /* Fetch ALL finished assessment sessions for this user */
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, duration_ms, finished_at, config")
      .eq("user_id", user.id)
      .eq("mode", "assessment")
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: true });

    if (!sessions?.length) {
      return NextResponse.json(
        { error: "No completed assessment sessions found" },
        { status: 404 },
      );
    }

    const sessionIds = sessions.map((s) => s.id);

    /* Fetch ALL attempts across all sessions — deduplicate by question_id
       keeping the attempt from the MOST RECENT session (latest assessment wins) */
    const { data: allAttempts } = await supabase
      .from("attempts")
      .select(
        "question_id, attempt_number, is_correct, result_label, time_spent_ms, session_id, question:questions(id, section_code, concept_id, level)",
      )
      .eq("user_id", user.id)
      .in("session_id", sessionIds)
      .order("created_at", { ascending: true });

    /* Build a map of session order (older → lower index, newer → higher).
       When same question appears in multiple sessions, keep the newer result. */
    const sessionOrder = new Map<string, number>();
    sessions.forEach((s, i) => sessionOrder.set(s.id, i));

    /* Deduplicate: per question_id keep attempt from most recent session */
    type AttemptRow = {
      question_id: string;
      attempt_number: number;
      is_correct: boolean;
      result_label: string | null;
      time_spent_ms: number | null;
      session_id: string;
      question: unknown;
    };

    const bestAttemptByQuestion = new Map<string, AttemptRow>();
    for (const a of (allAttempts ?? []) as AttemptRow[]) {
      const existing = bestAttemptByQuestion.get(a.question_id);
      if (!existing) {
        bestAttemptByQuestion.set(a.question_id, a);
      } else {
        const existingOrder = sessionOrder.get(existing.session_id) ?? -1;
        const newOrder = sessionOrder.get(a.session_id) ?? -1;
        if (newOrder > existingOrder) {
          bestAttemptByQuestion.set(a.question_id, a);
        }
      }
    }

    const deduplicatedAttempts = Array.from(bestAttemptByQuestion.values());

    /* Build summary from combined attempts */
    const summary = buildSummary(
      deduplicatedAttempts as unknown as Parameters<typeof buildSummary>[0],
    );

    /* Pick tutor letter from most recent session */
    const latestSession = sessions[sessions.length - 1];
    const latestConfig = (latestSession.config ?? {}) as Record<string, unknown>;
    const tutorLetter = (latestConfig.tutor_letter as string | undefined) ?? null;

    /* Total duration across all sessions */
    const totalDurationMs = sessions.reduce(
      (sum, s) => sum + (s.duration_ms ?? 0),
      0,
    );

    /* Concept titles */
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

    /* Render PDF */
    const element = React.createElement(OverallAssessmentPdf, {
      summary,
      totalSessions: sessions.length,
      totalDurationMs,
      conceptTitles,
      tutorLetter,
      generatedAt,
    }) as unknown as React.ReactElement<DocumentProps>;

    const buffer = await renderToBuffer(element);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="overall-assessment-report.pdf"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err) {
    console.error("[Overall PDF] render failed:", err);
    return NextResponse.json(
      { error: "PDF generation failed", detail: String(err) },
      { status: 500 },
    );
  }
}
