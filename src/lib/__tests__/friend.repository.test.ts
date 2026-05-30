import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    friendRequest: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    userProgressionLevel: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import {
  createFriendRequest,
  findAcceptedFriendRelation,
  getAcceptedFriendRows,
  getAllUserIds,
  isUniqueConstraintError,
  updateUserFriendCode,
} from "@/lib/repositories/friend.repository";

describe("friend.repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects unique constraint error code", () => {
    expect(isUniqueConstraintError({ code: "P2002" })).toBe(true);
    expect(isUniqueConstraintError({ code: "P2021" })).toBe(false);
  });

  it("loads accepted friend rows for a user", async () => {
    prismaMock.friendRequest.findMany.mockResolvedValueOnce([]);

    await getAcceptedFriendRows("u1");

    expect(prismaMock.friendRequest.findMany).toHaveBeenCalledWith({
      where: {
        status: "accepted",
        OR: [{ requesterId: "u1" }, { receiverId: "u1" }],
      },
      select: {
        requesterId: true,
        receiverId: true,
      },
    });
  });

  it("checks accepted relation between two users", async () => {
    prismaMock.friendRequest.findFirst.mockResolvedValueOnce({ id: "fr-1" });

    const result = await findAcceptedFriendRelation("u1", "u2");

    expect(prismaMock.friendRequest.findFirst).toHaveBeenCalled();
    expect(result).toEqual({ id: "fr-1" });
  });

  it("updates user friend code and creates pending friend request", async () => {
    prismaMock.user.update.mockResolvedValueOnce({ id: "u1", friendCode: "immortal0001" });
    prismaMock.friendRequest.create.mockResolvedValueOnce({ id: "fr-2" });

    const updated = await updateUserFriendCode("u1", "immortal0001");
    const created = await createFriendRequest("u1", "u2");

    expect(updated).toEqual({ id: "u1", friendCode: "immortal0001" });
    expect(prismaMock.friendRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          requesterId: "u1",
          receiverId: "u2",
          status: "pending",
        },
      }),
    );
    expect(created).toEqual({ id: "fr-2" });
  });

  it("returns user id list from getAllUserIds", async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([{ id: "u1" }, { id: "u2" }]);

    const ids = await getAllUserIds();

    expect(ids).toEqual(["u1", "u2"]);
  });
});
