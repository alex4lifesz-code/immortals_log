import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SimpleExercise, TrainingCategory, SimpleExerciseType, MuscleGroup, Difficulty } from "@/lib/exercise-types";
import { ALL_DIFFICULTIES } from "@/lib/exercise-types";
import { withAuth } from "@/lib/auth/middleware";
import { getExerciseDbOptionsFromAppPrefs } from "@/lib/exercise-db-settings";
import {
  isDeletedExerciseDescription,
  isPendingExerciseEditedDescription,
  isPendingExerciseDescription,
  markExerciseAsPending,
  stripExerciseStatusMarkers,
} from "@/lib/pending-exercises";

function parseJsonObject(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore malformed JSON and fall back to defaults.
  }
  return null;
}

async function getUserExerciseDbOptions(userId: string) {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { pinnedNavItems: true },
  });
  const appPrefs = parseJsonObject(settings?.pinnedNavItems) ?? {};
  return getExerciseDbOptionsFromAppPrefs(appPrefs);
}

function resolveOption(value: string, options: string[]): string | null {
  const target = value.trim().toLowerCase();
  if (!target) return null;
  return options.find((opt) => opt.toLowerCase() === target) ?? null;
}

function normalizeTypeForFlags(typeLabel: string): "weighted" | "timed" | "bodyweight" {
  const lower = typeLabel.trim().toLowerCase();
  if (lower.includes("weight") || lower.includes("load") || lower.includes("resist") || lower.includes("barbell") || lower.includes("dumbbell")) {
    return "weighted";
  }
  if (lower.includes("time") || lower.includes("hold") || lower.includes("duration") || lower.includes("isometric") || lower.includes("sec") || lower.includes("min")) {
    return "timed";
  }
  return "bodyweight";
}

function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item || "").trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function inferExerciseType(pe: { bodyweight: boolean; weighted: boolean; category?: string }, typeOptions: string[]): SimpleExerciseType {
  const timedByCategory = (pe.category || '').toLowerCase().includes('yoga') || (pe.category || '').toLowerCase().includes('stretch');
  const normalizedOptions = typeOptions.length > 0 ? typeOptions : ["weighted", "timed", "bodyweight"];

  if (pe.weighted) {
    return normalizedOptions.find((opt) => normalizeTypeForFlags(opt) === "weighted") || "weighted";
  }
  if (timedByCategory && !pe.weighted) {
    return normalizedOptions.find((opt) => normalizeTypeForFlags(opt) === "timed") || "timed";
  }
  if (pe.bodyweight) {
    return normalizedOptions.find((opt) => normalizeTypeForFlags(opt) === "bodyweight") || "bodyweight";
  }
  return normalizedOptions[0] || "bodyweight";
}

function mapDbToSimpleExercise(pe: {
  id: string;
  name: string;
  category: string;
  bodyweight: boolean;
  weighted: boolean;
  rings: boolean;
  primaryMuscles: string;
  secondaryMuscles: string;
  equipmentType: string;
  difficulty: string;
  story: string;
  tips: string;
  progression?: string;
  userId: string;
  createdAt: Date;
  tiers?: Array<{
    name: string;
    level: number;
  }>;
  variations?: Array<{
    id: string;
    name: string;
  }>;
}, options: { categories: string[]; muscles: string[]; types: string[] }): SimpleExercise {
  const category = inferCategory(pe.category, options.categories);
  const exerciseType = inferExerciseType(pe, options.types);
  const muscleGroups = parseMuscleGroups(pe.primaryMuscles, pe.secondaryMuscles, options.muscles);
  const equipment = pe.equipmentType ? pe.equipmentType.split(',').map(s => s.trim()).filter(Boolean) : undefined;
  const difficulty = inferDifficulty(pe.difficulty);
  const progression = (() => {
    const fromJson = parseStringArray(pe.progression);
    if (fromJson.length > 0) return fromJson;
    return (pe.tiers ?? [])
      .sort((a, b) => a.level - b.level)
      .map((tier) => String(tier.name || "").trim())
      .filter(Boolean);
  })();
  const isPendingAddition = isPendingExerciseDescription(pe.story);
  const isPendingEdited = isPendingExerciseEditedDescription(pe.story);

  return {
    id: pe.id,
    name: pe.name,
    category,
    exerciseType,
    muscleGroups,
    variations: (pe.variations ?? []).map((variation) => ({
      id: variation.id,
      name: variation.name,
    })),
    progression,
    equipment,
    difficulty,
    description: stripExerciseStatusMarkers(pe.story) || undefined,
    isCustom: true,
    isPendingAddition,
    isPendingEdited,
    userId: pe.userId,
    createdAt: pe.createdAt.toISOString(),
  };
}

