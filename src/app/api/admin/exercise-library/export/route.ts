import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/auth/middleware";

/**
 * GET /api/admin/exercise-library/export?targetUserId=<userId>
 *
 * Exports all ProgressionExercises (including tiers, variations, modifiers)
 * belonging to targetUserId as a JSON file download.
 * Requires admin role (enforced by withAdmin).
 */
export const GET = withAdmin(async (request, { auth }) => {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("targetUserId") || auth.userId;

    const exercises = await prisma.progressionExercise.findMany({
      where: { userId: targetUserId! },
      include: {
        tiers: {
          orderBy: { level: "asc" },
        },
        variations: true,
        modifiers: true,
      },
      orderBy: { name: "asc" },
    });

    // Strip internal DB ids so imports create fresh records
    const exportData = exercises.map((ex) => ({
      name: ex.name,
      wuxiaName: ex.wuxiaName,
      difficulty: ex.difficulty,
      wuxiaDifficulty: ex.wuxiaDifficulty,
      type: ex.type,
      wuxiaType: ex.wuxiaType,
      story: ex.story,
      category: ex.category,
      equipmentType: ex.equipmentType,
      bodyweight: ex.bodyweight,
      weighted: ex.weighted,
      rings: ex.rings,
      primaryMuscles: ex.primaryMuscles,
      secondaryMuscles: ex.secondaryMuscles,
      tips: ex.tips,
      prerequisites: ex.prerequisites,
      cues: ex.cues,
      commonMistakes: ex.commonMistakes,
      breathing: ex.breathing,
      safetyConsiderations: ex.safetyConsiderations,
      competitionStandards: ex.competitionStandards,
      progression: (() => {
        try {
          const parsed = JSON.parse(ex.progression || "[]");
          if (Array.isArray(parsed)) {
            return parsed.map((value) => String(value || "").trim()).filter(Boolean);
          }
        } catch {
          // Ignore malformed JSON and fallback to tiers.
        }
        return ex.tiers.map((t) => t.name).filter(Boolean);
      })(),
      assignedDays: ex.assignedDays,
      tiers: ex.tiers.map((t) => ({
        level: t.level,
        name: t.name,
        wuxiaName: t.wuxiaName,
        difficulty: t.difficulty,
        wuxiaDifficulty: t.wuxiaDifficulty,
        wuxiaType: t.wuxiaType,
        description: t.description,
        targetHold: t.targetHold,
        targetReps: t.targetReps,
        targetRepsText: t.targetRepsText,
      })),
      variations: ex.variations.map((v) => ({
        name: v.name,
        wuxiaName: v.wuxiaName,
        difficulty: v.difficulty,
        wuxiaDifficulty: v.wuxiaDifficulty,
        wuxiaType: v.wuxiaType,
        description: v.description,
      })),
      modifiers: ex.modifiers.map((m) => ({
        type: m.type,
        available: m.available,
        difficultyMod: m.difficultyMod,
        notes: m.notes,
        method: m.method,
        difficultyIncrease: m.difficultyIncrease,
      })),
    }));

    const json = JSON.stringify({ version: 1, exercises: exportData }, null, 2);

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="exercise-library-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    console.error("Exercise library export error:", error);
    return NextResponse.json({ error: "Failed to export exercise library" }, { status: 500 });
  }
});
