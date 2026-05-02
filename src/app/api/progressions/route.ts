import { apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";
import { isDeletedExerciseDescription } from "@/lib/pending-exercises";
import { ensureAppExerciseLibraryOwner } from "@/lib/exercise-library-owner";

// GET /api/progressions — fetch shared progression exercises plus requesting user's progress
export const GET = withAuth(async (_request, { auth }) => {
  try {
    const libraryOwnerId = await ensureAppExerciseLibraryOwner();
    const exercises = await prisma.progressionExercise.findMany({
      where: {
        OR: [
          { userId: libraryOwnerId },
          { userId: auth.userId },
          { userProgress: { some: { userId: auth.userId } } },
        ],
      },
      include: {
        tiers: {
          orderBy: { level: "asc" },
        },
        variations: true,
        modifiers: true,
        userProgress: {
          where: { userId: auth.userId },
          include: {
            logs: { orderBy: { createdAt: "desc" } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
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
    await prisma.userProgressionLevel.deleteMany({ where: { userId: auth.userId } });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Progressions delete error:", error);
    return ApiErrors.internal("Failed to delete progressions");
  }
});
