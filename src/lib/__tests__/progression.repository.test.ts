import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    progressionExercise: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    userProgressionLevel: {
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
    progressionLog: {
      findUnique: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import {
  deleteProgressionById,
  deleteUserProgressionLevels,
  findProgressionById,
  findProgressionLogWithOwner,
  updateProgressionLogById,
} from "@/lib/repositories/progression.repository";

describe("progression.repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes progression levels by user", async () => {
    prismaMock.userProgressionLevel.deleteMany.mockResolvedValueOnce({ count: 2 });

    const result = await deleteUserProgressionLevels("u1");

    expect(prismaMock.userProgressionLevel.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(result).toEqual({ count: 2 });
  });

  it("loads progression by id", async () => {
    prismaMock.progressionExercise.findUnique.mockResolvedValueOnce({ id: "ex-1" });

    const result = await findProgressionById("ex-1");

    expect(prismaMock.progressionExercise.findUnique).toHaveBeenCalledWith({ where: { id: "ex-1" } });
    expect(result).toEqual({ id: "ex-1" });
  });

  it("loads log with ownership info and updates log", async () => {
    prismaMock.progressionLog.findUnique.mockResolvedValueOnce({ id: "log-1" });
    prismaMock.progressionLog.update.mockResolvedValueOnce({ id: "log-1" });

    const log = await findProgressionLogWithOwner("log-1");
    const updated = await updateProgressionLogById("log-1", {
      weight1: null,
      reps1: null,
      weight2: null,
      reps2: null,
      weight3: null,
      reps3: null,
      holdTime: null,
      holdTime2: null,
      holdTime3: null,
      modifier: null,
      variant: null,
      setupOption: null,
      notes: null,
    });

    expect(log).toEqual({ id: "log-1" });
    expect(updated).toEqual({ id: "log-1" });
    expect(prismaMock.progressionLog.update).toHaveBeenCalled();
  });

  it("deletes progression exercise by id", async () => {
    prismaMock.progressionExercise.delete.mockResolvedValueOnce({ id: "ex-2" });

    const result = await deleteProgressionById("ex-2");

    expect(prismaMock.progressionExercise.delete).toHaveBeenCalledWith({ where: { id: "ex-2" } });
    expect(result).toEqual({ id: "ex-2" });
  });
});
