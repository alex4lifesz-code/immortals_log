import { apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";
import {
  isPendingExerciseDescription,
  markExerciseAsDeleted,
  stripExerciseStatusMarkers,
} from "@/lib/pending-exercises";

export const POST = withAuth(async (request, { params }) => {
  try {
    const id = params.id as string;
    const body = await request.json();
    const action = String(body?.action || "").trim().toLowerCase();

    if (action !== "append" && action !== "delete") {
      return ApiErrors.badRequest("Invalid action");
    }

    const existing = await prisma.progressionExercise.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        story: true,
      },
    });

    if (!existing) {
      return ApiErrors.notFound("Exercise not found");
    }

    if (!isPendingExerciseDescription(existing.story)) {
      return ApiErrors.conflict("Exercise is not pending");
    }

    if (action === "append") {
      const updated = await prisma.progressionExercise.update({
        where: { id },
        data: {
          story: stripExerciseStatusMarkers(existing.story),
        },
        select: { id: true, name: true },
      });

      return apiSuccess({ success: true, exercise: updated });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.progressionTier.updateMany({
        where: { exerciseId: id },
        data: {
          name: "Deleted exercise",
          wuxiaName: "Deleted exercise",
        },
      });

      return tx.progressionExercise.update({
        where: { id },
        data: {
          name: "Deleted exercise",
          wuxiaName: "Deleted exercise",
          story: markExerciseAsDeleted(existing.story),
        },
        select: { id: true, name: true },
      });
    });

    return apiSuccess({ success: true, exercise: updated });
  } catch (error) {
    console.error("Pending exercise action error:", error);
    return ApiErrors.internal("Failed to process pending exercise action");
  }
});
