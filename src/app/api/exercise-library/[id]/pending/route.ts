import { apiSuccess, ApiErrors } from "@/lib/api";
import { withAuth } from "@/lib/auth/middleware";
import {
  isPendingExerciseDescription,
  markExerciseAsDeleted,
  stripExerciseStatusMarkers,
} from "@/lib/pending-exercises";
import {
  findPendingExerciseById,
  updateExerciseStoryById,
} from "@/lib/repositories/exercise-library.repository";

export const POST = withAuth(async (request, { params }) => {
  try {
    const id = params.id as string;
    const body = await request.json();
    const action = String(body?.action || "").trim().toLowerCase();

    if (action !== "append" && action !== "delete") {
      return ApiErrors.badRequest("Invalid action");
    }

    const existing = await findPendingExerciseById(id);

    if (!existing) {
      return ApiErrors.notFound("Exercise not found");
    }

    if (!isPendingExerciseDescription(existing.story)) {
      return ApiErrors.conflict("Exercise is not pending");
    }

    if (action === "append") {
      const updated = await updateExerciseStoryById(id, stripExerciseStatusMarkers(existing.story));

      return apiSuccess({ success: true, exercise: updated });
    }

    const updated = await updateExerciseStoryById(id, markExerciseAsDeleted(existing.story));

    return apiSuccess({ success: true, exercise: updated });
  } catch (error) {
    console.error("Pending exercise action error:", error);
    return ApiErrors.internal("Failed to process pending exercise action");
  }
});
