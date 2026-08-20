import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Lightweight route-protection middleware (Next.js 16 "proxy" convention —
 * the framework renamed middleware.ts to proxy.ts; this file replaces it).
 *
 * We cannot access Zustand (localStorage) from the Edge runtime, so we rely on
 * an `auth-role` cookie that we write to the browser on successful login and
 * clear on logout (see login.tsx / useAuthStore).
 *
 * The cookie is NOT httpOnly so the client can still set/clear it.
 */

const ROLE_ROUTES: Record<string, string[]> = {
  "/admin": ["admin", "super_admin"],
  "/superadmin": ["super_admin"],
  "/student": ["student"],
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Find matching protected route prefix
  const protectedEntry = Object.entries(ROLE_ROUTES).find(([prefix]) =>
    pathname.startsWith(prefix)
  );

  if (!protectedEntry) return NextResponse.next();

  const [, allowedRoles] = protectedEntry;

  // Read the role cookie set during login
  const roleCookie = request.cookies.get("auth-role")?.value;

  if (!roleCookie || !allowedRoles.includes(roleCookie)) {
    // Redirect unauthorised visitors to the landing page
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/superadmin/:path*", "/student/:path*"],
};
