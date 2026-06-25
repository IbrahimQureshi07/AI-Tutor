import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getAccessState } from "@/lib/access/check-access";

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
    return NextResponse.redirect(url);
  }

  if (pathname === "/unlock") {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectTo", "/unlock");
      return NextResponse.redirect(url);
    }
    const access = await getAccessState(supabase, user);
    if (access.hasFullAccess) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return response;
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const access = await getAccessState(supabase, user);
    const url = request.nextUrl.clone();
    url.pathname = access.hasFullAccess ? "/dashboard" : "/unlock";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (
    user &&
    !isPublic &&
    !isPaywallExempt(pathname) &&
    !pathname.startsWith("/_next")
  ) {
    const access = await getAccessState(supabase, user);
    if (access.migrationApplied && access.needsPaywall) {
      const url = request.nextUrl.clone();
      url.pathname = "/unlock";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
