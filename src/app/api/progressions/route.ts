import { apiSuccess, ApiErrors } from "@/lib/api";
import { withAuth } from "@/lib/auth/middleware";
import { isDeletedExerciseDescription } from "@/lib/pending-exercises";
import { ensureAppExerciseLibraryOwner } from "@/lib/exercise-library-owner";
import {
  deleteUserProgressionLevels,
  getVisibleProgressionExercises,
} from "@/lib/repositories/progression.repository";

// GET /api/progressions — fetch shared progression exercises plus requesting user's progress
export const GET = withAuth(async (_request, { auth }) => {
  try {
    const libraryOwnerId = await ensureAppExerciseLibraryOwner();
    const exercises = await getVisibleProgressionExercises({
      libraryOwnerId,
      userId: auth.userId,
    });

    const visibleExercises = exercises.filter((exercise) => !isDeletedExerciseDescription(exercise.story));

    return apiSuccess({ exercises: visibleExercises });
  } catch (error) {
    console.error("Progressions fetch error:", error);
    return ApiErrors.internal("Failed to fetch progressions");
  }
});

// DELETE /api/progressions — remove user's progression data only
export const DELETE = withAuth(async (_request, { auth }) => {
  try {
    // Delete user progression levels (logs cascade)
    await deleteUserProgressionLevels(auth.userId);

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Progressions delete error:", error);
    return ApiErrors.internal("Failed to delete progressions");
  }
});
