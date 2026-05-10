/**
 * import-exercise-library.ts
 *
 * Imports all exercises from seed-data/exercise-library-full.json into the
 * ProgressionExercise table for the admin user. Creates tiers and variations.
 * If an exercise already exists (by name), it updates progressions/variations.
 *
 * Usage:
 *   npx tsx scripts/import-exercise-library.ts [username]
 *   Default username: admin
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { readFileSync } from "fs";
import { resolve } from "path";

type SeedExercise = {
  name: string;
  category: string;
  equipmentType: string;
  bodyweight: boolean;
  weighted: boolean;
  rings: boolean;
  primaryMuscles: string;
  progression: string[];
  variations: string[];
  modifiers?: string[];
};

type SeedData = {
  version: number;
  exercises: SeedExercise[];
};

const TARGET_USERNAME = process.argv[2] || "__app_exercise_library__";

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
  const seedPath = resolve(__dirname, "../seed-data/exercise-library-full.json");
  const raw = readFileSync(seedPath, "utf-8");
  const seedData: SeedData = JSON.parse(raw);

  console.log(`\nLoaded ${seedData.exercises.length} exercises from seed file (v${seedData.version})\n`);

  const prisma = createPrismaClient();

  try {
    const admin = await prisma.user.findFirst({
      where: { username: TARGET_USERNAME },
      select: { id: true, username: true },
    });
    if (!admin) {
      throw new Error(`User "${TARGET_USERNAME}" not found. Run seed-admin-simple.js first.`);
    }
    console.log(`Target user: ${admin.username} (${admin.id})\n`);

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const row of seedData.exercises) {
      const progression = dedupe(row.progression);
      const variations = dedupe(row.variations);
      const modifiers = dedupe(row.modifiers ?? []);

      try {
        const existing = await prisma.progressionExercise.findFirst({
          where: { name: row.name, userId: admin.id },
          select: { id: true },
        });

        let exerciseId: string;

        if (!existing) {
          const createdExercise = await prisma.progressionExercise.create({
            data: {
              name: row.name,
              wuxiaName: row.name,
              category: row.category,
              equipmentType: row.equipmentType,
              bodyweight: row.bodyweight,
              weighted: row.weighted,
              rings: row.rings,
              primaryMuscles: row.primaryMuscles,
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
          exerciseId = createdExercise.id;
          created++;
        } else {
          exerciseId = existing.id;
          await prisma.progressionExercise.update({
            where: { id: exerciseId },
            data: {
              category: row.category,
              equipmentType: row.equipmentType,
              bodyweight: row.bodyweight,
              weighted: row.weighted,
              rings: row.rings,
              primaryMuscles: row.primaryMuscles,
              progression: JSON.stringify(progression),
            },
          });
          updated++;
        }

        // Rebuild tiers
        await prisma.progressionTier.deleteMany({ where: { exerciseId } });
        if (progression.length > 0) {
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
        }

        // Rebuild variations
        await prisma.progressionVariation.deleteMany({ where: { exerciseId } });
        if (variations.length > 0) {
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
        }

        // Rebuild modifiers (used for grip/props/setup selections)
        await prisma.progressionModifier.deleteMany({ where: { exerciseId } });
        if (modifiers.length > 0) {
          await prisma.progressionModifier.createMany({
            data: modifiers.map((type) => ({
              exerciseId,
              type,
              available: true,
              difficultyMod: 0,
              notes: "",
              method: "",
              difficultyIncrease: "",
            })),
          });
        }

        // Ensure owner has a baseline progression row so history/joins stay stable.
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${row.name}: ${msg}`);
      }
    }

    console.log("Exercise library import complete.");
    console.log(`  Total: ${seedData.exercises.length}`);
    console.log(`  Created: ${created}`);
    console.log(`  Updated: ${updated}`);
    if (errors.length) {
      console.log(`  Errors: ${errors.length}`);
      for (const e of errors) console.log(`    - ${e}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to import exercises:", error);
  process.exitCode = 1;
});
