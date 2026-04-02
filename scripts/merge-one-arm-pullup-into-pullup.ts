import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  const adapter = new PrismaLibSql({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

const SOURCE_LEVEL_MAP: Array<{ name: string; targetLevel: number }> = [
  { name: "One Arm Pull Up Assisted", targetLevel: 6 },
  { name: "One-Arm Pull-Up Negatives", targetLevel: 7 },
  { name: "One-Arm Pull-Up", targetLevel: 8 },
];

async function main() {
  const prisma = createPrismaClient();

  try {
    const admin = await prisma.user.findFirst({ where: { username: "admin" }, select: { id: true } });
    if (!admin) throw new Error("Admin user not found.");

    const pullUp = await prisma.progressionExercise.findFirst({
      where: { userId: admin.id, name: "Pull up" },
      select: { id: true },
    });
    if (!pullUp) throw new Error('Canonical "Pull up" exercise not found for admin.');

    const targetUserProgress = await prisma.userProgressionLevel.upsert({
      where: {
        userId_exerciseId: {
          userId: admin.id,
          exerciseId: pullUp.id,
        },
      },
      update: {},
      create: {
        userId: admin.id,
        exerciseId: pullUp.id,
        currentLevel: 1,
      },
      select: { id: true },
    });

    let movedLogs = 0;
    let removedExercises = 0;

    for (const source of SOURCE_LEVEL_MAP) {
      const sourceExercise = await prisma.progressionExercise.findFirst({
        where: { userId: admin.id, name: source.name },
        select: { id: true, name: true },
      });
      if (!sourceExercise) continue;

      const sourceLevels = await prisma.userProgressionLevel.findMany({
        where: { userId: admin.id, exerciseId: sourceExercise.id },
        select: { id: true },
      });

      if (sourceLevels.length > 0) {
        const sourceLevelIds = sourceLevels.map((row) => row.id);
        const updateResult = await prisma.progressionLog.updateMany({
          where: { userProgressionId: { in: sourceLevelIds } },
          data: {
            userProgressionId: targetUserProgress.id,
            level: source.targetLevel,
          },
        });
        movedLogs += updateResult.count;

        await prisma.userProgressionLevel.deleteMany({
          where: { id: { in: sourceLevelIds } },
        });
      }

      await prisma.progressionExercise.delete({ where: { id: sourceExercise.id } });
      removedExercises += 1;
    }

    console.log("One-arm pull-up merge complete.");
    console.log(`Logs moved to Pull up: ${movedLogs}`);
    console.log(`Source exercises removed: ${removedExercises}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to merge one-arm pull-up exercises:", error);
  process.exitCode = 1;
});
