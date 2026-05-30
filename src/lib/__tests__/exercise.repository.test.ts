import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    exercise: {
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    exerciseTranslation: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import {
  ARCHIVED_TARGET_GROUP,
  deleteNonArchivedExercises,
  findArchivedExerciseByName,
  getActiveExercisesWithTranslations,
  upsertExerciseFromArchivedMatch,
  upsertExerciseTranslation,
} from "@/lib/repositories/exercise.repository";

describe("exercise.repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads active exercises with translations ordered by newest", async () => {
    prismaMock.exercise.findMany.mockResolvedValueOnce([]);

    await getActiveExercisesWithTranslations();

    expect(prismaMock.exercise.findMany).toHaveBeenCalledWith({
      where: {
        NOT: {
          targetGroup: ARCHIVED_TARGET_GROUP,
        },
      },
      include: {
        translation: true,
      },
      orderBy: { createdAt: "desc" },
    });
  });

  it("finds archived exercise by case-insensitive name", async () => {
    prismaMock.exercise.findMany.mockResolvedValueOnce([
      { id: "1", name: "Dragon Squat" },
      { id: "2", name: "Tiger Pushup" },
    ]);

    const result = await findArchivedExerciseByName("dragon squat");

    expect(result).toEqual({ id: "1", name: "Dragon Squat" });
  });

  it("updates archived exercise when archived id is provided", async () => {
    prismaMock.exercise.update.mockResolvedValueOnce({ id: "ex-1" });

    await upsertExerciseFromArchivedMatch("ex-1", {
      name: "Squat",
      wuxiaName: "Wuxia Squat",
      difficulty: "Beginner",
      type: "strength",
      story: "story",
      targetGroup: "legs",
    });

    expect(prismaMock.exercise.update).toHaveBeenCalled();
    expect(prismaMock.exercise.create).not.toHaveBeenCalled();
  });

  it("creates new exercise when archived id is missing", async () => {
    prismaMock.exercise.create.mockResolvedValueOnce({ id: "ex-2" });

    await upsertExerciseFromArchivedMatch(null, {
      name: "Squat",
      wuxiaName: null,
      difficulty: "Beginner",
      type: "strength",
    });

    expect(prismaMock.exercise.create).toHaveBeenCalled();
    expect(prismaMock.exercise.update).not.toHaveBeenCalled();
  });

  it("upserts translation row and supports bulk delete of non-archived exercises", async () => {
    prismaMock.exerciseTranslation.upsert.mockResolvedValueOnce({});
    prismaMock.exercise.deleteMany.mockResolvedValueOnce({ count: 3 });

    await upsertExerciseTranslation({
      id: "ex-3",
      englishName: "Lunge",
      vietnameseName: "Tan",
      englishStory: "story",
      vietnameseStory: "story",
      englishDifficulty: "Medium",
      vietnameseDifficulty: "Trung binh",
      englishType: "strength",
      vietnameseType: "suc manh",
    });
    const deleted = await deleteNonArchivedExercises();

    expect(prismaMock.exerciseTranslation.upsert).toHaveBeenCalled();
    expect(prismaMock.exercise.deleteMany).toHaveBeenCalledWith({
      where: {
        NOT: {
          targetGroup: ARCHIVED_TARGET_GROUP,
        },
      },
    });
    expect(deleted).toEqual({ count: 3 });
  });
});
