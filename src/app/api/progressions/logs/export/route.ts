import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/progressions/logs/export?userId=X
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const logs = await prisma.progressionLog.findMany({
      where: {
        userProgression: { userId },
      },
      include: {
        userProgression: {
          include: {
            exercise: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      userId,
      logs: logs.map((log) => ({
        exerciseId: log.userProgression.exercise.id,
        exerciseName: log.userProgression.exercise.name,
        level: log.level,
        weight1: log.weight1,
        reps1: log.reps1,
        weight2: log.weight2,
        reps2: log.reps2,
        weight3: log.weight3,
        reps3: log.reps3,
        holdTime: log.holdTime,
        holdTime2: log.holdTime2,
        holdTime3: log.holdTime3,
        modifier: log.modifier,
        variant: log.variant,
        notes: log.notes,
        completed: log.completed,
        createdAt: log.createdAt.toISOString(),
      })),
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Progression log export error:", error);
    return NextResponse.json({ error: "Failed to export progression logs" }, { status: 500 });
  }
}
