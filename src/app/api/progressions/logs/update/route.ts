import { apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";

interface LogUpdate {
  id: string;
  exerciseId?: string | null;
  level?: number | null;
  weight1: number | null;
  reps1: number | null;
  weight2: number | null;
  reps2: number | null;
  weight3: number | null;
  reps3: number | null;
  holdTime: number | null;
  holdTime2: number | null;
  holdTime3: number | null;
  modifier: string | null;
  variant: string | null;
  notes: string | null;
}

export const POST = withAuth(async (request, { auth }) => {
  try {
    const { updates } = await request.json() as { updates: LogUpdate[] };
    const userId = auth.userId;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return ApiErrors.badRequest("Updates array is required and must not be empty");
    }

    for (const update of updates) {
      if (!update.id) {
        return ApiErrors.badRequest("Log ID is required for all updates");
      }

      if (update.exerciseId != null && typeof update.exerciseId !== "string") {
        return ApiErrors.badRequest("exerciseId must be a string when provided");
      }

      // Validate weight ranges
      for (const field of ["weight1", "weight2", "weight3"] as const) {
        const val = update[field];
        if (val !== null && val !== undefined && (val < 0 || val > 10000)) {
          return ApiErrors.badRequest(`${field} must be between 0 and 10000`);
        }
      }

      // Validate reps ranges
      for (const field of ["reps1", "reps2", "reps3"] as const) {
        const val = update[field];
        if (val !== null && val !== undefined && (val < 0 || val > 500)) {
          return ApiErrors.badRequest(`${field} must be between 0 and 500`);
        }
      }

      // Validate hold time ranges
      for (const field of ["holdTime", "holdTime2", "holdTime3"] as const) {
        const val = update[field];
        if (val !== null && val !== undefined && (val < 0 || val > 9999)) {
          return ApiErrors.badRequest(`${field} must be between 0 and 9999`);
        }
      }

      if (update.level !== null && update.level !== undefined) {
        if (!Number.isFinite(update.level) || update.level < 1 || update.level > 999) {
          return ApiErrors.badRequest("level must be between 1 and 999");
        }
      }
    }

    const requestedExerciseIds = Array.from(
      new Set(
        updates
          .map((update) => update.exerciseId)
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
      ),
    );

    if (requestedExerciseIds.length > 0) {
      const foundExercises = await prisma.progressionExercise.findMany({
        where: { id: { in: requestedExerciseIds } },
        select: { id: true },
      });
      if (foundExercises.length !== requestedExerciseIds.length) {
        return ApiErrors.badRequest("One or more selected exercises were not found");
      }
    }

    // Verify ownership: all logs must belong to the user
    const logIds = updates.map(u => u.id);
    const logs = await prisma.progressionLog.findMany({
      where: { id: { in: logIds } },
      include: { userProgression: true },
    });

    if (logs.length !== logIds.length) {
      return ApiErrors.notFound("One or more log records not found");
    }

    for (const log of logs) {
      if (log.userProgression.userId !== userId) {
        return ApiErrors.forbidden("Unauthorized");
      }
    }

    // Batch update
    const updatePromises = updates.map(async (update) => {
      let nextUserProgressionId: string | undefined;

      if (update.exerciseId && update.exerciseId.trim().length > 0) {
        const userProgression = await prisma.userProgressionLevel.upsert({
          where: {
            userId_exerciseId: {
              userId,
              exerciseId: update.exerciseId,
            },
          },
          update: {},
          create: {
            userId,
            exerciseId: update.exerciseId,
            currentLevel: 1,
          },
          select: { id: true },
        });
        nextUserProgressionId = userProgression.id;
      }

      return prisma.progressionLog.update({
        where: { id: update.id },
        data: {
          userProgressionId: nextUserProgressionId,
          level: update.level != null ? Math.floor(update.level) : undefined,
          weight1: update.weight1,
          reps1: update.reps1,
          weight2: update.weight2,
          reps2: update.reps2,
          weight3: update.weight3,
          reps3: update.reps3,
          holdTime: update.holdTime,
          holdTime2: update.holdTime2,
          holdTime3: update.holdTime3,
          modifier: update.modifier ? String(update.modifier).trim().slice(0, 100) : null,
          variant: update.variant ? String(update.variant).trim().slice(0, 200) : null,
          notes: update.notes ? String(update.notes).trim().slice(0, 1000) : null,
        },
      });
    });

    await Promise.all(updatePromises);

    return apiSuccess({ success: true, message: "Progression logs updated successfully" });
  } catch (error) {
    console.error("Progression log update error:", error);
    return ApiErrors.internal("Failed to update progression logs");
  }
});
