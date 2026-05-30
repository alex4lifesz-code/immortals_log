import { prisma } from "@/lib/prisma";

export const ARCHIVED_TARGET_GROUP = "__archived__";

export type UpsertExerciseInput = {
  name: string;
  wuxiaName: string | null;
  difficulty: string;
  type: string;
  story?: string;
  targetGroup?: string;
};

export async function getActiveExercisesWithTranslations() {
  return prisma.exercise.findMany({
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
}

export async function findArchivedExerciseByName(name: string) {
  const archivedCandidates = await prisma.exercise.findMany({
    where: { targetGroup: ARCHIVED_TARGET_GROUP },
  });

  return (
    archivedCandidates.find((exercise) => exercise.name.toLowerCase() === name.toLowerCase()) ?? null
  );
}

export async function upsertExerciseFromArchivedMatch(
  archivedId: string | null,
  input: UpsertExerciseInput,
) {
  if (archivedId) {
    return prisma.exercise.update({
      where: { id: archivedId },
      data: {
        wuxiaName: input.wuxiaName,
        difficulty: input.difficulty,
        type: input.type,
        story: input.story,
        targetGroup: input.targetGroup ?? null,
      },
    });
  }

  return prisma.exercise.create({
    data: {
      name: input.name,
      wuxiaName: input.wuxiaName,
      difficulty: input.difficulty,
      type: input.type,
      story: input.story,
      targetGroup: input.targetGroup,
    },
  });
}

export async function upsertExerciseTranslation(input: {
  id: string;
  englishName: string;
  vietnameseName: string;
  englishStory: string | null;
  vietnameseStory: string | null;
  englishDifficulty: string;
  vietnameseDifficulty: string;
  englishType: string;
  vietnameseType: string;
}) {
  return prisma.exerciseTranslation.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      englishName: input.englishName,
      vietnameseName: input.vietnameseName,
      englishStory: input.englishStory,
      vietnameseStory: input.vietnameseStory,
      englishDifficulty: input.englishDifficulty,
      vietnameseDifficulty: input.vietnameseDifficulty,
      englishType: input.englishType,
      vietnameseType: input.vietnameseType,
    },
    update: {
      englishName: input.englishName,
      vietnameseName: input.vietnameseName,
      englishStory: input.englishStory,
      englishDifficulty: input.englishDifficulty,
      englishType: input.englishType,
    },
  });
}

export async function deleteNonArchivedExercises() {
  return prisma.exercise.deleteMany({
    where: {
      NOT: {
        targetGroup: ARCHIVED_TARGET_GROUP,
      },
    },
  });
}
