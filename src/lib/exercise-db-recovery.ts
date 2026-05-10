import { prisma } from "@/lib/prisma";

type SnapshotLog = {
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
  reps: number | null;
  modifier: string | null;
  variant: string | null;
  setupOption: string | null;
  notes: string | null;
  completed: boolean;
  createdAt: string;
};

type SnapshotEntry = {
  userId: string;
  exerciseName: string;
  currentLevel: number;
  logs: SnapshotLog[];
};

function normalizeKey(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function ensureRecoveryTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ExerciseDbRecoverySnapshot (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);
}

export async function snapshotExerciseDbUserProgress() {
  await ensureRecoveryTable();

  const levels = await prisma.userProgressionLevel.findMany({
    include: {
      exercise: {
        select: { name: true },
      },
      logs: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const payload: SnapshotEntry[] = levels.map((level) => ({
    userId: level.userId,
    exerciseName: level.exercise.name,
    currentLevel: level.currentLevel,
    logs: level.logs.map((log) => ({
      level: log.level,
      weight1: log.weight1 ?? null,
      reps1: log.reps1 ?? null,
      weight2: log.weight2 ?? null,
      reps2: log.reps2 ?? null,
      weight3: log.weight3 ?? null,
      reps3: log.reps3 ?? null,
      holdTime: log.holdTime ?? null,
      holdTime2: log.holdTime2 ?? null,
      holdTime3: log.holdTime3 ?? null,
      reps: log.reps ?? null,
      modifier: log.modifier ?? null,
      variant: log.variant ?? null,
      setupOption: log.setupOption ?? null,
      notes: log.notes ?? null,
      completed: Boolean(log.completed),
      createdAt: log.createdAt.toISOString(),
    })),
  }));

  const logCount = payload.reduce((sum, entry) => sum + entry.logs.length, 0);
  await prisma.$executeRawUnsafe(
    `
      INSERT OR REPLACE INTO ExerciseDbRecoverySnapshot (id, payload, createdAt)
      VALUES (?, ?, ?)
    `,
    "latest",
    JSON.stringify(payload),
    new Date().toISOString(),
  );

  return {
    levelCount: payload.length,
    logCount,
  };
}

export async function restoreExerciseDbUserProgressFromSnapshot() {
  await ensureRecoveryTable();

  const rows = await prisma.$queryRawUnsafe<Array<{ payload: string }>>(
    `SELECT payload FROM ExerciseDbRecoverySnapshot WHERE id = 'latest' LIMIT 1`,
  );

  if (rows.length === 0) {
    return { restoredLevels: 0, restoredLogs: 0, skippedEntries: 0 };
  }

  let entries: SnapshotEntry[] = [];
  try {
    const parsed = JSON.parse(rows[0].payload);
    if (Array.isArray(parsed)) {
      entries = parsed as SnapshotEntry[];
    }
  } catch {
    entries = [];
  }

  const exercises = await prisma.progressionExercise.findMany({
    select: { id: true, name: true },
  });
  const exerciseByName = new Map(exercises.map((exercise) => [normalizeKey(exercise.name), exercise]));

  let restoredLevels = 0;
  let restoredLogs = 0;
  let skippedEntries = 0;

  for (const entry of entries) {
    const exercise = exerciseByName.get(normalizeKey(entry.exerciseName));
    if (!exercise) {
      skippedEntries++;
      continue;
    }

    const level = await prisma.userProgressionLevel.upsert({
      where: {
        userId_exerciseId: {
          userId: entry.userId,
          exerciseId: exercise.id,
        },
      },
      update: {
        currentLevel: entry.currentLevel,
      },
      create: {
        userId: entry.userId,
        exerciseId: exercise.id,
        currentLevel: entry.currentLevel,
      },
      select: { id: true },
    });
    restoredLevels++;

    for (const log of entry.logs) {
      await prisma.progressionLog.create({
        data: {
          userProgressionId: level.id,
          level: log.level,
          weight1: log.weight1,
          reps1: log.reps1,
          weight2: log.weight2,
          reps2: log.reps2,
          weight3: log.weight3,
          reps3: log.reps3,
          holdTime: log.holdTime,
          holdTime2: log.holdTime2,
          holdTime3: log.holdTime3,
          reps: log.reps,
          modifier: log.modifier,
          variant: log.variant,
          setupOption: log.setupOption ?? null,
          notes: log.notes,
          completed: log.completed,
          createdAt: new Date(log.createdAt),
        },
      });
      restoredLogs++;
    }
  }

  await prisma.$executeRawUnsafe(`DELETE FROM ExerciseDbRecoverySnapshot WHERE id = 'latest'`);

  return { restoredLevels, restoredLogs, skippedEntries };
}
