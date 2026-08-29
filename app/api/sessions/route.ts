import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  accessDeniedResponse,
  requireFreeAccess,
} from "@/lib/access/require-access";

const Body = z.object({
  mode: z.enum(["assessment", "practice", "mistakes", "mock", "final"]),
  config: z.record(z.any()).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const guard = await requireFreeAccess(supabase);
  if (!guard.ok) return accessDeniedResponse(guard);
  const { user, access } = guard;

  const json = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (
    (parsed.data.mode === "mock" || parsed.data.mode === "final") &&
    !access.canUsePaidExams
  ) {
    return NextResponse.json(
      { error: "payment_required", unlock: "/unlock" },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      mode: parsed.data.mode,
      config: parsed.data.config ?? {},
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessionId: data.id });
}
