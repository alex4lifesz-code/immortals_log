import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { exercises } = await req.json();

    if (!Array.isArray(exercises) || exercises.length === 0) {
      return NextResponse.json(
        { error: "Expected an array of exercises" },
        { status: 400 }
      );
    }

    const validDifficulties = [
      "Mortal",
      "Foundation Establishment",
      "Core Formation",
      "Nascent Soul",
      "Soul Splitting",
      "Tribulation Transcendence",
      "Immortal",
      "Heavenly Dao",
    ];

    const validExercises = [];
    const errors = [];

    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      const conventionalName = String(ex.name || ex.originalName || "").trim();
      const wuxiaName = String(ex.wuxiaName || ex.name || "").trim();

      if (!conventionalName) {
        errors.push(`Exercise ${i + 1}: missing name`);
        continue;
      }
      if (ex.difficulty && !validDifficulties.includes(ex.difficulty)) {
        errors.push(`Exercise ${i + 1}: invalid difficulty "${ex.difficulty}"`);
        continue;
      }
      validExercises.push({
        name: conventionalName,
        wuxiaName: wuxiaName || null,
        difficulty: ex.difficulty || "Mortal",
        type: ex.type || "Unified Realm",
        story: ex.story || null,
        targetGroup: ex.targetGroup || null,
      });
    }

    if (validExercises.length === 0) {
      return NextResponse.json(
        { error: "No valid exercises found", details: errors },
        { status: 400 }
      );
    }

    // Skip duplicates by name
    const existing = await prisma.exercise.findMany({ select: { name: true } });
    const existingNames = new Set(existing.map(e => e.name.trim().toLowerCase()));
    const newExercises = validExercises.filter(e => !existingNames.has(e.name.trim().toLowerCase()));

    if (newExercises.length === 0) {
      return NextResponse.json({
        imported: 0,
        skipped: validExercises.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    const result = await prisma.exercise.createMany({
      data: newExercises,
    });

    return NextResponse.json({
      imported: result.count,
      skipped: validExercises.length - newExercises.length > 0 ? validExercises.length - newExercises.length : undefined,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Import failed" },
      { status: 500 }
    );
  }
}
