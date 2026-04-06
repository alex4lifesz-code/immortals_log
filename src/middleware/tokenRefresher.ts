// src/middleware/tokenRefresher.ts — Sliding-window JWT refresh

import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import type { MiddlewareContext } from "./types";
import { isProtectedRoute } from "./routeClassifier";
import { getJwtSecret, shouldUseSecureCookie, COOKIE_NAME } from "./cookieUtils";

/** Fraction of lifetime remaining below which we refresh the token */
const REFRESH_THRESHOLD = 0.25;

/**
 * If the JWT is valid but nearing expiry (< 25% of total lifetime remaining),
 * re-sign it with a fresh expiration and set the new cookie on the response.
 *
 * Returns a NextResponse with the refreshed cookie, or null to continue with
 * the default NextResponse.next().
 *
 * Must run after jwtValidator (ctx.auth is populated).
 */
export async function refreshTokenIfNeeded(
  ctx: MiddlewareContext
): Promise<NextResponse | null> {
  if (!isProtectedRoute(ctx.route) || !ctx.auth) {
    return null;
  }

  const { exp, iat } = ctx.auth;
  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = exp - now;
  const totalLifetime = exp - iat;

  // Only refresh if token is still valid but nearing expiry
  if (totalLifetime <= 0 || timeUntilExpiry <= 0) {
    return null;
  }

  if (timeUntilExpiry >= totalLifetime * REFRESH_THRESHOLD) {
    return null; // plenty of time left
  }

  // Re-sign with the same lifetime
  const newToken = await new SignJWT({
    userId: ctx.auth.userId,
    username: ctx.auth.username,
    name: ctx.auth.name,
    role: ctx.auth.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${totalLifetime}s`)
    .sign(getJwtSecret());

  const response = NextResponse.next();
  const isSecure = shouldUseSecureCookie(ctx.request);

  const cookieParts = [
    `${COOKIE_NAME}=${newToken}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${totalLifetime}`,
  ];
  if (isSecure) cookieParts.push("Secure");

  response.headers.append("Set-Cookie", cookieParts.join("; "));
  return response;
}
