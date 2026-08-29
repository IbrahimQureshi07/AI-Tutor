import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { maybeBootstrapAdmin } from "@/lib/auth/bootstrap-admin";
import { getAccessState } from "@/lib/access/check-access";
import {
  writeAccessGate,
  writeBootstrapDone,
} from "@/lib/access/access-gate-cookie";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await maybeBootstrapAdmin(supabase, user);
        const access = await getAccessState(supabase, user);
        let next = nextParam;
        // Deactivated / blocked: route to unlock (support / admin).
        if (!access.canUseFreeModes && (next === "/dashboard" || next === "/")) {
          next = "/unlock";
        }
        // Paid/grandfathered users don't need /unlock.
        if (access.canUsePaidExams && next === "/unlock") {
          next = "/dashboard";
        }
        const res = NextResponse.redirect(`${origin}${next}`);
        writeAccessGate(
          res,
          !access.canUseFreeModes ? "lock" : access.canUsePaidExams ? "ok" : "free",
        );
        writeBootstrapDone(res);
        return res;
      }
      return NextResponse.redirect(`${origin}${nextParam}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
