import { apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/auth/middleware";
import { ensureAppExerciseLibraryOwner } from "@/lib/exercise-library-owner";

type BackupPackage = {
  version?: number;
  packageType?: string;
  user?: {
    id?: string;
    username?: string;
    name?: string;
    onboardingCompleted?: boolean;
    onboardingSkipped?: boolean;
    onboardingStep?: number;
  };
  settings?: {
    dualPageView?: boolean;
    pinnedNavItems?: string;
    hiddenNavItems?: string;
    panelPosition?: string;
    combinedView?: boolean;
  } | null;
  profile?: {
    fitnessBackground?: string | null;
    primaryGoal?: string | null;
    trainingDaysPerWeek?: number | null;
    assessmentAnswers?: string | null;
    recommendedTier?: string | null;
    currentTier?: string | null;
    publicProfile?: boolean;
    displayName?: string | null;
    gettingStartedDismissed?: boolean;
    gettingStartedTasks?: string | null;
  } | null;
  checkins?: Array<{
    date?: string | null;
    weight?: number | null;
    comment?: string | null;
    present?: boolean;
  }>;
  checkInNotes?: Array<{
    date?: string | null;
    content?: string | null;
    pinned?: boolean;
  }>;
  exerciseLibrary?: Array<{
    sourceExerciseId?: string;
    name?: string;
    wuxiaName?: string;
    difficulty?: string;
    wuxiaDifficulty?: string;
    type?: string;
    wuxiaType?: string;
    story?: string;
    category?: string;
    equipmentType?: string;
    bodyweight?: boolean;
    weighted?: boolean;
    rings?: boolean;
    primaryMuscles?: string;
    secondaryMuscles?: string;
    tips?: string;
    prerequisites?: string;
    cues?: string;
    commonMistakes?: string;
    breathing?: string;
    safetyConsiderations?: string;
    competitionStandards?: string;
    progression?: string[];
    assignedDays?: string;
    currentLevel?: number;
    tiers?: Array<{
      level?: number;
      name?: string;
      wuxiaName?: string;
      difficulty?: string;
      wuxiaDifficulty?: string;
      wuxiaType?: string;
      description?: string;
      targetHold?: number | null;
      targetReps?: number | null;
      targetRepsText?: string;
    }>;
    variations?: Array<{
      name?: string;
      wuxiaName?: string;
      difficulty?: string;
      wuxiaDifficulty?: string;
      wuxiaType?: string;
      description?: string;
    }>;
    modifiers?: Array<{
      type?: string;
      available?: boolean;
      difficultyMod?: number;
      notes?: string;
      method?: string;
      difficultyIncrease?: string;
    }>;
  }>;
  trainingLogs?: Array<{
    exerciseId?: string;
    exerciseName?: string;
    level?: number;
    weight1?: number | null;
    reps1?: number | null;
    weight2?: number | null;
    reps2?: number | null;
    weight3?: number | null;
    reps3?: number | null;
    holdTime?: number | null;
    holdTime2?: number | null;
    holdTime3?: number | null;
    modifier?: string | null;
    variant?: string | null;
    notes?: string | null;
    completed?: boolean;
    createdAt?: string | null;
  }>;
};

function normalizeText(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function clampText(value: unknown, max: number): string {
  return String(value || "").trim().slice(0, max);
}

function parseDate(value: unknown): Date {
  const parsed = new Date(String(value || ""));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function parseNullableFloat(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNullableInt(value: unknown): number | null {
  const parsed = parseNullableFloat(value);
  return parsed == null ? null : Math.trunc(parsed);
}

function getProgressionList(exercise: NonNullable<BackupPackage["exerciseLibrary"]>[number]): string[] {
  if (Array.isArray(exercise.progression) && exercise.progression.length > 0) {
    return exercise.progression.map((value) => clampText(value, 200)).filter(Boolean);
  }

  if (Array.isArray(exercise.tiers) && exercise.tiers.length > 0) {
    return exercise.tiers.map((tier) => clampText(tier.name, 200)).filter(Boolean);
  }

  const fallbackName = clampText(exercise.name, 200);
  return fallbackName ? [fallbackName] : [];
}

function makeLogSignature(exerciseName: string, level: number, createdAt: Date, variant?: string | null, modifier?: string | null): string {
  return [
    normalizeText(exerciseName),
    String(level || 1),
    createdAt.toISOString(),
    normalizeText(variant),
    normalizeText(modifier),
  ].join("|");
}

export const POST = withAdmin(async (request, { auth }) => {
  try {
    const body = (await request.json()) as {
      targetUserId?: string;
      replaceExisting?: boolean;
      backup?: BackupPackage;
    };

    const backup = body.backup;
    if (!backup || typeof backup !== "object") {
      return ApiErrors.badRequest("backup payload is required");
    }

    const targetUserId = typeof body.targetUserId === "string" && body.targetUserId.trim().length > 0
      ? body.targetUserId
      : typeof backup.user?.id === "string" && backup.user.id.trim().length > 0
        ? backup.user.id
        : auth.userId;

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      return ApiErrors.notFound("Target user not found");
    }

    const replaceExisting = body.replaceExisting === true;

    if (replaceExisting) {
      await prisma.progressionLog.deleteMany({ where: { userProgression: { userId: targetUserId } } });
      await prisma.userProgressionLevel.deleteMany({ where: { userId: targetUserId } });
      await prisma.checkInNote.deleteMany({ where: { userId: targetUserId } });
      await prisma.checkIn.deleteMany({ where: { userId: targetUserId } });
    }

    if (backup.user?.name) {
      await prisma.user.update({
        where: { id: targetUserId },
        data: {
          name: clampText(backup.user.name, 100) || targetUser.name,
          onboardingCompleted: Boolean(backup.user.onboardingCompleted),
          onboardingSkipped: Boolean(backup.user.onboardingSkipped),
          onboardingStep: Number.isFinite(Number(backup.user.onboardingStep)) ? Number(backup.user.onboardingStep) : targetUser.onboardingStep,
        },
      });
    }

    if (backup.settings) {
      await prisma.userSettings.upsert({
        where: { userId: targetUserId },
        update: {
          dualPageView: Boolean(backup.settings.dualPageView),
          pinnedNavItems: clampText(backup.settings.pinnedNavItems || "[]", 10000) || "[]",
          hiddenNavItems: clampText(backup.settings.hiddenNavItems || "[]", 10000) || "[]",
          panelPosition: clampText(backup.settings.panelPosition || "left", 50) || "left",
          combinedView: Boolean(backup.settings.combinedView),
        },
        create: {
          userId: targetUserId,
          dualPageView: Boolean(backup.settings.dualPageView),
          pinnedNavItems: clampText(backup.settings.pinnedNavItems || "[]", 10000) || "[]",
          hiddenNavItems: clampText(backup.settings.hiddenNavItems || "[]", 10000) || "[]",
          panelPosition: clampText(backup.settings.panelPosition || "left", 50) || "left",
          combinedView: Boolean(backup.settings.combinedView),
        },
      });
    }

    if (backup.profile) {
      await prisma.userProfile.upsert({
        where: { userId: targetUserId },
        update: {
          fitnessBackground: backup.profile.fitnessBackground ? clampText(backup.profile.fitnessBackground, 50) : null,
          primaryGoal: backup.profile.primaryGoal ? clampText(backup.profile.primaryGoal, 50) : null,
          trainingDaysPerWeek: parseNullableInt(backup.profile.trainingDaysPerWeek),
          assessmentAnswers: backup.profile.assessmentAnswers ? clampText(backup.profile.assessmentAnswers, 10000) : null,
          recommendedTier: backup.profile.recommendedTier ? clampText(backup.profile.recommendedTier, 100) : null,
          currentTier: backup.profile.currentTier ? clampText(backup.profile.currentTier, 100) : null,
          publicProfile: Boolean(backup.profile.publicProfile),
          displayName: backup.profile.displayName ? clampText(backup.profile.displayName, 100) : null,
          gettingStartedDismissed: Boolean(backup.profile.gettingStartedDismissed),
          gettingStartedTasks: backup.profile.gettingStartedTasks ? clampText(backup.profile.gettingStartedTasks, 10000) : "{}",
        },
        create: {
          userId: targetUserId,
          fitnessBackground: backup.profile.fitnessBackground ? clampText(backup.profile.fitnessBackground, 50) : null,
          primaryGoal: backup.profile.primaryGoal ? clampText(backup.profile.primaryGoal, 50) : null,
          trainingDaysPerWeek: parseNullableInt(backup.profile.trainingDaysPerWeek),
          assessmentAnswers: backup.profile.assessmentAnswers ? clampText(backup.profile.assessmentAnswers, 10000) : null,
          recommendedTier: backup.profile.recommendedTier ? clampText(backup.profile.recommendedTier, 100) : null,
          currentTier: backup.profile.currentTier ? clampText(backup.profile.currentTier, 100) : null,
          publicProfile: Boolean(backup.profile.publicProfile),
          displayName: backup.profile.displayName ? clampText(backup.profile.displayName, 100) : null,
          gettingStartedDismissed: Boolean(backup.profile.gettingStartedDismissed),
          gettingStartedTasks: backup.profile.gettingStartedTasks ? clampText(backup.profile.gettingStartedTasks, 10000) : "{}",
        },
      });
    }

    let importedCheckins = 0;
    for (const entry of Array.isArray(backup.checkins) ? backup.checkins : []) {
      if (!entry?.date) continue;
      await prisma.checkIn.upsert({
        where: {
          date_userId: {
            date: parseDate(entry.date),
            userId: targetUserId,
          },
        },
        update: {
          weight: parseNullableFloat(entry.weight),
          comment: entry.comment ? clampText(entry.comment, 500) : null,
          present: Boolean(entry.present),
        },
        create: {
          date: parseDate(entry.date),
          userId: targetUserId,
          weight: parseNullableFloat(entry.weight),
          comment: entry.comment ? clampText(entry.comment, 500) : null,
          present: Boolean(entry.present),
        },
      });
      importedCheckins++;
    }

    let importedNotes = 0;
    for (const entry of Array.isArray(backup.checkInNotes) ? backup.checkInNotes : []) {
      const noteDate = clampText(entry?.date, 20);
      if (!noteDate) continue;
      await prisma.checkInNote.upsert({
        where: {
          date_userId: {
            date: noteDate,
            userId: targetUserId,
          },
        },
        update: {
          content: clampText(entry?.content, 5000),
          pinned: Boolean(entry?.pinned),
        },
        create: {
          date: noteDate,
          userId: targetUserId,
          content: clampText(entry?.content, 5000),
          pinned: Boolean(entry?.pinned),
        },
      });
      importedNotes++;
    }

    const existingExercises = await prisma.progressionExercise.findMany({
      select: { id: true, name: true, wuxiaName: true },
    });

    const exerciseMap = new Map<string, string>();
    const exerciseIdMap = new Map<string, string>();
    for (const entry of existingExercises) {
      exerciseIdMap.set(entry.id, entry.id);
      const nameKey = normalizeText(entry.name);
      if (nameKey) exerciseMap.set(nameKey, entry.id);
      const wuxiaKey = normalizeText(entry.wuxiaName);
      if (wuxiaKey && !exerciseMap.has(wuxiaKey)) exerciseMap.set(wuxiaKey, entry.id);
    }

    let importedExercises = 0;
    const libraryOwnerId = await ensureAppExerciseLibraryOwner();
    for (const exercise of Array.isArray(backup.exerciseLibrary) ? backup.exerciseLibrary : []) {
      const rawName = clampText(exercise?.name, 200);
      if (!rawName) continue;

      const progression = getProgressionList(exercise);
      const sourceExerciseId = clampText(exercise?.sourceExerciseId, 100);
      const payload = {
        userId: libraryOwnerId,
        name: rawName,
        wuxiaName: clampText(exercise?.wuxiaName || rawName, 200),
        difficulty: clampText(exercise?.difficulty, 100),
        wuxiaDifficulty: clampText(exercise?.wuxiaDifficulty, 100),
        type: clampText(exercise?.type, 100),
        wuxiaType: clampText(exercise?.wuxiaType, 100),
        story: clampText(exercise?.story, 5000),
        category: clampText(exercise?.category || "Other", 100) || "Other",
        equipmentType: clampText(exercise?.equipmentType || "bodyweight", 200) || "bodyweight",
        bodyweight: exercise?.bodyweight !== false,
        weighted: Boolean(exercise?.weighted),
        rings: Boolean(exercise?.rings),
        primaryMuscles: clampText(exercise?.primaryMuscles || "Other", 200) || "Other",
        secondaryMuscles: clampText(exercise?.secondaryMuscles, 200),
        tips: clampText(exercise?.tips || "[]", 10000) || "[]",
        prerequisites: clampText(exercise?.prerequisites || "[]", 10000) || "[]",
        cues: clampText(exercise?.cues || "[]", 10000) || "[]",
        commonMistakes: clampText(exercise?.commonMistakes || "[]", 10000) || "[]",
        breathing: clampText(exercise?.breathing, 1000),
        safetyConsiderations: clampText(exercise?.safetyConsiderations || "[]", 10000) || "[]",
        competitionStandards: clampText(exercise?.competitionStandards || "{}", 10000) || "{}",
        progression: JSON.stringify(progression),
        assignedDays: clampText(exercise?.assignedDays, 200),
      };

      const existingId = (sourceExerciseId && exerciseIdMap.get(sourceExerciseId))
        || exerciseMap.get(normalizeText(rawName))
        || exerciseMap.get(normalizeText(exercise?.wuxiaName));
      const savedExercise = existingId
        ? await prisma.progressionExercise.update({
            where: { id: existingId },
            data: payload,
            select: { id: true },
          })
        : await prisma.progressionExercise.create({
            data: payload,
            select: { id: true },
          });

      exerciseIdMap.set(savedExercise.id, savedExercise.id);
      exerciseMap.set(normalizeText(rawName), savedExercise.id);
      const wuxiaKey = normalizeText(exercise?.wuxiaName);
      if (wuxiaKey) exerciseMap.set(wuxiaKey, savedExercise.id);

      await prisma.progressionTier.deleteMany({ where: { exerciseId: savedExercise.id } });
      await prisma.progressionVariation.deleteMany({ where: { exerciseId: savedExercise.id } });
      await prisma.progressionModifier.deleteMany({ where: { exerciseId: savedExercise.id } });

      const tierRows = Array.isArray(exercise?.tiers) && exercise.tiers.length > 0
        ? exercise.tiers.map((tier, index) => ({
            exerciseId: savedExercise.id,
            level: Number.isFinite(Number(tier.level)) ? Number(tier.level) : index + 1,
            name: clampText(tier.name || rawName, 200),
            wuxiaName: clampText(tier.wuxiaName || tier.name || rawName, 200),
            difficulty: clampText(tier.difficulty, 100),
            wuxiaDifficulty: clampText(tier.wuxiaDifficulty, 100),
            wuxiaType: clampText(tier.wuxiaType, 100),
            description: clampText(tier.description, 2000),
            targetHold: parseNullableInt(tier.targetHold),
            targetReps: parseNullableInt(tier.targetReps),
            targetRepsText: clampText(tier.targetRepsText, 100),
          }))
        : [{
            exerciseId: savedExercise.id,
            level: 1,
            name: rawName,
            wuxiaName: clampText(exercise?.wuxiaName || rawName, 200),
            difficulty: clampText(exercise?.difficulty, 100),
            wuxiaDifficulty: clampText(exercise?.wuxiaDifficulty, 100),
            wuxiaType: clampText(exercise?.wuxiaType, 100),
            description: "",
            targetHold: null,
            targetReps: null,
            targetRepsText: "",
          }];

      await prisma.progressionTier.createMany({ data: tierRows });

      const variationRows = (Array.isArray(exercise?.variations) ? exercise.variations : [])
        .map((variation) => ({
          exerciseId: savedExercise.id,
          name: clampText(variation?.name, 200),
          wuxiaName: clampText(variation?.wuxiaName || variation?.name, 200),
          difficulty: clampText(variation?.difficulty, 100),
          wuxiaDifficulty: clampText(variation?.wuxiaDifficulty, 100),
          wuxiaType: clampText(variation?.wuxiaType, 100),
          description: clampText(variation?.description, 2000),
        }))
        .filter((entry) => entry.name.length > 0);

      if (variationRows.length > 0) {
        await prisma.progressionVariation.createMany({ data: variationRows });
      }

      const modifierRows = (Array.isArray(exercise?.modifiers) ? exercise.modifiers : [])
        .map((modifier) => ({
          exerciseId: savedExercise.id,
          type: clampText(modifier?.type || "custom", 100) || "custom",
          available: Boolean(modifier?.available),
          difficultyMod: parseNullableFloat(modifier?.difficultyMod) ?? 0,
          notes: clampText(modifier?.notes, 1000),
          method: clampText(modifier?.method, 500),
          difficultyIncrease: clampText(modifier?.difficultyIncrease, 500),
        }));

      if (modifierRows.length > 0) {
        await prisma.progressionModifier.createMany({ data: modifierRows });
      }

      await prisma.userProgressionLevel.upsert({
        where: {
          userId_exerciseId: {
            userId: targetUserId,
            exerciseId: savedExercise.id,
          },
        },
        update: {
          currentLevel: Number.isFinite(Number(exercise?.currentLevel)) ? Number(exercise.currentLevel) : 1,
        },
        create: {
          userId: targetUserId,
          exerciseId: savedExercise.id,
          currentLevel: Number.isFinite(Number(exercise?.currentLevel)) ? Number(exercise.currentLevel) : 1,
        },
      });

      importedExercises++;
    }

    const progressionLevels = await prisma.userProgressionLevel.findMany({
      where: { userId: targetUserId },
      include: {
        exercise: {
          select: {
            name: true,
            wuxiaName: true,
          },
        },
      },
    });

    const levelMap = new Map<string, string>();
    for (const level of progressionLevels) {
      const nameKey = normalizeText(level.exercise.name);
      if (nameKey) levelMap.set(nameKey, level.id);
      const wuxiaKey = normalizeText(level.exercise.wuxiaName);
      if (wuxiaKey && !levelMap.has(wuxiaKey)) levelMap.set(wuxiaKey, level.id);
    }

    const existingLogSignatures = new Set<string>();
    if (!replaceExisting) {
      const existingLogs = await prisma.progressionLog.findMany({
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
                  name: true,
                },
              },
            },
          },
        },
      });

      for (const entry of existingLogs) {
        existingLogSignatures.add(
          makeLogSignature(
            entry.userProgression.exercise.name,
            entry.level,
            entry.createdAt,
            entry.variant,
            entry.modifier,
          ),
        );
      }
    }

    let importedLogs = 0;
    let skippedLogs = 0;
    for (const log of Array.isArray(backup.trainingLogs) ? backup.trainingLogs : []) {
      const exerciseName = clampText(log?.exerciseName, 200);
      if (!exerciseName) {
        skippedLogs++;
        continue;
      }

      let progressionId = levelMap.get(normalizeText(exerciseName));
      if (!progressionId) {
        const fallbackExerciseId = clampText(log?.exerciseId, 100);
        let resolvedExerciseId = (fallbackExerciseId && exerciseIdMap.get(fallbackExerciseId))
          || exerciseMap.get(normalizeText(exerciseName));

        if (!resolvedExerciseId) {
          const createdExercise = await prisma.progressionExercise.create({
            data: {
              userId: libraryOwnerId,
              name: exerciseName,
              wuxiaName: exerciseName,
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
              progression: JSON.stringify([exerciseName]),
              assignedDays: "",
            },
            select: { id: true },
          });

          await prisma.progressionTier.create({
            data: {
              exerciseId: createdExercise.id,
              level: Number.isFinite(Number(log?.level)) ? Number(log.level) : 1,
              name: exerciseName,
              wuxiaName: exerciseName,
              difficulty: "",
              wuxiaDifficulty: "",
              wuxiaType: "",
              description: "",
              targetHold: null,
              targetReps: null,
              targetRepsText: "",
            },
          });

          resolvedExerciseId = createdExercise.id;
          exerciseIdMap.set(createdExercise.id, createdExercise.id);
          exerciseMap.set(normalizeText(exerciseName), createdExercise.id);
        }

        const levelRecord = await prisma.userProgressionLevel.upsert({
          where: {
            userId_exerciseId: {
              userId: targetUserId,
              exerciseId: resolvedExerciseId,
            },
          },
          update: {
            currentLevel: Number.isFinite(Number(log?.level)) ? Number(log.level) : 1,
          },
          create: {
            userId: targetUserId,
            exerciseId: resolvedExerciseId,
            currentLevel: Number.isFinite(Number(log?.level)) ? Number(log.level) : 1,
          },
          select: { id: true },
        });

        progressionId = levelRecord.id;
        levelMap.set(normalizeText(exerciseName), progressionId);
      }

      const createdAt = parseDate(log?.createdAt);
      const signature = makeLogSignature(
        exerciseName,
        Number.isFinite(Number(log?.level)) ? Number(log?.level) : 1,
        createdAt,
        log?.variant,
        log?.modifier,
      );

      if (existingLogSignatures.has(signature)) {
        skippedLogs++;
        continue;
      }

      await prisma.progressionLog.create({
        data: {
          userProgressionId: progressionId,
          level: Number.isFinite(Number(log?.level)) ? Number(log?.level) : 1,
          weight1: parseNullableFloat(log?.weight1),
          reps1: parseNullableInt(log?.reps1),
          weight2: parseNullableFloat(log?.weight2),
          reps2: parseNullableInt(log?.reps2),
          weight3: parseNullableFloat(log?.weight3),
          reps3: parseNullableInt(log?.reps3),
          holdTime: parseNullableInt(log?.holdTime),
          holdTime2: parseNullableInt(log?.holdTime2),
          holdTime3: parseNullableInt(log?.holdTime3),
          modifier: log?.modifier ? clampText(log.modifier, 100) : null,
          variant: log?.variant ? clampText(log.variant, 200) : null,
          notes: log?.notes ? clampText(log.notes, 2000) : null,
          completed: log?.completed !== false,
          createdAt,
        },
      });

      existingLogSignatures.add(signature);
      importedLogs++;
    }

    return apiSuccess({
      message: `Backup import complete: ${importedExercises} exercise package(s), ${importedLogs} training log(s), ${importedCheckins} check-in(s), and ${importedNotes} note(s) restored${skippedLogs ? `, ${skippedLogs} log(s) skipped` : ""}.`,
      importedExercises,
      importedLogs,
      importedCheckins,
      importedNotes,
      skippedLogs,
      replaceExisting,
    });
  } catch (error) {
    console.error("Backup Studio import error:", error);
    return ApiErrors.internal("Failed to import backup package");
  }
});

