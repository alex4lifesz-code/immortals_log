import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseJsonStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseCsv(raw: string): string[] {
  return (raw || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

// GET /api/progressions/library/export?userId=X
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const exercises = await prisma.progressionExercise.findMany({
      where: { userId },
      include: {
        tiers: { orderBy: { level: "asc" } },
        variations: true,
        modifiers: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const exportData = exercises.map((ex) => ({
      name: ex.name,
      wuxiaName: ex.wuxiaName || undefined,
      difficulty: ex.difficulty,
      wuxiaDifficulty: ex.wuxiaDifficulty || undefined,
      type: ex.type,
      wuxiaType: ex.wuxiaType || undefined,
      story: ex.story || undefined,
      tips: parseJsonStringArray(ex.tips),
      category: ex.category,
      equipment: {
        type: ex.equipmentType,
        bodyweight: ex.bodyweight,
        weighted: ex.weighted,
        rings: ex.rings,
      },
      primaryMuscles: parseCsv(ex.primaryMuscles),
      secondaryMuscles: parseCsv(ex.secondaryMuscles),
      progressions: ex.tiers.map((tier) => ({
        level: tier.level,
        name: tier.name,
        wuxiaName: tier.wuxiaName || undefined,
        difficulty: tier.difficulty || undefined,
        wuxiaDifficulty: tier.wuxiaDifficulty || undefined,
        wuxiaType: tier.wuxiaType || undefined,
        description: tier.description || undefined,
        targetHold: tier.targetHold ?? undefined,
        targetReps: tier.targetRepsText || tier.targetReps || undefined,
      })),
      variations: ex.variations.map((v) => ({
        name: v.name,
        wuxiaName: v.wuxiaName || undefined,
        difficulty: v.difficulty || undefined,
        wuxiaDifficulty: v.wuxiaDifficulty || undefined,
        wuxiaType: v.wuxiaType || undefined,
        description: v.description || undefined,
      })),
      modifiers: ex.modifiers.map((m) => ({
        type: m.type,
        available: m.available,
        difficultyMod: m.difficultyMod,
        notes: m.notes || undefined,
        method: m.method || undefined,
        difficultyIncrease: m.difficultyIncrease || undefined,
      })),
    }));

    return NextResponse.json({
      version: 1,
      exportedAt: new Date().toISOString(),
      userId,
      exercises: exportData,
    });
  } catch (error) {
    console.error("Progression library export error:", error);
    return NextResponse.json({ error: "Failed to export progression library" }, { status: 500 });
  }
}
