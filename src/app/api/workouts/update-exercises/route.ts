import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface ExerciseUpdate {
  id: string;
  weight1: number | null;
  reps1: number | null;
  weight2: number | null;
  reps2: number | null;
  weight3: number | null;
  reps3: number | null;
  holdTime: number | null;
  notes: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const { updates } = await req.json() as { updates: ExerciseUpdate[] };

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: "Updates array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Validate all updates
    for (const update of updates) {
      if (!update.id) {
        return NextResponse.json(
          { error: "Exercise ID is required for all updates" },
          { status: 400 }
        );
      }

      // Validate reps values
      if (update.reps1 !== null && (update.reps1 < 1 || update.reps1 > 500)) {
        return NextResponse.json(
          { error: "Reps 1 must be between 1 and 500" },
          { status: 400 }
        );
      }

      if (update.reps2 !== null && (update.reps2 < 1 || update.reps2 > 500)) {
        return NextResponse.json(
          { error: "Reps 2 must be between 1 and 500" },
          { status: 400 }
        );
      }

      if (update.reps3 !== null && (update.reps3 < 1 || update.reps3 > 500)) {
        return NextResponse.json(
          { error: "Reps 3 must be between 1 and 500" },
          { status: 400 }
        );
      }

      // Validate weight values
      if (update.weight1 !== null && (update.weight1 < 0 || update.weight1 > 10000)) {
        return NextResponse.json(
          { error: "Weight 1 must be between 0 and 10000" },
          { status: 400 }
        );
      }

      if (update.weight2 !== null && (update.weight2 < 0 || update.weight2 > 10000)) {
        return NextResponse.json(
          { error: "Weight 2 must be between 0 and 10000" },
          { status: 400 }
        );
      }

      if (update.weight3 !== null && (update.weight3 < 0 || update.weight3 > 10000)) {
        return NextResponse.json(
          { error: "Weight 3 must be between 0 and 10000" },
          { status: 400 }
        );
      }

      // At least one set must have reps
      if (!update.reps1 && !update.reps2 && !update.reps3) {
        return NextResponse.json(
          { error: "At least one set with reps is required" },
          { status: 400 }
        );
      }
    }

    // Perform batch update
    const updatePromises = updates.map(update =>
      prisma.simplifiedWorkoutExercise.update({
        where: { id: update.id },
        data: {
          weight1: update.weight1,
          reps1: update.reps1,
          weight2: update.weight2,
          reps2: update.reps2,
          weight3: update.weight3,
          reps3: update.reps3,
          holdTime: update.holdTime,
          notes: update.notes,
        },
      })
    );

    await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      message: "Training sessions updated successfully!",
    });
  } catch (error) {
    console.error("Workout update error:", error);
    
    // Check if it's a record not found error
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { error: "One or more exercise records not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update training sessions" },
      { status: 500 }
    );
  }
}
