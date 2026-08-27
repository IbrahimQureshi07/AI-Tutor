import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getAccessState } from "@/lib/access/check-access";
import {
  clearAccessGate,
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

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    return response;
  }

  const isPublic = isPublicPath(pathname);

  if (!user && !isPublic && !pathname.startsWith("/_next")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    const res = NextResponse.redirect(url);
    clearAccessGate(res);
    return res;
  }

  let didBootstrap = false;
  if (
    user &&
    isBootstrapAdminEmail(user.email) &&
    !readBootstrapDone(request)
  ) {
    await maybeBootstrapAdmin(supabase, user);
    writeBootstrapDone(response);
    didBootstrap = true;
  }

  if (pathname === "/unlock") {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectTo", "/unlock");
      return NextResponse.redirect(url);
    }
    if (readAccessGate(request) === "ok") {
      return redirectTo(request, "/dashboard", "ok", didBootstrap);
    }
    const access = await getAccessState(supabase, user);
    if (access.hasFullAccess) {
      return redirectTo(request, "/dashboard", "ok", didBootstrap);
    }
    writeAccessGate(response, "lock");
    return response;
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const access = await getAccessState(supabase, user);
    return redirectTo(
      request,
      access.hasFullAccess ? "/dashboard" : "/unlock",
      access.hasFullAccess ? "ok" : "lock",
      didBootstrap || isBootstrapAdminEmail(user.email),
    );
  }

  if (
    user &&
    !isPublic &&
    !isPaywallExempt(pathname) &&
    !pathname.startsWith("/_next")
  ) {
    const cached = readAccessGate(request);
    if (cached === "ok") {
      return response;
    }
    if (cached === "lock") {
      return redirectTo(request, "/unlock", "lock", didBootstrap);
    }

    const access = await getAccessState(supabase, user);
    if (access.migrationApplied && access.needsPaywall) {
      return redirectTo(request, "/unlock", "lock", didBootstrap);
    }
    writeAccessGate(response, "ok");
  }

  if (!user) {
    clearAccessGate(response);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
