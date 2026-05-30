import { apiSuccess, ApiErrors } from "@/lib/api";
import { withAuth } from "@/lib/auth/middleware";
import {
  applyExerciseTranslation,
  getUserLanguageMode,
} from "@/lib/exercise-translation-db";
import { resolveVietnameseValue } from "@/lib/auto-vietnamese";
import {
  ARCHIVED_TARGET_GROUP,
  deleteNonArchivedExercises,
  findArchivedExerciseByName,
  getActiveExercisesWithTranslations,
  upsertExerciseFromArchivedMatch,
  upsertExerciseTranslation,
} from "@/lib/repositories/exercise.repository";

export const GET = withAuth(async (_req, { auth }) => {
  try {
    const languageMode = await getUserLanguageMode(auth.userId);
    const exercises = await getActiveExercisesWithTranslations();

    const localizedExercises = exercises.map(({ translation, ...exercise }) =>
      applyExerciseTranslation(exercise, translation, languageMode)
    );

    return apiSuccess({ exercises: localizedExercises });
  } catch (error) {
    console.error("Exercises fetch error:", error);
    return ApiErrors.internal("Failed to fetch exercises");
  }
});

export const POST = withAuth(async (req, { auth }) => {
  try {
    if (auth.role !== "admin") {
      return ApiErrors.forbidden("Admin privileges required");
    }

    const body = await req.json();
    const name = String(body.name || body.originalName || "")
      .trim()
      .slice(0, 200);
    const wuxiaName = String(body.wuxiaName || body.name || "")
      .trim()
      .slice(0, 200);
    const difficulty = String(body.difficulty || "")
      .trim()
      .slice(0, 100);
    const type = String(body.type || "").trim();
    const story = body.story
      ? String(body.story).trim().slice(0, 2000)
      : undefined;
    const targetGroup = body.targetGroup
      ? String(body.targetGroup).trim().slice(0, 100)
      : undefined;

    if (!name || !difficulty || !type) {
      return ApiErrors.badRequest("Name, difficulty, and type are required");
    }

    // SQLite doesn't support mode:"insensitive", so fetch candidates and filter in JS
    const archivedMatch = await findArchivedExerciseByName(name);

    const exercise = await upsertExerciseFromArchivedMatch(
      archivedMatch?.id ?? null,
      {
        name,
        wuxiaName: wuxiaName || null,
        difficulty,
        type,
        story,
        targetGroup,
      }
    );

    await upsertExerciseTranslation({
      id: exercise.id,
      englishName: name,
      vietnameseName: resolveVietnameseValue(name, wuxiaName || null),
      englishStory: story || null,
      vietnameseStory: story || null,
      englishDifficulty: difficulty,
      vietnameseDifficulty: resolveVietnameseValue(difficulty, null),
      englishType: type,
      vietnameseType: resolveVietnameseValue(type, null),
    });

    return apiSuccess({ exercise });
  } catch (error) {
    console.error("Exercise create error:", error);
    return ApiErrors.internal("Failed to create exercise");
  }
});

export const DELETE = withAuth(async (_req, { auth }) => {
  try {
    if (auth.role !== "admin") {
      return ApiErrors.forbidden("Admin privileges required");
    }

    const deleteResult = await deleteNonArchivedExercises();

    return apiSuccess({
      message: `Library purged. ${deleteResult.count} technique(s) deleted.`,
      deleted: deleteResult.count,
      archived: 0,
    });
  } catch (error) {
    console.error("Exercise bulk delete error:", error);
    return ApiErrors.internal("Failed to remove techniques");
  }
});
