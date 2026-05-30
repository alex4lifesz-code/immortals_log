import { apiSuccess, ApiErrors } from "@/lib/api";
import {
  ALL_DIFFICULTIES,
} from "@/lib/exercise-types";
import { withAdmin } from "@/lib/auth/middleware";
import { getExerciseDbOptionsFromAppPrefs } from "@/lib/exercise-db-settings";
import { resolveVietnameseValue } from "@/lib/auto-vietnamese";
import {
  findAllExerciseNames,
  findExerciseById,
  findUserSettingsPinnedNav,
  updateExerciseStoryById,
  updateExerciseWithRelations,
  upsertExerciseTranslationById,
} from "@/lib/repositories/exercise-library.repository";
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
  const settings = await findUserSettingsPinnedNav(userId);
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

    const existing = await findExerciseById(id);
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
      const allUserExercises = await findAllExerciseNames();
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

    const updated = await updateExerciseWithRelations({
      id,
      updateData,
      variations: normalizedVariations,
      existing: {
        id: existing.id,
        name: existing.name,
        wuxiaName: existing.wuxiaName,
        difficulty: existing.difficulty,
        wuxiaDifficulty: existing.wuxiaDifficulty,
        type: existing.type,
        wuxiaType: existing.wuxiaType,
        story: existing.story,
      },
    });

    await upsertExerciseTranslationById({
      id,
      existing: {
        name: existing.name,
        wuxiaName: existing.wuxiaName,
        story: existing.story,
        difficulty: existing.difficulty,
        wuxiaDifficulty: existing.wuxiaDifficulty,
        type: existing.type,
        wuxiaType: existing.wuxiaType,
      },
      updateData,
      resolveVietnameseValue,
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

    const existing = await findExerciseById(id);
    if (!existing) {
      return ApiErrors.notFound("Exercise not found");
    }

    await updateExerciseStoryById(id, markExerciseAsDeleted(existing.story));

    return apiSuccess({ message: `${existing.name} was moved to the recycle bin.` });
  } catch (error) {
    console.error("Exercise delete error:", error);
    return ApiErrors.internal("Failed to delete exercise");
  }
});
