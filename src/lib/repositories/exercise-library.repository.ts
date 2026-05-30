import { prisma } from "@/lib/prisma";

export async function findUserSettingsPinnedNav(userId: string) {
  return prisma.userSettings.findUnique({
    where: { userId },
    select: { pinnedNavItems: true, hiddenNavItems: true, panelPosition: true, dualPageView: true, combinedView: true },
  });
}

export async function upsertUserSettingsPinnedNav(params: {
  userId: string;
  pinnedNavItems: string;
  hiddenNavItems: string;
  panelPosition: string;
  dualPageView: boolean;
  combinedView: boolean;
}) {
  return prisma.userSettings.upsert({
    where: { userId: params.userId },
    create: {
      userId: params.userId,
      pinnedNavItems: params.pinnedNavItems,
      hiddenNavItems: params.hiddenNavItems,
      panelPosition: params.panelPosition,
      dualPageView: params.dualPageView,
      combinedView: params.combinedView,
    },
    update: {
      pinnedNavItems: params.pinnedNavItems,
    },
  });
}

export async function renameExerciseCategoriesForUser(userId: string, from: string, to: string) {
  return prisma.$executeRawUnsafe(
    `
      UPDATE ProgressionExercise
      SET category = ?
      WHERE userId = ?
        AND LOWER(TRIM(category)) = LOWER(TRIM(?))
    `,
    to,
    userId,
    from,
  );
}

export async function findExerciseMusclesByUser(userId: string) {
  return prisma.progressionExercise.findMany({
    where: { userId },
    select: { id: true, primaryMuscles: true, secondaryMuscles: true },
  });
}

export async function updateExerciseMusclesById(id: string, primaryMuscles: string, secondaryMuscles: string) {
  return prisma.progressionExercise.update({
    where: { id },
    data: { primaryMuscles, secondaryMuscles },
  });
}

export async function renameExerciseVariationsForUser(userId: string, from: string, to: string) {
  return prisma.$executeRawUnsafe(
    `
      UPDATE ProgressionVariation
      SET name = ?, wuxiaName = ?
      WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
        AND exerciseId IN (
          SELECT id
          FROM ProgressionExercise
          WHERE userId = ?
        )
    `,
    to,
    to,
    from,
    userId,
  );
}

export async function ensureExerciseEditHistoryTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ExerciseEditHistory (
      id TEXT PRIMARY KEY,
      exerciseId TEXT NOT NULL,
      exerciseName TEXT NOT NULL,
      userId TEXT NOT NULL,
      userName TEXT NOT NULL,
      field TEXT NOT NULL,
      beforeValue TEXT,
      afterValue TEXT,
      editedAt TEXT NOT NULL
    )
  `);

  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS idx_exercise_edit_history_editedAt ON ExerciseEditHistory(editedAt DESC)",
  );

  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS idx_exercise_edit_history_exerciseId ON ExerciseEditHistory(exerciseId)",
  );
}

export async function listExerciseEditHistoryExerciseIds() {
  return prisma.$queryRawUnsafe<Array<{ exerciseId: string }>>(`
    SELECT DISTINCT exerciseId
    FROM ExerciseEditHistory
  `);
}

export async function listProgressionExercisesForHistoryBackfill() {
  return prisma.progressionExercise.findMany({
    select: {
      id: true,
      name: true,
      userId: true,
      createdAt: true,
    },
  });
}

export async function findUsersForHistoryBackfill(userIds: string[]) {
  return prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, username: true },
  });
}

export async function insertExerciseEditHistoryRow(params: {
  id: string;
  exerciseId: string;
  exerciseName: string;
  userId: string;
  userName: string;
  field: string;
  beforeValue: string;
  afterValue: string;
  editedAt: string;
}) {
  return prisma.$executeRawUnsafe(
    `
      INSERT OR IGNORE INTO ExerciseEditHistory (id, exerciseId, exerciseName, userId, userName, field, beforeValue, afterValue, editedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    params.id,
    params.exerciseId,
    params.exerciseName,
    params.userId,
    params.userName,
    params.field,
    params.beforeValue,
    params.afterValue,
    params.editedAt,
  );
}

