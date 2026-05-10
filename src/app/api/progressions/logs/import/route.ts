import { apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";
import { importLimiter } from "@/lib/auth/rate-limiters";
import { ensureAppExerciseLibraryOwner } from "@/lib/exercise-library-owner";
import { getClientIdentifier } from "@/lib/rate-limit";

type ImportedLog = {
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
  setupOption?: string | null;
  notes?: string | null;
  completed?: boolean;
  createdAt?: string;
};

type TargetExercise = {
  id: string;
  name: string;
  wuxiaName: string;
  difficulty: string;
  wuxiaDifficulty: string;
  wuxiaType: string;
};

type SourceProgressionExercise = {
  id: string;
  name: string;
  wuxiaName: string;
  difficulty: string;
  wuxiaDifficulty: string;
  type: string;
  wuxiaType: string;
  story: string;
  category: string;
  equipmentType: string;
  bodyweight: boolean;
  weighted: boolean;
  rings: boolean;
  primaryMuscles: string;
  secondaryMuscles: string;
};

type LibraryExercise = {
  id: string;
  name: string;
  wuxiaName: string | null;
  difficulty: string;
  type: string;
  story: string | null;
  targetGroup: string | null;
};

function normalizeNullableNumber(v: unknown, min: number, max: number): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

function normalizeNullableInt(v: unknown, min: number, max: number): number | null {
  const n = normalizeNullableNumber(v, min, max);
  return n == null ? null : Math.floor(n);
}

function parseCreatedAt(v: unknown): Date {
  if (typeof v !== "string") return new Date();
  const parsed = new Date(v);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function normalizeText(v: unknown): string {
  return String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function inferImportedExerciseShape(log: ImportedLog) {
  const hasWeightedData = [log.weight1, log.weight2, log.weight3].some((value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0;
  });
  const hasHoldData = [log.holdTime, log.holdTime2, log.holdTime3].some((value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0;
  });

  if (hasWeightedData) {
    return {
      category: "Imported, Gym",
      equipmentType: "machine, barbell, dumbbell",
      bodyweight: false,
      weighted: true,
      rings: false,
      difficulty: "",
      wuxiaDifficulty: "",
      wuxiaType: "",
    };
  }

  if (hasHoldData) {
    return {
      category: "Imported, Yoga",
      equipmentType: "bodyweight",
      bodyweight: true,
      weighted: false,
      rings: false,
      difficulty: "",
      wuxiaDifficulty: "",
      wuxiaType: "",
    };
  }

  return {
    category: "Imported, Calisthenics",
    equipmentType: "bodyweight",
    bodyweight: true,
    weighted: false,
    rings: false,
    difficulty: "",
    wuxiaDifficulty: "",
    wuxiaType: "",
  };
}

function addExerciseToMaps(
  exercise: TargetExercise,
  byId: Map<string, TargetExercise>,
  byName: Map<string, TargetExercise>
) {
  byId.set(exercise.id, exercise);
  const keys = [exercise.name, exercise.wuxiaName]
    .map(normalizeText)
    .filter(Boolean);
  for (const key of keys) {
    if (!byName.has(key)) byName.set(key, exercise);
  }
}

// POST /api/progressions/logs/import
// Body: { logs: ImportedLog[], replaceExisting?: boolean }
export const POST = withAuth(async (request, { auth }) => {
  try {
    // Rate limit imports
    const clientId = getClientIdentifier(request);
    const rateLimitResult = importLimiter.check(clientId);
    if (!rateLimitResult.allowed) {
      return ApiErrors.rateLimited("Too many import requests. Please try again later.");
    }

    const body = await request.json() as {
      logs?: ImportedLog[];
      replaceExisting?: boolean;
      targetUserId?: string;
    };

    // Admins can import into another user's data
    const userId = body.targetUserId && auth.role === "admin" ? body.targetUserId : auth.userId;

    const logs = body.logs;
    if (!Array.isArray(logs)) {
      return ApiErrors.badRequest("logs must be an array");
    }

    if (logs.length > 10000) {
      return ApiErrors.badRequest("Maximum 10,000 logs per import");
    }

    const replaceExisting = body.replaceExisting !== false;

    // If replaceExisting and no logs, just purge
    if (replaceExisting && logs.length === 0) {
      await prisma.progressionLog.deleteMany({
        where: { userProgression: { userId } },
      });
      return apiSuccess({ success: true, imported: 0, skipped: 0, replaced: true });
    }

    if (logs.length === 0) {
      return ApiErrors.badRequest("logs must be a non-empty array");
    }

    const exercises = await prisma.progressionExercise.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        wuxiaName: true,
        difficulty: true,
        wuxiaDifficulty: true,
        wuxiaType: true,
        tiers: { select: { level: true } },
        variations: { select: { name: true, wuxiaName: true } },
      },
    });

    const exerciseById = new Map<string, TargetExercise>();
    const exerciseByName = new Map<string, TargetExercise>();
    const tierLevelsByExerciseId = new Map<string, Set<number>>();
    const variationKeysByExerciseId = new Map<string, Set<string>>();
    for (const ex of exercises) {
      tierLevelsByExerciseId.set(ex.id, new Set(ex.tiers.map((tier) => tier.level)));
      variationKeysByExerciseId.set(
        ex.id,
        new Set(
          ex.variations
            .flatMap((variation) => [variation.name, variation.wuxiaName])
            .map(normalizeText)
            .filter(Boolean)
        )
      );
      addExerciseToMaps(
        {
          id: ex.id,
          name: ex.name,
          wuxiaName: ex.wuxiaName || "",
          difficulty: ex.difficulty || "",
          wuxiaDifficulty: ex.wuxiaDifficulty || "",
          wuxiaType: ex.wuxiaType || "",
        },
        exerciseById,
        exerciseByName
      );
    }

    const sourceIds = Array.from(
      new Set(logs.map((l) => l.exerciseId).filter((v): v is string => typeof v === "string" && v.trim().length > 0))
    );
    const sourceById = new Map<string, SourceProgressionExercise>();
    if (sourceIds.length > 0) {
      const sourceExercises = await prisma.progressionExercise.findMany({
        where: { id: { in: sourceIds } },
        select: {
          id: true,
          name: true,
          wuxiaName: true,
          difficulty: true,
          wuxiaDifficulty: true,
          type: true,
          wuxiaType: true,
          story: true,
          category: true,
          equipmentType: true,
          bodyweight: true,
          weighted: true,
          rings: true,
          primaryMuscles: true,
          secondaryMuscles: true,
        },
      });
      for (const src of sourceExercises) {
        sourceById.set(src.id, src);
      }
    }

    const library = await prisma.exercise.findMany({
      select: {
        id: true,
        name: true,
        wuxiaName: true,
        difficulty: true,
        type: true,
        story: true,
        targetGroup: true,
      },
    });
    const libraryByName = new Map<string, LibraryExercise>();
    for (const lib of library) {
      const keys = [lib.name, lib.wuxiaName || ""].map(normalizeText).filter(Boolean);
      for (const key of keys) {
        if (!libraryByName.has(key)) libraryByName.set(key, lib);
      }
    }

    const existingLevels = await prisma.userProgressionLevel.findMany({
      where: { userId },
      select: { id: true, exerciseId: true, currentLevel: true },
    });
    const levelByExerciseId = new Map(existingLevels.map((l) => [l.exerciseId, { id: l.id, currentLevel: l.currentLevel }]));

    if (replaceExisting) {
      await prisma.progressionLog.deleteMany({
        where: { userProgression: { userId } },
      });
    }

    let imported = 0;
    let skipped = 0;
    let createdExercises = 0;
    let createdVariations = 0;
    let createdTiers = 0;
    const libraryOwnerId = await ensureAppExerciseLibraryOwner();
    const skippedDetails: string[] = [];

    const createTargetExerciseFromLibrary = async (lib: LibraryExercise): Promise<TargetExercise> => {
      const created = await prisma.progressionExercise.create({
        data: {
          userId: libraryOwnerId,
          name: lib.name,
          wuxiaName: lib.wuxiaName || "",
          difficulty: lib.difficulty || "",
          wuxiaDifficulty: lib.difficulty || "",
          type: lib.type || "",
          wuxiaType: lib.type || "",
          story: lib.story || "",
          category: (lib.targetGroup || "Uncategorized").slice(0, 100),
          equipmentType: "bodyweight",
          bodyweight: true,
          weighted: false,
          rings: false,
          primaryMuscles: "",
          secondaryMuscles: "",
        },
        select: { id: true, name: true, wuxiaName: true, difficulty: true, wuxiaDifficulty: true, wuxiaType: true },
      });
      const target = {
        id: created.id,
        name: created.name,
        wuxiaName: created.wuxiaName || "",
        difficulty: created.difficulty || "",
        wuxiaDifficulty: created.wuxiaDifficulty || created.difficulty || "",
        wuxiaType: created.wuxiaType || "",
      };
      addExerciseToMaps(target, exerciseById, exerciseByName);
      tierLevelsByExerciseId.set(target.id, new Set<number>());
      variationKeysByExerciseId.set(target.id, new Set<string>());
      createdExercises++;
      return target;
    };

    const createTargetExerciseFromSource = async (src: SourceProgressionExercise): Promise<TargetExercise> => {
      const created = await prisma.progressionExercise.create({
        data: {
          userId: libraryOwnerId,
          name: src.name,
          wuxiaName: src.wuxiaName || "",
          difficulty: src.difficulty || "",
          wuxiaDifficulty: src.wuxiaDifficulty || src.difficulty || "",
          type: src.type || "",
          wuxiaType: src.wuxiaType || src.type || "",
          story: src.story || "",
          category: (src.category || "Uncategorized").slice(0, 100),
          equipmentType: src.equipmentType || "bodyweight",
          bodyweight: src.bodyweight,
          weighted: src.weighted,
          rings: src.rings,
          primaryMuscles: src.primaryMuscles || "",
          secondaryMuscles: src.secondaryMuscles || "",
        },
        select: { id: true, name: true, wuxiaName: true, difficulty: true, wuxiaDifficulty: true, wuxiaType: true },
      });
      const target = {
        id: created.id,
        name: created.name,
        wuxiaName: created.wuxiaName || "",
        difficulty: created.difficulty || "",
        wuxiaDifficulty: created.wuxiaDifficulty || created.difficulty || "",
        wuxiaType: created.wuxiaType || "",
      };
      addExerciseToMaps(target, exerciseById, exerciseByName);
      tierLevelsByExerciseId.set(target.id, new Set<number>());
      variationKeysByExerciseId.set(target.id, new Set<string>());
      createdExercises++;
      return target;
    };

    const createTargetExerciseFromImport = async (rawLog: ImportedLog): Promise<TargetExercise | null> => {
      const trimmedName = String(rawLog.exerciseName || "").trim();
      if (!trimmedName) return null;

      const inferred = inferImportedExerciseShape(rawLog);
      const created = await prisma.progressionExercise.create({
        data: {
          userId: libraryOwnerId,
          name: trimmedName.slice(0, 200),
          wuxiaName: trimmedName.slice(0, 200),
          difficulty: inferred.difficulty,
          wuxiaDifficulty: inferred.wuxiaDifficulty,
          type: inferred.category.includes("Gym") ? "Heaven and Earth United" : "",
          wuxiaType: inferred.wuxiaType,
          story: "Imported from training log",
          category: inferred.category,
          equipmentType: inferred.equipmentType,
          bodyweight: inferred.bodyweight,
          weighted: inferred.weighted,
          rings: inferred.rings,
          primaryMuscles: "",
          secondaryMuscles: "",
        },
        select: { id: true, name: true, wuxiaName: true, difficulty: true, wuxiaDifficulty: true, wuxiaType: true },
      });

      const target = {
        id: created.id,
        name: created.name,
        wuxiaName: created.wuxiaName || "",
        difficulty: created.difficulty || "",
        wuxiaDifficulty: created.wuxiaDifficulty || created.difficulty || "",
        wuxiaType: created.wuxiaType || "",
      };
      addExerciseToMaps(target, exerciseById, exerciseByName);
      tierLevelsByExerciseId.set(target.id, new Set<number>());
      variationKeysByExerciseId.set(target.id, new Set<string>());
      createdExercises++;
      return target;
    };

    const ensureTierExists = async (exercise: TargetExercise, level: number) => {
      const normalizedLevel = Math.max(1, Math.floor(level || 1));
      const existingLevelsForExercise = tierLevelsByExerciseId.get(exercise.id) ?? new Set<number>();
      if (existingLevelsForExercise.has(normalizedLevel)) return;

      await prisma.progressionTier.create({
        data: {
          exerciseId: exercise.id,
          level: normalizedLevel,
          name: normalizedLevel === 1 ? exercise.name : `${exercise.name} Tier ${normalizedLevel}`,
          wuxiaName: normalizedLevel === 1 ? (exercise.wuxiaName || exercise.name) : `${exercise.wuxiaName || exercise.name} Tier ${normalizedLevel}`,
          difficulty: exercise.difficulty || "",
          wuxiaDifficulty: exercise.wuxiaDifficulty || exercise.difficulty || "",
          wuxiaType: exercise.wuxiaType || "",
        },
      });

      existingLevelsForExercise.add(normalizedLevel);
      tierLevelsByExerciseId.set(exercise.id, existingLevelsForExercise);
      createdTiers++;
    };

    const ensureVariationExists = async (exercise: TargetExercise, variantName: string | null | undefined) => {
      const trimmedVariant = String(variantName || "").trim();
      if (!trimmedVariant) return;

      const normalizedVariant = normalizeText(trimmedVariant);
      if (!normalizedVariant) return;

      const existingVariationKeys = variationKeysByExerciseId.get(exercise.id) ?? new Set<string>();
      if (existingVariationKeys.has(normalizedVariant)) return;

      await prisma.progressionVariation.create({
        data: {
          exerciseId: exercise.id,
          name: trimmedVariant.slice(0, 200),
          wuxiaName: trimmedVariant.slice(0, 200),
          difficulty: exercise.difficulty || "",
          wuxiaDifficulty: exercise.wuxiaDifficulty || exercise.difficulty || "",
          wuxiaType: exercise.wuxiaType || "",
          description: "Imported from training log",
        },
      });

      existingVariationKeys.add(normalizedVariant);
      variationKeysByExerciseId.set(exercise.id, existingVariationKeys);
      createdVariations++;
    };

    const logCreateBatch: {
      userProgressionId: string;
      level: number;
      weight1: number | null;
      reps1: number | null;
      weight2: number | null;
      reps2: number | null;
      weight3: number | null;
      reps3: number | null;
      holdTime: number | null;
      holdTime2: number | null;
      holdTime3: number | null;
      modifier: string | null;
      variant: string | null;
      setupOption: string | null;
      notes: string | null;
      completed: boolean;
      createdAt: Date;
    }[] = [];

    for (const rawLog of logs) {
      let exercise = null as TargetExercise | null;

      if (rawLog.exerciseId && exerciseById.has(rawLog.exerciseId)) {
        exercise = exerciseById.get(rawLog.exerciseId) ?? null;
      }

      if (!exercise && rawLog.exerciseName) {
        const normalizedName = normalizeText(rawLog.exerciseName);
        exercise = exerciseByName.get(normalizedName) ?? null;
      }

      if (!exercise && rawLog.exerciseId && sourceById.has(rawLog.exerciseId)) {
        const src = sourceById.get(rawLog.exerciseId)!;
        const maybeExisting = exerciseByName.get(normalizeText(src.name)) || exerciseByName.get(normalizeText(src.wuxiaName));
        exercise = maybeExisting || await createTargetExerciseFromSource(src);
      }

      if (!exercise && rawLog.exerciseName) {
        const lib = libraryByName.get(normalizeText(rawLog.exerciseName));
        if (lib) {
          const maybeExisting = exerciseByName.get(normalizeText(lib.name)) || exerciseByName.get(normalizeText(lib.wuxiaName));
          exercise = maybeExisting || await createTargetExerciseFromLibrary(lib);
        }
      }

      if (!exercise && rawLog.exerciseName) {
        exercise = await createTargetExerciseFromImport(rawLog);
      }

      if (!exercise) {
        skipped++;
        if (skippedDetails.length < 50) {
          skippedDetails.push(`Unmatched exercise: ${rawLog.exerciseName || rawLog.exerciseId || "(unknown)"}`);
        }
        continue;
      }

      const level = Math.max(1, Math.floor(Number(rawLog.level) || 1));
      await ensureTierExists(exercise, level);
      await ensureVariationExists(exercise, rawLog.variant);

      let userProgression = levelByExerciseId.get(exercise.id);
      if (!userProgression) {
        const createdLevel = await prisma.userProgressionLevel.create({
          data: {
            userId,
            exerciseId: exercise.id,
            currentLevel: level,
          },
          select: { id: true, currentLevel: true },
        });
        userProgression = createdLevel;
        levelByExerciseId.set(exercise.id, createdLevel);
      }

      if (userProgression.currentLevel < level) {
        await prisma.userProgressionLevel.update({
          where: { id: userProgression.id },
          data: { currentLevel: level },
        });
        userProgression = { ...userProgression, currentLevel: level };
        levelByExerciseId.set(exercise.id, userProgression);
      }

      logCreateBatch.push({
        userProgressionId: userProgression.id,
        level,
        weight1: normalizeNullableNumber(rawLog.weight1, 0, 10000),
        reps1: normalizeNullableInt(rawLog.reps1, 0, 500),
        weight2: normalizeNullableNumber(rawLog.weight2, 0, 10000),
        reps2: normalizeNullableInt(rawLog.reps2, 0, 500),
        weight3: normalizeNullableNumber(rawLog.weight3, 0, 10000),
        reps3: normalizeNullableInt(rawLog.reps3, 0, 500),
        holdTime: normalizeNullableInt(rawLog.holdTime, 0, 9999),
        holdTime2: normalizeNullableInt(rawLog.holdTime2, 0, 9999),
        holdTime3: normalizeNullableInt(rawLog.holdTime3, 0, 9999),
        modifier: rawLog.modifier ? String(rawLog.modifier).trim().slice(0, 100) : null,
        variant: rawLog.variant ? String(rawLog.variant).trim().slice(0, 200) : null,
        setupOption: rawLog.setupOption ? String(rawLog.setupOption).trim().slice(0, 100) : null,
        notes: rawLog.notes ? String(rawLog.notes).trim().slice(0, 1000) : null,
        completed: Boolean(rawLog.completed),
        createdAt: parseCreatedAt(rawLog.createdAt),
      });

      imported++;
    }

    // Batch-insert all logs in chunks of 500 to avoid SQLite parameter limits
    const BATCH_SIZE = 500;
    for (let i = 0; i < logCreateBatch.length; i += BATCH_SIZE) {
      await prisma.progressionLog.createMany({
        data: logCreateBatch.slice(i, i + BATCH_SIZE),
      });
    }

    return apiSuccess({
      success: true,
      imported,
      skipped,
      createdExercises,
      createdVariations,
      createdTiers,
      skippedDetails: skippedDetails.length > 0 ? skippedDetails : undefined,
      replaced: replaceExisting,
    });
  } catch (error) {
    console.error("Progression log import error:", error);
    return ApiErrors.internal("Failed to import progression logs");
  }
});
