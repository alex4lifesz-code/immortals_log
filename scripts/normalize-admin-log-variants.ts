import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  const adapter = new PrismaLibSql({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

const EXERCISE_ALIAS_MAP: Record<string, Record<string, string | null>> = {
  "pull up": {
    "highpullup": "High",
    "chinup": "Chin up",
    "1armpullupnegative": null,
    "onearmpullupnegative": null,
    "onearmnegative": null,
  },
  "front lever": {
    "frontleverpulls": "Pulls",
    "tuckednegative": null,
    "fullnegative": null,
    "hold": null,
  },
  "planche": {
    "tuckedpress": null,
    "tuckedplanchepress": null,
  },
};

async function main() {
  const prisma = createPrismaClient();

  try {
    const admin = await prisma.user.findFirst({ where: { username: "admin" }, select: { id: true } });
    if (!admin) throw new Error("Admin user not found.");

    const exercises = await prisma.progressionExercise.findMany({
      where: { userId: admin.id },
      include: { variations: { select: { name: true } } },
    });

    const allowedVariantsByExerciseId = new Map<string, Map<string, string>>();
    const exerciseNameById = new Map<string, string>();

    for (const exercise of exercises) {
      const map = new Map<string, string>();
      for (const variation of exercise.variations) {
        const normalized = normalizeKey(variation.name);
        if (!normalized) continue;
        if (!map.has(normalized)) map.set(normalized, variation.name);
      }
      allowedVariantsByExerciseId.set(exercise.id, map);
      exerciseNameById.set(exercise.id, exercise.name);
    }

    const logs = await prisma.progressionLog.findMany({
      where: {
        variant: { not: null },
        userProgression: { userId: admin.id },
      },
      include: {
        userProgression: {
          select: {
            exerciseId: true,
          },
        },
      },
    });

    let normalizedCount = 0;
    let clearedCount = 0;
    let unchangedCount = 0;

    for (const log of logs) {
      const currentVariant = (log.variant || "").trim();
      if (!currentVariant) {
        if (log.variant !== null) {
          await prisma.progressionLog.update({ where: { id: log.id }, data: { variant: null } });
          clearedCount += 1;
        }
        continue;
      }

      const exerciseId = log.userProgression.exerciseId;
      const exerciseName = (exerciseNameById.get(exerciseId) || "").toLowerCase();
      const allowedMap = allowedVariantsByExerciseId.get(exerciseId) ?? new Map<string, string>();
      const currentKey = normalizeKey(currentVariant);

      let nextVariant: string | null = null;

      // Exact canonical match against allowed variants.
      if (allowedMap.has(currentKey)) {
        nextVariant = allowedMap.get(currentKey) || null;
      } else {
        const aliasMap = EXERCISE_ALIAS_MAP[exerciseName] || {};
        const aliasTarget = Object.prototype.hasOwnProperty.call(aliasMap, currentKey)
          ? aliasMap[currentKey]
          : undefined;

        if (aliasTarget === null) {
          nextVariant = null;
        } else if (typeof aliasTarget === "string") {
          const aliasKey = normalizeKey(aliasTarget);
          if (allowedMap.has(aliasKey)) {
            nextVariant = allowedMap.get(aliasKey) || aliasTarget;
          } else {
            nextVariant = aliasTarget;
          }
        } else {
          // If no allowed variants exist for this exercise, clear stale variant values.
          if (allowedMap.size === 0) {
            nextVariant = null;
          } else {
            // Variant exists but doesn't belong to allowed list; clear it.
            nextVariant = null;
          }
        }
      }

      if (nextVariant === currentVariant) {
        unchangedCount += 1;
        continue;
      }

      await prisma.progressionLog.update({
        where: { id: log.id },
        data: { variant: nextVariant },
      });

      if (nextVariant == null) clearedCount += 1;
      else normalizedCount += 1;
    }

    console.log("Admin log variant normalization complete.");
    console.log(`Normalized variants: ${normalizedCount}`);
    console.log(`Cleared invalid variants: ${clearedCount}`);
    console.log(`Unchanged variants: ${unchangedCount}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to normalize admin log variants:", error);
  process.exitCode = 1;
});
