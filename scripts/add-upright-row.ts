import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  const adapter = new PrismaLibSql({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const next = String(value || "").trim();
    if (!next) continue;
    const key = next.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }
  return out;
}

async function main() {
  const prisma = createPrismaClient();

  try {
    const admin = await prisma.user.findFirst({ where: { username: "admin" }, select: { id: true } });
    if (!admin) throw new Error("Admin user not found.");

    const progression = dedupe(["Standard", "Weighted"]);
    const variations = dedupe(["Dumbbell", "EZ Bar", "Barbell", "Cable", "Wide grip", "Close grip"]);

    const existing = await prisma.progressionExercise.findFirst({
      where: { name: "Upright row" },
      select: { id: true },
    });

    let exerciseId: string;
    let action: "created" | "updated";

    if (!existing) {
      const created = await prisma.progressionExercise.create({
        data: {
          name: "Upright row",
          wuxiaName: "Upright row",
          category: "Gym",
          equipmentType: "",
          bodyweight: false,
          weighted: true,
          rings: false,
          primaryMuscles: "Shoulders",
          secondaryMuscles: "",
          difficulty: "",
          wuxiaDifficulty: "",
          type: "",
          wuxiaType: "",
          story: "",
          tips: "[]",
          progression: JSON.stringify(progression),
          prerequisites: "[]",
          cues: "[]",
          commonMistakes: "[]",
          breathing: "",
          safetyConsiderations: "[]",
          competitionStandards: "{}",
          assignedDays: "",
          userId: admin.id,
        },
        select: { id: true },
      });
      exerciseId = created.id;
      action = "created";
    } else {
      exerciseId = existing.id;
      action = "updated";
      await prisma.progressionExercise.update({
        where: { id: exerciseId },
        data: {
          category: "Gym",
          bodyweight: false,
          weighted: true,
          primaryMuscles: "Shoulders",
          progression: JSON.stringify(progression),
        },
      });
    }

    await prisma.progressionTier.deleteMany({ where: { exerciseId } });
    await prisma.progressionTier.createMany({
      data: progression.map((name, index) => ({
        exerciseId,
        level: index + 1,
        name,
        wuxiaName: name,
        difficulty: "",
        wuxiaDifficulty: "",
        wuxiaType: "",
        description: "",
        targetHold: null,
        targetReps: null,
        targetRepsText: "",
      })),
    });

    await prisma.progressionVariation.deleteMany({ where: { exerciseId } });
    await prisma.progressionVariation.createMany({
      data: variations.map((name) => ({
        exerciseId,
        name,
        wuxiaName: name,
        difficulty: "",
        wuxiaDifficulty: "",
        wuxiaType: "",
        description: "",
      })),
    });

    await prisma.userProgressionLevel.upsert({
      where: {
        userId_exerciseId: {
          userId: admin.id,
          exerciseId,
        },
      },
      update: {},
      create: {
        userId: admin.id,
        exerciseId,
        currentLevel: 1,
      },
    });

    console.log(`Upright row ${action}.`);
    console.log(`Exercise ID: ${exerciseId}`);
    console.log(`Progression: ${JSON.stringify(progression)}`);
    console.log(`Variations: ${JSON.stringify(variations)}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to add Upright row:", error);
  process.exitCode = 1;
});
