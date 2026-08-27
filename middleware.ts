import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getAccessState } from "@/lib/access/check-access";
import {
  clearAccessGate,
  hasSupabaseAuthCookie,
  readAccessGate,
  readBootstrapDone,
  writeAccessGate,
  writeBootstrapDone,
  type AccessGateValue,
} from "@/lib/access/access-gate-cookie";
import {
  isBootstrapAdminEmail,
  maybeBootstrapAdmin,
} from "@/lib/auth/bootstrap-admin";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/pricing",
  "/try",
  "/auth/callback",
  "/forgot-password",
];

/** Logged-in users without paid access may visit these routes. */
const PAYWALL_EXEMPT_PREFIXES = ["/unlock", "/pricing", "/settings", "/admin"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function isPaywallExempt(pathname: string): boolean {
  return PAYWALL_EXEMPT_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function isAuthEntryPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/signup" || pathname === "/unlock";
}

function redirectTo(
  request: NextRequest,
  pathname: string,
  gate?: AccessGateValue,
  bootstrapDone?: boolean,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const res = NextResponse.redirect(url);
  if (gate) writeAccessGate(res, gate);
  if (bootstrapDone) writeBootstrapDone(res);
  return res;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    return NextResponse.next({ request });
  }

  const isPublic = isPublicPath(pathname);
  const hasSession = hasSupabaseAuthCookie(request);
  const gate = readAccessGate(request);
  const bootDone = readBootstrapDone(request);

  // Logged-out + protected: cookie check only (no Auth network).
  if (!hasSession && !isPublic && !pathname.startsWith("/_next")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    const res = NextResponse.redirect(url);
    clearAccessGate(res);
    return res;
  }

  // Logged-out + public marketing/auth pages: pass through.
  if (!hasSession) {
    return NextResponse.next({ request });
  }

  // Paid session, gate still warm: skip getUser + getAccessState.
  if (gate === "ok") {
    if (isAuthEntryPath(pathname)) {
      return redirectTo(request, "/dashboard", "ok", bootDone);
    }
    return NextResponse.next({ request });
  }

  // Locked session, gate still warm: skip getUser + getAccessState.
  if (gate === "lock") {
    if (pathname === "/login" || pathname === "/signup") {
      return redirectTo(request, "/unlock", "lock", bootDone);
    }
    if (!isPublic && !isPaywallExempt(pathname)) {
      return redirectTo(request, "/unlock", "lock", bootDone);
    }
    return NextResponse.next({ request });
  }

  // Cold gate: validate with Auth and refresh the 90s cookie.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    clearAccessGate(response);
    if (!isPublic && !pathname.startsWith("/_next")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectTo", pathname);
      const res = NextResponse.redirect(url);
      clearAccessGate(res);
      return res;
    }
    return response;
  }

  let didBootstrap = false;
  if (isBootstrapAdminEmail(user.email) && !bootDone) {
    await maybeBootstrapAdmin(supabase, user);
    writeBootstrapDone(response);
    didBootstrap = true;
  }

  if (pathname === "/unlock") {
    const access = await getAccessState(supabase, user);
    if (access.hasFullAccess) {
      return redirectTo(request, "/dashboard", "ok", didBootstrap);
    }
    writeAccessGate(response, "lock");
    return response;
  }

  if (pathname === "/login" || pathname === "/signup") {
    const access = await getAccessState(supabase, user);
    return redirectTo(
      request,
      access.hasFullAccess ? "/dashboard" : "/unlock",
      access.hasFullAccess ? "ok" : "lock",
      didBootstrap || isBootstrapAdminEmail(user.email),
    );
  }

  if (!isPublic && !isPaywallExempt(pathname) && !pathname.startsWith("/_next")) {
    const access = await getAccessState(supabase, user);
    if (access.migrationApplied && access.needsPaywall) {
      return redirectTo(request, "/unlock", "lock", didBootstrap);
    }
    writeAccessGate(response, "ok");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
