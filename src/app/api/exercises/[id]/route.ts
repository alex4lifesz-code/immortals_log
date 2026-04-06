import { apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializeDayAssignments } from "@/lib/constants";
import { withAuth } from "@/lib/auth/middleware";

export const DELETE = withAuth(async (_req, { auth, params }) => {
  try {
    if (auth.role !== "admin") {
      return ApiErrors.forbidden("Admin privileges required");
    }

    const id = params.id as string;
    const existing = await prisma.exercise.findUnique({ where: { id } });

    if (!existing) {
      return ApiErrors.notFound("Exercise not found");
    }

    // Also cascade-delete matching ProgressionExercise(s) by name
    const allProgressions = await prisma.progressionExercise.findMany({
      select: {
        id: true,
        name: true,
        wuxiaName: true,
        translation: {
          select: {
            englishName: true,
            vietnameseName: true,
          },
        },
      },
    });
    const nameLower = existing.name.toLowerCase();
    const wuxiaNameLower = existing.wuxiaName?.toLowerCase();
    const matchingProgressions = allProgressions.filter((p) => {
      return (
        p.name.toLowerCase() === nameLower ||
        (wuxiaNameLower && p.wuxiaName?.toLowerCase() === wuxiaNameLower) ||
        p.translation?.englishName?.toLowerCase() === nameLower ||
        (wuxiaNameLower &&
          p.translation?.vietnameseName?.toLowerCase() === wuxiaNameLower)
      );
    });

    if (matchingProgressions.length > 0) {
      const progIds = matchingProgressions.map((p) => p.id);
      await prisma.userProgressionLevel.deleteMany({
        where: { exerciseId: { in: progIds } },
      });
      await prisma.progressionExercise.deleteMany({
        where: { id: { in: progIds } },
      });
    }

    await prisma.exercise.delete({ where: { id } });
    return apiSuccess({
      success: true,
      archived: false,
      progressionsRemoved: matchingProgressions.length,
    });
  } catch (error) {
    console.error("Exercise delete error:", error);
    return ApiErrors.internal("Failed to delete exercise");
  }
});

export const PATCH = withAuth(async (req, { auth, params }) => {
  try {
    if (auth.role !== "admin") {
      return ApiErrors.forbidden("Admin privileges required");
    }

    const id = params.id as string;
    const body = await req.json();

    const existing = await prisma.exercise.findUnique({ where: { id } });
    if (!existing) {
      return ApiErrors.notFound("Exercise not found");
    }

    const data: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim().slice(0, 200);
      if (!name)
        return ApiErrors.badRequest("Name cannot be empty");
      const allExercises = await prisma.exercise.findMany({
        select: { id: true, name: true },
      });
      const duplicate = allExercises.find(
        (e) => e.id !== id && e.name.toLowerCase() === name.toLowerCase()
      );
      if (duplicate)
        return ApiErrors.conflict(`An exercise named "${name}" already exists`);
      data.name = name;
    }

    if (body.wuxiaName !== undefined) {
      data.wuxiaName = body.wuxiaName
        ? String(body.wuxiaName).trim().slice(0, 200)
        : null;
    }

    if (body.difficulty !== undefined) {
      const difficulty = String(body.difficulty).trim().slice(0, 100);
      if (!difficulty) {
        return ApiErrors.badRequest("Difficulty cannot be empty");
      }
      data.difficulty = difficulty;
    }

    if (body.type !== undefined) {
      data.type = String(body.type).trim().slice(0, 100);
    }

    if (body.story !== undefined) {
      data.story = body.story
        ? String(body.story).trim().slice(0, 5000)
        : null;
    }

    if (body.targetGroup !== undefined) {
      data.targetGroup = body.targetGroup
        ? String(body.targetGroup).trim().slice(0, 100)
        : null;
    }

    if (body.assignedDays !== undefined) {
      if (Array.isArray(body.assignedDays)) {
        const validDays = body.assignedDays.filter(
          (day: unknown) => typeof day === "number" && day >= 0 && day <= 6
        );
        data.assignedDays = serializeDayAssignments(validDays);
      }
    }

    if (Object.keys(data).length === 0) {
      return ApiErrors.badRequest("No valid fields to update");
    }

    const exercise = await prisma.exercise.update({ where: { id }, data });

    if (data.name || data.wuxiaName !== undefined || data.story !== undefined || data.difficulty || data.type) {
      const englishName = String(data.name ?? existing.name);
      const vietnameseName =
        data.wuxiaName !== undefined
          ? String(data.wuxiaName || englishName)
          : existing.wuxiaName || englishName;

      await prisma.exerciseTranslation.upsert({
        where: { id },
        create: {
          id,
          englishName,
          vietnameseName,
          englishStory: String(data.story ?? existing.story ?? "") || null,
          vietnameseStory: String(data.story ?? existing.story ?? "") || null,
          englishDifficulty: String(data.difficulty ?? existing.difficulty),
          vietnameseDifficulty: String(data.difficulty ?? existing.difficulty),
          englishType: String(data.type ?? existing.type),
          vietnameseType: String(data.type ?? existing.type),
        },
        update: {
          englishName,
          vietnameseName,
          ...(data.story !== undefined
            ? {
                englishStory: String(data.story ?? "") || null,
              }
            : {}),
          ...(data.difficulty
            ? {
                englishDifficulty: String(data.difficulty),
              }
            : {}),
          ...(data.type
            ? {
                englishType: String(data.type),
              }
            : {}),
        },
      });
    }

    // Sync name changes to matching ProgressionExercise
    if (data.name || data.wuxiaName !== undefined) {
      const oldName = existing.name.toLowerCase();
      const allProgs = await prisma.progressionExercise.findMany({
        select: { id: true, name: true },
      });
      const matchingProgs = allProgs.filter(
        (p) => p.name.toLowerCase() === oldName
      );
      for (const prog of matchingProgs) {
        const progUpdate: Record<string, unknown> = {};
        if (data.name) progUpdate.name = data.name;
        if (data.wuxiaName !== undefined)
          progUpdate.wuxiaName = data.wuxiaName || "";
        if (Object.keys(progUpdate).length > 0) {
          await prisma.progressionExercise.update({
            where: { id: prog.id },
            data: progUpdate,
          });
        }
      }
    }

    return apiSuccess({ exercise });
  } catch (error) {
    console.error("Exercise update error:", error);
    return ApiErrors.internal("Failed to update exercise");
  }
});
