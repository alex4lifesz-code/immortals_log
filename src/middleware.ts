// src/middleware.ts — Next.js edge middleware for authentication

import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "auth-token";

// Routes that do NOT require authentication
const PUBLIC_API_ROUTES = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/health",
]);

// API routes that need auth
const API_PREFIX = "/api/";
// Dashboard pages that need auth
const DASHBOARD_PREFIX = "/dashboard";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public API routes
  if (PUBLIC_API_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  const isApiRoute = pathname.startsWith(API_PREFIX);
  const isDashboardRoute = pathname.startsWith(DASHBOARD_PREFIX);

  // Only process API and dashboard routes
  if (!isApiRoute && !isDashboardRoute) {
    return NextResponse.next();
  }

  // Get auth token from cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: "Authentication required", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    // Redirect to login for dashboard pages
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify token
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());

    if (!payload.userId || !payload.role) {
      throw new Error("Invalid token payload");
    }

    // Token is valid — check if it should be refreshed (sliding window)
    const exp = payload.exp as number;
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = exp - now;
    const totalLifetime = exp - (payload.iat as number);

    // Refresh if less than 25% of lifetime remaining
    if (timeUntilExpiry < totalLifetime * 0.25 && timeUntilExpiry > 0) {
      const response = NextResponse.next();
      // Re-sign the token with a fresh expiration
      const { SignJWT } = await import("jose");
      const newToken = await new SignJWT({
        userId: payload.userId,
        username: payload.username,
        name: payload.name,
        role: payload.role,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${totalLifetime}s`)
        .sign(getJwtSecret());

      const isProduction = process.env.NODE_ENV === "production";
      const cookieParts = [
        `${COOKIE_NAME}=${newToken}`,
        `Path=/`,
        `HttpOnly`,
        `SameSite=Lax`,
        `Max-Age=${totalLifetime}`,
      ];
      if (isProduction) cookieParts.push("Secure");

      response.headers.append("Set-Cookie", cookieParts.join("; "));
      return response;
    }

    return NextResponse.next();
  } catch {
    // Token is invalid or expired
    if (isApiRoute) {
      return NextResponse.json(
        { error: "Invalid or expired token", code: "INVALID_TOKEN" },
        { status: 401 }
      );
    }
    // Redirect to login, clearing the bad cookie
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: [
    // Match all API routes except static files and _next
    "/api/:path*",
    // Match all dashboard routes
    "/dashboard/:path*",
  ],
};
