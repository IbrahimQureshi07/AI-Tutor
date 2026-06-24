import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  loadAttemptLog,
  type AttemptLogFilters,
} from "@/lib/admin/attempt-log";
import type { SessionMode } from "@/lib/admin/session-history";

export const dynamic = "force-dynamic";

const MODES: SessionMode[] = [
  "assessment",
  "practice",
  "mistakes",
  "mock",
  "final",
];

function parseFilters(searchParams: URLSearchParams): AttemptLogFilters {
  const mode = searchParams.get("mode");
  const runType = searchParams.get("runType");
  const section = searchParams.get("section");
  const result = searchParams.get("result");
  const limitRaw = searchParams.get("limit");

  const filters: AttemptLogFilters = {
    mode: "all",
    runType: "all",
    section: "all",
    result: "all",
    primaryOnly: searchParams.get("primaryOnly") === "1",
  };

  if (mode && MODES.includes(mode as SessionMode)) {
    filters.mode = mode as SessionMode;
  }

  if (runType === "smoke" || runType === "full" || runType === "other") {
    filters.runType = runType;
  }

  if (section && section !== "all") {
    filters.section = section;
  }

  if (result === "correct" || result === "wrong") {
    filters.result = result;
  }

  const limit = limitRaw ? Number(limitRaw) : 200;
  if (Number.isFinite(limit) && limit > 0) {
    filters.limit = Math.min(limit, 500);
  }

  return filters;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.reason === "unauthorized" ? "unauthorized" : "forbidden" },
      { status: guard.reason === "unauthorized" ? 401 : 403 },
    );
  }

  const admin = createAdminClient();
  const userRes = await admin.auth.admin.getUserById(id);
  if (userRes.error || !userRes.data.user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const filters = parseFilters(new URL(req.url).searchParams);
  const result = await loadAttemptLog(admin, id, filters);

  return NextResponse.json(result);
}
