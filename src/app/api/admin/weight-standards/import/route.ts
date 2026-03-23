import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TIER_NAMES, TIER_COLORS } from "@/lib/weight-standards";

interface ImportTier {
  tier: number;
  name: string;
  minPercentage: number;
  maxPercentage: number;
}

interface ImportExerciseStandard {
  exerciseId: string;
  exerciseName: string;
  category?: string;
  male?: ImportTier[];
  female?: ImportTier[];
}

/** POST /api/admin/weight-standards/import — Bulk import weight standards from JSON */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, exercises: importData } = body;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!Array.isArray(importData) || importData.length === 0) {
      return NextResponse.json({ error: "No exercises to import" }, { status: 400 });
    }

    const results: { exerciseName: string; status: string; error?: string }[] = [];

    for (const item of importData as ImportExerciseStandard[]) {
      const exerciseId = item.exerciseId;
      if (!exerciseId || typeof exerciseId !== "string") {
        results.push({ exerciseName: item.exerciseName || "unknown", status: "skipped", error: "Missing exerciseId" });
        continue;
      }

      // Verify exercise exists
      const exercise = await prisma.progressionExercise.findUnique({ where: { id: exerciseId } });
      if (!exercise) {
        results.push({ exerciseName: item.exerciseName || exerciseId, status: "skipped", error: "Exercise not found" });
        continue;
      }

      // Process each gender
      for (const gender of ["MALE", "FEMALE"] as const) {
        const tiers = gender === "MALE" ? item.male : item.female;
        if (!tiers || !Array.isArray(tiers) || tiers.length !== 6) continue;

        // Validate tiers
        let valid = true;
        let tierError = "";
        for (let i = 0; i < tiers.length; i++) {
          const t = tiers[i];
          if (typeof t.minPercentage !== "number" || typeof t.maxPercentage !== "number") {
            valid = false;
            tierError = `Tier ${i + 1} has invalid percentages`;
            break;
          }
          if (t.minPercentage < 0) {
            valid = false;
            tierError = `Tier ${i + 1} min cannot be negative`;
            break;
          }
          if (i < 5 && t.minPercentage >= t.maxPercentage) {
            valid = false;
            tierError = `Tier ${i + 1} min must be less than max`;
            break;
          }
        }

        // Validate continuity
        if (valid) {
          for (let i = 1; i < tiers.length; i++) {
            if (tiers[i].minPercentage !== tiers[i - 1].maxPercentage) {
              valid = false;
              tierError = `Tier ${i + 1} min (${tiers[i].minPercentage}) must equal Tier ${i} max (${tiers[i - 1].maxPercentage})`;
              break;
            }
          }
        }

        if (!valid) {
          results.push({
            exerciseName: item.exerciseName || exerciseId,
            status: "error",
            error: `${gender}: ${tierError}`,
          });
          continue;
        }

        try {
          await prisma.weightStandard.upsert({
            where: {
              exerciseId_gender: { exerciseId, gender },
            },
            update: {
              tier1Min: tiers[0].minPercentage, tier1Max: tiers[0].maxPercentage,
              tier2Min: tiers[1].minPercentage, tier2Max: tiers[1].maxPercentage,
              tier3Min: tiers[2].minPercentage, tier3Max: tiers[2].maxPercentage,
              tier4Min: tiers[3].minPercentage, tier4Max: tiers[3].maxPercentage,
              tier5Min: tiers[4].minPercentage, tier5Max: tiers[4].maxPercentage,
              tier6Min: tiers[5].minPercentage, tier6Max: tiers[5].maxPercentage,
              updatedBy: userId,
            },
            create: {
              exerciseId,
              gender,
              tier1Min: tiers[0].minPercentage, tier1Max: tiers[0].maxPercentage,
              tier2Min: tiers[1].minPercentage, tier2Max: tiers[1].maxPercentage,
              tier3Min: tiers[2].minPercentage, tier3Max: tiers[2].maxPercentage,
              tier4Min: tiers[3].minPercentage, tier4Max: tiers[3].maxPercentage,
              tier5Min: tiers[4].minPercentage, tier5Max: tiers[4].maxPercentage,
              tier6Min: tiers[5].minPercentage, tier6Max: tiers[5].maxPercentage,
              updatedBy: userId,
            },
          });

          results.push({
            exerciseName: item.exerciseName || exerciseId,
            status: "imported",
          });
        } catch (e) {
          results.push({
            exerciseName: item.exerciseName || exerciseId,
            status: "error",
            error: `${gender}: ${e instanceof Error ? e.message : "DB error"}`,
          });
        }
      }
    }

    const imported = results.filter((r) => r.status === "imported").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const errors = results.filter((r) => r.status === "error").length;

    return NextResponse.json({
      summary: { imported, skipped, errors, total: importData.length },
      results,
    });
  } catch (error) {
    console.error("Weight standards import error:", error);
    return NextResponse.json({ error: "Failed to import weight standards" }, { status: 500 });
  }
}

/** GET /api/admin/weight-standards/import — Returns expected format documentation */
export async function GET() {
  return NextResponse.json({
    description: "Expected JSON import format",
    example: {
      exercises: [
        {
          exerciseId: "exercise_id_here",
          exerciseName: "Bench Press",
          category: "GYM",
          male: TIER_NAMES.map((name, i) => ({
            tier: i + 1,
            name,
            minPercentage: [0, 50, 75, 100, 125, 150][i],
            maxPercentage: [50, 75, 100, 125, 150, 999][i],
            color: TIER_COLORS[i],
          })),
          female: TIER_NAMES.map((name, i) => ({
            tier: i + 1,
            name,
            minPercentage: [0, 35, 50, 70, 85, 100][i],
            maxPercentage: [35, 50, 70, 85, 100, 999][i],
            color: TIER_COLORS[i],
          })),
        },
      ],
    },
  });
}
