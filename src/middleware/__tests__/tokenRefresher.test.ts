// src/middleware/__tests__/tokenRefresher.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock jose
vi.mock("jose", () => {
  const mockSign = vi.fn().mockResolvedValue("new-refreshed-token");
  class MockSignJWT {
    constructor(_payload: Record<string, unknown>) {}
    setProtectedHeader() { return this; }
    setIssuedAt() { return this; }
    setExpirationTime() { return this; }
    sign = mockSign;
  }
  return { SignJWT: MockSignJWT };
});

import { refreshTokenIfNeeded } from "../tokenRefresher";
import type { MiddlewareContext, JwtPayload } from "../types";

function mockCtx(
  route: MiddlewareContext["route"],
  iat: number,
  exp: number
): MiddlewareContext {
  return {
    request: {
      nextUrl: { pathname: "/dashboard/train", protocol: "http:" },
      url: "http://localhost:3000/dashboard/train",
      headers: {
        get: () => null,
      },
    } as unknown as MiddlewareContext["request"],
    route,
    token: "old-token",
    auth: {
      userId: "u1",
      username: "hero",
      name: "Hero",
      role: "user",
      iat,
      exp,
    },
  };
}

beforeEach(() => {
  process.env.JWT_SECRET = "test-secret";
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.JWT_SECRET;
});

describe("refreshTokenIfNeeded", () => {
  it("returns null for non-protected routes", async () => {
    const now = Math.floor(Date.now() / 1000);
    const ctx = mockCtx("public-api", now, now + 86400);
    ctx.route = "public-api";
    const result = await refreshTokenIfNeeded(ctx);
    expect(result).toBeNull();
  });

  it("returns null when auth is null", async () => {
    const ctx = mockCtx("protected-dashboard", 0, 0);
    ctx.auth = null;
    const result = await refreshTokenIfNeeded(ctx);
    expect(result).toBeNull();
  });

  it("returns null when token has plenty of time left", async () => {
    const now = Math.floor(Date.now() / 1000);
    // Token issued now, expires in 24h → 100% remaining
    const ctx = mockCtx("protected-dashboard", now, now + 86400);
    const result = await refreshTokenIfNeeded(ctx);
    expect(result).toBeNull();
  });

  it("returns null when 50% of lifetime remaining", async () => {
    const now = Math.floor(Date.now() / 1000);
    // Token issued 12h ago, expires in 12h → 50% remaining
    const ctx = mockCtx("protected-dashboard", now - 43200, now + 43200);
    const result = await refreshTokenIfNeeded(ctx);
    expect(result).toBeNull();
  });

  it("refreshes token when < 25% of lifetime remaining", async () => {
    const now = Math.floor(Date.now() / 1000);
    // Token issued 20h ago, expires in 4h → ~16.7% remaining
    const ctx = mockCtx("protected-dashboard", now - 72000, now + 14400);
    const result = await refreshTokenIfNeeded(ctx);
    expect(result).not.toBeNull();
    // Should have Set-Cookie header with refreshed token
    const setCookie = result!.headers.get("set-cookie");
    expect(setCookie).toContain("auth-token=");
    expect(setCookie).toContain("HttpOnly");
  });

  it("returns null when token is already expired", async () => {
    const now = Math.floor(Date.now() / 1000);
    // Token expired 1 hour ago
    const ctx = mockCtx("protected-dashboard", now - 86400, now - 3600);
    const result = await refreshTokenIfNeeded(ctx);
    expect(result).toBeNull();
  });
});
