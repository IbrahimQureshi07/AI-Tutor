import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { loadSessionHistory } from "@/lib/admin/session-history";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
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

  const sessions = await loadSessionHistory(admin, id, { limit: 100 });
  return NextResponse.json({ sessions });
}
