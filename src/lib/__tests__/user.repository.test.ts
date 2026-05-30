import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    userProgressionLevel: {
      findMany: vi.fn(),
    },
    userSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import {
  createUser,
  findUserByUsername,
  getUsersWithProgressionCounts,
  upsertUserSettings,
} from "@/lib/repositories/user.repository";

describe("user.repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds a user by username", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: "u1", username: "hero" });

    const user = await findUserByUsername("hero");

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { username: "hero" } });
    expect(user).toEqual({ id: "u1", username: "hero" });
  });

  it("creates user with selected fields", async () => {
    prismaMock.user.create.mockResolvedValueOnce({ id: "u2", username: "jade" });

    const created = await createUser({
      username: "jade",
      password: "hash",
      name: "Jade",
      role: "user",
      friendCode: "immortal0001",
    });

    expect(prismaMock.user.create).toHaveBeenCalled();
    expect(created).toEqual({ id: "u2", username: "jade" });
  });

  it("returns users and progression levels together", async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([{ id: "u1" }]);
    prismaMock.userProgressionLevel.findMany.mockResolvedValueOnce([{ userId: "u1" }]);

    const result = await getUsersWithProgressionCounts();

    expect(result).toEqual({
      users: [{ id: "u1" }],
      progressionLevels: [{ userId: "u1" }],
    });
  });

  it("upserts user settings with provided values", async () => {
    prismaMock.userSettings.upsert.mockResolvedValueOnce({ id: "s1" });

    await upsertUserSettings({
      userId: "u1",
      pinnedNavItems: "{}",
      hiddenNavItems: "{}",
      panelPosition: "left",
      dualPageView: false,
      combinedView: false,
    });

    expect(prismaMock.userSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1" },
      }),
    );
  });
});
