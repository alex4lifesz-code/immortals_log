import { describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRawUnsafe: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { checkDatabaseReachable } from "@/lib/repositories/system.repository";

describe("system.repository", () => {
  it("executes lightweight db connectivity query", async () => {
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ 1: 1 }]);

    await checkDatabaseReachable();

    expect(prismaMock.$queryRawUnsafe).toHaveBeenCalledWith("SELECT 1");
  });
});
