import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const exerciseId = searchParams.get("exerciseId");
    const userId = searchParams.get("userId");

    if (!exerciseId) {
      return NextResponse.json({ error: "Exercise ID is required" }, { status: 400 });
    }

    const whereClause: { exerciseId: string; workout?: { userId: string } } = { exerciseId };
    if (userId) {
      whereClause.workout = { userId };
    }

    const history = await prisma.simplifiedWorkoutExercise.findMany({
      where: whereClause,
      include: {
        workout: {
          select: {
            date: true,
            name: true,
          },
        },
      },
      orderBy: { workout: { date: "desc" } },
      take: 50,
    });

    return NextResponse.json({
      history: history.map((entry) => ({
        id: entry.id,
        date: entry.workout.date,
        weight1: entry.weight1,
        reps1: entry.reps1,
        weight2: entry.weight2,
        reps2: entry.reps2,
        weight3: entry.weight3,
        reps3: entry.reps3,
        notes: entry.notes,
      })),
    });
  } catch (error) {
    console.error("Exercise history fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch exercise history" }, { status: 500 });
  }
}
