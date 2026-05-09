// src/middleware/__tests__/legacyRedirects.test.ts

import { describe, it, expect } from "vitest";
import { handleLegacyRedirects } from "../legacyRedirects";
import type { MiddlewareContext } from "../types";

function mockCtx(pathname: string): MiddlewareContext {
  const url = new URL(pathname, "http://localhost:3000");
  return {
    request: {
      nextUrl: {
        pathname,
        clone() {
          return new URL(pathname, "http://localhost:3000");
        },
      },
      url: url.toString(),
    } as unknown as MiddlewareContext["request"],
    route: "protected-dashboard",
    token: null,
    auth: null,
  };
}

describe("handleLegacyRedirects", () => {
  it("redirects /dashboard/workout-history to /dashboard/train", () => {
    const result = handleLegacyRedirects(mockCtx("/dashboard/workout-history"));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(307);
  });

  it("does not redirect nested workout-history edit routes", () => {
    const result = handleLegacyRedirects(
      mockCtx("/dashboard/workout-history/input/abc")
    );
    expect(result).toBeNull();
  });

  it("does not redirect canonical routes", () => {
    const result = handleLegacyRedirects(mockCtx("/dashboard/train"));
    expect(result).toBeNull();
  });

  it("does not redirect /dashboard/check-in", () => {
    const result = handleLegacyRedirects(mockCtx("/dashboard/check-in"));
    expect(result).toBeNull();
  });

  it("returns null for non-dashboard routes", () => {
    const ctx: MiddlewareContext = {
      request: {
        nextUrl: { pathname: "/api/health" },
        url: "http://localhost:3000/api/health",
      } as unknown as MiddlewareContext["request"],
      route: "public-api",
      token: null,
      auth: null,
    };
    const result = handleLegacyRedirects(ctx);
    expect(result).toBeNull();
  });
});
