import { apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";
import { isDeletedExerciseDescription } from "@/lib/pending-exercises";

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
    const callerUserId = auth.userId;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return ApiErrors.badRequest("Updates array is required and must not be empty");
    }

    for (const update of updates) {
      if (!update.id) {
        return ApiErrors.badRequest("Log ID is required for all updates");
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

    // Verify ownership: users can only edit their own logs
    const logIds = updates.map(u => u.id);
    const logs = await prisma.progressionLog.findMany({
      where: { id: { in: logIds } },
      include: { userProgression: true },
    });

    if (logs.length !== logIds.length) {
      return ApiErrors.notFound("One or more log records not found");
    }

    for (const log of logs) {
      if (log.userProgression.userId !== callerUserId) {
        return ApiErrors.forbidden("Unauthorized");
      }
    }

    const logById = new Map(logs.map((log) => [log.id, log]));

    for (const update of updates) {
      const existingLog = logById.get(update.id);
      if (!existingLog) {
        return ApiErrors.notFound("One or more log records not found");
      }

      let nextUserProgressionId: string | undefined;
      const requestedExerciseId = typeof update.exerciseId === "string" ? update.exerciseId.trim() : "";
      if (requestedExerciseId) {
        const requestedExercise = await prisma.progressionExercise.findUnique({
          where: { id: requestedExerciseId },
          select: { id: true, story: true },
        });

        if (!requestedExercise || isDeletedExerciseDescription(requestedExercise.story)) {
          return ApiErrors.notFound("Exercise not found");
        }

        const currentExerciseId = existingLog.userProgression.exerciseId;
        if (currentExerciseId !== requestedExerciseId) {
          const linkedProgression = await prisma.userProgressionLevel.upsert({
            where: {
              userId_exerciseId: {
                userId: callerUserId,
                exerciseId: requestedExerciseId,
              },
            },
            update: {},
            create: {
              userId: callerUserId,
              exerciseId: requestedExerciseId,
              currentLevel: update.level != null ? Math.max(1, Math.floor(update.level)) : existingLog.level,
            },
            select: { id: true },
          });

          nextUserProgressionId = linkedProgression.id;
        }
      }

      await prisma.progressionLog.update({
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
    }

    return apiSuccess({ success: true, message: "Progression logs updated successfully" });
  } catch (error) {
    console.error("Progression log update error:", error);
    return ApiErrors.internal("Failed to update progression logs");
  }
});
