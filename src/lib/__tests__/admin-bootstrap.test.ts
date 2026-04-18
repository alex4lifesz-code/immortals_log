import { describe, expect, it } from "vitest";
import { resolveSelfServeRegistrationRole } from "@/lib/auth/admin-bootstrap";

describe("resolveSelfServeRegistrationRole", () => {
  it("grants admin when no users exist yet", () => {
    expect(resolveSelfServeRegistrationRole([])).toBe("admin");
  });

  it("grants admin when only system users exist", () => {
    expect(resolveSelfServeRegistrationRole(["system"])).toBe("admin");
  });

  it("grants admin when there is still no admin account", () => {
    expect(resolveSelfServeRegistrationRole(["system", "user"])).toBe("admin");
  });

  it("returns user once an admin already exists", () => {
    expect(resolveSelfServeRegistrationRole(["system", "admin", "user"])).toBe("user");
  });
});
