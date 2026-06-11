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

const DAY = 24 * 60 * 60 * 1000;

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
      admin.from("profiles").select("id, role, is_active"),
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

  // Identify students (exclude admins from cohort metrics).
  const studentIds = new Set<string>();
  for (const u of authRes.data.users ?? []) {
    const profile = profileById.get(u.id);
    const role =
      (profile?.role as "student" | "admin" | undefined) ??
      (isBootstrapAdminEmail(u.email) ? "admin" : "student");
    if (role === "student") studentIds.add(u.id);
  }

  // ── Per-student session aggregates ──
  type SessionAgg = {
    lastActive: string | null;
    completed: Record<ModeKey, boolean>;
    bestMock: number | null;
  };
  const sessionByUser = new Map<string, SessionAgg>();
  const emptyCompleted = (): Record<ModeKey, boolean> => ({
    assessment: false,
    practice: false,
    mistakes: false,
    mock: false,
    final: false,
  });

  for (const s of (sessionRes.data ?? []) as Array<{
    user_id: string;
    mode: string;
    status: string;
    score_pct: number | null;
    started_at: string | null;
    finished_at: string | null;
  }>) {
    if (!studentIds.has(s.user_id)) continue;
    let agg = sessionByUser.get(s.user_id);
    if (!agg) {
      agg = { lastActive: null, completed: emptyCompleted(), bestMock: null };
      sessionByUser.set(s.user_id, agg);
    }
    const stamp = s.finished_at ?? s.started_at;
    if (stamp && (!agg.lastActive || stamp > agg.lastActive)) agg.lastActive = stamp;
    if (s.status === "finished" && s.mode in agg.completed) {
      agg.completed[s.mode as ModeKey] = true;
      if (s.mode === "mock" && s.score_pct != null) {
        const score = Math.round(Number(s.score_pct));
        if (agg.bestMock == null || score > agg.bestMock) agg.bestMock = score;
      }
    }
  }

  // ── Per-student mastery (coverage + accuracy) ──
  type MasteryAgg = { sections: Set<string>; total: number; correct: number };
  const masteryByUser = new Map<string, MasteryAgg>();
  // Class-wide per-section rollup.
  const sectionRollup = new Map<string, { total: number; correct: number; learners: number }>();

  for (const m of (masteryRes.data ?? []) as Array<{
    user_id: string;
    section_code: string;
    total: number;
    correct: number;
  }>) {
    if (!studentIds.has(m.user_id)) continue;
    let agg = masteryByUser.get(m.user_id);
    if (!agg) {
      agg = { sections: new Set(), total: 0, correct: 0 };
      masteryByUser.set(m.user_id, agg);
    }
    if ((m.total ?? 0) > 0) agg.sections.add(m.section_code);
    agg.total += m.total ?? 0;
    agg.correct += m.correct ?? 0;

    if ((m.total ?? 0) > 0) {
      const sec = sectionRollup.get(m.section_code) ?? { total: 0, correct: 0, learners: 0 };
      sec.total += m.total ?? 0;
      sec.correct += m.correct ?? 0;
      sec.learners += 1;
      sectionRollup.set(m.section_code, sec);
    }
  }

  const mistakesByUser = new Map<string, number>();
  for (const row of (mistakeRes.data ?? []) as Array<{ user_id: string }>) {
    if (!studentIds.has(row.user_id)) continue;
    mistakesByUser.set(row.user_id, (mistakesByUser.get(row.user_id) ?? 0) + 1);
  }

  // ── Cohort headline metrics ──
  const totalStudents = studentIds.size;
  let activeStudents = 0;
  let accuracySum = 0;
  let accuracyLearners = 0;
  let totalOpenMistakes = 0;
  let atRisk = 0;

  const funnel: Record<ModeKey, number> = {
    assessment: 0,
    practice: 0,
    mistakes: 0,
    mock: 0,
    final: 0,
  };
  // Mock score distribution buckets.
  const mockBuckets = { lt50: 0, b50: 0, b60: 0, b70: 0, b80: 0, b90: 0 };
  let mockLearners = 0;

  for (const uid of studentIds) {
    const session = sessionByUser.get(uid);
    const mastery = masteryByUser.get(uid);

    if (session?.lastActive && Date.now() - new Date(session.lastActive).getTime() <= 7 * DAY) {
      activeStudents += 1;
    }

    const acc =
      mastery && mastery.total > 0
        ? Math.round((100 * mastery.correct) / mastery.total)
        : null;
    if (acc != null) {
      accuracySum += acc;
      accuracyLearners += 1;
    }

    totalOpenMistakes += mistakesByUser.get(uid) ?? 0;

    if (session) {
      (Object.keys(funnel) as ModeKey[]).forEach((m) => {
        if (session.completed[m]) funnel[m] += 1;
      });
      if (session.bestMock != null) {
        mockLearners += 1;
        const b = session.bestMock;
        if (b < 50) mockBuckets.lt50 += 1;
        else if (b < 60) mockBuckets.b50 += 1;
        else if (b < 70) mockBuckets.b60 += 1;
        else if (b < 80) mockBuckets.b70 += 1;
        else if (b < 90) mockBuckets.b80 += 1;
        else mockBuckets.b90 += 1;
      }
    }

    const hasData = (mastery?.total ?? 0) > 0;
    if (
      hasData &&
      ((acc != null && acc < 70) ||
        (session?.bestMock != null && session.bestMock < 70))
    ) {
      atRisk += 1;
    }
  }

  const avgAccuracy = accuracyLearners
    ? Math.round(accuracySum / accuracyLearners)
    : 0;

  // ── Class-wide section performance (weakest first) ──
  const sectionPerformance = SECTIONS.map((sec) => {
    const r = sectionRollup.get(sec.code);
    const accuracy = r && r.total > 0 ? Math.round((100 * r.correct) / r.total) : null;
    return {
      code: sec.code,
      title: sec.title,
      group: sec.group,
      accuracy,
      learners: r?.learners ?? 0,
      attempts: r?.total ?? 0,
    };
  });

  // ── Recently active students (top 8) ──
  const recentActive = [...studentIds]
    .map((uid) => {
      const u = (authRes.data.users ?? []).find((x) => x.id === uid);
      const profile = profileById.get(uid);
      const session = sessionByUser.get(uid);
      const mastery = masteryByUser.get(uid);
      const acc =
        mastery && mastery.total > 0
          ? Math.round((100 * mastery.correct) / mastery.total)
          : null;
      return {
        id: uid,
        fullName:
          (profile && (profile as { full_name?: string }).full_name) ??
          ((u?.user_metadata?.full_name as string | undefined) ?? null),
        email: u?.email ?? null,
        lastActive: session?.lastActive ?? null,
        accuracy: acc,
        coverage: mastery?.sections.size ?? 0,
      };
    })
    .filter((r) => r.lastActive)
    .sort((a, b) => (b.lastActive ?? "").localeCompare(a.lastActive ?? ""))
    .slice(0, 8);

  return NextResponse.json({
    totals: {
      totalStudents,
      activeStudents,
      avgAccuracy,
      atRisk,
      totalOpenMistakes,
    },
    funnel,
    mock: { buckets: mockBuckets, learners: mockLearners },
    sectionPerformance,
    totalSections: SECTIONS.length,
    recentActive,
  });
}
