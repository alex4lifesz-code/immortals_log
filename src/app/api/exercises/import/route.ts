import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ARCHIVED_TARGET_GROUP = "__archived__";

function isAdminRequest(req: NextRequest): boolean {
  return (req.headers.get("x-user-role") || "").toLowerCase() === "admin";
}

export async function POST(req: NextRequest) {
  try {
    if (!isAdminRequest(req)) {
      return NextResponse.json({ error: "Admin privileges required" }, { status: 403 });
    }

    const { exercises } = await req.json();

    if (!Array.isArray(exercises) || exercises.length === 0) {
      return NextResponse.json(
        { error: "Expected an array of exercises" },
        { status: 400 }
      );
    }

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

    const existing = await prisma.exercise.findMany({
      select: {
        id: true,
        name: true,
        targetGroup: true,
      },
    });
    const existingByName = new Map(existing.map(e => [e.name.trim().toLowerCase(), e]));

    const newExercises = [];
    const resurrectExercises = [];
    for (const ex of validExercises) {
      const key = ex.name.trim().toLowerCase();
      const match = existingByName.get(key);
      if (!match) {
        newExercises.push(ex);
        continue;
      }

      if (match.targetGroup === ARCHIVED_TARGET_GROUP) {
        resurrectExercises.push({ id: match.id, ...ex });
      }
    }

    if (newExercises.length === 0 && resurrectExercises.length === 0) {
      return NextResponse.json({
        imported: 0,
        skipped: validExercises.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    let createdCount = 0;
    if (newExercises.length > 0) {
      const result = await prisma.exercise.createMany({
        data: newExercises,
      });
      createdCount = result.count;
    }

    if (resurrectExercises.length > 0) {
      await prisma.$transaction(
        resurrectExercises.map((ex) =>
          prisma.exercise.update({
            where: { id: ex.id },
            data: {
              wuxiaName: ex.wuxiaName || null,
              difficulty: ex.difficulty,
              type: ex.type,
              story: ex.story || null,
              targetGroup: ex.targetGroup || null,
            },
          })
        )
      );
    }

    const imported = createdCount + resurrectExercises.length;

    return NextResponse.json({
      imported,
      skipped: validExercises.length - imported > 0 ? validExercises.length - imported : undefined,
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
