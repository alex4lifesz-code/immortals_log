import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findMany: vi.fn() },
    checkIn: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    progressionLog: { findMany: vi.fn() },
    checkInNote: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import {
  findLatestWeightByUserId,
  getAllUserIdsForCheckins,
  getCheckinsAndWorkoutLogsForUsers,
} from "@/lib/repositories/checkin.repository";

describe("checkin.repository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns user ids for checkin visibility fallback", async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([{ id: "u1" }, { id: "u2" }]);

    const ids = await getAllUserIdsForCheckins();

    expect(ids).toEqual(["u1", "u2"]);
  });

  it("loads checkins and workout logs for user ids", async () => {
    prismaMock.checkIn.findMany.mockResolvedValueOnce([{ id: "c1" }]);
    prismaMock.progressionLog.findMany.mockResolvedValueOnce([{ id: "l1" }]);

    const result = await getCheckinsAndWorkoutLogsForUsers(["u1"]);

    expect(result).toEqual({ checkins: [{ id: "c1" }], workoutLogs: [{ id: "l1" }] });
  });

  it("loads latest weight for a user", async () => {
    prismaMock.checkIn.findFirst.mockResolvedValueOnce({ weight: 70, date: new Date("2026-01-01") });

    const latest = await findLatestWeightByUserId("u1");

    expect(prismaMock.checkIn.findFirst).toHaveBeenCalled();
    expect(latest).toEqual({ weight: 70, date: new Date("2026-01-01") });
  });
});
