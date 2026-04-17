import { apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  ALL_DIFFICULTIES,
} from "@/lib/exercise-types";
import { withAdmin } from "@/lib/auth/middleware";
import { getExerciseDbOptionsFromAppPrefs } from "@/lib/exercise-db-settings";
import { resolveVietnameseValue } from "@/lib/auto-vietnamese";
import {
  isPendingExerciseDescription,
  markPendingExerciseAsEdited,
  markExerciseAsDeleted,
  markExerciseAsPending,
  stripExerciseStatusMarkers,
} from "@/lib/pending-exercises";

function parseJsonObject(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore malformed JSON and fallback to defaults.
  }
  return null;
}

async function getUserExerciseDbOptions(userId: string) {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { pinnedNavItems: true },
  });
  const appPrefs = parseJsonObject(settings?.pinnedNavItems) ?? {};
  return getExerciseDbOptionsFromAppPrefs(appPrefs);
}

function resolveOption(value: string, options: string[]): string | null {
  const target = value.trim().toLowerCase();
  if (!target) return null;
  return options.find((opt) => opt.toLowerCase() === target) ?? null;
}

function normalizeTypeForFlags(typeLabel: string): "weighted" | "timed" | "bodyweight" {
  const lower = typeLabel.trim().toLowerCase();
  if (lower.includes("weight") || lower.includes("load") || lower.includes("resist") || lower.includes("barbell") || lower.includes("dumbbell")) {
    return "weighted";
  }
  if (lower.includes("time") || lower.includes("hold") || lower.includes("duration") || lower.includes("isometric") || lower.includes("sec") || lower.includes("min")) {
    return "timed";
  }
  return "bodyweight";
}

