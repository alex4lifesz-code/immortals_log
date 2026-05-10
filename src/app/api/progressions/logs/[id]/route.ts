import { apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";

export const GET = withAuth(async (_request, { auth, params }) => {
  try {
    const logId = params?.id;

    if (!logId || typeof logId !== "string") {
      return ApiErrors.badRequest("logId is required");
    }

    const log = await prisma.progressionLog.findUnique({
      where: { id: logId },
      include: {
        userProgression: {
          include: {
            exercise: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!log) {
      return ApiErrors.notFound("Log record not found");
    }

    if (log.userProgression.userId !== auth.userId) {
      return ApiErrors.forbidden("Unauthorized");
    }

    return apiSuccess({
      log: {
        id: log.id,
        exerciseId: log.userProgression.exercise.id,
        exerciseName: log.userProgression.exercise.name,
        level: log.level,
        weight1: log.weight1,
        reps1: log.reps1,
        weight2: log.weight2,
        reps2: log.reps2,
        weight3: log.weight3,
        reps3: log.reps3,
        holdTime: log.holdTime,
        holdTime2: log.holdTime2,
        holdTime3: log.holdTime3,
        modifier: log.modifier,
        variant: log.variant,
        setupOption: log.setupOption,
        notes: log.notes,
        completed: log.completed,
        createdAt: log.createdAt,
      },
    });
  } catch (error) {
    console.error("Progression log fetch error:", error);
    return ApiErrors.internal("Failed to fetch log record");
  }
});