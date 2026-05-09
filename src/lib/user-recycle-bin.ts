import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

const RECYCLE_BIN_PATH = path.join(process.cwd(), "backups", "recycle-bin-users.json");

type RecycleBinSummary = {
  progressionLogCount: number;
  progressionLevelCount: number;
  checkInCount: number;
  noteCount: number;
  ownedExerciseCount: number;
};

export type DeletedUserArchive = {
  archiveId: string;
  deletedAt: string;
  deletedByUserId: string | null;
  user: {
    id: string;
    username: string;
    password: string;
    name: string;
    role: string;
    friendCode: string;
    onboardingCompleted: boolean;
    onboardingSkipped: boolean;
    onboardingStep: number;
    createdAt: string;
    updatedAt: string;
  };
  settings: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  checkins: Array<Record<string, unknown>>;
  checkInNotes: Array<Record<string, unknown>>;
  progressionExercises: Array<Record<string, unknown>>;
  progressionLevels: Array<Record<string, unknown>>;
  summary: RecycleBinSummary;
};

export type DeletedUserArchiveMeta = {
  archiveId: string;
  deletedAt: string;
  deletedByUserId: string | null;
  id: string;
  username: string;
  name: string;
  role: string;
  createdAt: string;
  summary: RecycleBinSummary;
};

function normalizeArchiveMeta(entry: DeletedUserArchive): DeletedUserArchiveMeta {
  return {
    archiveId: entry.archiveId,
    deletedAt: entry.deletedAt,
    deletedByUserId: entry.deletedByUserId,
    id: entry.user.id,
    username: entry.user.username,
    name: entry.user.name,
    role: entry.user.role,
    createdAt: entry.user.createdAt,
    summary: entry.summary,
  };
}

async function ensureRecycleBinFile(): Promise<void> {
  await fs.mkdir(path.dirname(RECYCLE_BIN_PATH), { recursive: true });
  try {
    await fs.access(RECYCLE_BIN_PATH);
  } catch {
    await fs.writeFile(RECYCLE_BIN_PATH, "[]", "utf8");
  }
}

async function readRecycleBinEntries(): Promise<DeletedUserArchive[]> {
  await ensureRecycleBinFile();
  try {
    const raw = await fs.readFile(RECYCLE_BIN_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DeletedUserArchive[]) : [];
  } catch {
    return [];
  }
}

async function writeRecycleBinEntries(entries: DeletedUserArchive[]): Promise<void> {
  await ensureRecycleBinFile();
  await fs.writeFile(RECYCLE_BIN_PATH, JSON.stringify(entries, null, 2), "utf8");
}

