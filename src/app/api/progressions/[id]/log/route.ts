import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/progressions/[id]/log — log training data for a progression level
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const userId = body.userId;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const level = Number(body.level);
    if (!level || level < 1) {
      return NextResponse.json({ error: "level must be a positive number" }, { status: 400 });
    }

    // Find or create user progression
    const exercise = await prisma.progressionExercise.findFirst({
      where: { id },
    });
    if (!exercise) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
    }

    let userProgress = await prisma.userProgressionLevel.findUnique({
      where: { userId_exerciseId: { userId, exerciseId: id } },
    });

    if (!userProgress) {
      userProgress = await prisma.userProgressionLevel.create({
        data: { userId, exerciseId: id, currentLevel: level },
      });
    }

    const log = await prisma.progressionLog.create({
      data: {
        userProgressionId: userProgress.id,
        level,
        weight1: body.weight1 != null ? Number(body.weight1) : null,
        reps1: body.reps1 != null ? Number(body.reps1) : null,
        weight2: body.weight2 != null ? Number(body.weight2) : null,
        reps2: body.reps2 != null ? Number(body.reps2) : null,
        weight3: body.weight3 != null ? Number(body.weight3) : null,
        reps3: body.reps3 != null ? Number(body.reps3) : null,
        holdTime: body.holdTime != null ? Number(body.holdTime) : null,
        holdTime2: body.holdTime2 != null ? Number(body.holdTime2) : null,
        holdTime3: body.holdTime3 != null ? Number(body.holdTime3) : null,
        reps: body.reps != null ? Number(body.reps) : null,
        modifier: body.modifier ? String(body.modifier).trim().slice(0, 100) : null,
        variant: body.variant ? String(body.variant).trim().slice(0, 200) : null,
        notes: body.notes ? String(body.notes).trim().slice(0, 1000) : null,
        completed: body.completed === true,
      },
    });

    // If marking as completed and this is the current level, advance
    if (body.completed === true && userProgress.currentLevel === level) {
      await prisma.userProgressionLevel.update({
        where: { id: userProgress.id },
        data: { currentLevel: level + 1 },
      });
    }

    return NextResponse.json({ log });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Progression log error:", message, error);
    return NextResponse.json({ error: message || "Failed to log progression" }, { status: 500 });
  }
}
