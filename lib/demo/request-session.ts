import type { NextRequest } from "next/server";
import {
  decodeDemoSession,
  DEMO_SESSION_COOKIE,
  type DemoSessionPayload,
} from "@/lib/demo/session-cookie";

export function readDemoSession(request: NextRequest): DemoSessionPayload | null {
  const raw = request.cookies.get(DEMO_SESSION_COOKIE)?.value;
  if (!raw) return null;
  return decodeDemoSession(raw);
}

export function currentQuestionId(session: DemoSessionPayload): string | null {
  return session.questionIds[session.index] ?? null;
}
