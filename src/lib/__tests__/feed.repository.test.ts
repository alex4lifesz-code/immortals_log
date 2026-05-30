import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findMany: vi.fn() },
    progressionExercise: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { getAllUserIdsForFeed, getFeedExercisesForUsers, getFeedUsersByIds } from "@/lib/repositories/feed.repository";

describe("feed.repository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all user ids", async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([{ id: "u1" }, { id: "u2" }]);

    const ids = await getAllUserIdsForFeed();

    expect(ids).toEqual(["u1", "u2"]);
  });

  it("loads feed exercises for users", async () => {
    prismaMock.progressionExercise.findMany.mockResolvedValueOnce([{ id: "ex1" }]);

    const result = await getFeedExercisesForUsers(["u1"]);

    expect(prismaMock.progressionExercise.findMany).toHaveBeenCalled();
    expect(result).toEqual([{ id: "ex1" }]);
  });

  it("loads feed users by ids", async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([{ id: "u1", name: "Hero" }]);

    const users = await getFeedUsersByIds(["u1"]);

    expect(users).toEqual([{ id: "u1", name: "Hero" }]);
  });
});
