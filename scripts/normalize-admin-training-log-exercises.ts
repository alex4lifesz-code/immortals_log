import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

type MergeRule = {
  sourceName: string;
  targetName: string;
  targetLevel?: number;
  targetVariant?: string;
};

const MERGE_RULES: MergeRule[] = [
  { sourceName: "Barbell Bench Press", targetName: "Bench press", targetLevel: 2, targetVariant: "Flat" },
  { sourceName: "Dumbbell Bench Press", targetName: "Bench press", targetLevel: 1, targetVariant: "Flat" },
  { sourceName: "Incline Barbell Bench Press", targetName: "Bench press", targetLevel: 2, targetVariant: "Incline" },
  { sourceName: "Decline Barbell Bench Press", targetName: "Bench press", targetLevel: 2, targetVariant: "Decline" },
  { sourceName: "Incline Dumbbell Bench Press", targetName: "Bench press", targetLevel: 1, targetVariant: "Incline" },
  { sourceName: "Cable Row", targetName: "Row", targetLevel: 3, targetVariant: "Seated" },
  { sourceName: "Dumbbell Curl", targetName: "Bicep curl", targetLevel: 1, targetVariant: "Standard" },
];

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  const adapter = new PrismaLibSql({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

function normalizeVariant(existing: string | null, nextVariant: string | undefined): string | null {
  if (existing && existing.trim()) return existing.trim();
  if (nextVariant && nextVariant.trim()) return nextVariant.trim();
  return null;
}

async function main() {
  const prisma = createPrismaClient();

  try {
    const admin = await prisma.user.findFirst({ where: { username: "admin" }, select: { id: true } });
    if (!admin) throw new Error("Admin user not found.");

    let totalMovedLogs = 0;
    let totalRemovedExercises = 0;

    for (const rule of MERGE_RULES) {
      const sourceExercise = await prisma.progressionExercise.findFirst({
        where: { userId: admin.id, name: rule.sourceName },
        select: { id: true, name: true },
      });
      if (!sourceExercise) continue;

      const sourceLevels = await prisma.userProgressionLevel.findMany({
        where: { userId: admin.id, exerciseId: sourceExercise.id },
        select: { id: true },
      });

      if (sourceLevels.length === 0) {
        await prisma.progressionExercise.delete({ where: { id: sourceExercise.id } });
        totalRemovedExercises += 1;
        continue;
      }

      const targetExercise = await prisma.progressionExercise.findFirst({
        where: { userId: admin.id, name: rule.targetName },
        select: { id: true },
      });
      if (!targetExercise) {
        console.warn(`Skipped: target exercise not found for rule ${rule.sourceName} -> ${rule.targetName}`);
        continue;
      }

      const targetUserProgress = await prisma.userProgressionLevel.upsert({
        where: {
          userId_exerciseId: {
            userId: admin.id,
            exerciseId: targetExercise.id,
          },
        },
        update: {},
        create: {
          userId: admin.id,
          exerciseId: targetExercise.id,
          currentLevel: 1,
        },
        select: { id: true },
      });

      const sourceLevelIds = sourceLevels.map((row) => row.id);
      const sourceLogs = await prisma.progressionLog.findMany({
        where: { userProgressionId: { in: sourceLevelIds } },
        select: { id: true, level: true, variant: true },
      });

      for (const log of sourceLogs) {
        const nextLevel = rule.targetLevel ?? log.level;
        const nextVariant = normalizeVariant(log.variant, rule.targetVariant);
        await prisma.progressionLog.update({
          where: { id: log.id },
          data: {
            userProgressionId: targetUserProgress.id,
            level: nextLevel,
            variant: nextVariant,
          },
        });
      }

      totalMovedLogs += sourceLogs.length;

      await prisma.userProgressionLevel.deleteMany({ where: { id: { in: sourceLevelIds } } });
      await prisma.progressionExercise.delete({ where: { id: sourceExercise.id } });
      totalRemovedExercises += 1;

      console.log(`Merged ${sourceLogs.length} log(s): ${rule.sourceName} -> ${rule.targetName}`);
    }

    console.log("Admin training log exercise normalization complete.");
    console.log(`Total logs moved: ${totalMovedLogs}`);
    console.log(`Total source exercises removed: ${totalRemovedExercises}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to normalize admin training log exercises:", error);
  process.exitCode = 1;
});
