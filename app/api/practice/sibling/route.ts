import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  accessDeniedResponse,
  requireFullAccess,
} from "@/lib/access/require-access";
import { generateSiblingQuestion } from "@/lib/practice/sibling";
import type { QuestionRow } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 45;

const Body = z.object({
  session_id: z.string().uuid(),
  question_id: z.string().uuid(),
  exclude_ids: z.array(z.string().uuid()).optional().default([]),
  target_difficulty: z.enum(["same", "harder"]).optional().default("same"),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const guard = await requireFullAccess(supabase);
  if (!guard.ok) return accessDeniedResponse(guard);
  const { user } = guard;

  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 },
    );
  }

  const { session_id, question_id, exclude_ids, target_difficulty } = parsed.data;

  const { data: session } = await supabase
    .from("sessions")
    .select("id, mode, user_id")
    .eq("id", session_id)
    .eq("user_id", user.id)
    .single();
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  const { data: parentQ, error: qErr } = await supabase
    .from("questions")
    .select("*")
    .eq("id", question_id)
    .single();
  if (qErr || !parentQ) {
    return NextResponse.json({ error: "question not found" }, { status: 404 });
  }

  const excludeSet = new Set<string>([parentQ.id, ...exclude_ids]);

  try {
    const { question, source, difficulty } = await generateSiblingQuestion({
      supabase,
      parent: parentQ as QuestionRow,
      excludeIds: excludeSet,
      targetDifficulty: target_difficulty,
    });

    return NextResponse.json({
      question,
      source,
      difficulty,
    });
  } catch (e) {
    console.error("sibling generation failed", e);
    return NextResponse.json(
      { error: "Could not generate a follow-up question." },
      { status: 500 },
    );
  }
}