function safeDate(value: unknown): Date {
  const parsed = new Date(String(value || ""));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

type RecycleBinTransactionClient = Pick<
  typeof prisma,
  "progressionExercise" | "progressionTier" | "progressionVariation" | "progressionModifier"
>;

async function ensureExerciseExists(
  tx: RecycleBinTransactionClient,
  userId: string,
  exerciseLike: Record<string, unknown> | null | undefined,
): Promise<string | null> {
  const exerciseId = asString(exerciseLike?.id);
  if (!exerciseId) return null;

  const existing = await tx.progressionExercise.findUnique({ where: { id: exerciseId }, select: { id: true } });
  if (existing) return existing.id;

  const name = asString(exerciseLike?.name);
  if (!name) return null;

  await tx.progressionExercise.create({
    data: {
      id: exerciseId,
      userId,
      name,
      wuxiaName: asString(exerciseLike?.wuxiaName, name),
      difficulty: asString(exerciseLike?.difficulty),
      wuxiaDifficulty: asString(exerciseLike?.wuxiaDifficulty),
      type: asString(exerciseLike?.type),
      wuxiaType: asString(exerciseLike?.wuxiaType),
      story: asString(exerciseLike?.story),
      tips: asString(exerciseLike?.tips, "[]"),
      category: asString(exerciseLike?.category, "Other"),
      equipmentType: asString(exerciseLike?.equipmentType, "bodyweight"),
      bodyweight: asBoolean(exerciseLike?.bodyweight, true),
      weighted: asBoolean(exerciseLike?.weighted),
      rings: asBoolean(exerciseLike?.rings),
      primaryMuscles: asString(exerciseLike?.primaryMuscles, "Other"),
      secondaryMuscles: asString(exerciseLike?.secondaryMuscles),
      prerequisites: asString(exerciseLike?.prerequisites, "[]"),
      cues: asString(exerciseLike?.cues, "[]"),
      commonMistakes: asString(exerciseLike?.commonMistakes, "[]"),
      breathing: asString(exerciseLike?.breathing),
      safetyConsiderations: asString(exerciseLike?.safetyConsiderations, "[]"),
      competitionStandards: asString(exerciseLike?.competitionStandards, "{}"),
      progression: asString(exerciseLike?.progression, "[]"),
      assignedDays: asString(exerciseLike?.assignedDays),
      createdAt: safeDate(exerciseLike?.createdAt),
    },
  });

  const tiers = Array.isArray(exerciseLike?.tiers) ? exerciseLike.tiers : [];
  for (const tier of tiers) {
    const tierData = tier as Record<string, unknown>;
    await tx.progressionTier.create({
      data: {
        id: asString(tierData.id) || undefined,
        exerciseId,
        level: asNumber(tierData.level, 1),
        name: asString(tierData.name, name),
        wuxiaName: asString(tierData.wuxiaName, asString(tierData.name, name)),
        difficulty: asString(tierData.difficulty),
        wuxiaDifficulty: asString(tierData.wuxiaDifficulty),
        wuxiaType: asString(tierData.wuxiaType),
        description: asString(tierData.description),
        targetHold: typeof tierData.targetHold === "number" ? tierData.targetHold : null,
        targetReps: typeof tierData.targetReps === "number" ? tierData.targetReps : null,
        targetRepsText: asString(tierData.targetRepsText),
      },
    });
  }

  const variations = Array.isArray(exerciseLike?.variations) ? exerciseLike.variations : [];
  for (const variation of variations) {
    const variationData = variation as Record<string, unknown>;
    await tx.progressionVariation.create({
      data: {
        id: asString(variationData.id) || undefined,
        exerciseId,
        name: asString(variationData.name),
        wuxiaName: asString(variationData.wuxiaName, asString(variationData.name)),
        difficulty: asString(variationData.difficulty),
        wuxiaDifficulty: asString(variationData.wuxiaDifficulty),
        wuxiaType: asString(variationData.wuxiaType),
        description: asString(variationData.description),
      },
    });
  }

  const modifiers = Array.isArray(exerciseLike?.modifiers) ? exerciseLike.modifiers : [];
  for (const modifier of modifiers) {
    const modifierData = modifier as Record<string, unknown>;
    await tx.progressionModifier.create({
      data: {
        id: asString(modifierData.id) || undefined,
        exerciseId,
        type: asString(modifierData.type, "custom"),
        available: asBoolean(modifierData.available),
        difficultyMod: typeof modifierData.difficultyMod === "number" ? modifierData.difficultyMod : 0,
        notes: asString(modifierData.notes),
        method: asString(modifierData.method),
        difficultyIncrease: asString(modifierData.difficultyIncrease),
      },
    });
  }

  return exerciseId;
}

export async function listDeletedUsers(): Promise<DeletedUserArchiveMeta[]> {
  const entries = await readRecycleBinEntries();
  return entries.map(normalizeArchiveMeta).sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
}

export async function archiveUserAndDelete(userId: string, deletedByUserId: string | null): Promise<DeletedUserArchiveMeta> {
  const [user, progressionExercises, progressionLevels] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        settings: true,
        profile: true,
        checkIns: true,
        checkInNotes: true,
      },
    }),
    prisma.progressionExercise.findMany({
      where: { userId },
      include: {
        tiers: true,
        variations: true,
        modifiers: true,
      },
    }),
    prisma.userProgressionLevel.findMany({
      where: { userId },
      include: {
        logs: true,
        exercise: {
          include: {
            tiers: true,
            variations: true,
            modifiers: true,
          },
        },
      },
    }),
  ]);

  if (!user) {
    throw new Error("User not found");
  }

  const logCount = progressionLevels.reduce((sum, level) => sum + level.logs.length, 0);
  const archive: DeletedUserArchive = JSON.parse(JSON.stringify({
    archiveId: randomUUID(),
    deletedAt: new Date().toISOString(),
    deletedByUserId,
    user: {
      id: user.id,
      username: user.username,
      password: user.password,
      name: user.name,
      role: user.role,
      friendCode: user.friendCode,
      onboardingCompleted: user.onboardingCompleted,
      onboardingSkipped: user.onboardingSkipped,
      onboardingStep: user.onboardingStep,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    settings: user.settings,
    profile: user.profile,
    checkins: user.checkIns,
    checkInNotes: user.checkInNotes,
    progressionExercises,
    progressionLevels,
    summary: {
      progressionLogCount: logCount,
      progressionLevelCount: progressionLevels.length,
      checkInCount: user.checkIns.length,
      noteCount: user.checkInNotes.length,
      ownedExerciseCount: progressionExercises.length,
    },
  }));

  const entries = await readRecycleBinEntries();
  entries.unshift(archive);
  await writeRecycleBinEntries(entries);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.userProgressionLevel.deleteMany({ where: { userId } });
      await tx.progressionExercise.deleteMany({ where: { userId } });
      await tx.checkInNote.deleteMany({ where: { userId } });
      await tx.checkIn.deleteMany({ where: { userId } });
      await tx.userSettings.deleteMany({ where: { userId } });
      await tx.userProfile.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });
  } catch (error) {
    const rollbackEntries = (await readRecycleBinEntries()).filter((entry) => entry.archiveId !== archive.archiveId);
    await writeRecycleBinEntries(rollbackEntries);
    throw error;
  }

  return normalizeArchiveMeta(archive);
}

