import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  accessDeniedResponse,
  requireFullAccess,
} from "@/lib/access/require-access";
import { DebriefPlanSchema, sanitizePlan } from "@/lib/coach/debrief-plan";

export const runtime = "nodejs";

const Body = z.object({
  sessionId: z.string().uuid(),
  plan: DebriefPlanSchema,
  committed: z.boolean().default(false),
});

/**
 * Persists the agreed-upon debrief plan into the session's config so the
 * results page remembers the latest plan and `/practice/start` can pick it
 * up via `fromSessionId`. We merge with existing config to avoid clobbering
 * anything the runner wrote earlier.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const guard = await requireFullAccess(supabase);
  if (!guard.ok) return accessDeniedResponse(guard);
  const { user } = guard;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { sessionId, plan, committed } = parsed.data;
  const clean = sanitizePlan(plan);

  const { data: existing } = await supabase
    .from("sessions")
    .select("config")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const config = (existing.config as Record<string, unknown> | null) ?? {};
  const nextConfig = {
    ...config,
    debrief_plan: clean,
    debrief_committed: committed,
    debrief_committed_at: committed ? new Date().toISOString() : null,
  };

  const { error } = await supabase
    .from("sessions")
    .update({ config: nextConfig })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, plan: clean });
}
