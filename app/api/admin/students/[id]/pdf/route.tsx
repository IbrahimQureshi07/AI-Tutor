export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isBootstrapAdminEmail } from "@/lib/auth/bootstrap-admin";
import { getUserStats } from "@/lib/kpi/stats";
import { loadJourney } from "@/lib/journey/load";
import { loadSessionHistory } from "@/lib/admin/session-history";
import { StudentReportPdf } from "@/lib/pdf/student-report-pdf";

function hasMissingRoleColumns(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { message?: string; details?: string };
  const msg = `${e.message ?? ""} ${e.details ?? ""}`.toLowerCase();
  return msg.includes("column") && msg.includes("role") && msg.includes("profiles");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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

    const authRes = await admin.auth.admin.getUserById(id);
    if (authRes.error || !authRes.data.user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const authUser = authRes.data.user;

    let profile: { full_name?: string | null; role?: string; is_active?: boolean } | null =
      null;
    const profileRes = await admin
      .from("profiles")
      .select("full_name, role, is_active")
      .eq("id", id)
      .maybeSingle();
    if (profileRes.error && !hasMissingRoleColumns(profileRes.error)) {
      const fallback = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", id)
        .maybeSingle();
      profile = fallback.data ?? null;
    } else {
      profile = profileRes.data ?? null;
    }

    const fallbackAdmin = isBootstrapAdminEmail(authUser.email);

    const [stats, journey, sessions] = await Promise.all([
      getUserStats(id, admin),
      loadJourney(admin, id, { perModeLimit: 12, combinedLimit: 24 }),
      loadSessionHistory(admin, id, { limit: 100 }),
    ]);

    const fullName =
      (profile?.full_name as string | null | undefined) ??
      ((authUser.user_metadata?.full_name as string | undefined) ?? null);

    const generatedAt = new Date().toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    const element = React.createElement(StudentReportPdf, {
      student: {
        fullName,
        email: authUser.email ?? null,
        role:
          (profile?.role as "student" | "admin" | undefined) ??
          (fallbackAdmin ? "admin" : "student"),
        isActive: (profile?.is_active as boolean | undefined) ?? true,
        createdAt: authUser.created_at ?? null,
      },
      stats,
      journey,
      sessions,
      generatedAt,
    }) as unknown as React.ReactElement<DocumentProps>;

    const buffer = await renderToBuffer(element);

    const safeName = (fullName ?? authUser.email ?? id)
      .toString()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 40) || "student";

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="report-card-${safeName}.pdf"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err) {
    console.error("[Student Report PDF] render failed:", err);
    return NextResponse.json(
      { error: "PDF generation failed", detail: String(err) },
      { status: 500 },
    );
  }
}
