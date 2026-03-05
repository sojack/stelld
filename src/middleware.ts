import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export const runtime = "nodejs";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET, secureCookie: true });
  const isLoggedIn = !!token;

  const isOnDashboard = req.nextUrl.pathname.startsWith("/dashboard") ||
    req.nextUrl.pathname.startsWith("/builder");
  const isOnAuth = req.nextUrl.pathname.startsWith("/login") ||
    req.nextUrl.pathname.startsWith("/signup") ||
    req.nextUrl.pathname.startsWith("/forgot-password") ||
    req.nextUrl.pathname.startsWith("/reset-password");

  if (isOnDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isOnAuth && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/builder/:path*", "/login", "/signup", "/forgot-password", "/reset-password"],
};
