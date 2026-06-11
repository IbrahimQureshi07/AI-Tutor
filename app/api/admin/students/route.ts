import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isBootstrapAdminEmail } from "@/lib/auth/bootstrap-admin";
import { SECTIONS } from "@/lib/constants";

export const dynamic = "force-dynamic";

type ModeKey = "assessment" | "practice" | "mistakes" | "mock" | "final";

function hasMissingRoleColumns(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { message?: string; details?: string };
  const msg = `${e.message ?? ""} ${e.details ?? ""}`.toLowerCase();
  return msg.includes("column") && msg.includes("role") && msg.includes("profiles");
}

export async function GET() {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.reason === "unauthorized" ? "unauthorized" : "forbidden" },
      { status: guard.reason === "unauthorized" ? 401 : 403 },
    );
  }

  const admin = createAdminClient();

  const [authRes, profileRes, sessionRes, masteryRes, mistakeRes] =
    await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin.from("profiles").select("id, full_name, role, is_active"),
      admin
        .from("sessions")
        .select("user_id, mode, status, score_pct, started_at, finished_at")
        .order("started_at", { ascending: false })
        .limit(10000),
      admin
        .from("v_user_section_mastery")
        .select("user_id, section_code, total, correct"),
      admin
        .from("v_user_mistakes")
        .select("user_id, resolved")
        .eq("resolved", false),
    ]);

  if (authRes.error) {
    return NextResponse.json({ error: authRes.error.message }, { status: 500 });
  }
  if (profileRes.error && !hasMissingRoleColumns(profileRes.error)) {
    return NextResponse.json({ error: profileRes.error.message }, { status: 500 });
  }
  if (sessionRes.error) {
    return NextResponse.json({ error: sessionRes.error.message }, { status: 500 });
  }

  const profileById = new Map(
    (profileRes.data ?? []).map((p) => [p.id as string, p]),
  );

  type SessionAgg = {
    lastActive: string | null;
    completed: Record<ModeKey, number>;
    bestMock: number | null;
    lastMock: number | null;
    lastMockAt: string | null;
  };
  const emptyCompleted = (): Record<ModeKey, number> => ({
    assessment: 0,
    practice: 0,
    mistakes: 0,
    mock: 0,
    final: 0,
  });
  const sessionByUser = new Map<string, SessionAgg>();

  for (const s of (sessionRes.data ?? []) as Array<{
    user_id: string;
    mode: string;
    status: string;
    score_pct: number | null;
    started_at: string | null;
    finished_at: string | null;
  }>) {
    let agg = sessionByUser.get(s.user_id);
    if (!agg) {
      agg = {
        lastActive: null,
        completed: emptyCompleted(),
        bestMock: null,
        lastMock: null,
        lastMockAt: null,
      };
      sessionByUser.set(s.user_id, agg);
    }
    const stamp = s.finished_at ?? s.started_at;
    if (stamp && (!agg.lastActive || stamp > agg.lastActive)) {
      agg.lastActive = stamp;
    }
    if (s.status === "finished" && s.mode in agg.completed) {
      agg.completed[s.mode as ModeKey] += 1;
      if (s.mode === "mock" && s.score_pct != null) {
        const score = Math.round(Number(s.score_pct));
        if (agg.bestMock == null || score > agg.bestMock) agg.bestMock = score;
        if (!agg.lastMockAt || (s.finished_at ?? "") > agg.lastMockAt) {
          agg.lastMockAt = s.finished_at ?? "";
          agg.lastMock = score;
        }
      }
    }
  }

  type MasteryAgg = { sections: Set<string>; total: number; correct: number };
  const masteryByUser = new Map<string, MasteryAgg>();
  for (const m of (masteryRes.data ?? []) as Array<{
    user_id: string;
    section_code: string;
    total: number;
    correct: number;
  }>) {
    let agg = masteryByUser.get(m.user_id);
    if (!agg) {
      agg = { sections: new Set(), total: 0, correct: 0 };
      masteryByUser.set(m.user_id, agg);
    }
    if (m.total > 0) agg.sections.add(m.section_code);
    agg.total += m.total ?? 0;
    agg.correct += m.correct ?? 0;
  }

  const mistakesByUser = new Map<string, number>();
  for (const row of (mistakeRes.data ?? []) as Array<{ user_id: string }>) {
    mistakesByUser.set(row.user_id, (mistakesByUser.get(row.user_id) ?? 0) + 1);
  }

  const totalSections = SECTIONS.length;

  const students = (authRes.data.users ?? []).map((u) => {
    const profile = profileById.get(u.id);
    const email = u.email ?? null;
    const fallbackAdmin = isBootstrapAdminEmail(email);
    const session = sessionByUser.get(u.id);
    const mastery = masteryByUser.get(u.id);
    const coverage = mastery?.sections.size ?? 0;
    const overallAccuracy =
      mastery && mastery.total > 0
        ? Math.round((100 * mastery.correct) / mastery.total)
        : 0;

    return {
      id: u.id,
      email,
      fullName:
        (profile?.full_name as string | null | undefined) ??
        ((u.user_metadata?.full_name as string | undefined) ?? null),
      role:
        (profile?.role as "student" | "admin" | undefined) ??
        (fallbackAdmin ? "admin" : "student"),
      isActive: (profile?.is_active as boolean | undefined) ?? true,
      createdAt: u.created_at ?? null,
      lastActive: session?.lastActive ?? null,
      coverageSections: coverage,
      totalSections,
      overallAccuracy,
      totalAttempts: mastery?.total ?? 0,
      completed: session?.completed ?? emptyCompleted(),
      bestMock: session?.bestMock ?? null,
      lastMock: session?.lastMock ?? null,
      unresolvedMistakes: mistakesByUser.get(u.id) ?? 0,
    };
  });

  // Students first (most recently active), admins after.
  students.sort((a, b) => {
    const at = a.lastActive ?? "";
    const bt = b.lastActive ?? "";
    return bt.localeCompare(at);
  });

  return NextResponse.json({ students });
}