export async function restoreDeletedUser(archiveId: string): Promise<DeletedUserArchiveMeta> {
  const entries = await readRecycleBinEntries();
  const archive = entries.find((entry) => entry.archiveId === archiveId);
  if (!archive) {
    throw new Error("Archived user not found");
  }

  const usernameConflict = await prisma.user.findUnique({ where: { username: archive.user.username } });
  if (usernameConflict) {
    throw new Error("Cannot restore because that username already exists");
  }

  const userIdConflict = await prisma.user.findUnique({ where: { id: archive.user.id } });
  if (userIdConflict) {
    throw new Error("Cannot restore because that user id already exists");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id: archive.user.id,
        friendCode: archive.user.friendCode,
        username: archive.user.username,
        password: archive.user.password,
        name: archive.user.name,
        role: archive.user.role,
        onboardingCompleted: archive.user.onboardingCompleted,
        onboardingSkipped: archive.user.onboardingSkipped,
        onboardingStep: archive.user.onboardingStep,
        createdAt: safeDate(archive.user.createdAt),
        updatedAt: safeDate(archive.user.updatedAt),
      },
    });

    if (archive.settings) {
      await tx.userSettings.create({
        data: {
          userId: archive.user.id,
          dualPageView: asBoolean(archive.settings.dualPageView),
          pinnedNavItems: asString(archive.settings.pinnedNavItems, "[]"),
          hiddenNavItems: asString(archive.settings.hiddenNavItems, "[]"),
          panelPosition: asString(archive.settings.panelPosition, "left"),
          combinedView: asBoolean(archive.settings.combinedView),
        },
      });
    }

    if (archive.profile) {
      await tx.userProfile.create({
        data: {
          userId: archive.user.id,
          fitnessBackground: asNullableString(archive.profile.fitnessBackground),
          primaryGoal: asNullableString(archive.profile.primaryGoal),
          trainingDaysPerWeek: typeof archive.profile.trainingDaysPerWeek === "number" ? archive.profile.trainingDaysPerWeek : null,
          assessmentAnswers: asNullableString(archive.profile.assessmentAnswers),
          recommendedTier: asNullableString(archive.profile.recommendedTier),
          currentTier: asNullableString(archive.profile.currentTier),
          publicProfile: asBoolean(archive.profile.publicProfile),
          displayName: asNullableString(archive.profile.displayName),
          gettingStartedDismissed: asBoolean(archive.profile.gettingStartedDismissed),
          gettingStartedTasks: asString(archive.profile.gettingStartedTasks, "{}"),
        },
      });
    }

    for (const checkin of archive.checkins ?? []) {
      await tx.checkIn.create({
        data: {
          id: asString(checkin.id) || undefined,
          userId: archive.user.id,
          date: safeDate(checkin.date),
          weight: typeof checkin.weight === "number" ? checkin.weight : null,
          comment: asNullableString(checkin.comment),
          present: asBoolean(checkin.present),
          createdAt: safeDate(checkin.createdAt),
        },
      });
    }

    for (const note of archive.checkInNotes ?? []) {
      await tx.checkInNote.create({
        data: {
          id: asString(note.id) || undefined,
          userId: archive.user.id,
          date: asString(note.date),
          content: asString(note.content),
          pinned: asBoolean(note.pinned),
          createdAt: safeDate(note.createdAt),
          updatedAt: safeDate(note.updatedAt),
        },
      });
    }

    for (const exercise of archive.progressionExercises ?? []) {
      await ensureExerciseExists(tx, archive.user.id, exercise);
    }

    for (const level of archive.progressionLevels ?? []) {
      const levelData = level as Record<string, unknown>;
      const exerciseId = asString(levelData.exerciseId);
      if (!exerciseId) continue;

      await ensureExerciseExists(tx, archive.user.id, levelData.exercise as Record<string, unknown> | undefined);

      const restoredLevel = await tx.userProgressionLevel.upsert({
        where: {
          userId_exerciseId: {
            userId: archive.user.id,
            exerciseId,
          },
        },
        update: {
          currentLevel: asNumber(levelData.currentLevel, 1),
        },
        create: {
          id: asString(levelData.id) || undefined,
          userId: archive.user.id,
          exerciseId,
          currentLevel: asNumber(levelData.currentLevel, 1),
          createdAt: safeDate(levelData.createdAt),
          updatedAt: safeDate(levelData.updatedAt),
        },
      });

      const logs = Array.isArray(levelData.logs) ? levelData.logs : [];
      for (const log of logs) {
        const logData = log as Record<string, unknown>;
        const existingLog = asString(logData.id)
          ? await tx.progressionLog.findUnique({ where: { id: asString(logData.id) }, select: { id: true } })
          : null;

        if (existingLog) continue;

        await tx.progressionLog.create({
          data: {
            id: asString(logData.id) || undefined,
            userProgressionId: restoredLevel.id,
            level: asNumber(logData.level, 1),
            weight1: typeof logData.weight1 === "number" ? logData.weight1 : null,
            reps1: typeof logData.reps1 === "number" ? logData.reps1 : null,
            weight2: typeof logData.weight2 === "number" ? logData.weight2 : null,
            reps2: typeof logData.reps2 === "number" ? logData.reps2 : null,
            weight3: typeof logData.weight3 === "number" ? logData.weight3 : null,
            reps3: typeof logData.reps3 === "number" ? logData.reps3 : null,
            holdTime: typeof logData.holdTime === "number" ? logData.holdTime : null,
            holdTime2: typeof logData.holdTime2 === "number" ? logData.holdTime2 : null,
            holdTime3: typeof logData.holdTime3 === "number" ? logData.holdTime3 : null,
            reps: typeof logData.reps === "number" ? logData.reps : null,
            modifier: asNullableString(logData.modifier),
            variant: asNullableString(logData.variant),
            notes: asNullableString(logData.notes),
            completed: asBoolean(logData.completed),
            createdAt: safeDate(logData.createdAt),
          },
        });
      }
    }
  });

  await writeRecycleBinEntries(entries.filter((entry) => entry.archiveId !== archiveId));
  return normalizeArchiveMeta(archive);
}

export async function permanentlyDeleteArchivedUser(archiveId: string): Promise<DeletedUserArchiveMeta> {
  const entries = await readRecycleBinEntries();
  const archive = entries.find((entry) => entry.archiveId === archiveId);
  if (!archive) {
    throw new Error("Archived user not found");
  }

  await writeRecycleBinEntries(entries.filter((entry) => entry.archiveId !== archiveId));
  return normalizeArchiveMeta(archive);
}
