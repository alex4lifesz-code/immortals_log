import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALL_TRAINING_CATEGORIES, ALL_EXERCISE_TYPES, ALL_MUSCLE_GROUPS, ALL_DIFFICULTIES } from "@/lib/exercise-types";

/** PATCH /api/exercise-library/[id] — Update an exercise */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { userId, name, category, exerciseType, muscleGroups, equipment, difficulty, description, instructions } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const existing = await prisma.progressionExercise.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      const trimmedName = String(name).trim().slice(0, 200);
      if (trimmedName.length < 2) {
        return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
      }
      // Check duplicate
      const allUserExercises = await prisma.progressionExercise.findMany({ where: { userId } });
      const duplicate = allUserExercises.find(ex => ex.id !== id && ex.name.toLowerCase() === trimmedName.toLowerCase());
      if (duplicate) {
        return NextResponse.json({ error: "An exercise with this name already exists" }, { status: 409 });
      }
      updateData.name = trimmedName;
      updateData.wuxiaName = trimmedName;
    }

    if (category !== undefined) {
      if (!ALL_TRAINING_CATEGORIES.includes(category)) {
        return NextResponse.json({ error: "Invalid category" }, { status: 400 });
      }
      updateData.category = category;
    }

    if (exerciseType !== undefined) {
      if (!ALL_EXERCISE_TYPES.includes(exerciseType)) {
        return NextResponse.json({ error: "Invalid exercise type" }, { status: 400 });
      }
      updateData.bodyweight = exerciseType === 'bodyweight' || exerciseType === 'timed';
      updateData.weighted = exerciseType === 'weighted';
    }

    if (muscleGroups !== undefined) {
      if (!Array.isArray(muscleGroups) || muscleGroups.length === 0) {
        return NextResponse.json({ error: "At least one muscle group required" }, { status: 400 });
      }
      for (const mg of muscleGroups) {
        if (!ALL_MUSCLE_GROUPS.includes(mg)) {
          return NextResponse.json({ error: `Invalid muscle group: ${mg}` }, { status: 400 });
        }
      }
      updateData.primaryMuscles = muscleGroups.join(', ');
    }

    if (equipment !== undefined) {
      updateData.equipmentType = Array.isArray(equipment) ? equipment.join(', ') : '';
    }

    if (difficulty !== undefined) {
      if (difficulty && !ALL_DIFFICULTIES.includes(difficulty)) {
        return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
      }
      const wuxiaDiffMap: Record<string, string> = {
        'Beginner': 'Mortal',
        'Intermediate': 'Core Formation',
        'Advanced': 'Nascent Soul',
      };
      updateData.difficulty = difficulty ? wuxiaDiffMap[difficulty] || difficulty : '';
      updateData.wuxiaDifficulty = difficulty ? wuxiaDiffMap[difficulty] || '' : '';
    }

    if (description !== undefined) {
      updateData.story = String(description).trim().slice(0, 2000);
    }

    if (instructions !== undefined) {
      updateData.tips = JSON.stringify(instructions);
    }

    const updated = await prisma.progressionExercise.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ exercise: updated });
  } catch (error) {
    console.error("Exercise update error:", error);
    return NextResponse.json({ error: "Failed to update exercise" }, { status: 500 });
  }
}

/** DELETE /api/exercise-library/[id] — Delete an exercise */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const existing = await prisma.progressionExercise.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
    }

    // Cascade delete handles tiers, variations, modifiers, user progress, logs
    await prisma.progressionExercise.delete({ where: { id } });

    return NextResponse.json({ message: "Exercise deleted" });
  } catch (error) {
    console.error("Exercise delete error:", error);
    return NextResponse.json({ error: "Failed to delete exercise" }, { status: 500 });
  }
}
