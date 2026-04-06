import { apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";
import { isDeletedExerciseDescription } from "@/lib/pending-exercises";

// POST /api/progressions/[id]/log — log training data for a progression level
export const POST = withAuth(async (request, { auth, params }) => {
  try {
    const id = params.id as string;
    const body = await request.json();
    const userId = auth.userId;

    const level = Number(body.level);
    if (!level || level < 1) {
      return ApiErrors.badRequest("level must be a positive number");
    }

    // Allow logging for any library exercise id; create user progress on first log.
    const exercise = await prisma.progressionExercise.findUnique({
      where: { id },
      select: {
        id: true,
        story: true,
      },
    });
    if (!exercise) {
      return ApiErrors.notFound("Exercise not found");
    }
    if (isDeletedExerciseDescription(exercise.story)) {
      return ApiErrors.notFound("Exercise is unavailable");
    }

    let userProgress = await prisma.userProgressionLevel.findUnique({
      where: { userId_exerciseId: { userId, exerciseId: id } },
    });

    if (!userProgress) {
      userProgress = await prisma.userProgressionLevel.create({
        data: { userId, exerciseId: id, currentLevel: level },
      });
    }

    const createdAt = body.createdAt ? new Date(String(body.createdAt)) : null;
    const validCreatedAt = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : null;

    const log = await prisma.progressionLog.create({
      data: {
        userProgressionId: userProgress.id,
        level,
        weight1: body.weight1 != null ? Number(body.weight1) : null,
        reps1: body.reps1 != null ? Number(body.reps1) : null,
        weight2: body.weight2 != null ? Number(body.weight2) : null,
        reps2: body.reps2 != null ? Number(body.reps2) : null,
        weight3: body.weight3 != null ? Number(body.weight3) : null,
        reps3: body.reps3 != null ? Number(body.reps3) : null,
        holdTime: body.holdTime != null ? Number(body.holdTime) : null,
        holdTime2: body.holdTime2 != null ? Number(body.holdTime2) : null,
        holdTime3: body.holdTime3 != null ? Number(body.holdTime3) : null,
        reps: body.reps != null ? Number(body.reps) : null,
        modifier: body.modifier ? String(body.modifier).trim().slice(0, 100) : null,
        variant: body.variant ? String(body.variant).trim().slice(0, 200) : null,
        notes: body.notes ? String(body.notes).trim().slice(0, 1000) : null,
        completed: body.completed === true,
        createdAt: validCreatedAt ?? undefined,
      },
    });

    // If marking as completed and this is the current level, advance
    if (body.completed === true && userProgress.currentLevel === level) {
      await prisma.userProgressionLevel.update({
        where: { id: userProgress.id },
        data: { currentLevel: level + 1 },
      });
    }

    return apiSuccess({ log });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Progression log error:", message, error);
    return ApiErrors.internal(message || "Failed to log progression");
  }
});
