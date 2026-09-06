import { NextRequest, NextResponse } from "next/server";

// Edge-level route guard (Next.js 16 "proxy" — the renamed successor to
// middleware.ts). Zustand/localStorage aren't readable here, so the client
// writes a lightweight, non-sensitive "auth-role" cookie on login (see the
// /login page) that this proxy checks. The real authorization check still
// happens on every API request via the JWT — this only prevents an
// unauthenticated or wrong-role browser from ever rendering the dashboard shell.
const PUBLIC_PATHS = ["/login"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = req.cookies.get("auth-role")?.value;
  const isSuperAdmin = role === "super_admin";

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isPublic) {
    // Already signed in as super admin — no reason to see the login page again.
    if (isSuperAdmin && pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (!isSuperAdmin) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on every route except static assets and Next.js internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png).*)"],
};
