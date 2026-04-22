/**
 * Consolidate standalone Gym squat-variant exercises into the single "Gym Squat"
 * parent, moving all training logs onto the parent and tagging each log with the
 * appropriate `variant` value.
 *
 * Usage:
 *   npx tsx scripts/consolidate-gym-squat-variants.ts            # dry run
 *   npx tsx scripts/consolidate-gym-squat-variants.ts --apply    # commit changes
 *
 * What it does:
 *   1. For each (childExerciseName -> variantName) mapping below:
 *      - Find the child ProgressionExercise(s).
 *      - For every UserProgressionLevel on a child, ensure the same user has a
 *        UserProgressionLevel for the parent ("Gym Squat"); create it if missing.
 *      - Re-point all ProgressionLog rows from the child UserProgressionLevel to
 *        the parent UserProgressionLevel, setting `variant` to the mapped name
 *        when it isn't already populated.
 *      - Delete the now-empty child UserProgressionLevel rows.
 *      - Delete the child ProgressionExercise (cascades tiers/variations/modifiers).
 *   2. Ensure the parent's ProgressionVariation list covers every mapped variant.
 *
 * Calisthenics "Squat", "Bulgarian split squat", "Pistol squat", "Sissy squat",
 * and "Smith machine squat" are intentionally NOT consolidated (different patterns
 * / different category).
 */

import crypto from "node:crypto";
import { createClient as createSqlClient } from "@libsql/client";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const PARENT_NAME = "Gym Squat";

// childExerciseName (case-insensitive match) -> variant name on Gym Squat
const CHILD_TO_VARIANT: Record<string, string> = {
  "Front squat": "Front",
  "Hack squat": "Hack",
  "Hack squat machine": "Hack",
  "Pendulum squat": "Pendulum",
  "Belt squat": "Belt",
  "Kettlebell goblet squat": "Goblet",
  "Overhead squat": "Overhead",
  "Landmine squat": "Landmine",
  "Anderson squat": "Anderson",
  "Box squat": "Box",
  "Pause squat": "Pause",
  "Pin squat": "Pin",
  "Tempo squat": "Tempo",
};

