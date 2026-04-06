// src/middleware/__tests__/cookieUtils.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseBooleanEnv, getJwtSecret } from "../cookieUtils";

describe("parseBooleanEnv", () => {
  it("returns null for undefined", () => {
    expect(parseBooleanEnv(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseBooleanEnv("")).toBeNull();
  });

  it("returns true for 'true'", () => {
    expect(parseBooleanEnv("true")).toBe(true);
  });

  it("returns true for '1'", () => {
    expect(parseBooleanEnv("1")).toBe(true);
  });

  it("returns true for 'YES' (case insensitive)", () => {
    expect(parseBooleanEnv("YES")).toBe(true);
  });

  it("returns false for 'false'", () => {
    expect(parseBooleanEnv("false")).toBe(false);
  });

  it("returns false for '0'", () => {
    expect(parseBooleanEnv("0")).toBe(false);
  });

  it("returns false for 'no'", () => {
    expect(parseBooleanEnv("no")).toBe(false);
  });

  it("returns null for unrecognized values", () => {
    expect(parseBooleanEnv("maybe")).toBeNull();
  });

  it("trims whitespace", () => {
    expect(parseBooleanEnv("  true  ")).toBe(true);
  });
});

describe("getJwtSecret", () => {
  const originalEnv = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.JWT_SECRET = originalEnv;
    } else {
      delete process.env.JWT_SECRET;
    }
  });

  it("returns Uint8Array when JWT_SECRET is set", () => {
    process.env.JWT_SECRET = "test-secret-key";
    const result = getJwtSecret();
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it("throws when JWT_SECRET is missing", () => {
    delete process.env.JWT_SECRET;
    expect(() => getJwtSecret()).toThrow("JWT_SECRET");
  });
});
