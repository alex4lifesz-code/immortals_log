import crypto from "node:crypto";
import { createClient as createSqlClient } from "@libsql/client";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

type ParentName = keyof typeof STYLE_VARIANTS_BY_EXERCISE;

const STYLE_VARIANTS_BY_EXERCISE = {
  "Barbell Bench Press": ["Close Grip", "Medium Grip", "Wide Grip"],
  "Barbell Curl": ["Narrow Grip", "Shoulder Width Grip", "Wide Grip"],
  "Barbell Row": ["Overhand Grip", "Underhand Grip", "Wide Grip"],
  "Barbell Squat": ["Narrow Stance", "Shoulder Width Stance", "Wide Stance"],
  "Bench Press": ["Close Grip", "Medium Grip", "Wide Grip"],
  "Cable Face Pull": ["Rope Grip", "Underhand Grip"],
  "Cable Kickbacks": ["Bent Knee", "Straight Leg"],
  "Cable Row": ["Close Grip", "Neutral Grip", "Wide Grip"],
  "Cable Tricep Pushdown": ["Rope Attachment", "Straight Bar", "Reverse Grip"],
  "Calf Raise": ["Toes In", "Toes Neutral", "Toes Out"],
  "Chest Fly": ["Neutral Grip", "Pronated Grip", "Rings"],
  "Deadlift": ["Conventional Stance", "Snatch Grip"],
  "Decline Barbell Bench Press": ["Close Grip", "Medium Grip", "Wide Grip"],
  "Dip": ["Chest Bias", "Neutral", "Tricep Bias"],
  "Dumbbell Bench Press": ["Alternating", "Neutral Grip", "Pronated Grip"],
  "Dumbbell Curl": ["Hammer Grip"],
  "Dumbbell Forearm Curl": ["Behind The Back", "Seated", "Standing"],
  "Dumbbell Lateral Raise": ["Leaning", "Seated", "Standing"],
  "Dumbbell Shoulder Press": ["Alternating", "Neutral Grip", "Pronated Grip"],
  "Front Raise": ["Alternating", "Plate", "Thumbs Up"],
  "Hammer Curl": ["Alternating", "Cross Body", "Rope Attachment"],
  "High Pull-Up": ["Neutral Grip", "Overhand Grip", "Wide Grip"],
  "Hip Abduction Machine": ["Controlled Tempo", "Forward Lean", "Upright"],
  "Incline Barbell Bench Press": ["Close Grip", "Medium Grip", "Wide Grip"],
  "Incline Dumbbell Bench Press": ["Alternating", "Neutral Grip", "Pronated Grip"],
  "Lat Pulldown": ["Close Grip", "Neutral Grip", "Underhand Grip", "Wide Grip"],
  "Leg Press": ["High Foot Placement", "Narrow Stance", "Wide Stance"],
  "Pendulum Squat": ["Heels Elevated", "Narrow Stance", "Wide Stance"],
  "Pull Up": ["Chin-Up", "Neutral Grip", "Wide Grip"],
  "Reverse Fly": ["Neutral Grip", "Pronated Grip", "Rings"],
  "Seated Leg Curl": ["Toes In", "Toes Neutral", "Toes Out"],
  "Seated Leg Extension": ["Toes In", "Toes Neutral", "Toes Out"],
} as const;

const PROMOTED_VARIANTS = [
  { parentName: "Front Lever", variantName: "Ice Cream Maker", newExerciseName: "Ice Cream Maker" },
  { parentName: "Front Lever", variantName: "Negatives", newExerciseName: "Front Lever Negatives" },
  { parentName: "Front Lever", variantName: "Pulls", newExerciseName: "Front Lever Pulls" },
  { parentName: "Front Lever", variantName: "Tucked Negative", newExerciseName: "Tucked Front Lever Negative" },
  { parentName: "One Arm Pull Up", variantName: "Negatives", newExerciseName: "One Arm Pull Up Negatives" },
  { parentName: "Planche", variantName: "Tucked Press", newExerciseName: "Tucked Planche Press" },
  { parentName: "Pull Up", variantName: "High Pull", newExerciseName: "High Pull-Up" },
] as const;

