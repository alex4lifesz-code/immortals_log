import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

type MergeRule = {
  sourceName: string;
  targetName: string;
  targetLevel?: number;
  targetVariant?: string;
};

const CANONICAL_NAMES = new Set([
  "Muscle up",
  "Pull up",
  "Dip",
  "Push up",
  "Handstand",
  "Handstand push up",
  "Front lever",
  "Back lever",
  "Planche",
  "Dragon flag",
  "L-sit",
  "Human flag",
  "Hang",
  "Support hold",
  "Leg raise",
  "Pistol squat",
  "Squat",
  "Bench press",
  "Chest fly",
  "Row",
  "Lat pulldown",
  "Deadlift",
  "Leg press",
  "Leg extension",
  "Leg curl",
  "Calf raise",
  "Hip abduction",
  "Shoulder press",
  "Lateral raise",
  "Front raise",
  "Reverse fly",
  "Face pull",
  "Bicep curl",
  "Forearm curl",
  "Tricep pushdown",
  "Cable kickback",
]);

const MERGE_RULES: MergeRule[] = [
  { sourceName: "Active Hang", targetName: "Hang", targetLevel: 2 },
  { sourceName: "Dead Hang", targetName: "Hang", targetLevel: 1 },

  { sourceName: "Scapular Pull-Up", targetName: "Pull up", targetLevel: 1 },
  { sourceName: "Assisted Pull-Up", targetName: "Pull up", targetLevel: 2 },
  { sourceName: "Strict Pull-Up", targetName: "Pull up", targetLevel: 4 },
  { sourceName: "Weighted Pull-Up", targetName: "Pull up", targetLevel: 5 },
  { sourceName: "Archer Pull-Up", targetName: "Pull up", targetLevel: 4, targetVariant: "Archer" },
  { sourceName: "Chest-to-Bar Pull-Up", targetName: "Pull up", targetLevel: 4, targetVariant: "Chest-to-bar" },
  { sourceName: "High Pull-Up", targetName: "Pull up", targetLevel: 4, targetVariant: "High" },
  { sourceName: "Ring Pull-Up", targetName: "Pull up", targetLevel: 4, targetVariant: "Ring" },
  { sourceName: "Typewriter Pull-Up", targetName: "Pull up", targetLevel: 4, targetVariant: "Typewriter" },

  { sourceName: "Bench Dip", targetName: "Dip", targetLevel: 1 },
  { sourceName: "Ring Dip", targetName: "Dip", targetLevel: 4, targetVariant: "Ring" },
  { sourceName: "Straight Bar Dip", targetName: "Dip", targetLevel: 4, targetVariant: "Straight bar" },
  { sourceName: "Russian Dip", targetName: "Dip", targetLevel: 5, targetVariant: "Russian" },

  { sourceName: "Transition Drill", targetName: "Muscle up", targetLevel: 1, targetVariant: "Bar" },
  { sourceName: "Band Assisted Muscle Up", targetName: "Muscle up", targetLevel: 2, targetVariant: "Bar" },
  { sourceName: "Negative Muscle Up", targetName: "Muscle up", targetLevel: 3, targetVariant: "Bar" },
  { sourceName: "Strict Bar Muscle Up", targetName: "Muscle up", targetLevel: 4, targetVariant: "Bar" },
  { sourceName: "Ring Muscle Up", targetName: "Muscle up", targetLevel: 4, targetVariant: "Ring" },

  { sourceName: "Pike Push-Up", targetName: "Handstand push up", targetLevel: 1 },
  { sourceName: "Elevated Pike Push-Up", targetName: "Handstand push up", targetLevel: 2 },
  { sourceName: "Wall Handstand Push-Up", targetName: "Handstand push up", targetLevel: 3 },
  { sourceName: "Deficit Wall Handstand Push-Up", targetName: "Handstand push up", targetLevel: 4 },
  { sourceName: "Freestanding Handstand Push-Up", targetName: "Handstand push up", targetLevel: 5 },
  { sourceName: "Wall Handstand Hold", targetName: "Handstand", targetLevel: 1 },

  { sourceName: "Tuck Front Lever Hold", targetName: "Front lever", targetLevel: 1 },
  { sourceName: "Tucked Front Lever Negative", targetName: "Front lever", targetLevel: 2 },
  { sourceName: "Advanced Tuck Front Lever Hold", targetName: "Front lever", targetLevel: 3 },
  { sourceName: "One Leg Front Lever Hold", targetName: "Front lever", targetLevel: 4 },
  { sourceName: "Straddle Front Lever Hold", targetName: "Front lever", targetLevel: 5 },
  { sourceName: "Full Front Lever Hold", targetName: "Front lever", targetLevel: 6 },
  { sourceName: "Front Lever Negatives", targetName: "Front lever", targetLevel: 2 },
  { sourceName: "Front Lever Pull", targetName: "Front lever", targetLevel: 3, targetVariant: "Pulls" },
  { sourceName: "Front Lever Pulls", targetName: "Front lever", targetLevel: 3, targetVariant: "Pulls" },
  { sourceName: "Ice Cream Maker", targetName: "Front lever", targetLevel: 3, targetVariant: "Ice Cream Maker" },

  { sourceName: "Hanging Leg Raise", targetName: "Leg raise", targetLevel: 2 },
  { sourceName: "Tucked Planche Press", targetName: "Planche", targetLevel: 3, targetVariant: "Press" },
  { sourceName: "Pendulum Squat", targetName: "Squat", targetLevel: 3, targetVariant: "Pendulum" },

  { sourceName: "Test Exercise", targetName: "", targetLevel: 0 },
  { sourceName: "Test 2", targetName: "", targetLevel: 0 },
  { sourceName: "Warrior II Pose", targetName: "", targetLevel: 0 },
];

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  const adapter = new PrismaLibSql({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

function normalizeVariant(existing: string | null, fallbackVariant: string | undefined): string | null {
  const existingTrimmed = (existing || "").trim();
  if (existingTrimmed) return existingTrimmed;
  const fallback = (fallbackVariant || "").trim();
  return fallback || null;
}

async function main() {
  const prisma = createPrismaClient();

  try {
    const admin = await prisma.user.findFirst({ where: { username: "admin" }, select: { id: true } });
    if (!admin) throw new Error("Admin user not found.");

    const bySourceName = new Map(MERGE_RULES.map((rule) => [rule.sourceName.toLowerCase(), rule]));

    const exercises = await prisma.progressionExercise.findMany({
      where: { userId: admin.id },
      select: { id: true, name: true },
    });

    const targetsByName = new Map<string, { id: string; name: string }>();
    for (const ex of exercises) {
      if (CANONICAL_NAMES.has(ex.name)) {
        targetsByName.set(ex.name.toLowerCase(), ex);
      }
    }

    let movedLogs = 0;
    let removedExercises = 0;
    let skippedWithLogs = 0;

    for (const source of exercises) {
      if (CANONICAL_NAMES.has(source.name)) continue;

      const rule = bySourceName.get(source.name.toLowerCase());

      const sourceLevels = await prisma.userProgressionLevel.findMany({
        where: { userId: admin.id, exerciseId: source.id },
        select: { id: true },
      });
      const sourceLevelIds = sourceLevels.map((row) => row.id);
      const sourceLogCount = sourceLevelIds.length > 0
        ? await prisma.progressionLog.count({ where: { userProgressionId: { in: sourceLevelIds } } })
        : 0;

      if (!rule) {
        if (sourceLogCount > 0) {
          skippedWithLogs += 1;
          console.warn(`Skipped (has logs, no rule): ${source.name}`);
          continue;
        }

        if (sourceLevelIds.length > 0) {
          await prisma.userProgressionLevel.deleteMany({ where: { id: { in: sourceLevelIds } } });
        }
        await prisma.progressionExercise.delete({ where: { id: source.id } });
        removedExercises += 1;
        console.log(`Removed unmapped legacy exercise without logs: ${source.name}`);
        continue;
      }

      if (!rule.targetName) {
        if (sourceLevelIds.length > 0) {
          await prisma.userProgressionLevel.deleteMany({ where: { id: { in: sourceLevelIds } } });
        }
        await prisma.progressionExercise.delete({ where: { id: source.id } });
        removedExercises += 1;
        console.log(`Removed legacy test/non-canonical exercise: ${source.name}`);
        continue;
      }

      const target = targetsByName.get(rule.targetName.toLowerCase());
      if (!target) {
        console.warn(`Skipped (target missing): ${source.name} -> ${rule.targetName}`);
        continue;
      }

      const targetUserProgress = await prisma.userProgressionLevel.upsert({
        where: {
          userId_exerciseId: {
            userId: admin.id,
            exerciseId: target.id,
          },
        },
        update: {},
        create: {
          userId: admin.id,
          exerciseId: target.id,
          currentLevel: 1,
        },
        select: { id: true },
      });

      if (sourceLevelIds.length > 0) {
        const logs = await prisma.progressionLog.findMany({
          where: { userProgressionId: { in: sourceLevelIds } },
          select: { id: true, level: true, variant: true },
        });

        for (const log of logs) {
          await prisma.progressionLog.update({
            where: { id: log.id },
            data: {
              userProgressionId: targetUserProgress.id,
              level: rule.targetLevel && rule.targetLevel > 0 ? rule.targetLevel : log.level,
              variant: normalizeVariant(log.variant, rule.targetVariant),
            },
          });
        }

        movedLogs += logs.length;
        await prisma.userProgressionLevel.deleteMany({ where: { id: { in: sourceLevelIds } } });
      }

      await prisma.progressionExercise.delete({ where: { id: source.id } });
      removedExercises += 1;
      console.log(`Merged legacy exercise: ${source.name} -> ${rule.targetName}`);
    }

    console.log("\nLegacy cleanup complete.");
    console.log(`Logs moved: ${movedLogs}`);
    console.log(`Legacy exercises removed: ${removedExercises}`);
    console.log(`Legacy exercises skipped (had logs and no rule): ${skippedWithLogs}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to clean up legacy exercises:", error);
  process.exitCode = 1;
});
