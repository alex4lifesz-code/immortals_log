import { prisma } from "@/lib/prisma";

export async function getVisibleProgressionExercises(params: {
  libraryOwnerId: string;
  userId: string;
}) {
  return prisma.progressionExercise.findMany({
    where: {
      OR: [
        { userId: params.libraryOwnerId },
        { userId: params.userId },
        { userProgress: { some: { userId: params.userId } } },
      ],
    },
    include: {
      tiers: {
        orderBy: { level: "asc" },
      },
      variations: true,
      modifiers: true,
      userProgress: {
        where: { userId: params.userId },
        include: {
          logs: { orderBy: { createdAt: "desc" } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteUserProgressionLevels(userId: string) {
  return prisma.userProgressionLevel.deleteMany({ where: { userId } });
}

export async function findProgressionForUser(exerciseId: string, userId: string) {
  return prisma.progressionExercise.findFirst({
    where: {
      id: exerciseId,
      OR: [{ userId }, { userProgress: { some: { userId } } }],
    },
    include: {
      tiers: {
        orderBy: { level: "asc" },
      },
      variations: true,
      modifiers: true,
      userProgress: {
        where: { userId },
        include: {
          logs: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  });
}

export async function findProgressionById(exerciseId: string) {
  return prisma.progressionExercise.findUnique({ where: { id: exerciseId } });
}

export async function deleteProgressionById(exerciseId: string) {
  return prisma.progressionExercise.delete({ where: { id: exerciseId } });
}

export async function getProgressionHistoryPage(params: {
  where: unknown;
  userId: string;
  logLimit: number;
  take: number;
}) {
  return prisma.progressionExercise.findMany({
    where: params.where as never,
    select: {
      id: true,
      name: true,
      wuxiaName: true,
      difficulty: true,
      wuxiaDifficulty: true,
      type: true,
      wuxiaType: true,
      story: true,
      tips: true,
      category: true,
      equipmentType: true,
      bodyweight: true,
      weighted: true,
      rings: true,
      primaryMuscles: true,
      secondaryMuscles: true,
      assignedDays: true,
      createdAt: true,
      tiers: {
        select: {
          id: true,
          level: true,
          name: true,
          wuxiaName: true,
          difficulty: true,
          wuxiaDifficulty: true,
          wuxiaType: true,
          description: true,
          targetHold: true,
          targetReps: true,
          targetRepsText: true,
        },
        orderBy: { level: "asc" },
      },
      variations: {
        select: {
          id: true,
          name: true,
          wuxiaName: true,
          difficulty: true,
          description: true,
          wuxiaDifficulty: true,
          wuxiaType: true,
        },
      },
      modifiers: {
        select: {
          id: true,
          type: true,
          available: true,
          difficultyMod: true,
          notes: true,
        },
      },
      userProgress: {
        where: { userId: params.userId },
        select: {
          id: true,
          currentLevel: true,
          logs: {
            select: {
              id: true,
              level: true,
              weight1: true,
              reps1: true,
              weight2: true,
              reps2: true,
              weight3: true,
              reps3: true,
              holdTime: true,
              holdTime2: true,
              holdTime3: true,
              reps: true,
              modifier: true,
              variant: true,
              setupOption: true,
              notes: true,
              completed: true,
              createdAt: true,
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: params.logLimit,
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: params.take,
  });
}

export async function findProgressionLogWithOwner(logId: string) {
  return prisma.progressionLog.findUnique({
    where: { id: logId },
    include: { userProgression: true },
  });
}

export async function deleteProgressionLogById(logId: string) {
  return prisma.progressionLog.delete({ where: { id: logId } });
}

export async function getProgressionLogsForUserExport(userId: string) {
  return prisma.progressionLog.findMany({
    where: {
      userProgression: { userId },
    },
    include: {
      userProgression: {
        include: {
          exercise: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getExerciseHistoryLogsPage(params: {
  userId: string;
  exerciseId: string;
  progressionLevel: number | null;
  cursor: { createdAt: Date; id: string } | null;
  take: number;
}) {
  return prisma.progressionLog.findMany({
    where: {
      userProgression: {
        userId: params.userId,
        exerciseId: params.exerciseId,
      },
      ...(params.progressionLevel != null && Number.isFinite(params.progressionLevel) && params.progressionLevel > 0
        ? { level: params.progressionLevel }
        : {}),
      ...(params.cursor
        ? {
            OR: [
              { createdAt: { lt: params.cursor.createdAt } },
              {
                createdAt: params.cursor.createdAt,
                id: { lt: params.cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: params.take,
  });
}

export async function findProgressionLogsWithOwnerByIds(logIds: string[]) {
  return prisma.progressionLog.findMany({
    where: { id: { in: logIds } },
    include: { userProgression: true },
  });
}

export async function findProgressionExerciseLightById(exerciseId: string) {
  return prisma.progressionExercise.findUnique({
    where: { id: exerciseId },
    select: { id: true, story: true },
  });
}

export async function upsertUserProgressionForExercise(params: {
  userId: string;
  exerciseId: string;
  currentLevel: number;
}) {
  return prisma.userProgressionLevel.upsert({
    where: {
      userId_exerciseId: {
        userId: params.userId,
        exerciseId: params.exerciseId,
      },
    },
    update: {},
    create: {
      userId: params.userId,
      exerciseId: params.exerciseId,
      currentLevel: params.currentLevel,
    },
    select: { id: true },
  });
}

export async function updateProgressionLogById(
  logId: string,
  data: {
    userProgressionId?: string;
    level?: number;
    weight1: number | null;
    reps1: number | null;
    weight2: number | null;
    reps2: number | null;
    weight3: number | null;
    reps3: number | null;
    holdTime: number | null;
    holdTime2: number | null;
    holdTime3: number | null;
    modifier: string | null;
    variant: string | null;
    setupOption: string | null;
    notes: string | null;
  },
) {
  return prisma.progressionLog.update({
    where: { id: logId },
    data: {
      userProgressionId: data.userProgressionId,
      level: data.level,
      weight1: data.weight1,
      reps1: data.reps1,
      weight2: data.weight2,
      reps2: data.reps2,
      weight3: data.weight3,
      reps3: data.reps3,
      holdTime: data.holdTime,
      holdTime2: data.holdTime2,
      holdTime3: data.holdTime3,
      modifier: data.modifier,
      variant: data.variant,
      setupOption: data.setupOption,
      notes: data.notes,
    },
  });
}

export async function deleteProgressionLogsByUser(userId: string) {
  return prisma.progressionLog.deleteMany({
    where: { userProgression: { userId } },
  });
}

export async function findProgressionExercisesForImportByUser(userId: string) {
  return prisma.progressionExercise.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      wuxiaName: true,
      difficulty: true,
      wuxiaDifficulty: true,
      wuxiaType: true,
      tiers: { select: { level: true } },
      variations: { select: { name: true, wuxiaName: true } },
    },
  });
}

export async function findSourceProgressionExercisesForImportByIds(ids: string[]) {
  return prisma.progressionExercise.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      wuxiaName: true,
      difficulty: true,
      wuxiaDifficulty: true,
      type: true,
      wuxiaType: true,
      story: true,
      category: true,
      equipmentType: true,
      bodyweight: true,
      weighted: true,
      rings: true,
      primaryMuscles: true,
      secondaryMuscles: true,
    },
  });
}

export async function findLibraryExercisesForImport() {
  return prisma.exercise.findMany({
    select: {
      id: true,
      name: true,
      wuxiaName: true,
      difficulty: true,
      type: true,
      story: true,
      targetGroup: true,
    },
  });
}

export async function findUserProgressionLevelsForImport(userId: string) {
  return prisma.userProgressionLevel.findMany({
    where: { userId },
    select: { id: true, exerciseId: true, currentLevel: true },
  });
}

export async function createProgressionExerciseForImport(data: {
  userId: string;
  name: string;
  wuxiaName: string;
  difficulty: string;
  wuxiaDifficulty: string;
  type: string;
  wuxiaType: string;
  story: string;
  category: string;
  equipmentType: string;
  bodyweight: boolean;
  weighted: boolean;
  rings: boolean;
  primaryMuscles: string;
  secondaryMuscles: string;
}) {
  return prisma.progressionExercise.create({
    data,
    select: { id: true, name: true, wuxiaName: true, difficulty: true, wuxiaDifficulty: true, wuxiaType: true },
  });
}

export async function createProgressionTierForImport(data: {
  exerciseId: string;
  level: number;
  name: string;
  wuxiaName: string;
  difficulty: string;
  wuxiaDifficulty: string;
  wuxiaType: string;
}) {
  return prisma.progressionTier.create({ data });
}

export async function createProgressionVariationForImport(data: {
  exerciseId: string;
  name: string;
  wuxiaName: string;
  difficulty: string;
  wuxiaDifficulty: string;
  wuxiaType: string;
  description: string;
}) {
  return prisma.progressionVariation.create({ data });
}

export async function createUserProgressionLevelForImport(data: {
  userId: string;
  exerciseId: string;
  currentLevel: number;
}) {
  return prisma.userProgressionLevel.create({
    data,
    select: { id: true, currentLevel: true },
  });
}

export async function updateUserProgressionLevelCurrentById(id: string, currentLevel: number) {
  return prisma.userProgressionLevel.update({
    where: { id },
    data: { currentLevel },
  });
}

export async function createManyProgressionLogs(data: Array<{
  userProgressionId: string;
  level: number;
  weight1: number | null;
  reps1: number | null;
  weight2: number | null;
  reps2: number | null;
  weight3: number | null;
  reps3: number | null;
  holdTime: number | null;
  holdTime2: number | null;
  holdTime3: number | null;
  modifier: string | null;
  variant: string | null;
  setupOption: string | null;
  notes: string | null;
  completed: boolean;
  createdAt: Date;
}>) {
  return prisma.progressionLog.createMany({ data });
}
