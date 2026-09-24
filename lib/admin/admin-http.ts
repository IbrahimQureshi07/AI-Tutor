import { NextResponse } from "next/server";
import type { RequireAdminResult } from "@/lib/auth/require-admin";

/** Consistent admin-gate JSON for API routes (toast-friendly copy). */
export function adminGuardResponse(
  guard: Extract<RequireAdminResult, { ok: false }>,
): NextResponse {
  if (guard.reason === "unauthorized") {
    return NextResponse.json(
      { error: "Sign in required." },
      { status: 401 },
    );
  }
  return NextResponse.json(
    { error: "Admin access required." },
    { status: 403 },
  );
}

export function adminMisconfiguredResponse(): NextResponse {
  return NextResponse.json(
    { error: "Server misconfigured." },
    { status: 503 },
  );
}
