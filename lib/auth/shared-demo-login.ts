/**
 * Shared demo account login (/api/auth/demo) — local testing only.
 * Off by default. Never enabled on production builds.
 * Set NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true in .env.local when you need it.
 */
export function isSharedDemoLoginEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true";
}
