import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SimpleExercise, TrainingCategory, SimpleExerciseType, MuscleGroup, Difficulty } from "@/lib/exercise-types";
import { ALL_TRAINING_CATEGORIES, ALL_EXERCISE_TYPES, ALL_MUSCLE_GROUPS, ALL_DIFFICULTIES } from "@/lib/exercise-types";
import { withAuth } from "@/lib/auth/middleware";

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
  userId: string;
  createdAt: Date;
}): SimpleExercise {
  const category = inferCategory(pe.category);
  const exerciseType = inferExerciseType(pe);
  const muscleGroups = parseMuscleGroups(pe.primaryMuscles, pe.secondaryMuscles);
  const equipment = pe.equipmentType ? pe.equipmentType.split(',').map(s => s.trim()).filter(Boolean) : undefined;
  const difficulty = inferDifficulty(pe.difficulty);

  return {
    id: pe.id,
    name: pe.name,
    category,
    exerciseType,
    muscleGroups,
    equipment,
    difficulty,
    description: pe.story || undefined,
    isCustom: true,
    userId: pe.userId,
    createdAt: pe.createdAt.toISOString(),
  };
}

function inferCategory(cat: string): TrainingCategory {
  const lower = (cat || '').toLowerCase();
  if (lower.includes('gym')) return 'GYM';
  if (lower.includes('calisthenics') || lower.includes('cali')) return 'Calisthenics';
  if (lower.includes('yoga')) return 'Yoga';
  if (lower.includes('cardio')) return 'Cardio';
  if (lower.includes('stretch')) return 'Stretching';
  return 'Other';
}

function inferExerciseType(pe: { bodyweight: boolean; weighted: boolean; category?: string }): SimpleExerciseType {
  if (pe.weighted) return 'weighted';
  if (pe.bodyweight) return 'bodyweight';
  const cat = (pe.category || '').toLowerCase();
  if (cat.includes('yoga') || cat.includes('stretch')) return 'timed';
  if (cat.includes('gym')) return 'weighted';
  return 'bodyweight';
}

function parseMuscleGroups(primary: string, secondary?: string): MuscleGroup[] {
  const all = [primary, secondary || '']
    .join(',')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const mapped: MuscleGroup[] = [];
  for (const m of all) {
    const match = ALL_MUSCLE_GROUPS.find(g => g.toLowerCase() === m.toLowerCase());
    if (match && !mapped.includes(match)) {
      mapped.push(match);
    }
  }
  return mapped.length > 0 ? mapped : ['Other'];
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
export const GET = withAuth(async () => {
  try {
    const dbExercises = await prisma.progressionExercise.findMany({
      orderBy: { name: "asc" },
    });

    const exercises: SimpleExercise[] = dbExercises.map(mapDbToSimpleExercise);

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
    const { name, category, exerciseType, muscleGroups, equipment, difficulty, description, instructions } = body;

    const trimmedName = String(name || "").trim().slice(0, 200);
    if (!trimmedName || trimmedName.length < 2) {
      return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
    }

    if (!ALL_TRAINING_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    if (!ALL_EXERCISE_TYPES.includes(exerciseType)) {
      return NextResponse.json({ error: "Invalid exercise type" }, { status: 400 });
    }

    if (!Array.isArray(muscleGroups) || muscleGroups.length === 0) {
      return NextResponse.json({ error: "At least one muscle group is required" }, { status: 400 });
    }

    for (const mg of muscleGroups) {
      if (!ALL_MUSCLE_GROUPS.includes(mg)) {
        return NextResponse.json({ error: `Invalid muscle group: ${mg}` }, { status: 400 });
      }
    }

    if (difficulty && !ALL_DIFFICULTIES.includes(difficulty)) {
      return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
    }

    // Check for duplicate name within user's exercises
    const existing = await prisma.progressionExercise.findMany({
      where: { userId },
    });
    const duplicate = existing.find(ex => ex.name.toLowerCase() === trimmedName.toLowerCase());
    if (duplicate) {
      return NextResponse.json({ error: "An exercise with this name already exists" }, { status: 409 });
    }

    // Map category to DB format
    const dbCategory = category;
    const isBodyweight = exerciseType === 'bodyweight' || exerciseType === 'timed';
    const isWeighted = exerciseType === 'weighted';

    const dbExercise = await prisma.progressionExercise.create({
      data: {
        name: trimmedName,
        wuxiaName: trimmedName,
        category: dbCategory,
        equipmentType: Array.isArray(equipment) ? equipment.join(', ') : '',
        bodyweight: isBodyweight,
        weighted: isWeighted,
        rings: false,
        primaryMuscles: muscleGroups.join(', '),
        secondaryMuscles: '',
        difficulty: difficulty ? String(difficulty).trim() : '',
        wuxiaDifficulty: difficulty ? String(difficulty).trim() : '',
        story: description ? String(description).trim().slice(0, 2000) : '',
        tips: instructions ? JSON.stringify(instructions) : '[]',
        userId,
      },
    });

    // Create a default tier so the exercise works with the logging system
    await prisma.progressionTier.create({
      data: {
        exerciseId: dbExercise.id,
        level: 1,
        name: trimmedName,
        wuxiaName: trimmedName,
        difficulty: difficulty ? String(difficulty).trim() : '',
      },
    });

    // Create UserProgressionLevel so logging works
    await prisma.userProgressionLevel.create({
      data: {
        userId,
        exerciseId: dbExercise.id,
        currentLevel: 1,
      },
    });

    const exercise = mapDbToSimpleExercise(dbExercise);

    return NextResponse.json({ exercise }, { status: 201 });
  } catch (error) {
    console.error("Exercise create error:", error);
    return NextResponse.json(
      { error: "Failed to create exercise" },
      { status: 500 }
    );
  }
});