function inferCategory(cat: string, categories: string[]): TrainingCategory {
  const direct = resolveOption(cat, categories);
  if (direct) return direct;

  const lower = (cat || '').toLowerCase();
  if (lower.includes('gym')) return 'GYM';
  if (lower.includes('calisthenics') || lower.includes('cali')) return 'Calisthenics';
  if (lower.includes('yoga')) return 'Yoga';
  if (lower.includes('cardio')) return 'Cardio';
  if (lower.includes('stretch')) return 'Stretching';
  return cat?.trim() || 'Other';
}

function parseMuscleGroups(primary: string, secondary: string | undefined, allowedMuscles: string[]): MuscleGroup[] {
  const all = [primary, secondary || '']
    .join(',')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const mapped: MuscleGroup[] = [];
  for (const m of all) {
    const match = resolveOption(m, allowedMuscles);
    if (match && !mapped.includes(match)) {
      mapped.push(match);
    }
  }
  if (mapped.length > 0) return mapped;
  return [resolveOption('Other', allowedMuscles) ?? 'Other'];
}

function inferDifficulty(diff?: string): Difficulty | undefined {
  if (!diff) return undefined;
  const lower = diff.toLowerCase();
  if (lower === 'beginner') return 'Beginner';
  if (lower === 'intermediate') return 'Intermediate';
  if (lower === 'advanced') return 'Advanced';
  return undefined;
}

