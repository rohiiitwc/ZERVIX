import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = [
  "/welcome",
  "/dashboard",
  "/workspace",
  "/analytics",
  "/audit-reports",
  "/privacy-security",
  "/assistant",
  "/prompt-log",
  "/settings",
  "/admin",
];

const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get("zervix_session")?.value);

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtected && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const isAuthPage = AUTH_PAGES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isAuthPage && hasSessionCookie) {
    return NextResponse.redirect(new URL("/welcome", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/welcome/:path*",
    "/dashboard/:path*",
    "/workspace/:path*",
    "/analytics/:path*",
    "/audit-reports/:path*",
    "/privacy-security/:path*",
    "/assistant/:path*",
    "/prompt-log/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ],
};