const REMOVED_VARIANTS = [
  { parentName: "Dumbbell Curl", variantName: "Standard" },
  { parentName: "Front Lever", variantName: "Hold" },
] as const;

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  const adapter = new PrismaLibSql({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

function normalizeVariantList(variants: string[]) {
  const seen = new Set<string>();
  return variants
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => left.localeCompare(right));
}

async function ensureHistoryTable(prisma: PrismaClient) {
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
}

async function getUserName(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, username: true },
  });

  return (user?.name || user?.username || "Unknown").slice(0, 120);
}

async function insertHistoryRow(
  prisma: PrismaClient,
  input: {
    exerciseId: string;
    exerciseName: string;
    userId: string;
    userName: string;
    field: string;
    beforeValue: string;
    afterValue: string;
  },
) {
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO ExerciseEditHistory (id, exerciseId, exerciseName, userId, userName, field, beforeValue, afterValue, editedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    crypto.randomUUID(),
    input.exerciseId,
    input.exerciseName,
    input.userId,
    input.userName,
    input.field,
    input.beforeValue,
    input.afterValue,
    new Date().toISOString(),
  );
}

async function main() {
  const prisma = createPrismaClient();
  const sqlClient = createSqlClient({ url: process.env.DATABASE_URL || "file:./dev.db" });

  try {
    await ensureHistoryTable(prisma);

    const parentNames = Array.from(
      new Set([
        ...Object.keys(STYLE_VARIANTS_BY_EXERCISE),
        ...PROMOTED_VARIANTS.map((item) => item.parentName),
        ...REMOVED_VARIANTS.map((item) => item.parentName),
      ]),
    );

    const exercises = await prisma.progressionExercise.findMany({
      where: { name: { in: parentNames } },
      include: {
        variations: { orderBy: { name: "asc" } },
        modifiers: true,
      },
    });

    const exercisesByName = new Map(exercises.map((exercise) => [exercise.name, exercise]));

    for (const parentName of parentNames) {
      if (!exercisesByName.has(parentName)) {
        console.warn(`Skipped missing parent exercise: ${parentName}`);
      }
    }

    const userNameById = new Map<string, string>();
    for (const exercise of exercises) {
      if (!userNameById.has(exercise.userId)) {
        userNameById.set(exercise.userId, await getUserName(prisma, exercise.userId));
      }
    }

    const existingExercises = await prisma.progressionExercise.findMany({
      select: { id: true, name: true, userId: true },
    });
    const existingExerciseKeys = new Set(
      existingExercises.map((exercise) => `${exercise.userId}:${exercise.name.toLowerCase()}`),
    );

    for (const promotion of PROMOTED_VARIANTS) {
      const parent = exercisesByName.get(promotion.parentName);
      if (!parent) continue;

      const parentVariants = parent.variations.map((variation) => variation.name);
      const hasVariant = parentVariants.some(
        (variationName) => variationName.toLowerCase() === promotion.variantName.toLowerCase(),
      );
      if (!hasVariant) continue;

      const exerciseKey = `${parent.userId}:${promotion.newExerciseName.toLowerCase()}`;
      if (existingExerciseKeys.has(exerciseKey)) continue;

      const createdExercise = await prisma.progressionExercise.create({
        data: {
          name: promotion.newExerciseName,
          wuxiaName: promotion.newExerciseName,
          difficulty: parent.difficulty,
          wuxiaDifficulty: parent.wuxiaDifficulty,
          type: parent.type,
          wuxiaType: parent.wuxiaType,
          story: parent.story,
          tips: parent.tips,
          category: parent.category,
          equipmentType: parent.equipmentType,
          bodyweight: parent.bodyweight,
          weighted: parent.weighted,
          rings: parent.rings,
          primaryMuscles: parent.primaryMuscles,
          secondaryMuscles: parent.secondaryMuscles,
          prerequisites: parent.prerequisites,
          cues: parent.cues,
          commonMistakes: parent.commonMistakes,
          breathing: parent.breathing,
          safetyConsiderations: parent.safetyConsiderations,
          competitionStandards: parent.competitionStandards,
          assignedDays: parent.assignedDays,
          userId: parent.userId,
        },
      });

      await prisma.progressionTier.create({
        data: {
          exerciseId: createdExercise.id,
          level: 1,
          name: promotion.newExerciseName,
          wuxiaName: promotion.newExerciseName,
        },
      });

      if (parent.modifiers.length > 0) {
        await prisma.progressionModifier.createMany({
          data: parent.modifiers.map((modifier) => ({
            exerciseId: createdExercise.id,
            type: modifier.type,
            available: modifier.available,
            difficultyMod: modifier.difficultyMod,
            notes: modifier.notes,
            method: modifier.method,
            difficultyIncrease: modifier.difficultyIncrease,
          })),
        });
      }

      await prisma.userProgressionLevel.create({
        data: {
          userId: parent.userId,
          exerciseId: createdExercise.id,
          currentLevel: 1,
        },
      });

      existingExerciseKeys.add(exerciseKey);

      const userName = userNameById.get(parent.userId) ?? "Unknown";
      await insertHistoryRow(prisma, {
        exerciseId: createdExercise.id,
        exerciseName: createdExercise.name,
        userId: parent.userId,
        userName,
        field: "Created",
        beforeValue: "—",
        afterValue: `Promoted from ${promotion.parentName} variant: ${promotion.variantName}`,
      });
    }

    for (const exercise of exercises) {
      const originalVariants = exercise.variations.map((variation) => variation.name);
      const originalByLowerName = new Map(
        exercise.variations.map((variation) => [variation.name.toLowerCase(), variation]),
      );

      const promotedNames = new Set(
        PROMOTED_VARIANTS
          .filter((item) => item.parentName === exercise.name)
          .map((item) => item.variantName.toLowerCase()),
      );
      const removedNames = new Set(
        REMOVED_VARIANTS
          .filter((item) => item.parentName === exercise.name)
          .map((item) => item.variantName.toLowerCase()),
      );
      const desiredStyleVariants = STYLE_VARIANTS_BY_EXERCISE[exercise.name as ParentName] ?? [];

      const finalVariants = normalizeVariantList([
        ...originalVariants.filter((variantName) => {
          const key = variantName.toLowerCase();
          return !promotedNames.has(key) && !removedNames.has(key);
        }),
        ...desiredStyleVariants,
      ]);

      const finalVariantKeys = new Set(finalVariants.map((variantName) => variantName.toLowerCase()));
      const variantsToDelete = exercise.variations.filter(
        (variation) => !finalVariantKeys.has(variation.name.toLowerCase()),
      );
      const variantsToCreate = finalVariants.filter(
        (variantName) => !originalByLowerName.has(variantName.toLowerCase()),
      );

      if (variantsToDelete.length === 0 && variantsToCreate.length === 0) continue;

      if (variantsToDelete.length > 0) {
        for (const variation of variantsToDelete) {
          await sqlClient.execute({
            sql: `DELETE FROM ProgressionVariation WHERE id = ?`,
            args: [variation.id],
          });
        }
      }

      if (variantsToCreate.length > 0) {
        for (const variantName of variantsToCreate) {
          await sqlClient.execute({
            sql: `
              INSERT INTO ProgressionVariation (id, exerciseId, name, wuxiaName, difficulty, wuxiaDifficulty, wuxiaType, description)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
              crypto.randomUUID(),
              exercise.id,
              variantName,
              variantName,
              "",
              "",
              "",
              "",
            ],
          });
        }
      }

      const userName = userNameById.get(exercise.userId) ?? "Unknown";
      await insertHistoryRow(prisma, {
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        userId: exercise.userId,
        userName,
        field: "Variants",
        beforeValue: originalVariants.join(", ") || "—",
        afterValue: finalVariants.join(", ") || "—",
      });
    }

    console.log("Exercise variant normalization complete.");
  } finally {
    await sqlClient.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to normalize exercise variants:", error);
  process.exitCode = 1;
});