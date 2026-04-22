/**
 * Generalised consolidator: folds duplicate / variant child ProgressionExercise
 * rows into a canonical parent, moves all training logs to the parent's
 * UserProgressionLevel, and tags each moved log with a `variant` value.
 *
 * Usage:
 *   npx tsx scripts/consolidate-exercise-variants.ts            # dry run (default)
 *   npx tsx scripts/consolidate-exercise-variants.ts --apply    # commit
 *   npx tsx scripts/consolidate-exercise-variants.ts --only=Deadlift,Pull up
 *
 * Safety:
 *   - Re-points logs via SQL UPDATE; never deletes a log row.
 *   - Sets log.variant only when currently empty (NULLIF(variant,'')).
 *   - Bumps parent UserProgressionLevel.currentLevel to MAX(parent, child)
 *     when merging, so the user doesn't appear to "lose" progress.
 *   - Inserts any missing ProgressionVariation rows on the parent.
 *   - Deletes child UserProgressionLevel only after its logs are moved, then
 *     deletes the child ProgressionExercise (cascades tiers/variations/modifiers).
 */

import crypto from "node:crypto";
import { createClient as createSqlClient } from "@libsql/client";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

type ChildSpec = { name: string; variant: string };
type MergeBlock = {
  parent: string;
  /** Variants to ensure exist on the parent (in addition to those mapped from children). */
  ensureVariants?: string[];
  children: ChildSpec[];
};

/* -------------------------------------------------------------------------- */
/* Merge configuration                                                        */
/* -------------------------------------------------------------------------- */

