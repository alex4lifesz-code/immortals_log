// src/middleware/jwtValidator.ts — Extract, verify JWT and handle missing/invalid tokens

import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import type { MiddlewareContext, JwtPayload } from "./types";
import { isProtectedRoute, isApiRoute, isDashboardRoute } from "./routeClassifier";
import { getJwtSecret, COOKIE_NAME } from "./cookieUtils";

/**
 * Validate the JWT from the auth cookie.
 *
 * - Public/unmatched routes: skip (return null to continue pipeline).
 * - Protected routes without token: return 401 (API) or redirect to login (dashboard).
 * - Valid token: populate `ctx.auth` and continue.
 * - Invalid/expired token: return 401 (API) or redirect + clear cookie (dashboard).
 */
export async function validateJwt(
  ctx: MiddlewareContext
): Promise<NextResponse | null> {
  // Nothing to do for public routes
  if (!isProtectedRoute(ctx.route)) {
    return null;
  }

  const { pathname } = ctx.request.nextUrl;

  // No token present
  if (!ctx.token) {
    if (isApiRoute(ctx.route)) {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required" } },
        { status: 401 }
      );
    }
    // Dashboard — redirect to login
    const loginUrl = new URL("/", ctx.request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify the token
  try {
    const { payload } = await jwtVerify(ctx.token, getJwtSecret());

    if (!payload.userId || !payload.role) {
      throw new Error("Invalid token payload");
    }

    ctx.auth = {
      userId: payload.userId as string,
      username: payload.username as string,
      name: (payload.name as string) ?? "",
      role: payload.role as string,
      iat: typeof payload.iat === "number" ? payload.iat : 0,
      exp: typeof payload.exp === "number" ? payload.exp : 0,
    };

    return null; // continue pipeline
  } catch {
    // Token is invalid or expired
    if (isApiRoute(ctx.route)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_TOKEN", message: "Invalid or expired token" } },
        { status: 401 }
      );
    }

    // Dashboard — redirect to login and clear bad cookie
    const loginUrl = new URL("/", ctx.request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(COOKIE_NAME);
    return response;
  }
}
