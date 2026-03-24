// src/lib/auth/index.ts — Core JWT authentication functions

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import type { AuthPayload, AuthContext, UserInfo } from "./types";
import { AuthError } from "./types";

const COOKIE_NAME = "auth-token";

function parseBooleanEnv(value: string | undefined): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  return null;
}

function shouldUseSecureCookie(request?: Request): boolean {
  const explicit = parseBooleanEnv(process.env.COOKIE_SECURE);
  if (explicit !== null) {
    return explicit;
  }

  if (request) {
    const forwardedProto = request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      .trim()
      .toLowerCase();

    if (forwardedProto === "https") {
      return true;
    }
    if (forwardedProto === "http") {
      return false;
    }

    try {
      return new URL(request.url).protocol === "https:";
    } catch {
      // Fall through to app URL / environment-based fallback.
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  if (appUrl) {
    try {
      return new URL(appUrl).protocol === "https:";
    } catch {
      // Invalid URL should not crash auth cookie setup.
    }
  }

  return process.env.NODE_ENV === "production";
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET environment variable is required. " +
        "Generate one with: openssl rand -base64 32"
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Create a signed JWT for the given user.
 * @param user - Basic user info to encode in the token
 * @param rememberMe - If true, token expires in 7 days; otherwise 24 hours
 */
export async function createToken(
  user: UserInfo,
  rememberMe: boolean
): Promise<string> {
  const expiresIn = rememberMe ? "7d" : "24h";

  const token = await new SignJWT({
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  } satisfies Omit<AuthPayload, "iat" | "exp">)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getJwtSecret());

  return token;
}

/**
 * Verify and decode a JWT token.
 * @returns The decoded auth payload, or null if invalid/expired
 */
export async function verifyToken(
  token: string
): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());

    const p = payload as JWTPayload & Partial<AuthPayload>;
    if (!p.userId || !p.username || !p.role) {
      return null;
    }

    return {
      userId: p.userId,
      username: p.username,
      name: p.name ?? "",
      role: p.role,
      iat: typeof p.iat === "number" ? p.iat : 0,
      exp: typeof p.exp === "number" ? p.exp : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Extract and verify auth from a Request's cookie header.
 * Works in API route handlers.
 */
export async function getAuthFromRequest(
  request: Request
): Promise<AuthContext | null> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`)
  );
  if (!match) return null;

  const token = match[1];
  const payload = await verifyToken(token);
  if (!payload) return null;

  return {
    userId: payload.userId,
    username: payload.username,
    name: payload.name,
    role: payload.role,
  };
}

/**
 * Extract and verify auth from cookies (server component version).
 * Uses next/headers which is only available in server components and route handlers.
 */
export async function getAuthFromCookies(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get(COOKIE_NAME);
  if (!tokenCookie?.value) return null;

  const payload = await verifyToken(tokenCookie.value);
  if (!payload) return null;

  return {
    userId: payload.userId,
    username: payload.username,
    name: payload.name,
    role: payload.role,
  };
}

/**
 * Require authentication. Throws AuthError(401) if not authenticated.
 * Use in API route handlers.
 */
export async function requireAuth(request: Request): Promise<AuthContext> {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    throw AuthError.unauthorized();
  }
  return auth;
}

/**
 * Require admin role. Throws AuthError(403) if not admin.
 * Use in API route handlers.
 */
export async function requireAdmin(request: Request): Promise<AuthContext> {
  const auth = await requireAuth(request);
  if (auth.role !== "admin") {
    throw AuthError.forbidden("Admin access required");
  }
  return auth;
}

/**
 * Set the auth cookie on a NextResponse.
 * @param response - The response to add the cookie to
 * @param token - The JWT token string
 * @param rememberMe - If true, cookie persists for 7 days; otherwise session cookie
 */
export function setAuthCookie(
  response: Response,
  token: string,
  rememberMe: boolean,
  request?: Request
): void {
  const maxAge = rememberMe ? 7 * 24 * 60 * 60 : 24 * 60 * 60;
  const isSecure = shouldUseSecureCookie(request);

  // Build Set-Cookie header value
  const parts = [
    `${COOKIE_NAME}=${token}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAge}`,
  ];

  if (isSecure) {
    parts.push("Secure");
  }

  response.headers.append("Set-Cookie", parts.join("; "));
}

/**
 * Clear the auth cookie on a response (for logout).
 */
export function clearAuthCookie(response: Response): void {
  const parts = [
    `${COOKIE_NAME}=`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=0`,
  ];

  response.headers.append("Set-Cookie", parts.join("; "));
}

/**
 * Get the raw token string from a request's cookies.
 * Useful for the Next.js middleware where we need the raw token.
 */
export function getTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`)
  );
  return match ? match[1] : null;
}

export { COOKIE_NAME };
