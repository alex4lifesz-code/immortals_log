import { apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";

// PUT /api/progressions/[id]/level — update user's current level for an exercise
export const PUT = withAuth(async (request, { auth, params }) => {
  try {
    const id = params.id as string;
    const body = await request.json();
    const currentLevel = body.currentLevel;

    if (typeof currentLevel !== "number" || currentLevel < 1) {
      return ApiErrors.badRequest("currentLevel must be a positive number");
    }

    // Verify the exercise exists in shared library
    const exercise = await prisma.progressionExercise.findFirst({
      where: { id },
    });
    if (!exercise) {
      return ApiErrors.notFound("Exercise not found");
    }

    const userId = auth.userId;
    const progress = await prisma.userProgressionLevel.upsert({
      where: { userId_exerciseId: { userId, exerciseId: id } },
      update: { currentLevel },
      create: { userId, exerciseId: id, currentLevel },
    });

    return apiSuccess({ progress });
  } catch (error) {
    console.error("Level update error:", error);
    return ApiErrors.internal("Failed to update level");
  }
});
