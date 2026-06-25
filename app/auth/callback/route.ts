import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { maybeBootstrapAdmin } from "@/lib/auth/bootstrap-admin";
import { getAccessState } from "@/lib/access/check-access";

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
        if (!access.hasFullAccess && (next === "/dashboard" || next === "/")) {
          next = "/unlock";
        }
        if (access.hasFullAccess && next === "/unlock") {
          next = "/dashboard";
        }
        return NextResponse.redirect(`${origin}${next}`);
      }
      return NextResponse.redirect(`${origin}${nextParam}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
