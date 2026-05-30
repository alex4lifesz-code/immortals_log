import { NextResponse } from "next/server";
import { apiSuccess, ApiErrors } from "@/lib/api";
import { withAdmin } from "@/lib/auth/middleware";
import { ensureAppExerciseLibraryOwner } from "@/lib/exercise-library-owner";
import { restoreExerciseDbUserProgressFromSnapshot, snapshotExerciseDbUserProgress } from "@/lib/exercise-db-recovery";
import { isDeletedExerciseDescription } from "@/lib/pending-exercises";
import {
  countAllExercises,
  countDeletedExercises,
  countProgressionLogs,
  countUserProgressionLevels,
  findAllExerciseNameEntries,
  listExercisesForStudioExport,
  purgeAllExercises,
  replaceStudioExerciseRelations,
  saveStudioExerciseById,
} from "@/lib/repositories/exercise-library.repository";

function clampText(value: unknown, max: number): string {
  return String(value || "").trim().slice(0, max);
}

function parseNullableInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function parseNullableFloat(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getProgressionList(exercise: Record<string, unknown>): string[] {
  const progression = Array.isArray(exercise.progression) ? exercise.progression : [];
  const normalized = progression.map((item) => clampText(item, 200)).filter(Boolean);
  if (normalized.length > 0) return normalized;

  const tiers = Array.isArray(exercise.tiers) ? exercise.tiers : [];
  const tierNames = tiers
    .map((tier) => clampText((tier as Record<string, unknown>).name, 200))
    .filter(Boolean);
  if (tierNames.length > 0) return tierNames;

  const fallbackName = clampText(exercise.name, 200);
  return fallbackName ? [fallbackName] : [];
}

export const GET = withAdmin(async () => {
  try {
    const exercises = await listExercisesForStudioExport();

    const visibleExercises = exercises.filter((exercise) => !isDeletedExerciseDescription(exercise.story));

    const payload = {
      version: 1,
      packageType: "exercise-library-studio",
      exportedAt: new Date().toISOString(),
      exercises: visibleExercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        wuxiaName: exercise.wuxiaName,
        difficulty: exercise.difficulty,
        wuxiaDifficulty: exercise.wuxiaDifficulty,
        type: exercise.type,
        wuxiaType: exercise.wuxiaType,
        story: exercise.story,
        category: exercise.category,
        equipmentType: exercise.equipmentType,
        bodyweight: exercise.bodyweight,
        weighted: exercise.weighted,
        rings: exercise.rings,
        primaryMuscles: exercise.primaryMuscles,
        secondaryMuscles: exercise.secondaryMuscles,
        tips: exercise.tips,
        prerequisites: exercise.prerequisites,
        cues: exercise.cues,
        commonMistakes: exercise.commonMistakes,
        breathing: exercise.breathing,
        safetyConsiderations: exercise.safetyConsiderations,
        competitionStandards: exercise.competitionStandards,
        progression: (() => {
          try {
            const parsed = JSON.parse(exercise.progression || "[]");
            if (Array.isArray(parsed)) {
              return parsed.map((item) => String(item || "").trim()).filter(Boolean);
            }
          } catch {
            // ignore malformed json
          }
          return exercise.tiers.map((tier) => tier.name).filter(Boolean);
        })(),
        assignedDays: exercise.assignedDays,
        tiers: exercise.tiers.map((tier) => ({
          level: tier.level,
          name: tier.name,
          wuxiaName: tier.wuxiaName,
          difficulty: tier.difficulty,
          wuxiaDifficulty: tier.wuxiaDifficulty,
          wuxiaType: tier.wuxiaType,
          description: tier.description,
          targetHold: tier.targetHold,
          targetReps: tier.targetReps,
          targetRepsText: tier.targetRepsText,
        })),
        variations: exercise.variations.map((variation) => ({
          name: variation.name,
          wuxiaName: variation.wuxiaName,
          difficulty: variation.difficulty,
          wuxiaDifficulty: variation.wuxiaDifficulty,
          wuxiaType: variation.wuxiaType,
          description: variation.description,
        })),
        modifiers: exercise.modifiers.map((modifier) => ({
          type: modifier.type,
          available: modifier.available,
          difficultyMod: modifier.difficultyMod,
          notes: modifier.notes,
          method: modifier.method,
          difficultyIncrease: modifier.difficultyIncrease,
        })),
      })),
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="exercise-library-${new Date().toISOString().slice(0, 10)}.json"`,
        "X-Exercise-Count": String(payload.exercises.length),
      },
    });
  } catch (error) {
    console.error("Exercise library export error:", error);
    return ApiErrors.internal("Failed to export exercise library");
  }
});

export const POST = withAdmin(async (request) => {
  try {
    const body = (await request.json()) as {
      replaceExisting?: boolean;
      backup?: { exercises?: Array<Record<string, unknown>> };
    };

    const exercises = Array.isArray(body?.backup?.exercises) ? body.backup.exercises : [];
    if (exercises.length === 0) {
      return ApiErrors.badRequest("No exercises found in the uploaded file");
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const libraryOwnerId = await ensureAppExerciseLibraryOwner();
    const existingCandidates = await findAllExerciseNameEntries();

    for (const exercise of exercises) {
      const rawName = clampText(exercise.name, 200);
      if (!rawName) {
        skipped++;
        continue;
      }

      const progression = getProgressionList(exercise);
      const existing = existingCandidates.find(
        (entry) => entry.name.trim().toLowerCase() === rawName.toLowerCase(),
      );

      if (existing && body.replaceExisting !== true) {
        skipped++;
        continue;
      }

      const payload = {
        userId: libraryOwnerId,
        name: rawName,
        wuxiaName: clampText(exercise.wuxiaName || rawName, 200),
        difficulty: clampText(exercise.difficulty, 100),
        wuxiaDifficulty: clampText(exercise.wuxiaDifficulty, 100),
        type: clampText(exercise.type, 100),
        wuxiaType: clampText(exercise.wuxiaType, 100),
        story: clampText(exercise.story, 5000),
        category: clampText(exercise.category || "Other", 100) || "Other",
        equipmentType: clampText(exercise.equipmentType || "bodyweight", 200) || "bodyweight",
        bodyweight: exercise.bodyweight !== false,
        weighted: Boolean(exercise.weighted),
        rings: Boolean(exercise.rings),
        primaryMuscles: clampText(exercise.primaryMuscles || "Other", 200) || "Other",
        secondaryMuscles: clampText(exercise.secondaryMuscles, 200),
        tips: clampText(exercise.tips || "[]", 10000) || "[]",
        prerequisites: clampText(exercise.prerequisites || "[]", 10000) || "[]",
        cues: clampText(exercise.cues || "[]", 10000) || "[]",
        commonMistakes: clampText(exercise.commonMistakes || "[]", 10000) || "[]",
        breathing: clampText(exercise.breathing, 1000),
        safetyConsiderations: clampText(exercise.safetyConsiderations || "[]", 10000) || "[]",
        competitionStandards: clampText(exercise.competitionStandards || "{}", 10000) || "{}",
        progression: JSON.stringify(progression),
        assignedDays: clampText(exercise.assignedDays, 200),
      };

      const saved = await saveStudioExerciseById({
        existingId: existing?.id ?? null,
        payload,
      });

      const tiers = Array.isArray(exercise.tiers) ? exercise.tiers : [];
      const tierRows = tiers.length > 0
        ? tiers.map((tier, index) => {
            const tierData = tier as Record<string, unknown>;
            return {
              exerciseId: saved.id,
              level: Number.isFinite(Number(tierData.level)) ? Number(tierData.level) : index + 1,
              name: clampText(tierData.name || rawName, 200),
              wuxiaName: clampText(tierData.wuxiaName || tierData.name || rawName, 200),
              difficulty: clampText(tierData.difficulty, 100),
              wuxiaDifficulty: clampText(tierData.wuxiaDifficulty, 100),
              wuxiaType: clampText(tierData.wuxiaType, 100),
              description: clampText(tierData.description, 2000),
              targetHold: parseNullableInt(tierData.targetHold),
              targetReps: parseNullableInt(tierData.targetReps),
              targetRepsText: clampText(tierData.targetRepsText, 100),
            };
          })
        : [{
            exerciseId: saved.id,
            level: 1,
            name: rawName,
            wuxiaName: clampText(exercise.wuxiaName || rawName, 200),
            difficulty: clampText(exercise.difficulty, 100),
            wuxiaDifficulty: clampText(exercise.wuxiaDifficulty, 100),
            wuxiaType: clampText(exercise.wuxiaType, 100),
            description: "",
            targetHold: null,
            targetReps: null,
            targetRepsText: "",
          }];

      const variations = Array.isArray(exercise.variations) ? exercise.variations : [];
      const variationRows = variations
        .map((variation) => {
          const variationData = variation as Record<string, unknown>;
          return {
            exerciseId: saved.id,
            name: clampText(variationData.name, 200),
            wuxiaName: clampText(variationData.wuxiaName || variationData.name, 200),
            difficulty: clampText(variationData.difficulty, 100),
            wuxiaDifficulty: clampText(variationData.wuxiaDifficulty, 100),
            wuxiaType: clampText(variationData.wuxiaType, 100),
            description: clampText(variationData.description, 2000),
          };
        })
        .filter((entry) => entry.name.length > 0);

      const modifiers = Array.isArray(exercise.modifiers) ? exercise.modifiers : [];
      const modifierRows = modifiers.map((modifier) => {
        const modifierData = modifier as Record<string, unknown>;
        return {
          exerciseId: saved.id,
          type: clampText(modifierData.type || "custom", 100) || "custom",
          available: Boolean(modifierData.available),
          difficultyMod: parseNullableFloat(modifierData.difficultyMod) ?? 0,
          notes: clampText(modifierData.notes, 1000),
          method: clampText(modifierData.method, 500),
          difficultyIncrease: clampText(modifierData.difficultyIncrease, 500),
        };
      });

      await replaceStudioExerciseRelations({
        exerciseId: saved.id,
        tiers: tierRows,
        variations: variationRows,
        modifiers: modifierRows,
      });

      if (!existing) {
        existingCandidates.push({ id: saved.id, name: rawName });
      }

      if (existing) {
        updated++;
      } else {
        imported++;
      }
    }

    const recovery = await restoreExerciseDbUserProgressFromSnapshot();

    return apiSuccess({
      message: `Exercise library import complete: ${imported} added, ${updated} updated, ${skipped} skipped.${recovery.restoredLogs > 0 || recovery.restoredLevels > 0 ? ` Restored ${recovery.restoredLevels} progression records and ${recovery.restoredLogs} logs.` : ""}`,
      imported,
      updated,
      skipped,
      restoredLevels: recovery.restoredLevels,
      restoredLogs: recovery.restoredLogs,
      skippedRecoveryEntries: recovery.skippedEntries,
    });
  } catch (error) {
    console.error("Exercise library import error:", error);
    return ApiErrors.internal("Failed to import exercise library");
  }
});

export const DELETE = withAdmin(async (request) => {
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.confirm !== true) {
      return ApiErrors.badRequest("Purge requires confirmation");
    }

    const [exerciseCount, deletedCount, levelCount, logCount] = await Promise.all([
      countAllExercises(),
      countDeletedExercises(),
      countUserProgressionLevels(),
      countProgressionLogs(),
    ]);

    const recovery = await snapshotExerciseDbUserProgress();

    await purgeAllExercises();

    return apiSuccess({
      message: `Exercise DB purged successfully: ${exerciseCount} exercises cleared. Saved ${recovery.levelCount} progression records and ${recovery.logCount} logs for automatic restore after the next library import.`,
      exerciseCount,
      deletedCount,
      levelCount,
      logCount,
      preservedLevelCount: recovery.levelCount,
      preservedLogCount: recovery.logCount,
    });
  } catch (error) {
    console.error("Exercise DB purge error:", error);
    return ApiErrors.internal("Failed to purge the exercise DB");
  }
});
