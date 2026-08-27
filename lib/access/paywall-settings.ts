import type { SupabaseClient } from "@supabase/supabase-js";

export const PAYWALL_SETTING_KEY = "paywall_enabled";

type PaywallStatus = {
  /** Effective: students see /unlock when true. */
  enabled: boolean;
  /** Row exists in app_settings (migration 0007 applied). */
  settingsTableReady: boolean;
  /**
   * Env override active: PAYWALL_ENABLED=false forces off;
   * PAYWALL_ENABLED=true forces on (ignores DB).
   */
  envOverride: boolean | null;
  /** Raw DB value when readable; null if missing / unreadable. */
  dbValue: boolean | null;
};

let cache: { at: number; status: PaywallStatus } | null = null;
const CACHE_MS = 60_000;

export function isMissingAppSettingsError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { message?: string; details?: string; code?: string };
  const msg = `${e.message ?? ""} ${e.details ?? ""} ${e.code ?? ""}`.toLowerCase();
  return (
    msg.includes("app_settings") &&
    (msg.includes("does not exist") ||
      msg.includes("relation") ||
      msg.includes("42p01") ||
      e.code === "42P01" ||
      e.code === "PGRST205")
  );
}

/** Parse PAYWALL_ENABLED env. Unset → null (no override). */
export function getPaywallEnvOverride(): boolean | null {
  const raw = process.env.PAYWALL_ENABLED?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off") return false;
  if (raw === "true" || raw === "1" || raw === "on") return true;
  return null;
}

function invalidatePaywallCache() {
  cache = null;
}

/**
 * Resolve whether the course paywall (/unlock) is enforced.
 * Priority: env override → DB app_settings → default true (current behavior).
 */
export async function getPaywallStatus(
  client: SupabaseClient,
): Promise<PaywallStatus> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.status;

  const envOverride = getPaywallEnvOverride();

  let settingsTableReady = false;
  let dbValue: boolean | null = null;

  const { data, error } = await client
    .from("app_settings")
    .select("value")
    .eq("key", PAYWALL_SETTING_KEY)
    .maybeSingle();

  if (error) {
    if (!isMissingAppSettingsError(error)) {
      console.error("paywall settings read failed", error);
    }
    settingsTableReady = false;
    dbValue = null;
  } else {
    settingsTableReady = true;
    if (data && typeof data.value === "boolean") {
      dbValue = data.value;
    } else if (data?.value === "true" || data?.value === "false") {
      dbValue = data.value === "true";
    } else {
      dbValue = true;
    }
  }

  let enabled: boolean;
  if (envOverride !== null) {
    enabled = envOverride;
  } else if (dbValue !== null) {
    enabled = dbValue;
  } else {
    enabled = true;
  }

  const status: PaywallStatus = {
    enabled,
    settingsTableReady,
    envOverride,
    dbValue,
  };
  cache = { at: now, status };
  return status;
}

export async function isPaywallEnabled(client: SupabaseClient): Promise<boolean> {
  const status = await getPaywallStatus(client);
  return status.enabled;
}

export type SetPaywallResult =
  | { ok: true; status: PaywallStatus }
  | {
      ok: false;
      reason: "migration_required" | "env_locked" | "error";
      message?: string;
    };

/**
 * Persist paywall on/off (service-role client). Blocked while env override is set.
 */
export async function setPaywallEnabled(
  admin: SupabaseClient,
  enabled: boolean,
  updatedBy?: string | null,
): Promise<SetPaywallResult> {
  const envOverride = getPaywallEnvOverride();
  if (envOverride !== null) {
    return {
      ok: false,
      reason: "env_locked",
      message:
        "PAYWALL_ENABLED is set in environment variables and overrides the admin toggle. Remove or unset it on Vercel to use this switch.",
    };
  }

  const { error } = await admin.from("app_settings").upsert(
    {
      key: PAYWALL_SETTING_KEY,
      value: enabled,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy ?? null,
    },
    { onConflict: "key" },
  );

  if (error) {
    if (isMissingAppSettingsError(error)) {
      return {
        ok: false,
        reason: "migration_required",
        message:
          "Run supabase/migrations/0007_app_settings.sql in the Supabase SQL Editor, then try again. Or set PAYWALL_ENABLED=false on Vercel for an immediate off switch.",
      };
    }
    return { ok: false, reason: "error", message: error.message };
  }

  invalidatePaywallCache();
  const status = await getPaywallStatus(admin);
  return { ok: true, status };
}
