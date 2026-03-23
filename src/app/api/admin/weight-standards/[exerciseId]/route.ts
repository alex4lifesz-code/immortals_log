import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TierStandard, tiersToRecord } from "@/lib/weight-standards";
import { withAdmin } from "@/lib/auth/middleware";

/** GET /api/admin/weight-standards/[exerciseId] — Fetch weight standards for a specific exercise */
export const GET = withAdmin(async (_request, { params }) => {
  try {
    const exerciseId = params.exerciseId as string;

    const standards = await prisma.weightStandard.findMany({
      where: { exerciseId },
    });

    const maleStandard = standards.find((s) => s.gender === "MALE") || null;
    const femaleStandard = standards.find((s) => s.gender === "FEMALE") || null;

    return NextResponse.json({ maleStandard, femaleStandard });
  } catch (error) {
    console.error("Weight standard fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch weight standard" }, { status: 500 });
  }
});

/** PUT /api/admin/weight-standards/[exerciseId] — Create or update weight standards */
export const PUT = withAdmin(async (request, { auth, params }) => {
  try {
    const exerciseId = params.exerciseId as string;
    const body = await request.json();
    const { gender, tiers } = body;

    // Validate gender
    const genderUpper = String(gender).toUpperCase();
    if (genderUpper !== "MALE" && genderUpper !== "FEMALE") {
      return NextResponse.json({ error: "Gender must be MALE or FEMALE" }, { status: 400 });
    }

    // Validate tiers
    if (!Array.isArray(tiers) || tiers.length !== 6) {
      return NextResponse.json({ error: "Exactly 6 tiers are required" }, { status: 400 });
    }

    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i] as TierStandard;
      if (typeof t.minPercentage !== "number" || typeof t.maxPercentage !== "number") {
        return NextResponse.json({ error: `Tier ${i + 1} has invalid percentages` }, { status: 400 });
      }
      if (t.minPercentage < 0) {
        return NextResponse.json({ error: `Tier ${i + 1} min cannot be negative` }, { status: 400 });
      }
      if (i < 5 && t.minPercentage >= t.maxPercentage) {
        return NextResponse.json({ error: `Tier ${i + 1} min must be less than max` }, { status: 400 });
      }
    }

    // Validate continuity
    for (let i = 1; i < tiers.length; i++) {
      if (tiers[i].minPercentage !== tiers[i - 1].maxPercentage) {
        return NextResponse.json(
          { error: `Tier ${i + 1} min (${tiers[i].minPercentage}) must equal Tier ${i} max (${tiers[i - 1].maxPercentage})` },
          { status: 400 }
        );
      }
    }

    // Verify exercise exists
    const exercise = await prisma.progressionExercise.findUnique({ where: { id: exerciseId } });
    if (!exercise) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
    }

    const tierData = tiersToRecord(tiers);

    const weightStandard = await prisma.weightStandard.upsert({
      where: {
        exerciseId_gender: {
          exerciseId,
          gender: genderUpper,
        },
      },
      update: {
        ...tierData,
        updatedBy: auth.userId,
      },
      create: {
        exerciseId,
        gender: genderUpper,
        ...tierData,
        updatedBy: auth.userId,
      },
    });

    return NextResponse.json({ weightStandard });
  } catch (error) {
    console.error("Weight standard update error:", error);
    return NextResponse.json({ error: "Failed to update weight standard" }, { status: 500 });
  }
});

/** DELETE /api/admin/weight-standards/[exerciseId] — Delete weight standards */
export const DELETE = withAdmin(async (request, { params }) => {
  try {
    const exerciseId = params.exerciseId as string;
    const { searchParams } = new URL(request.url);
    const gender = searchParams.get("gender")?.toUpperCase();

    if (gender && (gender === "MALE" || gender === "FEMALE")) {
      await prisma.weightStandard.deleteMany({
        where: { exerciseId, gender },
      });
    } else {
      await prisma.weightStandard.deleteMany({
        where: { exerciseId },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Weight standard delete error:", error);
    return NextResponse.json({ error: "Failed to delete weight standard" }, { status: 500 });
  }
});
