import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSharedDemoLoginEnabled } from "@/lib/auth/shared-demo-login";

/**
 * One-click shared demo account login (legacy testing shortcut).
 * Disabled by default — use guest /try demo (Step 4) for prospects instead.
 * Local only: NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true in .env.local
 */
export async function POST() {
  if (!isSharedDemoLoginEnabled()) {
    return NextResponse.json({ error: "Demo login disabled." }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      {
        error:
          "Demo login needs SUPABASE_SERVICE_ROLE_KEY in .env.local. Add it from Supabase → Settings → API.",
      },
      { status: 500 },
    );
  }

  const email = process.env.DEMO_EMAIL || "demo@tutor.local";
  const password = process.env.DEMO_PASSWORD || "demo-tutor-1234";

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const existing = list.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );

  if (existing) {
    // Re-assert the password + confirm flag so testing always works.
    const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata ?? {}),
        full_name: existing.user_metadata?.full_name ?? "Demo Student",
      },
    });
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
  } else {
    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Demo Student" },
    });
    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ email, password });
}
