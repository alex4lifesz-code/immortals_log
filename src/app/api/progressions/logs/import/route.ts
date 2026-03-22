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
      select: { id: true, name: true },
    });

    const exerciseById = new Map(exercises.map((e) => [e.id, e]));
    const exerciseByName = new Map(exercises.map((e) => [e.name.trim().toLowerCase(), e]));

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

    for (const rawLog of logs) {
      let exercise = null as { id: string; name: string } | null;

      if (rawLog.exerciseId && exerciseById.has(rawLog.exerciseId)) {
        exercise = exerciseById.get(rawLog.exerciseId) ?? null;
      }

      if (!exercise && rawLog.exerciseName) {
        exercise = exerciseByName.get(rawLog.exerciseName.trim().toLowerCase()) ?? null;
      }

      if (!exercise) {
        skipped++;
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
      replaced: replaceExisting,
    });
  } catch (error) {
    console.error("Progression log import error:", error);
    return NextResponse.json({ error: "Failed to import progression logs" }, { status: 500 });
  }
}
