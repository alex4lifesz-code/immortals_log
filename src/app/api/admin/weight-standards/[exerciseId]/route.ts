import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TierStandard, tiersToRecord } from "@/lib/weight-standards";

/** GET /api/admin/weight-standards/[exerciseId] — Fetch weight standards for a specific exercise */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ exerciseId: string }> }
) {
  try {
    const { exerciseId } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

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
}

/** PUT /api/admin/weight-standards/[exerciseId] — Create or update weight standards */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ exerciseId: string }> }
) {
  try {
    const { exerciseId } = await params;
    const body = await req.json();
    const { userId, gender, tiers } = body;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

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
        updatedBy: userId,
      },
      create: {
        exerciseId,
        gender: genderUpper,
        ...tierData,
        updatedBy: userId,
      },
    });

    return NextResponse.json({ weightStandard });
  } catch (error) {
    console.error("Weight standard update error:", error);
    return NextResponse.json({ error: "Failed to update weight standard" }, { status: 500 });
  }
}

/** DELETE /api/admin/weight-standards/[exerciseId] — Delete weight standards */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ exerciseId: string }> }
) {
  try {
    const { exerciseId } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const gender = searchParams.get("gender")?.toUpperCase();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

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
}
