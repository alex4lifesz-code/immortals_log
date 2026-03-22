import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  notes?: string | null;
  completed?: boolean;
  createdAt?: string;
};

type TargetExercise = {
  id: string;
  name: string;
  wuxiaName: string;
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
// Body: { userId: string, logs: ImportedLog[], replaceExisting?: boolean }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      userId?: string;
      logs?: ImportedLog[];
      replaceExisting?: boolean;
    };

    const userId = body.userId;
    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const logs = body.logs;
    if (!Array.isArray(logs)) {
      return NextResponse.json({ error: "logs must be an array" }, { status: 400 });
    }

    if (logs.length > 10000) {
      return NextResponse.json({ error: "Maximum 10,000 logs per import" }, { status: 400 });
    }

    const replaceExisting = body.replaceExisting !== false;

    // If replaceExisting and no logs, just purge
    if (replaceExisting && logs.length === 0) {
      await prisma.progressionLog.deleteMany({
        where: { userProgression: { userId } },
      });
      return NextResponse.json({ success: true, imported: 0, skipped: 0, replaced: true });
    }

    if (logs.length === 0) {
      return NextResponse.json({ error: "logs must be a non-empty array" }, { status: 400 });
    }

    const exercises = await prisma.progressionExercise.findMany({
      where: { userId },
      select: { id: true, name: true, wuxiaName: true },
    });

    const exerciseById = new Map<string, TargetExercise>();
    const exerciseByName = new Map<string, TargetExercise>();
    for (const ex of exercises) {
      addExerciseToMaps(
        { id: ex.id, name: ex.name, wuxiaName: ex.wuxiaName || "" },
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
      select: { id: true, exerciseId: true },
    });
    const levelByExerciseId = new Map(existingLevels.map((l) => [l.exerciseId, l.id]));

    if (replaceExisting) {
      await prisma.progressionLog.deleteMany({
        where: { userProgression: { userId } },
      });
    }

    let imported = 0;
    let skipped = 0;
    const skippedDetails: string[] = [];

    const createTargetExerciseFromLibrary = async (lib: LibraryExercise): Promise<TargetExercise> => {
      const created = await prisma.progressionExercise.create({
        data: {
          userId,
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
        select: { id: true, name: true, wuxiaName: true },
      });
      const target = { id: created.id, name: created.name, wuxiaName: created.wuxiaName || "" };
      addExerciseToMaps(target, exerciseById, exerciseByName);
      return target;
    };

    const createTargetExerciseFromSource = async (src: SourceProgressionExercise): Promise<TargetExercise> => {
      const created = await prisma.progressionExercise.create({
        data: {
          userId,
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
        select: { id: true, name: true, wuxiaName: true },
      });
      const target = { id: created.id, name: created.name, wuxiaName: created.wuxiaName || "" };
      addExerciseToMaps(target, exerciseById, exerciseByName);
      return target;
    };

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

      if (!exercise) {
        skipped++;
        if (skippedDetails.length < 50) {
          skippedDetails.push(`Unmatched exercise: ${rawLog.exerciseName || rawLog.exerciseId || "(unknown)"}`);
        }
        continue;
      }

      let userProgressionId = levelByExerciseId.get(exercise.id);
      if (!userProgressionId) {
        const createdLevel = await prisma.userProgressionLevel.create({
          data: {
            userId,
            exerciseId: exercise.id,
            currentLevel: Math.max(1, Math.floor(Number(rawLog.level) || 1)),
          },
          select: { id: true },
        });
        userProgressionId = createdLevel.id;
        levelByExerciseId.set(exercise.id, createdLevel.id);
      }

      const level = Math.max(1, Math.floor(Number(rawLog.level) || 1));

      await prisma.progressionLog.create({
        data: {
          userProgressionId,
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
          notes: rawLog.notes ? String(rawLog.notes).trim().slice(0, 1000) : null,
          completed: Boolean(rawLog.completed),
          createdAt: parseCreatedAt(rawLog.createdAt),
        },
      });

      imported++;
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      skippedDetails: skippedDetails.length > 0 ? skippedDetails : undefined,
      replaced: replaceExisting,
    });
  } catch (error) {
    console.error("Progression log import error:", error);
    return NextResponse.json({ error: "Failed to import progression logs" }, { status: 500 });
  }
}
