import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";

// GET /api/progressions — fetch shared progression exercise library plus user's progress
export const GET = withAuth(async (_request, { auth }) => {
  try {
    const exercises = await prisma.progressionExercise.findMany({
      include: {
        tiers: { orderBy: { level: "asc" } },
        variations: true,
        modifiers: true,
        userProgress: {
          where: { userId: auth.userId },
          include: {
            logs: { orderBy: { createdAt: "desc" } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ exercises });
  } catch (error) {
    console.error("Progressions fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch progressions" }, { status: 500 });
  }
});

// DELETE /api/progressions — remove user's progression data only
export const DELETE = withAuth(async (_request, { auth }) => {
  try {
    // Delete user progression levels (logs cascade)
    await prisma.userProgressionLevel.deleteMany({ where: { userId: auth.userId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Progressions delete error:", error);
    return NextResponse.json({ error: "Failed to delete progressions" }, { status: 500 });
  }
});
