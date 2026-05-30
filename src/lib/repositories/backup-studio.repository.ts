import { prisma } from "@/lib/prisma";

export async function findBackupTargetUser(targetUserId: string) {
  return prisma.user.findUnique({
    where: { id: targetUserId },
    include: {
      settings: true,
      profile: true,
    },
  });
}

export async function listBackupCheckinsByUser(targetUserId: string) {
  return prisma.checkIn.findMany({
    where: { userId: targetUserId },
    orderBy: { date: "asc" },
  });
}

export async function listBackupCheckInNotesByUser(targetUserId: string) {
  return prisma.checkInNote.findMany({
    where: { userId: targetUserId },
    orderBy: { date: "asc" },
  });
}

export async function listBackupExercisesForUser(targetUserId: string) {
  return prisma.progressionExercise.findMany({
    where: {
      userProgress: {
        some: { userId: targetUserId },
      },
    },
    include: {
      tiers: { orderBy: { level: "asc" } },
      variations: true,
      modifiers: true,
      userProgress: {
        where: { userId: targetUserId },
        select: { currentLevel: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function listBackupProgressionLogsByUser(targetUserId: string) {
  return prisma.progressionLog.findMany({
    where: {
      userProgression: {
        userId: targetUserId,
      },
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

export async function findBackupUserById(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function clearBackupImportDataForUser(userId: string) {
  await prisma.progressionLog.deleteMany({ where: { userProgression: { userId } } });
  await prisma.userProgressionLevel.deleteMany({ where: { userId } });
  await prisma.checkInNote.deleteMany({ where: { userId } });
  await prisma.checkIn.deleteMany({ where: { userId } });
}

export async function updateBackupUserCore(params: {
  userId: string;
  name: string;
  onboardingCompleted: boolean;
  onboardingSkipped: boolean;
  onboardingStep: number;
}) {
  return prisma.user.update({
    where: { id: params.userId },
    data: {
      name: params.name,
      onboardingCompleted: params.onboardingCompleted,
      onboardingSkipped: params.onboardingSkipped,
      onboardingStep: params.onboardingStep,
    },
  });
}

export async function upsertBackupUserSettings(params: {
  userId: string;
  dualPageView: boolean;
  pinnedNavItems: string;
  hiddenNavItems: string;
  panelPosition: string;
  combinedView: boolean;
}) {
  return prisma.userSettings.upsert({
    where: { userId: params.userId },
    update: {
      dualPageView: params.dualPageView,
      pinnedNavItems: params.pinnedNavItems,
      hiddenNavItems: params.hiddenNavItems,
      panelPosition: params.panelPosition,
      combinedView: params.combinedView,
    },
    create: {
      userId: params.userId,
      dualPageView: params.dualPageView,
      pinnedNavItems: params.pinnedNavItems,
      hiddenNavItems: params.hiddenNavItems,
      panelPosition: params.panelPosition,
      combinedView: params.combinedView,
    },
  });
}

export async function upsertBackupUserProfile(params: {
  userId: string;
  fitnessBackground: string | null;
  primaryGoal: string | null;
  trainingDaysPerWeek: number | null;
  assessmentAnswers: string | null;
  recommendedTier: string | null;
  currentTier: string | null;
  publicProfile: boolean;
  displayName: string | null;
  gettingStartedDismissed: boolean;
  gettingStartedTasks: string;
}) {
  return prisma.userProfile.upsert({
    where: { userId: params.userId },
    update: {
      fitnessBackground: params.fitnessBackground,
      primaryGoal: params.primaryGoal,
      trainingDaysPerWeek: params.trainingDaysPerWeek,
      assessmentAnswers: params.assessmentAnswers,
      recommendedTier: params.recommendedTier,
      currentTier: params.currentTier,
      publicProfile: params.publicProfile,
      displayName: params.displayName,
      gettingStartedDismissed: params.gettingStartedDismissed,
      gettingStartedTasks: params.gettingStartedTasks,
    },
    create: {
      userId: params.userId,
      fitnessBackground: params.fitnessBackground,
      primaryGoal: params.primaryGoal,
      trainingDaysPerWeek: params.trainingDaysPerWeek,
      assessmentAnswers: params.assessmentAnswers,
      recommendedTier: params.recommendedTier,
      currentTier: params.currentTier,
      publicProfile: params.publicProfile,
      displayName: params.displayName,
      gettingStartedDismissed: params.gettingStartedDismissed,
      gettingStartedTasks: params.gettingStartedTasks,
    },
  });
}

export async function listCheckinsForBackupImport(userId: string) {
  return prisma.checkIn.findMany({
    where: { userId },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
}

export async function updateCheckinById(params: {
  id: string;
  date: Date;
  weight: number | null;
  comment: string | null;
  present: boolean;
}) {
  return prisma.checkIn.update({
    where: { id: params.id },
    data: {
      date: params.date,
      weight: params.weight,
      comment: params.comment,
      present: params.present,
    },
  });
}

export async function updateCheckinMergeById(params: {
  id: string;
  present: boolean;
  weight: number | null;
  comment: string | null;
}) {
  return prisma.checkIn.update({
    where: { id: params.id },
    data: {
      present: params.present,
      weight: params.weight,
      comment: params.comment,
    },
  });
}

export async function deleteCheckinById(id: string) {
  return prisma.checkIn.delete({ where: { id } });
}

export async function createCheckinForBackupImport(params: {
  date: Date;
  userId: string;
  weight: number | null;
  comment: string | null;
  present: boolean;
}) {
  return prisma.checkIn.create({
    data: {
      date: params.date,
      userId: params.userId,
      weight: params.weight,
      comment: params.comment,
      present: params.present,
    },
    select: { id: true },
  });
}

export async function upsertCheckinNoteForBackupImport(params: {
  date: string;
  userId: string;
  content: string;
  pinned: boolean;
}) {
  return prisma.checkInNote.upsert({
    where: {
      date_userId: {
        date: params.date,
        userId: params.userId,
      },
    },
    update: {
      content: params.content,
      pinned: params.pinned,
    },
    create: {
      date: params.date,
      userId: params.userId,
      content: params.content,
      pinned: params.pinned,
    },
  });
}

export async function listBackupImportExerciseIdentities() {
  return prisma.progressionExercise.findMany({
    select: { id: true, name: true, wuxiaName: true },
  });
}

export async function saveBackupImportExercise(params: {
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

export async function replaceBackupImportExerciseRelations(params: {
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

export async function upsertBackupUserProgressionLevel(params: {
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
    update: {
      currentLevel: params.currentLevel,
    },
    create: {
      userId: params.userId,
      exerciseId: params.exerciseId,
      currentLevel: params.currentLevel,
    },
    select: { id: true },
  });
}

export async function listBackupImportUserProgressionLevels(userId: string) {
  return prisma.userProgressionLevel.findMany({
    where: { userId },
    include: {
      exercise: {
        select: {
          name: true,
          wuxiaName: true,
        },
      },
    },
  });
}

export async function listBackupImportExistingLogs(userId: string) {
  return prisma.progressionLog.findMany({
    where: {
      userProgression: {
        userId,
      },
    },
    include: {
      userProgression: {
        include: {
          exercise: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });
}

export async function createFallbackExerciseForBackupImport(params: {
  userId: string;
  exerciseName: string;
  level: number;
}) {
  return prisma.$transaction(async (tx) => {
    const createdExercise = await tx.progressionExercise.create({
      data: {
        userId: params.userId,
        name: params.exerciseName,
        wuxiaName: params.exerciseName,
        difficulty: "",
        wuxiaDifficulty: "",
        type: "",
        wuxiaType: "",
        story: "",
        category: "Other",
        equipmentType: "bodyweight",
        bodyweight: true,
        weighted: false,
        rings: false,
        primaryMuscles: "Other",
        secondaryMuscles: "",
        tips: "[]",
        prerequisites: "[]",
        cues: "[]",
        commonMistakes: "[]",
        breathing: "",
        safetyConsiderations: "[]",
        competitionStandards: "{}",
        progression: JSON.stringify([params.exerciseName]),
        assignedDays: "",
      },
      select: { id: true },
    });

    await tx.progressionTier.create({
      data: {
        exerciseId: createdExercise.id,
        level: params.level,
        name: params.exerciseName,
        wuxiaName: params.exerciseName,
        difficulty: "",
        wuxiaDifficulty: "",
        wuxiaType: "",
        description: "",
        targetHold: null,
        targetReps: null,
        targetRepsText: "",
      },
    });

    return createdExercise;
  });
}

export async function createBackupImportProgressionLog(params: {
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
}) {
  return prisma.progressionLog.create({
    data: {
      userProgressionId: params.userProgressionId,
      level: params.level,
      weight1: params.weight1,
      reps1: params.reps1,
      weight2: params.weight2,
      reps2: params.reps2,
      weight3: params.weight3,
      reps3: params.reps3,
      holdTime: params.holdTime,
      holdTime2: params.holdTime2,
      holdTime3: params.holdTime3,
      modifier: params.modifier,
      variant: params.variant,
      setupOption: params.setupOption,
      notes: params.notes,
      completed: params.completed,
      createdAt: params.createdAt,
    },
  });
}

export async function purgeBackupDataForUser(userId: string) {
  await prisma.progressionLog.deleteMany({ where: { userProgression: { userId } } });
  await prisma.userProgressionLevel.deleteMany({ where: { userId } });
  await prisma.checkInNote.deleteMany({ where: { userId } });
  await prisma.checkIn.deleteMany({ where: { userId } });
  await prisma.userProfile.deleteMany({ where: { userId } });
  await prisma.userSettings.deleteMany({ where: { userId } });
}