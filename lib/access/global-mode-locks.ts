import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingAppSettingsError } from "@/lib/access/paywall-settings";
import { MODES, type ModeKey } from "@/lib/constants";

export const GLOBAL_DISABLED_MODES_KEY = "global_disabled_modes";

const MODE_KEYS = Object.keys(MODES) as ModeKey[];

export function normalizeModeKeys(value: unknown): ModeKey[] {
  if (!Array.isArray(value)) return [];
  return MODE_KEYS.filter((mode) => value.includes(mode));
}

export type GlobalModeLockStatus = {
  disabledModes: ModeKey[];
  /** Row can be stored in app_settings (migration 0007 applied). */
  settingsTableReady: boolean;
};

let cache: { at: number; status: GlobalModeLockStatus } | null = null;
const CACHE_MS = 15_000;

export function invalidateGlobalModeLockCache() {
  cache = null;
}

function parseStoredModes(value: unknown): ModeKey[] {
  if (Array.isArray(value)) return normalizeModeKeys(value);
  if (typeof value === "string") {
    try {
      return normalizeModeKeys(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
}

export async function getGlobalModeLockStatus(
  client: SupabaseClient,
): Promise<GlobalModeLockStatus> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.status;

  const { data, error } = await client
    .from("app_settings")
    .select("value")
    .eq("key", GLOBAL_DISABLED_MODES_KEY)
    .maybeSingle();

  if (error) {
    if (!isMissingAppSettingsError(error)) {
      console.error("global mode locks read failed", error);
    }
    const status = { disabledModes: [], settingsTableReady: false };
    cache = { at: now, status };
    return status;
  }

  const status: GlobalModeLockStatus = {
    disabledModes: parseStoredModes(data?.value),
    settingsTableReady: true,
  };
  cache = { at: now, status };
  return status;
}

export async function getGlobalDisabledModes(
  client: SupabaseClient,
): Promise<ModeKey[]> {
  const status = await getGlobalModeLockStatus(client);
  return status.disabledModes;
}

export function mergeDisabledModes(
  studentModes: ModeKey[],
  globalModes: ModeKey[],
): ModeKey[] {
  return MODE_KEYS.filter(
    (mode) => studentModes.includes(mode) || globalModes.includes(mode),
  );
}

export type SetGlobalModeLockResult =
  | { ok: true; status: GlobalModeLockStatus }
  | {
      ok: false;
      reason: "migration_required" | "error";
      message?: string;
    };

export async function setGlobalModeLocked(
  admin: SupabaseClient,
  mode: ModeKey,
  locked: boolean,
  updatedBy?: string | null,
): Promise<SetGlobalModeLockResult> {
  const current = await getGlobalModeLockStatus(admin);
  if (!current.settingsTableReady) {
    return {
      ok: false,
      reason: "migration_required",
      message:
        "Run supabase/migrations/0007_app_settings.sql in the Supabase SQL Editor, then try again.",
    };
  }

  const next = new Set(current.disabledModes);
  if (locked) next.add(mode);
  else next.delete(mode);
  const disabledModes = MODE_KEYS.filter((key) => next.has(key));

  const { error } = await admin.from("app_settings").upsert(
    {
      key: GLOBAL_DISABLED_MODES_KEY,
      value: disabledModes,
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
          "Run supabase/migrations/0007_app_settings.sql in the Supabase SQL Editor, then try again.",
      };
    }
    return { ok: false, reason: "error", message: error.message };
  }

  invalidateGlobalModeLockCache();
  const status = await getGlobalModeLockStatus(admin);
  return { ok: true, status };
}
