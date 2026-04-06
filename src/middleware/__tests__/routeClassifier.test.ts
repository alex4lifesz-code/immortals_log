// src/middleware/__tests__/routeClassifier.test.ts

import { describe, it, expect } from "vitest";
import { classifyRoute, isPublicRoute, isProtectedRoute, isApiRoute, isDashboardRoute } from "../routeClassifier";
import type { MiddlewareContext } from "../types";

/** Minimal mock of NextRequest for route classification */
function mockCtx(pathname: string, cookieValue?: string): MiddlewareContext {
  const cookies = {
    get: (name: string) =>
      name === "auth-token" && cookieValue
        ? { value: cookieValue }
        : undefined,
  };

  return {
    request: {
      nextUrl: { pathname },
      cookies,
    } as any,
    route: "unmatched",
    token: null,
    auth: null,
  };
}

describe("classifyRoute", () => {
  it("classifies public API routes", () => {
    const ctx = mockCtx("/api/auth/login");
    classifyRoute(ctx);
    expect(ctx.route).toBe("public-api");
  });

  it("classifies /api/auth/register as public", () => {
    const ctx = mockCtx("/api/auth/register");
    classifyRoute(ctx);
    expect(ctx.route).toBe("public-api");
  });

  it("classifies /api/health as public", () => {
    const ctx = mockCtx("/api/health");
    classifyRoute(ctx);
    expect(ctx.route).toBe("public-api");
  });

  it("classifies protected API routes", () => {
    const ctx = mockCtx("/api/checkins");
    classifyRoute(ctx);
    expect(ctx.route).toBe("protected-api");
  });

  it("classifies /api/progressions/123 as protected API", () => {
    const ctx = mockCtx("/api/progressions/123");
    classifyRoute(ctx);
    expect(ctx.route).toBe("protected-api");
  });

  it("classifies dashboard root as protected dashboard", () => {
    const ctx = mockCtx("/dashboard");
    classifyRoute(ctx);
    expect(ctx.route).toBe("protected-dashboard");
  });

  it("classifies nested dashboard routes as protected dashboard", () => {
    const ctx = mockCtx("/dashboard/train/input/abc123");
    classifyRoute(ctx);
    expect(ctx.route).toBe("protected-dashboard");
  });

  it("classifies unknown routes as unmatched", () => {
    const ctx = mockCtx("/");
    classifyRoute(ctx);
    expect(ctx.route).toBe("unmatched");
  });

  it("classifies /about as unmatched", () => {
    const ctx = mockCtx("/about");
    classifyRoute(ctx);
    expect(ctx.route).toBe("unmatched");
  });

  it("extracts token from cookie when present", () => {
    const ctx = mockCtx("/dashboard/check-in", "my-jwt-token");
    classifyRoute(ctx);
    expect(ctx.token).toBe("my-jwt-token");
  });

  it("sets token to null when cookie is absent", () => {
    const ctx = mockCtx("/dashboard/check-in");
    classifyRoute(ctx);
    expect(ctx.token).toBeNull();
  });
});

describe("route type helpers", () => {
  it("isPublicRoute", () => {
    expect(isPublicRoute("public-api")).toBe(true);
    expect(isPublicRoute("public-page")).toBe(true);
    expect(isPublicRoute("unmatched")).toBe(true);
    expect(isPublicRoute("protected-api")).toBe(false);
    expect(isPublicRoute("protected-dashboard")).toBe(false);
  });

  it("isProtectedRoute", () => {
    expect(isProtectedRoute("protected-api")).toBe(true);
    expect(isProtectedRoute("protected-dashboard")).toBe(true);
    expect(isProtectedRoute("public-api")).toBe(false);
    expect(isProtectedRoute("unmatched")).toBe(false);
  });

  it("isApiRoute", () => {
    expect(isApiRoute("public-api")).toBe(true);
    expect(isApiRoute("protected-api")).toBe(true);
    expect(isApiRoute("protected-dashboard")).toBe(false);
  });

  it("isDashboardRoute", () => {
    expect(isDashboardRoute("protected-dashboard")).toBe(true);
    expect(isDashboardRoute("protected-api")).toBe(false);
  });
});
