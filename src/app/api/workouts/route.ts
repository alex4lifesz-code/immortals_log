import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const showAll = searchParams.get("showAll") === "true";
    const daysParam = searchParams.get("days");
    
    if (!userId && !showAll) {
      console.error("Missing userId parameter - unauthenticated request");
      return NextResponse.json(
        { error: "Authentication required. Please log in." },
        { status: 401 }
      );
    }

    // Build query: filter by userId if provided, or return all if showAll=true
    const whereClause: Record<string, unknown> = userId ? { userId } : {};

    // Apply date range filter if days parameter provided
    const days = daysParam ? parseInt(daysParam, 10) : 0;
    if (days > 0) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      whereClause.date = { gte: since };
    }

    const workouts = await prisma.workout.findMany({
      where: whereClause,
      include: {
        simplifiedExercises: {
          include: { exercise: true },
          orderBy: { order: "asc" },
        },
        detailedExercises: {
          include: { exercise: true },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { date: "desc" },
      ...(!showAll && !days ? { take: 10 } : {}),
    });

    // Auto-derive targetGroups from exercises for workouts that don't have them yet
    const enrichedWorkouts = workouts.map(w => {
      const normalizedExercises =
        w.simplifiedExercises.length > 0
          ? w.simplifiedExercises
          : w.detailedExercises.map(de => ({
              id: de.id,
              workoutId: de.workoutId,
              exerciseId: de.exerciseId,
              weight1: de.weight1,
              reps1: de.reps1,
              weight2: de.weight2,
              reps2: de.reps2,
              weight3: de.weight3,
              reps3: de.reps3,
              notes: de.notes,
              order: de.order,
              createdAt: de.createdAt,
              exercise: de.exercise,
            }));

      const withNormalized = { ...w, simplifiedExercises: normalizedExercises };
      if (w.targetGroups) return withNormalized;
      const groups = new Set<string>();
      for (const se of normalizedExercises) {
        if (se.exercise.targetGroup) groups.add(se.exercise.targetGroup);
      }
      return groups.size > 0
        ? { ...withNormalized, targetGroups: Array.from(groups).join(",") }
        : withNormalized;
    });
    
    return NextResponse.json({ workouts: enrichedWorkouts });
  } catch (error) {
    console.error("Workouts fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch workouts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, exerciseId, weight1, reps1, weight2, reps2, weight3, reps3, notes } = await req.json();

    // Validation
    if (!userId || typeof userId !== "string" || !exerciseId || typeof exerciseId !== "string") {
      return NextResponse.json(
        { error: "User ID and exercise ID are required" },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Validate notes length
    if (notes && typeof notes === "string" && notes.length > 1000) {
      return NextResponse.json(
        { error: "Notes must be 1000 characters or less" },
        { status: 400 }
      );
    }

    // At least one set must have reps
    if (!reps1 && !reps2 && !reps3) {
      return NextResponse.json(
        { error: "At least one set with reps is required" },
        { status: 400 }
      );
    }

    // Validate reps values
    const validateReps = (reps: number | string | undefined | null) => {
      if (reps !== undefined && reps !== null) {
        const repsNum = parseInt(String(reps), 10);
        if (isNaN(repsNum) || repsNum <= 0 || repsNum > 500) {
          return false;
        }
      }
      return true;
    };

    if (!validateReps(reps1) || !validateReps(reps2) || !validateReps(reps3)) {
      return NextResponse.json(
        { error: "Reps must be between 1 and 500" },
        { status: 400 }
      );
    }

    // Validate weight values
    const validateWeight = (weight: number | string | undefined | null) => {
      if (weight !== undefined && weight !== null) {
        const weightNum = parseFloat(String(weight));
        if (isNaN(weightNum) || weightNum < 0 || weightNum > 10000) {
          return false;
        }
      }
      return true;
    };

    if (!validateWeight(weight1) || !validateWeight(weight2) || !validateWeight(weight3)) {
      return NextResponse.json(
        { error: "Weight must be between 0 and 10000" },
        { status: 400 }
      );
    }

    // Verify exercise exists
    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId }
    });

    if (!exercise) {
      return NextResponse.json(
        { error: "Exercise not found" },
        { status: 404 }
      );
    }

    // Create workout with set-based exercise entry
    const workout = await prisma.workout.create({
      data: {
        userId,
        name: `${exercise.name} Training`,
        totalXP: getDifficultyXP(exercise.difficulty),
        targetGroups: exercise.targetGroup || null,
        simplifiedExercises: {
          create: {
            exerciseId,
            weight1: weight1 ? parseFloat(weight1) : null,
            reps1: reps1 ? parseInt(reps1) : null,
            weight2: weight2 ? parseFloat(weight2) : null,
            reps2: reps2 ? parseInt(reps2) : null,
            weight3: weight3 ? parseFloat(weight3) : null,
            reps3: reps3 ? parseInt(reps3) : null,
            notes: notes || null,
            order: 0,
          }
        },
      },
      include: {
        simplifiedExercises: {
          include: { exercise: true },
        },
      },
    });

    return NextResponse.json({ 
      success: true, 
      workout: workout,
      message: "Training session recorded successfully!" 
    });
    
  } catch (error) {
    console.error("Workout creation error:", error);
    return NextResponse.json({ error: "Failed to create workout" }, { status: 500 });
  }
}

// Helper function to calculate XP based on difficulty
function getDifficultyXP(difficulty: string): number {
  switch (difficulty.toLowerCase()) {
    case 'beginner': return 10;
    case 'intermediate': return 20;
    case 'advanced': return 30;
    case 'master': return 50;
    default: return 10;
  }
}
