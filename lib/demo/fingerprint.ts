import { createHash, randomUUID } from "crypto";
import type { NextRequest } from "next/server";
import { DEMO_FP_COOKIE } from "@/lib/demo/constants";

export function hashFingerprint(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function hashClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/** Read or mint a stable browser fingerprint (httpOnly cookie set by API routes). */
export function readFingerprintCookie(request: NextRequest): string | null {
  return request.cookies.get(DEMO_FP_COOKIE)?.value ?? null;
}

export function mintFingerprint(): string {
  return randomUUID();
}
