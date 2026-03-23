import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/progressions?userId=X — fetch shared progression exercise library plus user's progress
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const exercises = await prisma.progressionExercise.findMany({
      include: {
        tiers: { orderBy: { level: "asc" } },
        variations: true,
        modifiers: true,
        userProgress: {
          where: { userId },
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
}

// DELETE /api/progressions?userId=X — remove user's progression data only
export async function DELETE(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

  // Delete user progression levels (logs cascade)
    await prisma.userProgressionLevel.deleteMany({ where: { userId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Progressions delete error:", error);
    return NextResponse.json({ error: "Failed to delete progressions" }, { status: 500 });
  }
}
