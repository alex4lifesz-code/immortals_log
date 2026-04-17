import { apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/auth/middleware";
import { isDeletedExerciseDescription, stripDeletedExerciseMarker, stripExerciseStatusMarkers } from "@/lib/pending-exercises";

export const GET = withAdmin(async (_request) => {
  try {
    const deletedExercises = await prisma.progressionExercise.findMany({
      where: {},
      include: {
        variations: {
          select: {
            id: true,
            name: true,
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    const recycleBin = deletedExercises
      .filter((exercise) => isDeletedExerciseDescription(exercise.story))
      .map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        category: exercise.category,
        userId: exercise.userId,
        createdAt: exercise.createdAt.toISOString(),
        description: stripExerciseStatusMarkers(exercise.story) || "",
        variations: exercise.variations.map((variation) => ({ id: variation.id, name: variation.name })),
      }));

    return apiSuccess({ exercises: recycleBin });
  } catch (error) {
    console.error("Exercise recycle bin list error:", error);
    return ApiErrors.internal("Failed to load exercise recycle bin");
  }
});

export const POST = withAdmin(async (request) => {
  try {
    const body = await request.json();
    const id = String(body?.id || "").trim();
    if (!id) {
      return ApiErrors.badRequest("Exercise id is required");
    }

    const existing = await prisma.progressionExercise.findUnique({
      where: { id },
      select: { id: true, name: true, story: true, userId: true },
    });

    if (!existing) {
      return ApiErrors.notFound("Exercise not found");
    }

    const restored = await prisma.progressionExercise.update({
      where: { id },
      data: {
        story: stripDeletedExerciseMarker(existing.story),
      },
      select: { id: true, name: true },
    });

    return apiSuccess({ message: `${restored.name} was restored from the recycle bin.`, exercise: restored });
  } catch (error) {
    console.error("Exercise recycle bin restore error:", error);
    return ApiErrors.internal("Failed to restore exercise");
  }
});

export const DELETE = withAdmin(async (request) => {
  try {
    const body = await request.json();
    const id = String(body?.id || "").trim();
    const confirm = body?.confirm === true;

    if (!id) {
      return ApiErrors.badRequest("Exercise id is required");
    }
    if (!confirm) {
      return ApiErrors.badRequest("Permanent delete requires confirmation");
    }

    const existing = await prisma.progressionExercise.findUnique({
      where: { id },
      select: { id: true, name: true, userId: true },
    });

    if (!existing) {
      return ApiErrors.notFound("Exercise not found");
    }

    await prisma.progressionExercise.delete({ where: { id } });

    return apiSuccess({ message: `${existing.name} was permanently deleted from the recycle bin.` });
  } catch (error) {
    console.error("Exercise recycle bin permanent delete error:", error);
    return ApiErrors.internal("Failed to permanently delete exercise");
  }
});
