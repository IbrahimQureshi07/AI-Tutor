import type { SupabaseClient } from "@supabase/supabase-js";
import { SECTIONS, type SectionCode } from "@/lib/constants";

const VALID_SECTIONS = new Set<string>(SECTIONS.map((s) => s.code));

function extractSectionFromConceptId(cid: string): SectionCode | null {
  const m = cid.trim().match(/^([AB][1-9])\./i);
  if (!m) return null;
  const code = m[1].toUpperCase();
  return VALID_SECTIONS.has(code) ? (code as SectionCode) : null;
}

function humanizeConceptTitle(cid: string): string {
  const tail = cid.split(".").slice(1).join(".") || cid;
  let t = tail
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bOldcar\b/g, "OLDCAR")
    .replace(/\bSc\b/g, "SC")
    .replace(/\bPmi\b/g, "PMI")
    .replace(/\bCcrs\b/g, "CC&Rs")
    .replace(/\bRespa\b/g, "RESPA")
    .replace(/\bTila\b/g, "TILA")
    .replace(/\bEcoa\b/g, "ECOA")
    .replace(/\bAda\b/g, "ADA")
    .replace(/\bArms\b/g, "ARMs")
    .replace(/\bLtv\b/g, "LTV")
    .replace(/\bFha\b/g, "FHA")
    .replace(/\bVa\b/g, "VA")
    .replace(/\bUsda\b/g, "USDA")
    .replace(/\bPud\b/g, "PUD")
    .replace(/\bHoa\b/g, "HOA")
    .replace(/\bApr\b/g, "APR")
    .replace(/\bIrs\b/g, "IRS")
    .replace(/\bCma\b/g, "CMA")
    .replace(/\bCe\b/g, "CE")
    .replace(/\bMgmt\b/g, "Mgmt")
    .replace(/\bVs\b/g, "vs.")
    .replace(/\bJt Tic Tbe\b/g, "JT/TIC/TBE")
    .replace(/\bCondos Coops Pud\b/g, "Condos, Co-ops & PUDs")
    .replace(/\bCalc\b/g, "Calc.")
    .replace(/\bFund\b/g, "Fund")
    .replace(/\b(And|Of|In|The|To|For|By|Vs)\b/g, (m) => m.toLowerCase())
    .replace(/^./, (c) => c.toUpperCase());
  return t;
}

/**
 * Ensures a `concepts` row exists for a given `concept_id` so inserts into
 * `questions.concept_id` won't fail the foreign key.
 *
 * No-op when `conceptId` is null/blank or doesn't contain a valid section prefix.
 */
export async function ensureConceptExists(
  admin: SupabaseClient,
  conceptId: string | null | undefined,
): Promise<void> {
  const cid = (conceptId ?? "").trim();
  if (!cid) return;

  const section = extractSectionFromConceptId(cid);
  if (!section) return;

  const row = {
    id: cid,
    section_code: section,
    title: humanizeConceptTitle(cid),
    order_index: 0,
  };

  // Upsert is idempotent; safe for concurrent imports.
  const { error } = await admin.from("concepts").upsert(row, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

