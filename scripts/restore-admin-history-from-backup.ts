import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

type SourceLog = {
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
  notes: string | null;
  completed: boolean;
  createdAt: Date;
  exerciseName: string;
};

function createPrismaClient(databaseUrl: string) {
  const adapter = new PrismaLibSql({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

function normalizeKey(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const EXERCISE_REMAP: Record<string, string> = {
  "gym squat": "Squat",
  "chest press": "Chest press machine",
  "hamstring curl": "Leg curl",
  "lateral raise": "Shoulder raise",
  "front raise": "Shoulder raise",
  "rear delt fly": "Shoulder raise",
  "hip abduction": "Abductor machine",
  "cable kickback": "Glute kickback machine",
  "bike": "Stationary bike",
};

function remapExerciseName(sourceName: string): string {
  const normalized = normalizeKey(sourceName);
  return EXERCISE_REMAP[normalized] || sourceName;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const positionalArgs = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const sourceUrl = positionalArgs[0] || "file:./backups/dev-before-checkin-cleanup-20260415.db";
  const targetUrl = process.env.DATABASE_URL || "file:./dev.db";

  const source = createPrismaClient(sourceUrl);
  const target = createPrismaClient(targetUrl);

  try {
    const sourceAdmin = await source.user.findFirst({ where: { username: "admin" }, select: { id: true } });
    const targetAdmin = await target.user.findFirst({ where: { username: "admin" }, select: { id: true } });

    if (!sourceAdmin) throw new Error(`Admin user not found in source DB: ${sourceUrl}`);
    if (!targetAdmin) throw new Error(`Admin user not found in target DB: ${targetUrl}`);

    const sourceLogsRaw = await source.progressionLog.findMany({
      where: { userProgression: { userId: sourceAdmin.id } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
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
        notes: true,
        completed: true,
        createdAt: true,
        userProgression: {
          select: {
            exercise: {
              select: { name: true },
            },
          },
        },
      },
    });

    const sourceLogs: SourceLog[] = sourceLogsRaw.map((row) => ({
      level: row.level,
      weight1: row.weight1,
      reps1: row.reps1,
      weight2: row.weight2,
      reps2: row.reps2,
      weight3: row.weight3,
      reps3: row.reps3,
      holdTime: row.holdTime,
      holdTime2: row.holdTime2,
      holdTime3: row.holdTime3,
      reps: row.reps,
      modifier: row.modifier,
      variant: row.variant,
      notes: row.notes,
      completed: row.completed,
      createdAt: row.createdAt,
      exerciseName: row.userProgression.exercise.name,
    }));

    const targetExercises = await target.progressionExercise.findMany({
      select: { id: true, name: true },
    });
    const targetByName = new Map<string, { id: string; name: string }>();
    for (const exercise of targetExercises) {
      targetByName.set(normalizeKey(exercise.name), exercise);
    }

    const unresolved = new Map<string, number>();
    const mapped: Array<{ log: SourceLog; exerciseId: string; exerciseName: string }> = [];

    for (const log of sourceLogs) {
      const remappedName = remapExerciseName(log.exerciseName);
      const match = targetByName.get(normalizeKey(remappedName));
      if (!match) {
        unresolved.set(log.exerciseName, (unresolved.get(log.exerciseName) || 0) + 1);
        continue;
      }
      mapped.push({ log, exerciseId: match.id, exerciseName: match.name });
    }

    const distinctMapped = new Set(mapped.map((row) => row.exerciseId)).size;
    const unresolvedList = [...unresolved.entries()].sort((a, b) => b[1] - a[1]);

    console.log("Admin history restore plan:");
    console.log(`  Source DB: ${sourceUrl}`);
    console.log(`  Target DB: ${targetUrl}`);
    console.log(`  Source logs: ${sourceLogs.length}`);
    console.log(`  Mapped logs: ${mapped.length}`);
    console.log(`  Distinct mapped exercises: ${distinctMapped}`);
    console.log(`  Unresolved logs: ${sourceLogs.length - mapped.length}`);
    if (unresolvedList.length > 0) {
      console.log("  Unresolved exercise names (top 20):");
      for (const [name, count] of unresolvedList.slice(0, 20)) {
        console.log(`    - ${name}: ${count}`);
      }
    }

    if (!apply) {
      console.log("Dry-run only. Re-run with --apply to execute restore.");
      return;
    }

    await target.progressionLog.deleteMany({ where: { userProgression: { userId: targetAdmin.id } } });

    const progressionByExercise = new Map<string, string>();
    for (const exerciseId of new Set(mapped.map((item) => item.exerciseId))) {
      const row = await target.userProgressionLevel.upsert({
        where: { userId_exerciseId: { userId: targetAdmin.id, exerciseId } },
        update: {},
        create: { userId: targetAdmin.id, exerciseId, currentLevel: 1 },
        select: { id: true },
      });
      progressionByExercise.set(exerciseId, row.id);
    }

    const maxLevelByExercise = new Map<string, number>();

    for (const item of mapped) {
      const userProgressionId = progressionByExercise.get(item.exerciseId);
      if (!userProgressionId) continue;

      await target.progressionLog.create({
        data: {
          userProgressionId,
          level: item.log.level,
          weight1: item.log.weight1,
          reps1: item.log.reps1,
          weight2: item.log.weight2,
          reps2: item.log.reps2,
          weight3: item.log.weight3,
          reps3: item.log.reps3,
          holdTime: item.log.holdTime,
          holdTime2: item.log.holdTime2,
          holdTime3: item.log.holdTime3,
          reps: item.log.reps,
          modifier: item.log.modifier,
          variant: item.log.variant,
          notes: item.log.notes,
          completed: item.log.completed,
          createdAt: item.log.createdAt,
        },
      });

      const current = maxLevelByExercise.get(item.exerciseId) || 0;
      if (item.log.level > current) maxLevelByExercise.set(item.exerciseId, item.log.level);
    }

    for (const [exerciseId, maxLevel] of maxLevelByExercise.entries()) {
      await target.userProgressionLevel.update({
        where: { userId_exerciseId: { userId: targetAdmin.id, exerciseId } },
        data: { currentLevel: maxLevel },
      });
    }

    const restored = await target.progressionLog.count({ where: { userProgression: { userId: targetAdmin.id } } });
    console.log(`Restore complete. Admin logs now: ${restored}`);
  } finally {
    await source.$disconnect();
    await target.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to restore admin history from backup:", error);
  process.exitCode = 1;
});