const APPLY = process.argv.includes("--apply");

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  const adapter = new PrismaLibSql({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

type Counters = {
  childExercisesFound: number;
  logsRepointed: number;
  variantTagsAssigned: number;
  parentLevelsCreated: number;
  childLevelsDeleted: number;
  childExercisesDeleted: number;
  variantsAdded: number;
};

async function main() {
  const prisma = createPrismaClient();
  const sqlClient = createSqlClient({ url: process.env.DATABASE_URL || "file:./dev.db" });

  const counters: Counters = {
    childExercisesFound: 0,
    logsRepointed: 0,
    variantTagsAssigned: 0,
    parentLevelsCreated: 0,
    childLevelsDeleted: 0,
    childExercisesDeleted: 0,
    variantsAdded: 0,
  };

  console.log(`\n=== Gym Squat consolidation (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);

  try {
    // Find every Gym Squat parent (could be one per scope; usually app-owned single row).
    const parents = await prisma.progressionExercise.findMany({
      where: { name: PARENT_NAME },
      include: { variations: true },
    });

    if (parents.length === 0) {
      console.error(`No "${PARENT_NAME}" parent exercise found. Aborting.`);
      return;
    }
    if (parents.length > 1) {
      console.warn(
        `Found ${parents.length} "${PARENT_NAME}" rows; will route each child to the parent owned by the same userId when possible.`,
      );
    }

    const parentByUserId = new Map(parents.map((p) => [p.userId, p]));
    const defaultParent = parents[0];

    // Build case-insensitive child name -> variant lookup.
    const childNameLookup = new Map<string, string>();
    for (const [name, variant] of Object.entries(CHILD_TO_VARIANT)) {
      childNameLookup.set(name.toLowerCase(), variant);
    }

    // Fetch all candidate children (case-insensitive comparison done in JS per repo memory).
    const allExercises = await prisma.progressionExercise.findMany({
      select: { id: true, name: true, userId: true },
    });
    const childExercises = allExercises.filter((e) =>
      childNameLookup.has(e.name.toLowerCase()),
    );
    counters.childExercisesFound = childExercises.length;

    if (childExercises.length === 0) {
      console.log("No child squat exercises present. Nothing to consolidate.");
    }

    // Group children by intended variant for nice logging.
    for (const child of childExercises) {
      const variant = childNameLookup.get(child.name.toLowerCase())!;
      const parent = parentByUserId.get(child.userId) ?? defaultParent;

      console.log(
        `- "${child.name}" (id=${child.id}, owner=${child.userId}) -> "${PARENT_NAME}" variant "${variant}"`,
      );

      // Pull all UserProgressionLevel rows on this child, with their logs.
      const childLevels = await prisma.userProgressionLevel.findMany({
        where: { exerciseId: child.id },
        include: { logs: { select: { id: true, variant: true } } },
      });

      for (const childLevel of childLevels) {
        // Ensure a parent UserProgressionLevel exists for this user.
        let parentLevel = await prisma.userProgressionLevel.findUnique({
          where: {
            userId_exerciseId: { userId: childLevel.userId, exerciseId: parent.id },
          },
          select: { id: true },
        });

        if (!parentLevel) {
          if (APPLY) {
            const created = await prisma.userProgressionLevel.create({
              data: {
                userId: childLevel.userId,
                exerciseId: parent.id,
                currentLevel: childLevel.currentLevel,
              },
              select: { id: true },
            });
            parentLevel = created;
          } else {
            // For dry-run we still need *some* placeholder id for the log preview count.
            parentLevel = { id: "(dry-run-new-parent-level)" };
          }
          counters.parentLevelsCreated += 1;
          console.log(
            `    + create UserProgressionLevel for user ${childLevel.userId} on parent`,
          );
        }

        if (childLevel.logs.length > 0) {
          counters.logsRepointed += childLevel.logs.length;
          const needsVariantTag = childLevel.logs.filter((l) => !l.variant).length;
          counters.variantTagsAssigned += needsVariantTag;
          console.log(
            `    ~ repoint ${childLevel.logs.length} log(s); tag ${needsVariantTag} as variant="${variant}"`,
          );

          if (APPLY) {
            // Re-point logs and set variant only where empty.
            await sqlClient.execute({
              sql: `
                UPDATE ProgressionLog
                SET userProgressionId = ?,
                    variant = COALESCE(NULLIF(variant, ''), ?)
                WHERE userProgressionId = ?
              `,
              args: [parentLevel.id, variant, childLevel.id],
            });
          }
        }

        // Delete the (now-empty) child UserProgressionLevel.
        if (APPLY) {
          await prisma.userProgressionLevel.delete({ where: { id: childLevel.id } });
        }
        counters.childLevelsDeleted += 1;
      }

      // Delete the child ProgressionExercise (cascades tiers/variations/modifiers).
      if (APPLY) {
        await prisma.progressionExercise.delete({ where: { id: child.id } });
      }
      counters.childExercisesDeleted += 1;
      console.log(`    - delete child ProgressionExercise "${child.name}"`);
    }

    // Make sure parent variation list covers every mapped variant.
    const desiredVariants = Array.from(new Set(Object.values(CHILD_TO_VARIANT)));
    for (const parent of parents) {
      const existing = new Set(parent.variations.map((v) => v.name.toLowerCase()));
      const missing = desiredVariants.filter((v) => !existing.has(v.toLowerCase()));
      if (missing.length === 0) continue;

      console.log(
        `\nParent "${PARENT_NAME}" (id=${parent.id}) missing variants: ${missing.join(", ")}`,
      );
      for (const variantName of missing) {
        counters.variantsAdded += 1;
        if (APPLY) {
          await sqlClient.execute({
            sql: `
              INSERT INTO ProgressionVariation (id, exerciseId, name, wuxiaName, difficulty, wuxiaDifficulty, wuxiaType, description)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [crypto.randomUUID(), parent.id, variantName, variantName, "", "", "", ""],
          });
        }
      }
    }

    console.log("\n=== Summary ===");
    console.log(JSON.stringify(counters, null, 2));
    if (!APPLY) {
      console.log("\nDry run only. Re-run with --apply to commit changes.");
    } else {
      console.log("\nConsolidation applied.");
    }
  } finally {
    await sqlClient.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to consolidate Gym Squat variants:", error);
  process.exitCode = 1;
});
