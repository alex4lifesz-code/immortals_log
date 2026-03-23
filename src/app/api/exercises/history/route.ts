import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";

export const GET = withAuth(async (req, { auth }) => {
  try {
    const { searchParams } = new URL(req.url);
    const exerciseId = searchParams.get("exerciseId");

    if (!exerciseId) {
      return NextResponse.json(
        { error: "Exercise ID is required" },
        { status: 400 }
      );
    }

    // Only return the authenticated user's history
    const levels = await prisma.userProgressionLevel.findMany({
      where: { exerciseId, userId: auth.userId },
      include: {
        logs: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });

    const history = levels.flatMap((level) =>
      level.logs.map((log) => ({
        id: log.id,
        date: log.createdAt,
        weight1: log.weight1,
        reps1: log.reps1,
        weight2: log.weight2,
        reps2: log.reps2,
        weight3: log.weight3,
        reps3: log.reps3,
        holdTime: log.holdTime,
        notes: log.notes,
      }))
    );

    // Sort by date descending and limit to 50
    history.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return NextResponse.json({ history: history.slice(0, 50) });
  } catch (error) {
    console.error("Exercise history fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch exercise history" },
      { status: 500 }
    );
  }
});
