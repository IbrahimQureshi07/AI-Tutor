import { createHmac, timingSafeEqual } from "crypto";
import type { QuestionRow } from "@/lib/supabase/types";
import { DEMO_SESSION_COOKIE } from "@/lib/demo/constants";

export type DemoSessionPayload = {
  v: 1;
  fingerprint: string;
  questionIds: string[];
  index: number;
  answered: number;
  correct: number;
  coachTurns: Record<string, number>;
  complete: boolean;
};

export type DemoQuestionPublic = Pick<
  QuestionRow,
  | "id"
  | "section_code"
  | "level"
  | "prompt"
  | "option_a"
  | "option_b"
  | "option_c"
  | "option_d"
  | "concept_id"
>;

function demoSecret(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "demo-dev-fallback-secret"
  );
}

function sign(raw: string): string {
  return createHmac("sha256", demoSecret()).update(raw).digest("base64url");
}

export function encodeDemoSession(payload: DemoSessionPayload): string {
  const raw = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${raw}.${sign(raw)}`;
}

export function decodeDemoSession(value: string): DemoSessionPayload | null {
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const raw = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(raw);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const json = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as DemoSessionPayload;
    if (json.v !== 1 || !Array.isArray(json.questionIds)) return null;
    return json;
  } catch {
    return null;
  }
}

export function demoSessionCookieOptions(maxAgeSec = 60 * 60 * 2) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}

export { DEMO_SESSION_COOKIE };

export function stripCorrectOption(q: QuestionRow): DemoQuestionPublic {
  return {
    id: q.id,
    section_code: q.section_code,
    level: q.level,
    prompt: q.prompt,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    concept_id: q.concept_id,
  };
}
