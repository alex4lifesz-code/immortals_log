import { apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";
import {
  applyExerciseTranslation,
  getUserLanguageMode,
} from "@/lib/exercise-translation-db";
import { resolveVietnameseValue } from "@/lib/auto-vietnamese";

const ARCHIVED_TARGET_GROUP = "__archived__";

export const GET = withAuth(async (_req, { auth }) => {
  try {
    const languageMode = await getUserLanguageMode(auth.userId);
    const exercises = await prisma.exercise.findMany({
      where: {
        NOT: {
          targetGroup: ARCHIVED_TARGET_GROUP,
        },
      },
      include: {
        translation: true,
      },
      orderBy: { createdAt: "desc" },
    });

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
    const archivedCandidates = await prisma.exercise.findMany({
      where: { targetGroup: ARCHIVED_TARGET_GROUP },
    });
    const archivedMatch =
      archivedCandidates.find(
        (ex) => ex.name.toLowerCase() === name.toLowerCase()
      ) ?? null;

    const exercise = archivedMatch
      ? await prisma.exercise.update({
          where: { id: archivedMatch.id },
          data: {
            wuxiaName: wuxiaName || null,
            difficulty,
            type,
            story,
            targetGroup: targetGroup || null,
          },
        })
      : await prisma.exercise.create({
          data: {
            name,
            wuxiaName: wuxiaName || null,
            difficulty,
            type,
            story,
            targetGroup,
          },
        });

    await prisma.exerciseTranslation.upsert({
      where: { id: exercise.id },
      create: {
        id: exercise.id,
        englishName: name,
        vietnameseName: resolveVietnameseValue(name, wuxiaName || null),
        englishStory: story || null,
        vietnameseStory: story || null,
        englishDifficulty: difficulty,
        vietnameseDifficulty: resolveVietnameseValue(difficulty, null),
        englishType: type,
        vietnameseType: resolveVietnameseValue(type, null),
      },
      update: {
        englishName: name,
        vietnameseName: resolveVietnameseValue(name, wuxiaName || null),
        englishStory: story || null,
        englishDifficulty: difficulty,
        englishType: type,
      },
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

    const deleteResult = await prisma.exercise.deleteMany({
      where: {
        NOT: {
          targetGroup: ARCHIVED_TARGET_GROUP,
        },
      },
    });

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
