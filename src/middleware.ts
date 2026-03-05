import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export const runtime = "nodejs";

const intlMiddleware = createMiddleware(routing);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip locale handling for API routes and static files
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Run next-intl middleware first (handles locale detection/redirect)
  const intlResponse = intlMiddleware(req);

  // Extract locale from the URL (after intl middleware may have redirected)
  const localeMatch = pathname.match(/^\/(en|fr)(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : "en";

  // Strip locale prefix to check the path
  const strippedPath = pathname.replace(/^\/(en|fr)/, "") || "/";

  const isOnDashboard =
    strippedPath.startsWith("/dashboard") ||
    strippedPath.startsWith("/builder");
  const isOnAuth =
    strippedPath === "/login" ||
    strippedPath === "/signup" ||
    strippedPath === "/forgot-password" ||
    strippedPath === "/reset-password";

  // Only run auth checks for protected/auth routes
  if (isOnDashboard || isOnAuth) {
    const token = await getToken({
      req,
      secret: process.env.AUTH_SECRET,
      secureCookie: process.env.NODE_ENV === "production",
    });
    const isLoggedIn = !!token;

    if (isOnDashboard && !isLoggedIn) {
      return NextResponse.redirect(new URL(`/${locale}/login`, req.nextUrl));
    }

    if (isOnAuth && isLoggedIn) {
      return NextResponse.redirect(
        new URL(`/${locale}/dashboard`, req.nextUrl)
      );
    }
  }

  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\..*).*)"],
};