/** PATCH /api/exercise-library/[id] — Update an exercise */
export const PATCH = withAdmin(async (req, { auth, params }) => {
  try {
    const id = params.id as string;
    const body = await req.json();
    const {
      name,
      category,
      exerciseType,
      muscleGroups,
      equipment,
      difficulty,
      description,
      instructions,
      progression,
      variations,
    } = body;

    const existing = await prisma.progressionExercise.findUnique({
      where: { id },
    });
    if (!existing) {
      return ApiErrors.notFound("Exercise not found");
    }

    const dbOptions = await getUserExerciseDbOptions(auth.userId);

    const updateData: Record<string, unknown> = {};
    const existingIsPending = isPendingExerciseDescription(existing.story);

    if (name !== undefined) {
      const trimmedName = String(name).trim().slice(0, 200);
      if (trimmedName.length < 2) {
        return ApiErrors.badRequest("Name must be at least 2 characters");
      }
      const allUserExercises = await prisma.progressionExercise.findMany({
        select: { id: true, name: true },
      });
      const duplicate = allUserExercises.find(
        (ex) =>
          ex.id !== id && ex.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicate) {
        return ApiErrors.conflict("An exercise with this name already exists");
      }
      updateData.name = trimmedName;
      updateData.wuxiaName = trimmedName;
    }

    if (category !== undefined) {
      const resolvedCategory = resolveOption(String(category || ""), dbOptions.categories);
      if (!resolvedCategory) {
        return ApiErrors.badRequest("Invalid category");
      }
      updateData.category = resolvedCategory;
    }

    if (exerciseType !== undefined) {
      const resolvedType = resolveOption(String(exerciseType || ""), dbOptions.types);
      if (!resolvedType) {
        return ApiErrors.badRequest("Invalid exercise type");
      }
      const normalizedType = normalizeTypeForFlags(resolvedType);
      updateData.bodyweight =
        normalizedType === "bodyweight" || normalizedType === "timed";
      updateData.weighted = normalizedType === "weighted";
    }

    if (muscleGroups !== undefined) {
      if (!Array.isArray(muscleGroups) || muscleGroups.length === 0) {
        return ApiErrors.badRequest("At least one muscle group required");
      }
      const normalizedMuscles = muscleGroups
        .map((mg) => resolveOption(String(mg || ""), dbOptions.muscles))
        .filter(Boolean) as string[];
      if (normalizedMuscles.length !== muscleGroups.length) {
        return ApiErrors.badRequest("One or more muscle groups are invalid");
      }
      updateData.primaryMuscles = normalizedMuscles.join(", ");
    }

    if (equipment !== undefined) {
      updateData.equipmentType = Array.isArray(equipment)
        ? equipment.join(", ")
        : "";
    }

    if (difficulty !== undefined) {
      if (difficulty && !ALL_DIFFICULTIES.includes(difficulty)) {
        return ApiErrors.badRequest("Invalid difficulty");
      }
      updateData.difficulty = difficulty ? String(difficulty).trim() : "";
      updateData.wuxiaDifficulty = difficulty ? String(difficulty).trim() : "";
    }

    if (description !== undefined) {
      updateData.story = String(description).trim().slice(0, 2000);
    }

    if (instructions !== undefined) {
      updateData.tips = JSON.stringify(instructions);
    }

    const normalizedVariations = variations !== undefined
      ? (Array.isArray(variations)
          ? variations
              .map((variation) => String(variation || "").trim().slice(0, 200))
              .filter(Boolean)
          : null)
      : undefined;

    const normalizedProgression = progression !== undefined
      ? (Array.isArray(progression)
          ? progression
              .map((level) => String(level || "").trim().slice(0, 200))
              .filter(Boolean)
          : null)
      : undefined;

    if (normalizedVariations === null) {
      return ApiErrors.badRequest("Invalid variations payload");
    }

    if (normalizedProgression === null) {
      return ApiErrors.badRequest("Invalid progression payload");
    }

    if (normalizedProgression !== undefined) {
      updateData.progression = JSON.stringify(normalizedProgression);
    }

    if (existingIsPending && Object.keys(updateData).length > 0) {
      const nextDescription = description !== undefined
        ? String(description).trim().slice(0, 2000)
        : stripExerciseStatusMarkers(existing.story);
      updateData.story = markPendingExerciseAsEdited(markExerciseAsPending(nextDescription));
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (normalizedVariations !== undefined) {
        await tx.progressionVariation.deleteMany({
          where: { exerciseId: id },
        });

        if (normalizedVariations.length > 0) {
          await tx.progressionVariation.createMany({
            data: normalizedVariations.map((variationName) => ({
              exerciseId: id,
              name: variationName,
              wuxiaName: variationName,
            })),
          });

          const createdVariations = await tx.progressionVariation.findMany({
            where: { exerciseId: id },
            select: { id: true, name: true, description: true, difficulty: true },
          });

          if (createdVariations.length > 0) {
            await tx.progressionVariationTranslation.createMany({
              data: createdVariations.map((variation) => ({
                id: variation.id,
                englishName: variation.name,
                vietnameseName: variation.name,
                englishDescription: variation.description,
                vietnameseDescription: variation.description,
                englishDifficulty: variation.difficulty,
                vietnameseDifficulty: variation.difficulty,
              })),
            });
          }
        }
      }

      const next = await tx.progressionExercise.update({
        where: { id },
        data: updateData,
        include: {
          variations: {
            select: {
              id: true,
              name: true,
            },
            orderBy: { name: "asc" },
          },
        },
      });

      await tx.progressionExerciseTranslation.upsert({
        where: { id },
        create: {
          id,
          englishName: String(updateData.name ?? existing.name),
          vietnameseName: resolveVietnameseValue(
            String(updateData.name ?? existing.name),
            String(updateData.wuxiaName ?? (existing.wuxiaName || updateData.name || existing.name)),
          ),
          englishStory: String(updateData.story ?? existing.story),
          vietnameseStory: resolveVietnameseValue(String(updateData.story ?? existing.story), null),
          englishDifficulty: String(updateData.difficulty ?? existing.difficulty),
          vietnameseDifficulty: resolveVietnameseValue(
            String(updateData.difficulty ?? existing.difficulty),
            String(updateData.wuxiaDifficulty ?? (existing.wuxiaDifficulty || updateData.difficulty || existing.difficulty)),
          ),
          englishType: String(updateData.type ?? existing.type),
          vietnameseType: resolveVietnameseValue(
            String(updateData.type ?? existing.type),
            String(updateData.wuxiaType ?? (existing.wuxiaType || updateData.type || existing.type)),
          ),
        },
        update: {
          ...(updateData.name !== undefined ? { englishName: String(updateData.name) } : {}),
          ...(updateData.wuxiaName !== undefined
            ? {
                vietnameseName: resolveVietnameseValue(
                  String(updateData.name ?? existing.name),
                  String(updateData.wuxiaName || updateData.name || existing.name),
                ),
              }
            : {}),
          ...(updateData.story !== undefined
            ? {
                englishStory: String(updateData.story),
                vietnameseStory: resolveVietnameseValue(String(updateData.story), null),
              }
            : {}),
          ...(updateData.difficulty !== undefined ? { englishDifficulty: String(updateData.difficulty) } : {}),
          ...(updateData.wuxiaDifficulty !== undefined
            ? {
                vietnameseDifficulty: resolveVietnameseValue(
                  String(updateData.difficulty ?? existing.difficulty),
                  String(updateData.wuxiaDifficulty || updateData.difficulty || existing.difficulty),
                ),
              }
            : {}),
          ...(updateData.type !== undefined ? { englishType: String(updateData.type) } : {}),
          ...(updateData.wuxiaType !== undefined
            ? {
                vietnameseType: resolveVietnameseValue(
                  String(updateData.type ?? existing.type),
                  String(updateData.wuxiaType || updateData.type || existing.type),
                ),
              }
            : {}),
        },
      });

      return next;
    });

    return apiSuccess({ exercise: updated });
  } catch (error) {
    console.error("Exercise update error:", error);
    return ApiErrors.internal("Failed to update exercise");
  }
});

/** DELETE /api/exercise-library/[id] — Move an exercise to the recycle bin */
export const DELETE = withAdmin(async (_req, { auth, params }) => {
  try {
    const id = params.id as string;

    const existing = await prisma.progressionExercise.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        story: true,
        userId: true,
      },
    });
    if (!existing) {
      return ApiErrors.notFound("Exercise not found");
    }

    await prisma.progressionExercise.update({
      where: { id },
      data: {
        story: markExerciseAsDeleted(existing.story),
      },
    });

    return apiSuccess({ message: `${existing.name} was moved to the recycle bin.` });
  } catch (error) {
    console.error("Exercise delete error:", error);
    return ApiErrors.internal("Failed to delete exercise");
  }
});
