import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_COACH_MAX_TURNS, DEMO_SESSION_COOKIE } from "@/lib/demo/constants";
import { generateDemoCoachReply } from "@/lib/demo/coach-reply";
import { readDemoSession, currentQuestionId } from "@/lib/demo/request-session";
import {
  demoSessionCookieOptions,
  encodeDemoSession,
} from "@/lib/demo/session-cookie";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const Message = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

const Body = z.object({
  question_id: z.string().uuid(),
  messages: z.array(Message).min(1).max(20),
});

export async function POST(request: NextRequest) {
  const session = readDemoSession(request);
  if (!session || session.complete) {
    return NextResponse.json({ error: "No active demo session." }, { status: 400 });
  }

  const activeId = currentQuestionId(session);
  if (!activeId) {
    return NextResponse.json({ error: "Demo complete." }, { status: 400 });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (parsed.data.question_id !== activeId) {
    return NextResponse.json(
      { error: "Wrong question for this demo step." },
      { status: 400 },
    );
  }

  const priorTurns = session.coachTurns[activeId] ?? 0;
  if (priorTurns >= DEMO_COACH_MAX_TURNS) {
    return NextResponse.json({
      reply:
        "Demo chat limit reached for this question — pick an answer below.",
      capped: true,
      remaining_turns: 0,
    });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 503 });
  }

  const { data: q, error } = await admin
    .from("questions")
    .select(
      "id, section_code, prompt, option_a, option_b, option_c, option_d, correct_option, explanation",
    )
    .eq("id", activeId)
    .single();

  if (error || !q) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }

  const result = await generateDemoCoachReply(
    q,
    parsed.data.messages,
    DEMO_COACH_MAX_TURNS,
  );

  const updated = {
    ...session,
    coachTurns: {
      ...session.coachTurns,
      [activeId]: Math.min(DEMO_COACH_MAX_TURNS, priorTurns + 1),
    },
  };

  const res = NextResponse.json(result);
  res.cookies.set(
    DEMO_SESSION_COOKIE,
    encodeDemoSession(updated),
    demoSessionCookieOptions(),
  );
  return res;
}
