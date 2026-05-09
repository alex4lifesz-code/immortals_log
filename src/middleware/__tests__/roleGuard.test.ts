// src/middleware/__tests__/roleGuard.test.ts

import { describe, it, expect } from "vitest";
import { enforceRole } from "../roleGuard";
import type { MiddlewareContext, JwtPayload } from "../types";

function mockAuth(role: string): JwtPayload {
  return {
    userId: "user-1",
    username: "testuser",
    name: "Test",
    role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
}

function mockCtx(
  pathname: string,
  role: string | null
): MiddlewareContext {
  return {
    request: {
      nextUrl: { pathname },
      url: "http://localhost:3000" + pathname,
    } as unknown as MiddlewareContext["request"],
    route: "protected-dashboard",
    token: "dummy",
    auth: role ? mockAuth(role) : null,
  };
}

describe("enforceRole", () => {
  it("allows admin to access admin routes", () => {
    const result = enforceRole(mockCtx("/dashboard/attendance", "admin"));
    expect(result).toBeNull();
  });

  it("redirects non-admin from /dashboard/attendance", () => {
    const result = enforceRole(mockCtx("/dashboard/attendance", "user"));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(307);
  });

  it("redirects non-admin from /dashboard/checkin", () => {
    const result = enforceRole(mockCtx("/dashboard/checkin", "user"));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(307);
  });

  it("redirects non-admin from /dashboard/website-information", () => {
    const result = enforceRole(
      mockCtx("/dashboard/website-information", "user")
    );
    expect(result).not.toBeNull();
  });

  it("allows any user to access non-admin routes", () => {
    const result = enforceRole(mockCtx("/dashboard/train", "user"));
    expect(result).toBeNull();
  });

  it("allows any user to access /dashboard/check-in", () => {
    const result = enforceRole(mockCtx("/dashboard/check-in", "user"));
    expect(result).toBeNull();
  });

  it("returns null when route is not dashboard", () => {
    const ctx: MiddlewareContext = {
      request: {
        nextUrl: { pathname: "/api/checkins" },
        url: "http://localhost:3000/api/checkins",
      } as unknown as MiddlewareContext["request"],
      route: "protected-api",
      token: "dummy",
      auth: mockAuth("user"),
    };
    const result = enforceRole(ctx);
    expect(result).toBeNull();
  });

  it("returns null when auth is null", () => {
    const result = enforceRole(mockCtx("/dashboard/attendance", null));
    expect(result).toBeNull();
  });

  it("blocks nested admin routes like /dashboard/attendance/sub", () => {
    const result = enforceRole(
      mockCtx("/dashboard/attendance/some-subpage", "user")
    );
    expect(result).not.toBeNull();
  });
});
