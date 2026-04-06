// src/middleware/cookieUtils.ts — Shared cookie & environment helpers (Edge-compatible)

import type { NextRequest } from "next/server";

export const COOKIE_NAME = "auth-token";

export function parseBooleanEnv(value: string | undefined): boolean | null {
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

export function shouldUseSecureCookie(request: NextRequest): boolean {
  const explicit = parseBooleanEnv(process.env.COOKIE_SECURE);
  if (explicit !== null) {
    return explicit;
  }

  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim()
    .toLowerCase();

  if (forwardedProto === "https") return true;
  if (forwardedProto === "http") return false;

  const protocol = request.nextUrl.protocol;
  if (protocol) return protocol === "https:";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  if (appUrl) {
    try {
      return new URL(appUrl).protocol === "https:";
    } catch {
      // Invalid URL should not crash middleware.
    }
  }

  return process.env.NODE_ENV === "production";
}

export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return new TextEncoder().encode(secret);
}
