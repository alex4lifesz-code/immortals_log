import { apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";
import {
  applyProgressionExerciseTranslation,
  getUserLanguageMode,
} from "@/lib/exercise-translation-db";
import { isDeletedExerciseDescription } from "@/lib/pending-exercises";

// GET /api/progressions — fetch shared progression exercises plus requesting user's progress
export const GET = withAuth(async (_request, { auth }) => {
  try {
    const languageMode = await getUserLanguageMode(auth.userId);
    const exercises = await prisma.progressionExercise.findMany({
      where: {
        OR: [
          { userId: auth.userId },
          { userProgress: { some: { userId: auth.userId } } },
        ],
      },
      include: {
        translation: true,
        tiers: {
          include: { translation: true },
          orderBy: { level: "asc" },
        },
        variations: {
          include: { translation: true },
        },
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

    const localizedExercises = exercises
      .filter((exercise) => !isDeletedExerciseDescription(exercise.story))
      .map(({ translation, ...exercise }) => {
      const localized = applyProgressionExerciseTranslation(exercise, translation, languageMode);
      const englishName = translation?.englishName || exercise.name;
      const vietnameseName = translation?.vietnameseName || exercise.wuxiaName || exercise.name;
      return {
        ...localized,
        name: englishName,
        wuxiaName: vietnameseName,
        englishName,
        vietnameseName,
      };
    });

    return apiSuccess({ exercises: localizedExercises });
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
