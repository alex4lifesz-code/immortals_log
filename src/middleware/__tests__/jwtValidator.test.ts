// src/middleware/__tests__/jwtValidator.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock jose before importing the module under test
vi.mock("jose", () => ({
  jwtVerify: vi.fn(),
}));

import { validateJwt } from "../jwtValidator";
import { jwtVerify } from "jose";
import type { MiddlewareContext } from "../types";

const mockedJwtVerify = vi.mocked(jwtVerify);

function mockCtx(
  route: MiddlewareContext["route"],
  pathname: string,
  token: string | null
): MiddlewareContext {
  return {
    request: {
      nextUrl: { pathname },
      url: "http://localhost:3000" + pathname,
      cookies: {
        delete: vi.fn(),
      },
    } as unknown as MiddlewareContext["request"],
    route,
    token,
    auth: null,
  };
}

beforeEach(() => {
  process.env.JWT_SECRET = "test-secret";
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.JWT_SECRET;
});

describe("validateJwt", () => {
  it("skips public routes", async () => {
    const ctx = mockCtx("public-api", "/api/auth/login", null);
    const result = await validateJwt(ctx);
    expect(result).toBeNull();
    expect(mockedJwtVerify).not.toHaveBeenCalled();
  });

  it("skips unmatched routes", async () => {
    const ctx = mockCtx("unmatched", "/about", null);
    const result = await validateJwt(ctx);
    expect(result).toBeNull();
  });

  it("returns 401 for API route with no token", async () => {
    const ctx = mockCtx("protected-api", "/api/checkins", null);
    const result = await validateJwt(ctx);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("redirects dashboard route with no token to login", async () => {
    const ctx = mockCtx("protected-dashboard", "/dashboard/train", null);
    const result = await validateJwt(ctx);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(307); // redirect
  });

  it("populates ctx.auth on valid token", async () => {
    const now = Math.floor(Date.now() / 1000);
    mockedJwtVerify.mockResolvedValueOnce({
      payload: {
        userId: "u1",
        username: "hero",
        name: "Hero",
        role: "user",
        iat: now,
        exp: now + 86400,
      },
      protectedHeader: { alg: "HS256" },
    } as unknown as object);

    const ctx = mockCtx("protected-api", "/api/checkins", "valid-token");
    const result = await validateJwt(ctx);
    expect(result).toBeNull(); // continues pipeline
    expect(ctx.auth).not.toBeNull();
    expect(ctx.auth!.userId).toBe("u1");
    expect(ctx.auth!.role).toBe("user");
  });

  it("returns 401 for API route with invalid token", async () => {
    mockedJwtVerify.mockRejectedValueOnce(new Error("token expired"));

    const ctx = mockCtx("protected-api", "/api/friends", "bad-token");
    const result = await validateJwt(ctx);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("redirects dashboard with invalid token and clears cookie", async () => {
    mockedJwtVerify.mockRejectedValueOnce(new Error("token expired"));

    const ctx = mockCtx(
      "protected-dashboard",
      "/dashboard/check-in",
      "expired-token"
    );
    const result = await validateJwt(ctx);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(307); // redirect
  });

  it("rejects token missing userId", async () => {
    mockedJwtVerify.mockResolvedValueOnce({
      payload: { role: "user" },
      protectedHeader: { alg: "HS256" },
    } as unknown as object);

    const ctx = mockCtx("protected-api", "/api/checkins", "incomplete-token");
    const result = await validateJwt(ctx);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });
});
