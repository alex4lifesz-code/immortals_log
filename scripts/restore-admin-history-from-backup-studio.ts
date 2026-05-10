import fs from "node:fs";
import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";

type BackupTrainingLog = {
  exerciseId?: string;
  exerciseName?: string;
  level?: number;
  weight1?: number | null;
  reps1?: number | null;
  weight2?: number | null;
  reps2?: number | null;
  weight3?: number | null;
  reps3?: number | null;
  holdTime?: number | null;
  holdTime2?: number | null;
  holdTime3?: number | null;
  modifier?: string | null;
  variant?: string | null;
  notes?: string | null;
  completed?: boolean;
  createdAt?: string | null;
};

type BackupStudioPackage = {
  exerciseLibrary?: Array<{
    id?: string;
    name?: string;
    tiers?: Array<{ level?: number; name?: string }>;
  }>;
  trainingLogs?: BackupTrainingLog[];
};

const EXERCISE_REMAP: Record<string, string> = {
  "gym squat": "Squat",
  "chest press": "Chest press machine",
  "hamstring curl": "Leg curl",
  "lateral raise": "Shoulder raise",
  "front raise": "Shoulder raise",
  "rear delt fly": "Shoulder raise",
  "leg raise": "Hanging leg raise",
  "glute kickback": "Glute kickback machine",
  "hip abduction": "Abductor machine",
  "cable kickback": "Glute kickback machine",
  bike: "Stationary bike",
};

