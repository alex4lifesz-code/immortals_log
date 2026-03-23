import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT /api/progressions/[id]/level — update user's current level for an exercise
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const userId = body.userId;
    const currentLevel = body.currentLevel;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }
    if (typeof currentLevel !== "number" || currentLevel < 1) {
      return NextResponse.json({ error: "currentLevel must be a positive number" }, { status: 400 });
    }

    // Verify the exercise exists in shared library
    const exercise = await prisma.progressionExercise.findFirst({
      where: { id },
    });
    if (!exercise) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
    }

    const progress = await prisma.userProgressionLevel.upsert({
      where: { userId_exerciseId: { userId, exerciseId: id } },
      update: { currentLevel },
      create: { userId, exerciseId: id, currentLevel },
    });

    return NextResponse.json({ progress });
  } catch (error) {
    console.error("Level update error:", error);
    return NextResponse.json({ error: "Failed to update level" }, { status: 500 });
  }
}
