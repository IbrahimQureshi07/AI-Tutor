import type { SupabaseClient } from "@supabase/supabase-js";
import { isGuestDemoTableMissingError } from "@/lib/access/check-access";

export async function isDemoFingerprintUsed(
  admin: SupabaseClient,
  fingerprintHash: string,
): Promise<{ used: boolean; migrationApplied: boolean }> {
  const { data, error } = await admin
    .from("guest_demo_claims")
    .select("id")
    .eq("fingerprint_hash", fingerprintHash)
    .maybeSingle();

  if (!error) {
    return { used: !!data, migrationApplied: true };
  }

  if (isGuestDemoTableMissingError(error)) {
    return { used: false, migrationApplied: false };
  }

  console.error("guest_demo_claims lookup failed", error);
  return { used: false, migrationApplied: false };
}

export async function recordDemoClaim(
  admin: SupabaseClient,
  fingerprintHash: string,
  ipHash: string | null,
  questionsAnswered: number,
): Promise<{ ok: boolean; migrationApplied: boolean }> {
  const { error } = await admin.from("guest_demo_claims").insert({
    fingerprint_hash: fingerprintHash,
    ip_hash: ipHash,
    questions_answered: questionsAnswered,
  });

  if (!error) return { ok: true, migrationApplied: true };

  if (isGuestDemoTableMissingError(error)) {
    return { ok: false, migrationApplied: false };
  }

  // Unique violation = already claimed
  const msg = `${(error as { message?: string }).message ?? ""}`.toLowerCase();
  if (msg.includes("duplicate") || msg.includes("unique")) {
    return { ok: true, migrationApplied: true };
  }

  console.error("guest_demo_claims insert failed", error);
  return { ok: false, migrationApplied: true };
}
