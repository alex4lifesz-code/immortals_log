import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/weight-standards — Fetch weight standards for exercises (public, for tier calculation) */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const exerciseId = searchParams.get("exerciseId");

    if (exerciseId) {
      // Single exercise
      const standards = await prisma.weightStandard.findMany({
        where: { exerciseId },
        select: {
          id: true,
          exerciseId: true,
          gender: true,
          tier1Min: true, tier1Max: true,
          tier2Min: true, tier2Max: true,
          tier3Min: true, tier3Max: true,
          tier4Min: true, tier4Max: true,
          tier5Min: true, tier5Max: true,
          tier6Min: true, tier6Max: true,
        },
      });
      return NextResponse.json({ standards });
    }

    // All standards
    const standards = await prisma.weightStandard.findMany({
      select: {
        id: true,
        exerciseId: true,
        gender: true,
        tier1Min: true, tier1Max: true,
        tier2Min: true, tier2Max: true,
        tier3Min: true, tier3Max: true,
        tier4Min: true, tier4Max: true,
        tier5Min: true, tier5Max: true,
        tier6Min: true, tier6Max: true,
      },
    });
    return NextResponse.json({ standards });
  } catch (error) {
    console.error("Weight standards fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch weight standards" }, { status: 500 });
  }
}
