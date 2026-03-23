import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/admin/weight-standards — Fetch all exercises with their weight standards */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Verify admin role
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get all exercises with their weight standards
    const exercises = await prisma.progressionExercise.findMany({
      include: {
        weightStandards: true,
      },
      orderBy: { name: "asc" },
    });

    const result = exercises.map((ex) => {
      const maleStandard = ex.weightStandards.find((ws) => ws.gender === "MALE") || null;
      const femaleStandard = ex.weightStandards.find((ws) => ws.gender === "FEMALE") || null;

      return {
        id: ex.id,
        name: ex.name,
        category: ex.category,
        bodyweight: ex.bodyweight,
        weighted: ex.weighted,
        maleStandard,
        femaleStandard,
      };
    });

    return NextResponse.json({ exercises: result });
  } catch (error) {
    console.error("Weight standards fetch error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to fetch weight standards", detail: message }, { status: 500 });
  }
}