/** GET /api/exercise-library — Fetch shared exercise library */
export const GET = withAuth(async (_req, { auth }) => {
  try {
    const dbExercises = await prisma.progressionExercise.findMany({
      include: {
        tiers: {
          select: {
            name: true,
            level: true,
          },
          orderBy: { level: "asc" },
        },
        variations: {
          select: {
            id: true,
            name: true,
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    // Use the signed-in user's DB options to preserve custom category and muscle labels.
    const dbOptions = await getUserExerciseDbOptions(auth.userId);

    const visibleExercises = dbExercises.filter((exercise) => !isDeletedExerciseDescription(exercise.story));
    const exercises: SimpleExercise[] = visibleExercises.map((exercise) => mapDbToSimpleExercise(exercise, dbOptions));

    return NextResponse.json({ exercises });
  } catch (error) {
    console.error("Exercise library fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch exercises" },
      { status: 500 }
    );
  }
});

/** POST /api/exercise-library — Create a new exercise */
export const POST = withAuth(async (req, { auth }) => {
  try {
    const body = await req.json();
    const userId = auth.userId;
    const {
      name,
      category,
      exerciseType,
      muscleGroups,
      equipment,
      difficulty,
      description,
      instructions,
      progression,
      variations,
      pendingReview,
    } = body;
    const dbOptions = await getUserExerciseDbOptions(userId);

    const trimmedName = String(name || "").trim().slice(0, 200);
    if (!trimmedName || trimmedName.length < 2) {
      return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
    }

    const resolvedCategory = resolveOption(String(category || ""), dbOptions.categories);
    if (!resolvedCategory) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const resolvedType = resolveOption(String(exerciseType || ""), dbOptions.types);
    if (!resolvedType) {
      return NextResponse.json({ error: "Invalid exercise type" }, { status: 400 });
    }

    if (!Array.isArray(muscleGroups) || muscleGroups.length === 0) {
      return NextResponse.json({ error: "At least one muscle group is required" }, { status: 400 });
    }

    const normalizedMuscles = muscleGroups
      .map((mg: unknown) => resolveOption(String(mg || ""), dbOptions.muscles))
      .filter(Boolean) as string[];
    if (normalizedMuscles.length !== muscleGroups.length) {
      return NextResponse.json({ error: "One or more muscle groups are invalid" }, { status: 400 });
    }

    if (difficulty && !ALL_DIFFICULTIES.includes(difficulty)) {
      return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
    }

    const normalizedVariations = Array.isArray(variations)
      ? variations
          .map((variation) => String(variation || "").trim().slice(0, 200))
          .filter(Boolean)
      : [];

    const normalizedProgression = progression !== undefined
      ? (Array.isArray(progression)
          ? progression
              .map((stage) => String(stage || "").trim().slice(0, 200))
              .filter(Boolean)
          : null)
      : [];

    if (normalizedProgression === null) {
      return NextResponse.json({ error: "Invalid progression payload" }, { status: 400 });
    }

    const progressionStages = normalizedProgression.length > 0 ? normalizedProgression : [trimmedName];

    // Check for duplicate name across shared exercises
    const existing = await prisma.progressionExercise.findMany({
      select: { name: true },
    });
    const duplicate = existing.find(ex => ex.name.toLowerCase() === trimmedName.toLowerCase());
    if (duplicate) {
      return NextResponse.json({ error: "An exercise with this name already exists" }, { status: 409 });
    }

    // Map category to DB format
    const dbCategory = resolvedCategory;
    const normalizedType = normalizeTypeForFlags(resolvedType);
    const isBodyweight = normalizedType === 'bodyweight' || normalizedType === 'timed';
    const isWeighted = normalizedType === 'weighted';

    const dbExercise = await prisma.progressionExercise.create({
      data: {
        name: trimmedName,
        wuxiaName: trimmedName,
        category: dbCategory,
        equipmentType: Array.isArray(equipment) ? equipment.join(', ') : '',
        bodyweight: isBodyweight,
        weighted: isWeighted,
        rings: false,
        primaryMuscles: normalizedMuscles.join(', '),
        secondaryMuscles: '',
        difficulty: difficulty ? String(difficulty).trim() : '',
        wuxiaDifficulty: difficulty ? String(difficulty).trim() : '',
        story: (() => {
          const baseDescription = description ? String(description).trim().slice(0, 2000) : "";
          return pendingReview === true ? markExerciseAsPending(baseDescription) : baseDescription;
        })(),
        tips: instructions ? JSON.stringify(instructions) : '[]',
        progression: JSON.stringify(progressionStages),
        userId,
        variations: normalizedVariations.length > 0
          ? {
              create: normalizedVariations.map((variationName) => ({
                name: variationName,
                wuxiaName: variationName,
              })),
            }
          : undefined,
      },
      include: {
        tiers: {
          select: {
            name: true,
            level: true,
          },
          orderBy: { level: "asc" },
        },
        variations: {
          select: {
            id: true,
            name: true,
          },
          orderBy: { name: "asc" },
        },
      },
    });

    // Create progression tiers so the exercise works with the logging system.
    await prisma.progressionTier.createMany({
      data: progressionStages.map((stageName, index) => ({
        exerciseId: dbExercise.id,
        level: index + 1,
        name: stageName,
        wuxiaName: stageName,
        difficulty: difficulty ? String(difficulty).trim() : '',
      })),
    });

    // Create UserProgressionLevel so logging works
    await prisma.userProgressionLevel.create({
      data: {
        userId,
        exerciseId: dbExercise.id,
        currentLevel: 1,
      },
    });

    const exercise = mapDbToSimpleExercise(dbExercise, dbOptions);

    return NextResponse.json({ exercise }, { status: 201 });
  } catch (error) {
    console.error("Exercise create error:", error);
    return NextResponse.json(
      { error: "Failed to create exercise" },
      { status: 500 }
    );
  }
});