export async function listExerciseEditHistoryRows(limit: number) {
  return prisma.$queryRawUnsafe<Array<{
    id: string;
    exerciseId: string;
    exerciseName: string;
    userId: string;
    userName: string;
    field: string;
    beforeValue: string | null;
    afterValue: string | null;
    editedAt: string;
  }>>(
    `
      SELECT id, exerciseId, exerciseName, userId, userName, field, beforeValue, afterValue, editedAt
      FROM ExerciseEditHistory
      ORDER BY editedAt DESC
      LIMIT ${limit}
    `,
  );
}

export async function findUserDisplayNameById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, username: true },
  });
}

export async function findRecycleBinExercises() {
  return prisma.progressionExercise.findMany({
    where: {},
    include: {
      variations: {
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function findExerciseByIdLight(id: string) {
  return prisma.progressionExercise.findUnique({
    where: { id },
    select: { id: true, name: true, story: true, userId: true },
  });
}

export async function updateExerciseStoryById(id: string, story: string) {
  return prisma.progressionExercise.update({
    where: { id },
    data: { story },
    select: { id: true, name: true },
  });
}

export async function deleteExerciseById(id: string) {
  return prisma.progressionExercise.delete({ where: { id } });
}

export async function findExerciseById(id: string) {
  return prisma.progressionExercise.findUnique({ where: { id } });
}

export async function findAllExerciseNames() {
  return prisma.progressionExercise.findMany({
    select: { id: true, name: true },
  });
}

export async function updateExerciseWithRelations(params: {
  id: string;
  updateData: Record<string, unknown>;
  variations: string[] | undefined;
  existing: {
    id: string;
    name: string;
    wuxiaName: string;
    difficulty: string;
    wuxiaDifficulty: string;
    type: string;
    wuxiaType: string;
    story: string;
  };
}) {
  return prisma.$transaction(async (tx) => {
    if (params.variations !== undefined) {
      await tx.progressionVariation.deleteMany({ where: { exerciseId: params.id } });

      if (params.variations.length > 0) {
        await tx.progressionVariation.createMany({
          data: params.variations.map((variationName) => ({
            exerciseId: params.id,
            name: variationName,
            wuxiaName: variationName,
          })),
        });

        const createdVariations = await tx.progressionVariation.findMany({
          where: { exerciseId: params.id },
          select: { id: true, name: true, description: true, difficulty: true },
        });

        if (createdVariations.length > 0) {
          await tx.progressionVariationTranslation.createMany({
            data: createdVariations.map((variation) => ({
              id: variation.id,
              englishName: variation.name,
              vietnameseName: variation.name,
              englishDescription: variation.description,
              vietnameseDescription: variation.description,
              englishDifficulty: variation.difficulty,
              vietnameseDifficulty: variation.difficulty,
            })),
          });
        }
      }
    }

    const next = await tx.progressionExercise.update({
      where: { id: params.id },
      data: params.updateData,
      include: {
        variations: {
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        },
      },
    });

    return next;
  });
}

export async function upsertExerciseTranslationById(params: {
  id: string;
  existing: {
    name: string;
    wuxiaName: string;
    story: string;
    difficulty: string;
    wuxiaDifficulty: string;
    type: string;
    wuxiaType: string;
  };
  updateData: Record<string, unknown>;
  resolveVietnameseValue: (english: string, vietnameseHint: string | null) => string;
}) {
  const { id, existing, updateData, resolveVietnameseValue } = params;

  return prisma.progressionExerciseTranslation.upsert({
    where: { id },
    create: {
      id,
      englishName: String(updateData.name ?? existing.name),
      vietnameseName: resolveVietnameseValue(
        String(updateData.name ?? existing.name),
        String(updateData.wuxiaName ?? (existing.wuxiaName || updateData.name || existing.name)),
      ),
      englishStory: String(updateData.story ?? existing.story),
      vietnameseStory: resolveVietnameseValue(String(updateData.story ?? existing.story), null),
      englishDifficulty: String(updateData.difficulty ?? existing.difficulty),
      vietnameseDifficulty: resolveVietnameseValue(
        String(updateData.difficulty ?? existing.difficulty),
        String(updateData.wuxiaDifficulty ?? (existing.wuxiaDifficulty || updateData.difficulty || existing.difficulty)),
      ),
      englishType: String(updateData.type ?? existing.type),
      vietnameseType: resolveVietnameseValue(
        String(updateData.type ?? existing.type),
        String(updateData.wuxiaType ?? (existing.wuxiaType || updateData.type || existing.type)),
      ),
    },
    update: {
      ...(updateData.name !== undefined ? { englishName: String(updateData.name) } : {}),
      ...(updateData.wuxiaName !== undefined
        ? {
            vietnameseName: resolveVietnameseValue(
              String(updateData.name ?? existing.name),
              String(updateData.wuxiaName || updateData.name || existing.name),
            ),
          }
        : {}),
      ...(updateData.story !== undefined
        ? {
            englishStory: String(updateData.story),
            vietnameseStory: resolveVietnameseValue(String(updateData.story), null),
          }
        : {}),
      ...(updateData.difficulty !== undefined ? { englishDifficulty: String(updateData.difficulty) } : {}),
      ...(updateData.wuxiaDifficulty !== undefined
        ? {
            vietnameseDifficulty: resolveVietnameseValue(
              String(updateData.difficulty ?? existing.difficulty),
              String(updateData.wuxiaDifficulty || updateData.difficulty || existing.difficulty),
            ),
          }
        : {}),
      ...(updateData.type !== undefined ? { englishType: String(updateData.type) } : {}),
      ...(updateData.wuxiaType !== undefined
        ? {
            vietnameseType: resolveVietnameseValue(
              String(updateData.type ?? existing.type),
              String(updateData.wuxiaType || updateData.type || existing.type),
            ),
          }
        : {}),
    },
  });
}

export async function findPendingExerciseById(id: string) {
  return prisma.progressionExercise.findUnique({
    where: { id },
    select: { id: true, name: true, story: true },
  });
}

export async function listExerciseLibraryExercises() {
  return prisma.progressionExercise.findMany({
    include: {
      tiers: {
        select: {
          name: true,
          level: true,
          description: true,
          difficulty: true,
        },
        orderBy: { level: "asc" },
      },
      variations: {
        select: {
          id: true,
          name: true,
          description: true,
          difficulty: true,
        },
        orderBy: { name: "asc" },
      },
      modifiers: {
        select: {
          id: true,
          type: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function createExerciseLibraryExercise(params: {
  creatorUserId: string;
  libraryOwnerId: string;
  name: string;
  category: string;
  equipmentType: string;
  bodyweight: boolean;
  weighted: boolean;
  primaryMuscles: string;
  difficulty: string;
  story: string;
  tips: string;
  progressionStages: string[];
  variations: string[];
  resolvedType: string;
  resolveVietnameseValue: (english: string, vietnameseHint: string | null) => string;
}) {
  return prisma.$transaction(async (tx) => {
    const dbExercise = await tx.progressionExercise.create({
      data: {
        name: params.name,
        wuxiaName: params.name,
        category: params.category,
        equipmentType: params.equipmentType,
        bodyweight: params.bodyweight,
        weighted: params.weighted,
        rings: false,
        primaryMuscles: params.primaryMuscles,
        secondaryMuscles: "",
        difficulty: params.difficulty,
        wuxiaDifficulty: params.difficulty,
        story: params.story,
        tips: params.tips,
        progression: JSON.stringify(params.progressionStages),
        userId: params.libraryOwnerId,
        variations: params.variations.length > 0
          ? {
              create: params.variations.map((variationName) => ({
                name: variationName,
                wuxiaName: variationName,
              })),
            }
          : undefined,
      },
      include: {
        translation: true,
        tiers: {
          select: {
            name: true,
            level: true,
          },
          orderBy: { level: "asc" },
        },
        variations: {
          select: {
            id: true,
            name: true,
          },
          orderBy: { name: "asc" },
        },
      },
    });

    await tx.progressionTier.createMany({
      data: params.progressionStages.map((stageName, index) => ({
        exerciseId: dbExercise.id,
        level: index + 1,
        name: stageName,
        wuxiaName: stageName,
        difficulty: params.difficulty,
      })),
    });

    await tx.progressionExerciseTranslation.create({
      data: {
        id: dbExercise.id,
        englishName: params.name,
        vietnameseName: params.resolveVietnameseValue(params.name, null),
        englishStory: params.story,
        vietnameseStory: params.resolveVietnameseValue(params.story, null),
        englishDifficulty: params.difficulty,
        vietnameseDifficulty: params.resolveVietnameseValue(params.difficulty, null),
        englishType: params.resolvedType,
        vietnameseType: params.resolveVietnameseValue(params.resolvedType, null),
      },
    });

    const createdTiers = await tx.progressionTier.findMany({
      where: { exerciseId: dbExercise.id },
      select: { id: true, name: true, description: true, difficulty: true },
    });

    if (createdTiers.length > 0) {
      await tx.progressionTierTranslation.createMany({
        data: createdTiers.map((tier) => ({
          id: tier.id,
          englishName: tier.name,
          vietnameseName: tier.name,
          englishDescription: tier.description,
          vietnameseDescription: tier.description,
          englishDifficulty: tier.difficulty,
          vietnameseDifficulty: tier.difficulty,
        })),
      });
    }

    if (dbExercise.variations.length > 0) {
      await tx.progressionVariationTranslation.createMany({
        data: dbExercise.variations.map((variation) => ({
          id: variation.id,
          englishName: variation.name,
          vietnameseName: variation.name,
          englishDescription: null,
          vietnameseDescription: null,
          englishDifficulty: "",
          vietnameseDifficulty: "",
        })),
      });
    }

    await tx.userProgressionLevel.create({
      data: {
        userId: params.creatorUserId,
        exerciseId: dbExercise.id,
        currentLevel: 1,
      },
    });

    return dbExercise;
  });
}

export async function listExercisesForStudioExport() {
  return prisma.progressionExercise.findMany({
    include: {
      tiers: { orderBy: { level: "asc" } },
      variations: { orderBy: { name: "asc" } },
      modifiers: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function findAllExerciseNameEntries() {
  return prisma.progressionExercise.findMany({
    select: { id: true, name: true },
  });
}

export async function saveStudioExerciseById(params: {
  existingId: string | null;
  payload: {
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
    tips: string;
    prerequisites: string;
    cues: string;
    commonMistakes: string;
    breathing: string;
    safetyConsiderations: string;
    competitionStandards: string;
    progression: string;
    assignedDays: string;
  };
}) {
  if (params.existingId) {
    return prisma.progressionExercise.update({
      where: { id: params.existingId },
      data: params.payload,
      select: { id: true },
    });
  }

  return prisma.progressionExercise.create({
    data: params.payload,
    select: { id: true },
  });
}

export async function replaceStudioExerciseRelations(params: {
  exerciseId: string;
  tiers: Array<{
    exerciseId: string;
    level: number;
    name: string;
    wuxiaName: string;
    difficulty: string;
    wuxiaDifficulty: string;
    wuxiaType: string;
    description: string;
    targetHold: number | null;
    targetReps: number | null;
    targetRepsText: string;
  }>;
  variations: Array<{
    exerciseId: string;
    name: string;
    wuxiaName: string;
    difficulty: string;
    wuxiaDifficulty: string;
    wuxiaType: string;
    description: string;
  }>;
  modifiers: Array<{
    exerciseId: string;
    type: string;
    available: boolean;
    difficultyMod: number;
    notes: string;
    method: string;
    difficultyIncrease: string;
  }>;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.progressionTier.deleteMany({ where: { exerciseId: params.exerciseId } });
    await tx.progressionVariation.deleteMany({ where: { exerciseId: params.exerciseId } });
    await tx.progressionModifier.deleteMany({ where: { exerciseId: params.exerciseId } });

    await tx.progressionTier.createMany({ data: params.tiers });

    if (params.variations.length > 0) {
      await tx.progressionVariation.createMany({ data: params.variations });
    }

    if (params.modifiers.length > 0) {
      await tx.progressionModifier.createMany({ data: params.modifiers });
    }
  });
}

export async function countAllExercises() {
  return prisma.progressionExercise.count();
}

export async function countDeletedExercises() {
  return prisma.progressionExercise.count({
    where: {
      story: {
        startsWith: "[DELETED_EXERCISE]",
      },
    },
  });
}

export async function countUserProgressionLevels() {
  return prisma.userProgressionLevel.count();
}

export async function countProgressionLogs() {
  return prisma.progressionLog.count();
}

export async function purgeAllExercises() {
  return prisma.$transaction(async (tx) => {
    await tx.progressionExercise.deleteMany({});
  });
}
