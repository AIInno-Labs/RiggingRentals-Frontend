import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import { fetchProfileViaRpc } from "@/features/rbac/fetch-profile";
import {
  canAccessPath,
  homePathForRole,
} from "@/features/rbac/route-access";
import { isAppRole, type AppRole } from "@/features/rbac/types";
import { SA_SESSION_COOKIE, isTokenFresh } from "@/features/super-admin/auth/session-cookie";

const PUBLIC_PATHS = new Set(["/login", "/unauthorized"]);
const ROLE_COOKIE = "rr_role";

/** Next metadata routes are extensionless and must stay public for crawlers/WhatsApp. */
function isPublicAssetPath(pathname: string) {
  return (
    pathname === "/icon" ||
    pathname === "/apple-icon" ||
    pathname === "/opengraph-image" ||
    pathname === "/twitter-image" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/icon?") ||
    pathname.startsWith("/apple-icon?") ||
    pathname.startsWith("/opengraph-image?") ||
    pathname.startsWith("/twitter-image?")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".") ||
    isPublicAssetPath(pathname)
  ) {
    return NextResponse.next();
  }

  // Super Admin signs in on the shared /login page against the Rigg Rental
  // backend (not Supabase); its session is the backend JWT cookie.
  if (pathname === "/super-admin" || pathname.startsWith("/super-admin/")) {
    const token = request.cookies.get(SA_SESSION_COOKIE)?.value;
    if (token && isTokenFresh(token)) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    const res = NextResponse.redirect(url);
    if (token) res.cookies.delete(SA_SESSION_COOKIE);
    return res;
  }
  // Its Route Handlers check the session themselves (sign-out must work without one).
  if (pathname.startsWith("/api/super-admin/")) {
    return NextResponse.next();
  }

  const { supabase, getResponse } = createMiddlewareClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.has(pathname);

  if (!user) {
    const res = getResponse();
    res.cookies.delete(ROLE_COOKIE);
    if (isPublic || pathname === "/") return res;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const cachedRole = request.cookies.get(ROLE_COOKIE)?.value;
  let role: AppRole | null =
    cachedRole && isAppRole(cachedRole) ? cachedRole : null;

  if (!role) {
    const profile = await fetchProfileViaRpc(supabase);
    if (!profile || !profile.is_active) {
      if (pathname === "/unauthorized" || pathname === "/login") {
        return getResponse();
      }
      const url = request.nextUrl.clone();
      url.pathname = "/unauthorized";
      return NextResponse.redirect(url);
    }
    role = profile.role;
  }

  const response = getResponse();
  if (!cachedRole || cachedRole !== role) {
    response.cookies.set(ROLE_COOKIE, role, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
  }

  if (pathname === "/login" || pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = homePathForRole(role);
    const redirect = NextResponse.redirect(url);
    redirect.cookies.set(ROLE_COOKIE, role, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return redirect;
  }

  if (!canAccessPath(role, pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/unauthorized";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|icon|apple-icon|opengraph-image|twitter-image|manifest.webmanifest|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
