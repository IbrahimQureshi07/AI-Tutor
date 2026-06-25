import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEMO_CLAIMED_COOKIE,
  DEMO_COACH_MAX_TURNS,
  DEMO_FP_COOKIE,
  DEMO_QUESTION_COUNT,
} from "@/lib/demo/constants";
import {
  hashClientIp,
  hashFingerprint,
  mintFingerprint,
  readFingerprintCookie,
} from "@/lib/demo/fingerprint";
import { isDemoFingerprintUsed, recordDemoClaim } from "@/lib/demo/guest-claims";
import { pickDemoQuestions } from "@/lib/demo/pick-demo-questions";
import { readDemoSession } from "@/lib/demo/request-session";
import {
  demoSessionCookieOptions,
  encodeDemoSession,
  stripCorrectOption,
  DEMO_SESSION_COOKIE,
  type DemoSessionPayload,
} from "@/lib/demo/session-cookie";
import type { QuestionRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const FP_COOKIE_OPTS = {
  httpOnly: true as const,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

async function loadQuestionsByIds(
  admin: ReturnType<typeof createAdminClient>,
  ids: string[],
): Promise<QuestionRow[]> {
  const { data, error } = await admin
    .from("questions")
    .select(
      "id, section_code, topic_id, concept_id, level, prompt, option_a, option_b, option_c, option_d, correct_option, hint, explanation, source",
    )
    .in("id", ids);
  if (error || !data?.length) {
    throw new Error(error?.message ?? "Questions missing");
  }
  const map = new Map((data as QuestionRow[]).map((q) => [q.id, q]));
  return ids.map((id) => map.get(id)).filter(Boolean) as QuestionRow[];
}

function responseWithCookies(
  body: Record<string, unknown>,
  fp: string,
  session: DemoSessionPayload,
  extraCookies?: { name: string; value: string }[],
) {
  const res = NextResponse.json(body);
  res.cookies.set(DEMO_FP_COOKIE, fp, FP_COOKIE_OPTS);
  res.cookies.set(
    DEMO_SESSION_COOKIE,
    encodeDemoSession(session),
    demoSessionCookieOptions(),
  );
  for (const c of extraCookies ?? []) {
    res.cookies.set(c.name, c.value, FP_COOKIE_OPTS);
  }
  return res;
}

export async function POST(request: NextRequest) {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Demo is not configured on this server." },
      { status: 503 },
    );
  }

  const fp = readFingerprintCookie(request) ?? mintFingerprint();
  const fpHash = hashFingerprint(fp);

  const existing = readDemoSession(request);
  if (existing && existing.fingerprint === fp) {
    if (existing.complete) {
      return NextResponse.json({ alreadyUsed: true });
    }
    try {
      const rows = await loadQuestionsByIds(admin, existing.questionIds);
      return responseWithCookies(
        {
          alreadyUsed: false,
          questions: rows.map(stripCorrectOption),
          index: existing.index,
          total: existing.questionIds.length,
          answered: existing.answered,
          correct: existing.correct,
          coachMaxTurns: DEMO_COACH_MAX_TURNS,
        },
        fp,
        existing,
      );
    } catch (e) {
      console.error("demo resume failed", e);
    }
  }

  const claimedCookie = request.cookies.get(DEMO_CLAIMED_COOKIE)?.value;
  if (claimedCookie === fpHash) {
    return NextResponse.json({ alreadyUsed: true });
  }

  const { used } = await isDemoFingerprintUsed(admin, fpHash);
  if (used) {
    return NextResponse.json({ alreadyUsed: true });
  }

  try {
    const rows = await pickDemoQuestions(admin, DEMO_QUESTION_COUNT);
    const session: DemoSessionPayload = {
      v: 1,
      fingerprint: fp,
      questionIds: rows.map((q) => q.id),
      index: 0,
      answered: 0,
      correct: 0,
      coachTurns: {},
      complete: false,
    };

    const claim = await recordDemoClaim(
      admin,
      fpHash,
      hashClientIp(request),
      0,
    );

    const extraCookies: { name: string; value: string }[] = [];
    if (!claim.migrationApplied) {
      extraCookies.push({ name: DEMO_CLAIMED_COOKIE, value: fpHash });
    }

    return responseWithCookies(
      {
        alreadyUsed: false,
        questions: rows.map(stripCorrectOption),
        index: 0,
        total: rows.length,
        answered: 0,
        correct: 0,
        coachMaxTurns: DEMO_COACH_MAX_TURNS,
      },
      fp,
      session,
      extraCookies,
    );
  } catch (e) {
    console.error("demo start failed", e);
    return NextResponse.json(
      { error: "Could not start demo. Try again later." },
      { status: 500 },
    );
  }
}
