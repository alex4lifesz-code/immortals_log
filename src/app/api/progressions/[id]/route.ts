import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeDayAssignments } from "@/lib/constants";
import { withAuth } from "@/lib/auth/middleware";

// GET /api/progressions/[id] — get a shared progression exercise with requesting user's progress
export const GET = withAuth(async (_request, { auth, params }) => {
  try {
    const id = params.id as string;

    const exercise = await prisma.progressionExercise.findFirst({
      where: { id },
      include: {
        tiers: { orderBy: { level: "asc" } },
        variations: true,
        modifiers: true,
        userProgress: {
          where: { userId: auth.userId },
          include: {
            logs: { orderBy: { createdAt: "desc" } },
          },
        },
      },
    });

    if (!exercise) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
    }

    return NextResponse.json({ exercise });
  } catch (error) {
    console.error("Progression fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch progression" }, { status: 500 });
  }
});

// DELETE /api/progressions/[id] — delete a single progression exercise
export const DELETE = withAuth(async (_request, { auth, params }) => {
  try {
    const id = params.id as string;
    const userId = auth.userId;

    const exercise = await prisma.progressionExercise.findFirst({
      where: { id, userId },
    });

    if (!exercise) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
    }

    await prisma.userProgressionLevel.deleteMany({ where: { userId, exerciseId: id } });
    await prisma.progressionExercise.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Progression delete error:", error);
    return NextResponse.json({ error: "Failed to delete progression" }, { status: 500 });
  }
});

// PATCH /api/progressions/[id] — update fields on a progression exercise
export const PATCH = withAuth(async (request, { auth, params }) => {
  try {
    const id = params.id as string;
    const body = await request.json();
    const userId = auth.userId;

    // Verify ownership
    const existing = await prisma.progressionExercise.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    // Simple string fields
    const stringFields: [string, number][] = [
      ["name", 200], ["wuxiaName", 300], ["difficulty", 100], ["wuxiaDifficulty", 100],
      ["type", 100], ["wuxiaType", 100], ["story", 5000], ["category", 100],
      ["equipmentType", 100], ["primaryMuscles", 500], ["secondaryMuscles", 500],
      ["breathing", 1000],
    ];
    for (const [field, maxLen] of stringFields) {
      if (body[field] !== undefined) {
        data[field] = String(body[field] ?? "").trim().slice(0, maxLen);
      }
    }

    // Boolean fields
    for (const field of ["bodyweight", "weighted", "rings"]) {
      if (body[field] !== undefined) {
        data[field] = body[field] === true;
      }
    }

    // JSON-stored array/object fields
    const jsonFields = ["tips", "prerequisites", "cues", "commonMistakes", "safetyConsiderations", "competitionStandards"];
    for (const field of jsonFields) {
      if (body[field] !== undefined) {
        data[field] = JSON.stringify(body[field] ?? (field === "competitionStandards" ? {} : []));
      }
    }

    // AssignedDays
    if (body.assignedDays !== undefined) {
      if (Array.isArray(body.assignedDays)) {
        const validDays = body.assignedDays.filter(
          (day: unknown) => typeof day === "number" && day >= 0 && day <= 6
        );
        data.assignedDays = serializeDayAssignments(validDays);
      }
    }

    // Duplicate name check
    if (data.name) {
      const allProgs = await prisma.progressionExercise.findMany({
        where: { userId: auth.userId },
        select: { id: true, name: true },
      });
      const duplicate = allProgs.find(p => p.id !== id && p.name.toLowerCase() === String(data.name).toLowerCase());
      if (duplicate) {
        return NextResponse.json({ error: `A progression exercise named "${data.name}" already exists` }, { status: 409 });
      }
    }

    if (Object.keys(data).length === 0 && !body.tiers) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // Update tiers if provided
    if (body.tiers && Array.isArray(body.tiers)) {
      // Delete existing tiers and recreate
      await prisma.progressionTier.deleteMany({ where: { exerciseId: id } });
      for (const t of body.tiers) {
        await prisma.progressionTier.create({
          data: {
            exerciseId: id,
            level: Number(t.level),
            name: String(t.name || "").trim().slice(0, 200),
            wuxiaName: t.wuxiaName ? String(t.wuxiaName).trim().slice(0, 300) : "",
            difficulty: (t.difficulty || "").toString().trim().slice(0, 100),
            wuxiaDifficulty: (t.wuxiaDifficulty || t.difficulty || "").toString().trim().slice(0, 100),
            wuxiaType: (t.wuxiaType || "").toString().trim().slice(0, 100),
            description: (t.description || "").toString().trim().slice(0, 1000),
            targetHold: t.targetHold != null ? Number(t.targetHold) : null,
            targetReps: t.targetReps != null ? Number(t.targetReps) : null,
            targetRepsText: t.targetRepsText ? String(t.targetRepsText).trim().slice(0, 50) : "",
          },
        });
      }
    }

    // Update variations if provided
    if (body.variations && Array.isArray(body.variations)) {
      await prisma.progressionVariation.deleteMany({ where: { exerciseId: id } });
      for (const v of body.variations) {
        await prisma.progressionVariation.create({
          data: {
            exerciseId: id,
            name: String(v.name || "").trim().slice(0, 200),
            wuxiaName: v.wuxiaName ? String(v.wuxiaName).trim().slice(0, 300) : "",
            difficulty: (v.difficulty || "").toString().trim().slice(0, 100),
            wuxiaDifficulty: (v.wuxiaDifficulty || v.difficulty || "").toString().trim().slice(0, 100),
            wuxiaType: (v.wuxiaType || "").toString().trim().slice(0, 100),
            description: (v.description || "").toString().trim().slice(0, 1000),
          },
        });
      }
    }

    // Update modifiers if provided
    if (body.modifiers && Array.isArray(body.modifiers)) {
      await prisma.progressionModifier.deleteMany({ where: { exerciseId: id } });
      for (const m of body.modifiers) {
        await prisma.progressionModifier.create({
          data: {
            exerciseId: id,
            type: String(m.type || "").trim().slice(0, 50),
            available: m.available === true,
            difficultyMod: m.difficultyMod != null ? Number(m.difficultyMod) : 0,
            notes: (m.notes || "").toString().trim().slice(0, 500),
            method: (m.method || "").toString().trim().slice(0, 500),
            difficultyIncrease: (m.difficultyIncrease || "").toString().trim().slice(0, 200),
          },
        });
      }
    }

    if (Object.keys(data).length > 0) {
      await prisma.progressionExercise.update({ where: { id }, data });
    } else {
      await prisma.progressionExercise.findUnique({ where: { id } });
    }

    // Re-fetch with full includes
    const full = await prisma.progressionExercise.findUnique({
      where: { id },
      include: {
        tiers: { orderBy: { level: "asc" } },
        variations: true,
        modifiers: true,
        userProgress: {
          where: { userId: auth.userId },
          include: { logs: { orderBy: { createdAt: "desc" } } },
        },
      },
    });

    return NextResponse.json({ exercise: full });
  } catch (error) {
    console.error("Progression update error:", error);
    return NextResponse.json(
      { error: "Failed to update progression exercise" },
      { status: 500 }
    );
  }
});
