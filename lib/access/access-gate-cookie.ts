import type { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

/** Short-lived gate so middleware skips repeated getAccessState on nav. */
export const ACCESS_GATE_COOKIE = "fa_access_gate";
/** Bootstrap-admin one-shot flag (avoid maybeBootstrapAdmin every request). */
export const BOOTSTRAP_DONE_COOKIE = "fa_boot_done";

/**
 * Access gate for middleware short-circuiting:
 * - ok: paid (or otherwise allowed) for paid exams
 * - free: allowed in free modes, but paid exams are locked
 * - lock: account blocked (e.g. deactivated) → redirect to /unlock
 */
export type AccessGateValue = "ok" | "free" | "lock";

const GATE_MAX_AGE_SEC = 90;

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/** True if a Supabase SSR auth cookie is present (no Auth API call). */
export function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(
    (c) => c.name.includes("auth-token") && c.value.length > 0,
  );
}

export function readAccessGate(request: NextRequest): AccessGateValue | null {
  const v = request.cookies.get(ACCESS_GATE_COOKIE)?.value;
  if (v === "ok" || v === "free" || v === "lock") return v;
  return null;
}

export function writeAccessGate(
  response: NextResponse,
  value: AccessGateValue,
): void {
  response.cookies.set(ACCESS_GATE_COOKIE, value, {
    ...cookieBase,
    maxAge: GATE_MAX_AGE_SEC,
  });
}

export function clearAccessGate(response: NextResponse): void {
  response.cookies.set(ACCESS_GATE_COOKIE, "", {
    ...cookieBase,
    maxAge: 0,
  });
}

/** Clear gate from Server Actions / Route Handlers after access changes. */
export async function bustAccessGateCookie(): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_GATE_COOKIE, "", { ...cookieBase, maxAge: 0 });
}

export function readBootstrapDone(request: NextRequest): boolean {
  return request.cookies.get(BOOTSTRAP_DONE_COOKIE)?.value === "1";
}

export function writeBootstrapDone(response: NextResponse): void {
  response.cookies.set(BOOTSTRAP_DONE_COOKIE, "1", {
    ...cookieBase,
    maxAge: 60 * 60 * 24 * 7,
  });
}
