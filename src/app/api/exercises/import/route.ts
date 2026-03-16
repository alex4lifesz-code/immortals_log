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
    ];

    const validTypes = [
      "Upper Heaven",
      "Lower Realms",
      "Heart Meridian",
      "Unified Realm",
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
      if (ex.type && !validTypes.includes(ex.type)) {
        errors.push(`Exercise ${i + 1}: invalid type "${ex.type}"`);
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

    const result = await prisma.exercise.createMany({
      data: validExercises,
    });

    return NextResponse.json({
      imported: result.count,
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