export const DELETE = withAdmin(async (request, { auth }) => {
  try {
    const body = (await request.json().catch(() => ({}))) as { targetUserId?: string; confirm?: boolean };
    const targetUserId = typeof body.targetUserId === "string" && body.targetUserId.trim().length > 0
      ? body.targetUserId
      : auth.userId;

    if (body.confirm !== true) {
      return ApiErrors.badRequest("Confirmation is required before purging user backup data");
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      return ApiErrors.notFound("Target user not found");
    }

    await prisma.progressionLog.deleteMany({ where: { userProgression: { userId: targetUserId } } });
    await prisma.userProgressionLevel.deleteMany({ where: { userId: targetUserId } });
    await prisma.checkInNote.deleteMany({ where: { userId: targetUserId } });
    await prisma.checkIn.deleteMany({ where: { userId: targetUserId } });
    await prisma.userProfile.deleteMany({ where: { userId: targetUserId } });
    await prisma.userSettings.deleteMany({ where: { userId: targetUserId } });

    return apiSuccess({
      message: `Purged backup-related user data for ${targetUser.name}. Exercise DB records were preserved.`,
      targetUserId,
    });
  } catch (error) {
    console.error("Backup Studio purge error:", error);
    return ApiErrors.internal("Failed to purge user backup data");
  }
});
