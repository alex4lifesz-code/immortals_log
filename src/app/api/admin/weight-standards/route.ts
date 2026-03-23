import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/auth/middleware";

/** GET /api/admin/weight-standards — Fetch all exercises with their weight standards */
export const GET = withAdmin(async () => {
  try {
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
});