function createPrismaClient(databaseUrl: string) {
  const adapter = new PrismaLibSql({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

function normalizeKey(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function clampText(value: string | null | undefined, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function parseDate(value: string | null | undefined): Date | null {
  const parsed = new Date(String(value ?? ""));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseNullableFloat(value: number | null | undefined): number | null {
  if (value == null || value === ("" as unknown as number)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNullableInt(value: number | null | undefined): number | null {
  const parsed = parseNullableFloat(value);
  return parsed == null ? null : Math.trunc(parsed);
}

function remapExerciseName(sourceName: string): string {
  const normalized = normalizeKey(sourceName);
  return EXERCISE_REMAP[normalized] || sourceName;
}

function normalizeTierName(value: string | null | undefined): string {
  return normalizeKey(value)
    .replace(/\bpull\b/g, "")
    .replace(/\bhang\b/g, "")
    .replace(/\bonly\b/g, "")
    .replace(/\bnegative(s)?\b/g, "negative")
    .replace(/\bneg\b/g, "negative")
    .replace(/\bassisted\b/g, "assisted")
    .replace(/\bband\b/g, "assisted")
    .replace(/\beccentric\b/g, "negative")
    .replace(/\s+/g, " ")
    .trim();
}

function getTierName(
  tiers: Array<{ level?: number; name?: string }> | undefined,
  level: number,
): string | null {
  const match = (tiers ?? []).find((tier) => Number(tier.level) === level);
  const rawName = clampText(match?.name, 200);
  return rawName || null;
}

function mapLevelByTierName(
  sourceTiers: Array<{ level?: number; name?: string }> | undefined,
  sourceLevel: number,
  targetTiers: Array<{ level: number; name: string }>,
): number {
  if (targetTiers.length === 0) return sourceLevel;

  const sortedTargetLevels = targetTiers
    .map((tier) => Number(tier.level))
    .filter((level) => Number.isFinite(level))
    .sort((a, b) => a - b);

  if (sortedTargetLevels.length === 0) return sourceLevel;

  const minTargetLevel = sortedTargetLevels[0];
  const maxTargetLevel = sortedTargetLevels[sortedTargetLevels.length - 1];
  const clampToTargetRange = (level: number) => Math.min(maxTargetLevel, Math.max(minTargetLevel, level));

  const sourceTierName = getTierName(sourceTiers, sourceLevel);
  if (!sourceTierName) return clampToTargetRange(sourceLevel);

  const normalizedSourceTier = normalizeTierName(sourceTierName);
  if (!normalizedSourceTier) return clampToTargetRange(sourceLevel);

  const direct = targetTiers.find((tier) => normalizeTierName(tier.name) === normalizedSourceTier);
  if (direct) return direct.level;

  const sourceTokens = new Set(normalizedSourceTier.split(" ").filter(Boolean));
  const ranked = targetTiers
    .map((tier) => {
      const normalizedTarget = normalizeTierName(tier.name);
      const targetTokens = new Set(normalizedTarget.split(" ").filter(Boolean));
      let overlap = 0;
      sourceTokens.forEach((token) => {
        if (targetTokens.has(token)) overlap += 1;
      });
      return { level: tier.level, overlap };
    })
    .sort((a, b) => b.overlap - a.overlap);

  if (ranked[0]?.overlap && ranked[0].overlap > 0) {
    return ranked[0].level;
  }

  return clampToTargetRange(sourceLevel);
}

function eventKey(
  exerciseName: string,
  createdAt: Date,
  variant?: string | null,
  modifier?: string | null,
): string {
  return [
    normalizeKey(exerciseName),
    createdAt.toISOString(),
    normalizeKey(variant),
    normalizeKey(modifier),
  ].join("|");
}

function parseSetupOptionFromModifier(value: string | null | undefined): string {
  if (!value) return "";
  const parts = String(value)
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  const setupPart = parts.find((part) => /^setup\s*:/i.test(part));
  if (!setupPart) return "";
  return setupPart.replace(/^setup\s*:/i, "").trim();
}

function toTitleWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeGripOption(value: string): string {
  const normalized = normalizeKey(value);
  if (!normalized) return "";
  if (normalized.includes("neutral")) return "Neutral";
  if (normalized.includes("underhand") || normalized.includes("supinated") || normalized.includes("chin up")) return "Underhand";
  if (normalized.includes("overhand") || normalized.includes("pronated")) return "Overhand";
  if (normalized.includes("wide")) return "Wide";
  if (normalized.includes("close") || normalized.includes("narrow")) return "Close";
  if (normalized.includes("false")) return "False";
  if (normalized.includes("mixed")) return "Mixed";
  if (normalized.includes("ring")) return "Rings";
  if (normalized.includes("grip")) {
    return toTitleWords(
      normalized
        .split(" ")
        .filter((part) => part !== "grip")
        .join(" "),
    );
  }
  return "";
}

function withSetupModifier(modifier: string | null | undefined, setupOption: string): string {
  const parts = String(modifier ?? "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^setup\s*:/i.test(part));
  return [`Setup: ${setupOption}`, ...parts].join(" | ");
}

function normalizeVariantAndModifier(variant: string | null | undefined, modifier: string | null | undefined): { variant: string | null; modifier: string | null } {
  const rawVariant = clampText(variant, 200);
  const rawModifier = clampText(modifier, 100);
  const existingSetup = normalizeGripOption(parseSetupOptionFromModifier(rawModifier));
  const setupFromVariant = normalizeGripOption(rawVariant);

  if (!setupFromVariant) {
    return {
      variant: rawVariant || null,
      modifier: rawModifier || null,
    };
  }

  const finalSetup = existingSetup || setupFromVariant;
  return {
    variant: null,
    modifier: withSetupModifier(rawModifier || null, finalSetup),
  };
}

function makeLogSignature(exerciseName: string, level: number, createdAt: Date, variant?: string | null, modifier?: string | null): string {
  return [
    normalizeKey(exerciseName),
    String(level || 1),
    createdAt.toISOString(),
    normalizeKey(variant),
    normalizeKey(modifier),
  ].join("|");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const userArg = process.argv.find((arg) => arg.startsWith("--user="));
  const targetUsername = clampText(userArg?.slice("--user=".length) || "admin", 100) || "admin";
  const positionalArgs = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const backupPath = positionalArgs[0]
    ? path.resolve(positionalArgs[0])
    : path.resolve("C:/Users/Admin/Downloads/changes/backup-studio-alex-2026-05-10.json");
  const targetUrl = process.env.DATABASE_URL || "file:./dev.db";

  const backup = JSON.parse(fs.readFileSync(backupPath, "utf8")) as BackupStudioPackage;
  const backupLogs = Array.isArray(backup.trainingLogs) ? backup.trainingLogs : [];
  const prisma = createPrismaClient(targetUrl);

  try {
    const targetUser = await prisma.user.findFirst({ where: { username: targetUsername }, select: { id: true, username: true } });
    if (!targetUser) {
      throw new Error(`User not found in target DB: ${targetUsername}`);
    }

    const exercises = await prisma.progressionExercise.findMany({
      select: {
        id: true,
        name: true,
        tiers: { select: { level: true, name: true } },
      },
    });
    const exerciseByName = new Map<string, { id: string; name: string; tiers: Array<{ level: number; name: string }> }>();
    for (const exercise of exercises) {
      exerciseByName.set(normalizeKey(exercise.name), exercise);
    }

    const backupLibrary = Array.isArray(backup.exerciseLibrary) ? backup.exerciseLibrary : [];
    const backupExerciseByName = new Map<string, { tiers?: Array<{ level?: number; name?: string }> }>();
    for (const item of backupLibrary) {
      const sourceName = clampText(item?.name, 200);
      if (!sourceName) continue;
      backupExerciseByName.set(normalizeKey(sourceName), { tiers: Array.isArray(item.tiers) ? item.tiers : [] });
    }

    const existingLogs = await prisma.progressionLog.findMany({
      where: { userProgression: { userId: targetUser.id } },
      include: {
        userProgression: {
          include: {
            exercise: {
              select: { name: true },
            },
          },
        },
      },
    });

    const existingSignatures = new Set<string>();
    const existingByEvent = new Map<string, Array<{ id: string; level: number; exerciseName: string }>>();
    for (const entry of existingLogs) {
      const normalizedExistingFields = normalizeVariantAndModifier(entry.variant, entry.modifier);
      const existingEventKey = eventKey(entry.userProgression.exercise.name, entry.createdAt, normalizedExistingFields.variant, normalizedExistingFields.modifier);
      const bucket = existingByEvent.get(existingEventKey) ?? [];
      bucket.push({ id: entry.id, level: entry.level, exerciseName: entry.userProgression.exercise.name });
      existingByEvent.set(existingEventKey, bucket);

      existingSignatures.add(
        makeLogSignature(
          entry.userProgression.exercise.name,
          entry.level,
          entry.createdAt,
          normalizedExistingFields.variant,
          normalizedExistingFields.modifier,
        ),
      );
    }

    const unresolved = new Map<string, number>();
    const duplicateSignatures = new Set<string>();
    const pending: Array<{
      log: BackupTrainingLog;
      exerciseId: string;
      canonicalName: string;
      createdAt: Date;
      signature: string;
      level: number;
      variant: string | null;
      modifier: string | null;
    }> = [];
    const repairCandidates: Array<{
      logId: string;
      canonicalName: string;
      createdAt: Date;
      fromLevel: number;
      toLevel: number;
      fromVariant: string | null;
      toVariant: string | null;
      fromModifier: string | null;
      toModifier: string | null;
    }> = [];

    for (const log of backupLogs) {
      const sourceName = clampText(log.exerciseName, 200);
      const createdAt = parseDate(log.createdAt);
      const level = Number.isFinite(Number(log.level)) ? Math.max(1, Math.trunc(Number(log.level))) : 1;
      if (!sourceName || !createdAt) continue;

      const canonicalName = remapExerciseName(sourceName);
      const exercise = exerciseByName.get(normalizeKey(canonicalName));
      if (!exercise) {
        unresolved.set(sourceName, (unresolved.get(sourceName) || 0) + 1);
        continue;
      }

      const sourceExercise = backupExerciseByName.get(normalizeKey(sourceName));
      const mappedLevel = mapLevelByTierName(sourceExercise?.tiers, level, exercise.tiers);
      const normalizedFields = normalizeVariantAndModifier(log.variant, log.modifier);

      const key = eventKey(canonicalName, createdAt, normalizedFields.variant, normalizedFields.modifier);
      const existingForEvent = existingByEvent.get(key) ?? [];
      if (existingForEvent.length === 1) {
        const [existing] = existingForEvent;
        const existingLog = existingLogs.find((entry) => entry.id === existing.id);
        const existingVariant = clampText(existingLog?.variant, 200) || null;
        const existingModifier = clampText(existingLog?.modifier, 100) || null;
        if (
          existing.level !== mappedLevel ||
          existingVariant !== normalizedFields.variant ||
          existingModifier !== normalizedFields.modifier
        ) {
          repairCandidates.push({
            logId: existing.id,
            canonicalName: exercise.name,
            createdAt,
            fromLevel: existing.level,
            toLevel: mappedLevel,
            fromVariant: existingVariant,
            toVariant: normalizedFields.variant,
            fromModifier: existingModifier,
            toModifier: normalizedFields.modifier,
          });
        }
        continue;
      }

      const signature = makeLogSignature(
        canonicalName,
        mappedLevel,
        createdAt,
        normalizedFields.variant,
        normalizedFields.modifier,
      );
      if (existingSignatures.has(signature) || duplicateSignatures.has(signature)) {
        continue;
      }

      duplicateSignatures.add(signature);
      pending.push({
        log,
        exerciseId: exercise.id,
        canonicalName: exercise.name,
        createdAt,
        signature,
        level: mappedLevel,
        variant: normalizedFields.variant,
        modifier: normalizedFields.modifier,
      });
    }

    console.log(`Backup Studio ${targetUser.username} history restore plan:`);
    console.log(`  Backup file: ${backupPath}`);
    console.log(`  Target DB: ${targetUrl}`);
    console.log(`  Backup logs: ${backupLogs.length}`);
    console.log(`  Existing ${targetUser.username} logs: ${existingLogs.length}`);
    console.log(`  Pending import logs: ${pending.length}`);
    console.log(`  Existing logs to repair fields: ${repairCandidates.length}`);
    console.log(`  Unresolved logs: ${[...unresolved.values()].reduce((sum, count) => sum + count, 0)}`);
    if (unresolved.size > 0) {
      console.log("  Unresolved exercise names:");
      for (const [name, count] of [...unresolved.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
        console.log(`    - ${name}: ${count}`);
      }
    }

    const recent = pending.slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).slice(-10);
    if (recent.length > 0) {
      console.log("  Most recent pending logs:");
      for (const item of recent) {
        console.log(`    - ${item.createdAt.toISOString()} | ${item.canonicalName} | level ${item.level} | variant=${item.log.variant ?? "-"}`);
      }
    }

    const recentRepairs = repairCandidates
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(-10);
    if (recentRepairs.length > 0) {
      console.log("  Most recent field repairs:");
      for (const item of recentRepairs) {
        const levelChange = item.fromLevel !== item.toLevel ? `level ${item.fromLevel} -> ${item.toLevel}` : "level unchanged";
        const variantChange = item.fromVariant !== item.toVariant ? `variant ${item.fromVariant ?? "-"} -> ${item.toVariant ?? "-"}` : "variant unchanged";
        const modifierChange = item.fromModifier !== item.toModifier ? `modifier ${item.fromModifier ?? "-"} -> ${item.toModifier ?? "-"}` : "modifier unchanged";
        console.log(`    - ${item.createdAt.toISOString()} | ${item.canonicalName} | ${levelChange} | ${variantChange} | ${modifierChange}`);
      }
    }

    if (!apply) {
      console.log("Dry-run only. Re-run with --apply to import missing logs.");
      return;
    }

    for (const item of repairCandidates) {
      await prisma.progressionLog.update({
        where: { id: item.logId },
        data: {
          level: item.toLevel,
          variant: item.toVariant,
          modifier: item.toModifier,
        },
      });
    }

    const progressionIds = new Map<string, string>();
    const maxLevelByExercise = new Map<string, number>();

    for (const item of pending) {
      let progressionId = progressionIds.get(item.exerciseId);
      if (!progressionId) {
        const progression = await prisma.userProgressionLevel.upsert({
          where: { userId_exerciseId: { userId: targetUser.id, exerciseId: item.exerciseId } },
          update: {},
          create: { userId: targetUser.id, exerciseId: item.exerciseId, currentLevel: item.level },
          select: { id: true, currentLevel: true },
        });
        progressionId = progression.id;
        progressionIds.set(item.exerciseId, progression.id);
        maxLevelByExercise.set(item.exerciseId, Math.max(item.level, progression.currentLevel));
      } else {
        maxLevelByExercise.set(item.exerciseId, Math.max(item.level, maxLevelByExercise.get(item.exerciseId) || 0));
      }

      await prisma.progressionLog.create({
        data: {
          userProgressionId: progressionId,
          level: item.level,
          weight1: parseNullableFloat(item.log.weight1),
          reps1: parseNullableInt(item.log.reps1),
          weight2: parseNullableFloat(item.log.weight2),
          reps2: parseNullableInt(item.log.reps2),
          weight3: parseNullableFloat(item.log.weight3),
          reps3: parseNullableInt(item.log.reps3),
          holdTime: parseNullableInt(item.log.holdTime),
          holdTime2: parseNullableInt(item.log.holdTime2),
          holdTime3: parseNullableInt(item.log.holdTime3),
          modifier: item.modifier,
          variant: item.variant,
          notes: item.log.notes ? clampText(item.log.notes, 2000) : null,
          completed: item.log.completed !== false,
          createdAt: item.createdAt,
        },
      });
    }

    for (const [exerciseId, currentLevel] of maxLevelByExercise.entries()) {
      await prisma.userProgressionLevel.update({
        where: { userId_exerciseId: { userId: targetUser.id, exerciseId } },
        data: { currentLevel },
      });
    }

    const aggregate = await prisma.progressionLog.aggregate({
      where: { userProgression: { userId: targetUser.id } },
      _count: { _all: true },
      _max: { createdAt: true },
    });
    console.log(`Import complete. ${targetUser.username} logs now: ${aggregate._count._all}`);
    console.log(`Latest ${targetUser.username} log now: ${aggregate._max.createdAt?.toISOString() ?? "null"}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to restore admin history from Backup Studio JSON:", error);
  process.exitCode = 1;
});