const MERGES: MergeBlock[] = [
  // --- Section 1: cross-category duplicates ("Gym X" -> "X") --------------
  {
    parent: "Pull up",
    ensureVariants: ["Wide", "Close", "Neutral", "Chin up", "Behind the neck"],
    children: [{ name: "Gym Pull up", variant: "Standard" }],
  },
  {
    parent: "Calf raise",
    ensureVariants: ["Standing", "Seated", "Donkey", "Single leg"],
    children: [{ name: "Gym Calf raise", variant: "Standing" }],
  },
  {
    parent: "Step up",
    ensureVariants: ["Bodyweight", "Dumbbell", "Barbell", "Lateral"],
    children: [{ name: "Gym Step up", variant: "Dumbbell" }],
  },
  {
    parent: "Leg raise",
    ensureVariants: ["Hanging", "Lying", "Captain's chair", "Toes to bar"],
    children: [{ name: "Gym Leg raise", variant: "Hanging" }],
  },
  {
    parent: "Hip thrust",
    ensureVariants: ["Bodyweight", "Barbell", "Single leg", "Banded"],
    children: [{ name: "Gym Hip thrust", variant: "Barbell" }],
  },

  // --- Section 2: movement-pattern parents -------------------------------
  {
    parent: "Deadlift",
    ensureVariants: [
      "Conventional",
      "Sumo",
      "Romanian",
      "Stiff leg",
      "Snatch grip",
      "Trap bar",
      "Axle bar",
      "Deficit",
      "Block",
      "Rack pull",
      "Single leg",
      "Reeves",
      "Jefferson",
      "Sumo high pull",
    ],
    children: [
      { name: "Sumo deadlift", variant: "Sumo" },
      { name: "Romanian deadlift", variant: "Romanian" },
      { name: "Stiff leg deadlift", variant: "Stiff leg" },
      { name: "Snatch grip deadlift", variant: "Snatch grip" },
      { name: "Trap bar deadlift", variant: "Trap bar" },
      { name: "Axle bar deadlift", variant: "Axle bar" },
      { name: "Deficit deadlift", variant: "Deficit" },
      { name: "Block pull", variant: "Block" },
      { name: "Rack pull", variant: "Rack pull" },
      { name: "Single leg deadlift", variant: "Single leg" },
      { name: "Reeves deadlift", variant: "Reeves" },
      { name: "Jefferson deadlift", variant: "Jefferson" },
      { name: "Sumo deadlift high pull", variant: "Sumo high pull" },
    ],
  },
  {
    parent: "Lunge",
    ensureVariants: ["Forward", "Reverse", "Walking", "Lateral", "Curtsy", "Barbell", "Dumbbell"],
    children: [
      { name: "Walking lunge", variant: "Walking" },
      { name: "Reverse lunge", variant: "Reverse" },
      { name: "Lateral lunge", variant: "Lateral" },
      { name: "Curtsy lunge", variant: "Curtsy" },
      { name: "Barbell lunge", variant: "Barbell" },
    ],
  },
  {
    parent: "Shoulder press",
    ensureVariants: ["Strict", "Push press", "Push jerk", "Split jerk", "Log", "Landmine"],
    children: [
      { name: "Push press", variant: "Push press" },
      { name: "Push jerk", variant: "Push jerk" },
      { name: "Split jerk", variant: "Split jerk" },
      { name: "Log press", variant: "Log" },
      { name: "Landmine press", variant: "Landmine" },
    ],
  },
  {
    parent: "Clean",
    ensureVariants: ["Power", "Hang", "Squat", "Muscle", "Kettlebell", "Clean and jerk"],
    children: [
      { name: "Power clean", variant: "Power" },
      { name: "Hang clean", variant: "Hang" },
      { name: "Kettlebell clean", variant: "Kettlebell" },
      { name: "Clean and jerk", variant: "Clean and jerk" },
    ],
  },
  {
    parent: "Snatch",
    ensureVariants: ["Power", "Muscle", "Squat", "Kettlebell"],
    children: [
      { name: "Power snatch", variant: "Power" },
      { name: "Muscle snatch", variant: "Muscle" },
      { name: "Kettlebell snatch", variant: "Kettlebell" },
    ],
  },
  {
    parent: "Tricep extension",
    ensureVariants: ["Overhead", "Skullcrusher", "Pushdown", "Kickback"],
    children: [
      { name: "Tricep pushdown", variant: "Pushdown" },
      { name: "Tricep kickback", variant: "Kickback" },
    ],
  },
  {
    parent: "Row",
    ensureVariants: ["Bent over", "Seated", "T-bar", "Single arm", "Pendlay", "Meadows", "Landmine", "Cable"],
    children: [{ name: "Landmine row", variant: "Landmine" }],
  },

  // --- Section 3: loaded carries ------------------------------------------
  {
    parent: "Loaded carry",
    ensureVariants: [
      "Farmer's",
      "Suitcase",
      "Rack",
      "Front rack",
      "Overhead",
      "Waiter",
      "Zercher",
      "Yoke",
      "Sandbag",
      "Trap bar",
      "Cross body",
    ],
    children: [
      { name: "Farmer's walk", variant: "Farmer's" },
      { name: "Suitcase carry", variant: "Suitcase" },
      { name: "Rack carry", variant: "Rack" },
      { name: "Overhead carry", variant: "Overhead" },
      { name: "Waiter carry", variant: "Waiter" },
      { name: "Zercher carry", variant: "Zercher" },
      { name: "Yoke walk", variant: "Yoke" },
      { name: "Sandbag carry", variant: "Sandbag" },
      { name: "Trap bar carry", variant: "Trap bar" },
      { name: "Cross carry", variant: "Cross body" },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Implementation                                                             */
/* -------------------------------------------------------------------------- */

const APPLY = process.argv.includes("--apply");
const ONLY = (() => {
  const arg = process.argv.find((a) => a.startsWith("--only="));
  if (!arg) return null;
  return new Set(
    arg
      .slice("--only=".length)
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
})();

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  const adapter = new PrismaLibSql({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

type Counters = {
  blocks: number;
  childExercisesProcessed: number;
  childExercisesMissing: number;
  parentLevelsCreated: number;
  parentLevelsBumped: number;
  childLevelsDeleted: number;
  logsRepointed: number;
  variantTagsAssigned: number;
  childExercisesDeleted: number;
  variantsAdded: number;
};

async function main() {
  const prisma = createPrismaClient();
  const sqlClient = createSqlClient({ url: process.env.DATABASE_URL || "file:./dev.db" });

  const counters: Counters = {
    blocks: 0,
    childExercisesProcessed: 0,
    childExercisesMissing: 0,
    parentLevelsCreated: 0,
    parentLevelsBumped: 0,
    childLevelsDeleted: 0,
    logsRepointed: 0,
    variantTagsAssigned: 0,
    childExercisesDeleted: 0,
    variantsAdded: 0,
  };

  console.log(`\n=== Exercise consolidation (${APPLY ? "APPLY" : "DRY RUN"}) ===`);
  if (ONLY) console.log(`Filter: only parents matching ${[...ONLY].join(", ")}`);

  try {
    // Pull every exercise once for case-insensitive lookup (Prisma `mode: insensitive`
    // is fragile here per repo memory).
    const allExercises = await prisma.progressionExercise.findMany({
      include: { variations: true, tiers: { select: { level: true } } },
    });
    const byLowerName = new Map<string, typeof allExercises>();
    for (const ex of allExercises) {
      const k = ex.name.toLowerCase();
      const list = byLowerName.get(k) ?? [];
      list.push(ex);
      byLowerName.set(k, list);
    }

    for (const block of MERGES) {
      if (ONLY && !ONLY.has(block.parent.toLowerCase())) continue;

      const parents = byLowerName.get(block.parent.toLowerCase()) ?? [];
      if (parents.length === 0) {
        console.warn(`\n[skip] No parent "${block.parent}" found.`);
        continue;
      }
      counters.blocks += 1;
      console.log(`\n--- ${block.parent} (${parents.length} parent row(s)) ---`);

      // Index parents by userId so we route children to a parent owned by the
      // same user when possible (otherwise fall back to the first parent).
      const parentByUserId = new Map(parents.map((p) => [p.userId, p]));
      const defaultParent = parents[0];

      // Process each child entry.
      for (const childSpec of block.children) {
        const childRows = byLowerName.get(childSpec.name.toLowerCase()) ?? [];
        if (childRows.length === 0) {
          counters.childExercisesMissing += 1;
          console.log(`  [missing] "${childSpec.name}" — nothing to do`);
          continue;
        }

        for (const child of childRows) {
          counters.childExercisesProcessed += 1;
          const parent = parentByUserId.get(child.userId) ?? defaultParent;
          console.log(
            `  - "${child.name}" (id=${child.id}, owner=${child.userId}) -> "${parent.name}" variant "${childSpec.variant}"`,
          );

          const childLevels = await prisma.userProgressionLevel.findMany({
            where: { exerciseId: child.id },
            include: { logs: { select: { id: true, variant: true } } },
          });

          for (const childLevel of childLevels) {
            // Ensure parent UserProgressionLevel exists, bumping currentLevel if needed.
            let parentLevel = await prisma.userProgressionLevel.findUnique({
              where: {
                userId_exerciseId: { userId: childLevel.userId, exerciseId: parent.id },
              },
              select: { id: true, currentLevel: true },
            });

            if (!parentLevel) {
              counters.parentLevelsCreated += 1;
              console.log(
                `      + create parent level for user ${childLevel.userId} (currentLevel=${childLevel.currentLevel})`,
              );
              if (APPLY) {
                const created = await prisma.userProgressionLevel.create({
                  data: {
                    userId: childLevel.userId,
                    exerciseId: parent.id,
                    currentLevel: childLevel.currentLevel,
                  },
                  select: { id: true, currentLevel: true },
                });
                parentLevel = created;
              } else {
                parentLevel = { id: "(dry-run)", currentLevel: childLevel.currentLevel };
              }
            } else if (childLevel.currentLevel > parentLevel.currentLevel) {
              counters.parentLevelsBumped += 1;
              console.log(
                `      ^ bump parent currentLevel ${parentLevel.currentLevel} -> ${childLevel.currentLevel}`,
              );
              if (APPLY) {
                await prisma.userProgressionLevel.update({
                  where: { id: parentLevel.id },
                  data: { currentLevel: childLevel.currentLevel },
                });
              }
            }

            if (childLevel.logs.length > 0) {
              counters.logsRepointed += childLevel.logs.length;
              const needsTag = childLevel.logs.filter((l) => !l.variant).length;
              counters.variantTagsAssigned += needsTag;
              console.log(
                `      ~ repoint ${childLevel.logs.length} log(s); tag ${needsTag} as variant="${childSpec.variant}"`,
              );
              if (APPLY) {
                await sqlClient.execute({
                  sql: `
                    UPDATE ProgressionLog
                    SET userProgressionId = ?,
                        variant = COALESCE(NULLIF(variant, ''), ?)
                    WHERE userProgressionId = ?
                  `,
                  args: [parentLevel.id, childSpec.variant, childLevel.id],
                });
              }
            }

            if (APPLY) {
              await prisma.userProgressionLevel.delete({ where: { id: childLevel.id } });
            }
            counters.childLevelsDeleted += 1;
          }

          if (APPLY) {
            await prisma.progressionExercise.delete({ where: { id: child.id } });
          }
          counters.childExercisesDeleted += 1;
          console.log(`      - delete child ProgressionExercise "${child.name}"`);
        }
      }

      // Ensure variant rows exist on every parent row of this block.
      const desiredVariants = Array.from(
        new Set([
          ...(block.ensureVariants ?? []),
          ...block.children.map((c) => c.variant),
        ]),
      );

      for (const parent of parents) {
        const existing = new Set(parent.variations.map((v) => v.name.toLowerCase()));
        const missing = desiredVariants.filter((v) => !existing.has(v.toLowerCase()));
        if (missing.length === 0) continue;

        counters.variantsAdded += missing.length;
        console.log(
          `  + add ${missing.length} variant(s) to "${parent.name}" (id=${parent.id}): ${missing.join(", ")}`,
        );

        if (APPLY) {
          for (const variantName of missing) {
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
    }

    console.log("\n=== Summary ===");
    console.log(JSON.stringify(counters, null, 2));
    console.log(APPLY ? "\nConsolidation applied." : "\nDry run only. Re-run with --apply to commit.");
  } finally {
    await sqlClient.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to consolidate exercises:", error);
  process.exitCode = 1;
});
