import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isAdminRequest(req: NextRequest): boolean {
  return (req.headers.get("x-user-role") || "").toLowerCase() === "admin";
}

// POST /api/exercises/bulk — perform bulk operations on exercises
export async function POST(req: NextRequest) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Admin privileges required" }, { status: 403 });
    }

    const body = await req.json();
    const { action, ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
    }

    if (ids.length > 500) {
      return NextResponse.json({ error: "Maximum 500 exercises per bulk operation" }, { status: 400 });
    }

    switch (action) {
      case "delete": {
        // Get exercise names for cascade deletion of progressions
        const exercises = await prisma.exercise.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, wuxiaName: true },
        });

        const names = exercises.map(e => e.name.toLowerCase());
        const wuxiaNames = exercises.map(e => e.wuxiaName?.toLowerCase()).filter(Boolean) as string[];

        // Find matching progression exercises
        const allProgs = await prisma.progressionExercise.findMany({
          select: { id: true, name: true, wuxiaName: true },
        });
        const matchingProgIds = allProgs
          .filter(p =>
            names.includes(p.name.toLowerCase()) ||
            (p.wuxiaName && wuxiaNames.includes(p.wuxiaName.toLowerCase()))
          )
          .map(p => p.id);

        if (matchingProgIds.length > 0) {
          await prisma.userProgressionLevel.deleteMany({
            where: { exerciseId: { in: matchingProgIds } },
          });
          await prisma.progressionExercise.deleteMany({
            where: { id: { in: matchingProgIds } },
          });
        }

        const result = await prisma.exercise.deleteMany({
          where: { id: { in: ids } },
        });

        return NextResponse.json({
          success: true,
          deleted: result.count,
          progressionsRemoved: matchingProgIds.length,
        });
      }

      case "updateCategory": {
        const category = String(body.category || "").trim().slice(0, 100);
        if (!category) {
          return NextResponse.json({ error: "category is required for updateCategory action" }, { status: 400 });
        }
        const result = await prisma.exercise.updateMany({
          where: { id: { in: ids } },
          data: { targetGroup: category },
        });
        return NextResponse.json({ success: true, updated: result.count });
      }

      case "updateDifficulty": {
        const difficulty = String(body.difficulty || "").trim();
        const validDifficulties = ["mortal", "foundation establishment", "core formation", "nascent soul", "soul splitting", "tribulation transcendence", "immortal", "heavenly dao"];
        if (!validDifficulties.includes(difficulty.toLowerCase())) {
          return NextResponse.json({ error: "Invalid difficulty value" }, { status: 400 });
        }
        const result = await prisma.exercise.updateMany({
          where: { id: { in: ids } },
          data: { difficulty },
        });
        return NextResponse.json({ success: true, updated: result.count });
      }

      case "updateType": {
        const type = String(body.type || "").trim().slice(0, 100);
        if (!type) {
          return NextResponse.json({ error: "type is required for updateType action" }, { status: 400 });
        }
        const result = await prisma.exercise.updateMany({
          where: { id: { in: ids } },
          data: { type },
        });
        return NextResponse.json({ success: true, updated: result.count });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("Bulk operation error:", error);
    return NextResponse.json({ error: "Bulk operation failed" }, { status: 500 });
  }
}
