import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingAppSettingsError } from "@/lib/access/paywall-settings";
import { SECTIONS, type SectionCode } from "@/lib/constants";

export const GLOBAL_DISABLED_ASSESSMENT_SECTIONS_KEY =
  "global_disabled_assessment_sections";

const SECTION_CODES = SECTIONS.map((s) => s.code) as SectionCode[];

export function normalizeSectionCodes(value: unknown): SectionCode[] {
  if (!Array.isArray(value)) return [];
  return SECTION_CODES.filter((code) => value.includes(code));
}

export type GlobalAssessmentSectionLockStatus = {
  disabledAssessmentSections: SectionCode[];
  /** Row can be stored in app_settings (migration 0007 applied). */
  settingsTableReady: boolean;
};

let cache: { at: number; status: GlobalAssessmentSectionLockStatus } | null =
  null;
const CACHE_MS = 15_000;

export function invalidateGlobalAssessmentSectionLockCache() {
  cache = null;
}

function parseStoredSections(value: unknown): SectionCode[] {
  if (Array.isArray(value)) return normalizeSectionCodes(value);
  if (typeof value === "string") {
    try {
      return normalizeSectionCodes(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
}

export async function getGlobalAssessmentSectionLockStatus(
  client: SupabaseClient,
): Promise<GlobalAssessmentSectionLockStatus> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.status;

  const { data, error } = await client
    .from("app_settings")
    .select("value")
    .eq("key", GLOBAL_DISABLED_ASSESSMENT_SECTIONS_KEY)
    .maybeSingle();

  if (error) {
    if (!isMissingAppSettingsError(error)) {
      console.error("global assessment section locks read failed", error);
    }
    const status = {
      disabledAssessmentSections: [] as SectionCode[],
      settingsTableReady: false,
    };
    cache = { at: now, status };
    return status;
  }

  const status: GlobalAssessmentSectionLockStatus = {
    disabledAssessmentSections: parseStoredSections(data?.value),
    settingsTableReady: true,
  };
  cache = { at: now, status };
  return status;
}

export async function getGlobalDisabledAssessmentSections(
  client: SupabaseClient,
): Promise<SectionCode[]> {
  const status = await getGlobalAssessmentSectionLockStatus(client);
  return status.disabledAssessmentSections;
}

export function mergeDisabledAssessmentSections(
  studentSections: SectionCode[],
  globalSections: SectionCode[],
): SectionCode[] {
  return SECTION_CODES.filter(
    (code) =>
      studentSections.includes(code) || globalSections.includes(code),
  );
}

export type SetGlobalAssessmentSectionLockResult =
  | { ok: true; status: GlobalAssessmentSectionLockStatus }
  | {
      ok: false;
      reason: "migration_required" | "error";
      message?: string;
    };

export async function setGlobalAssessmentSectionLocked(
  admin: SupabaseClient,
  section: SectionCode,
  locked: boolean,
  updatedBy?: string | null,
): Promise<SetGlobalAssessmentSectionLockResult> {
  const current = await getGlobalAssessmentSectionLockStatus(admin);
  if (!current.settingsTableReady) {
    return {
      ok: false,
      reason: "migration_required",
      message:
        "Run supabase/migrations/0007_app_settings.sql in the Supabase SQL Editor, then try again.",
    };
  }

  const next = new Set(current.disabledAssessmentSections);
  if (locked) next.add(section);
  else next.delete(section);
  const disabledAssessmentSections = SECTION_CODES.filter((code) =>
    next.has(code),
  );

  const { error } = await admin.from("app_settings").upsert(
    {
      key: GLOBAL_DISABLED_ASSESSMENT_SECTIONS_KEY,
      value: disabledAssessmentSections,
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

  invalidateGlobalAssessmentSectionLockCache();
  const status = await getGlobalAssessmentSectionLockStatus(admin);
  return { ok: true, status };
}
