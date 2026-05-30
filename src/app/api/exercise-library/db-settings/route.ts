import { apiSuccess, ApiErrors } from "@/lib/api";
import { withAuth } from "@/lib/auth/middleware";
import {
  getDefaultExerciseDbOptions,
  getExerciseDbOptionsFromAppPrefs,
  mergeExerciseDbOptionsIntoAppPrefs,
  type ExerciseDbOptions,
} from "@/lib/exercise-db-settings";
import {
  findExerciseMusclesByUser,
  findUserSettingsPinnedNav,
  renameExerciseCategoriesForUser,
  renameExerciseVariationsForUser,
  updateExerciseMusclesById,
  upsertUserSettingsPinnedNav,
} from "@/lib/repositories/exercise-library.repository";

type RenamePair = { from: string; to: string };
type RenamePayload = {
  categories?: RenamePair[];
  types?: RenamePair[];
  muscles?: RenamePair[];
  variants?: RenamePair[];
};

function parseJsonObject(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore invalid JSON and fallback to defaults.
  }
  return null;
}

function normalizeLabel(value: unknown): string {
  const raw = String(value ?? "").trim().slice(0, 60);
  if (!raw) return "";
  return `${raw.charAt(0).toUpperCase()}${raw.slice(1)}`;
}

function normalizeRenames(values: unknown): RenamePair[] {
  if (!Array.isArray(values)) return [];
  const output: RenamePair[] = [];
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    const from = normalizeLabel(row.from);
    const to = normalizeLabel(row.to);
    if (!from || !to) continue;
    if (from.toLowerCase() === to.toLowerCase()) continue;
    output.push({ from, to });
  }
  return output;
}

function renameInCsv(csv: string, renames: RenamePair[]): string {
  if (!csv) return csv;
  const parts = csv.split(",").map((item) => item.trim()).filter(Boolean);
  if (parts.length === 0) return csv;

  const mapped = parts.map((item) => {
    const match = renames.find((rename) => rename.from.toLowerCase() === item.toLowerCase());
    return match ? match.to : item;
  });

  return mapped.join(", ");
}

async function applyRenamePropagation(userId: string, renames: Required<RenamePayload>) {
  for (const rename of renames.categories) {
    await renameExerciseCategoriesForUser(userId, rename.from, rename.to);
  }

  if (renames.muscles.length > 0) {
    const exercises = await findExerciseMusclesByUser(userId);

    for (const exercise of exercises) {
      const nextPrimary = renameInCsv(exercise.primaryMuscles || "", renames.muscles);
      const nextSecondary = renameInCsv(exercise.secondaryMuscles || "", renames.muscles);
      if (nextPrimary === (exercise.primaryMuscles || "") && nextSecondary === (exercise.secondaryMuscles || "")) {
        continue;
      }
      await updateExerciseMusclesById(exercise.id, nextPrimary, nextSecondary);
    }
  }

  for (const rename of renames.variants) {
    await renameExerciseVariationsForUser(userId, rename.from, rename.to);
  }

  // Type labels are UI labels derived from boolean flags; no direct column to rename.
}

export const GET = withAuth(async (_req, { auth }) => {
  try {
    const existing = await findUserSettingsPinnedNav(auth.userId);

    const appPrefs = parseJsonObject(existing?.pinnedNavItems) ?? {};
    const options = getExerciseDbOptionsFromAppPrefs(appPrefs);

    // Auto-normalize persisted settings (including capitalization) when legacy values are loaded.
    if (existing?.pinnedNavItems) {
      const normalizedPrefs = mergeExerciseDbOptionsIntoAppPrefs(appPrefs, options);
      const normalizedSerialized = JSON.stringify(normalizedPrefs);
      if (normalizedSerialized !== existing.pinnedNavItems) {
        await upsertUserSettingsPinnedNav({
          userId: auth.userId,
          pinnedNavItems: normalizedSerialized,
          hiddenNavItems: existing.hiddenNavItems ?? "{}",
          panelPosition: existing.panelPosition ?? "left",
          dualPageView: existing.dualPageView ?? false,
          combinedView: existing.combinedView ?? false,
        });
      }
    }

    return apiSuccess({ options });
  } catch (error) {
    console.error("Exercise DB settings fetch error:", error);
    return apiSuccess({ options: getDefaultExerciseDbOptions() });
  }
});

export const PUT = withAuth(async (req, { auth }) => {
  try {
    const body = await req.json();
    const incoming = body?.options as ExerciseDbOptions | undefined;
    const renamePayload = (body?.renames ?? {}) as RenamePayload;
    if (!incoming || typeof incoming !== "object") {
      return ApiErrors.badRequest("Invalid settings payload");
    }

    const renames: Required<RenamePayload> = {
      categories: normalizeRenames(renamePayload.categories),
      types: normalizeRenames(renamePayload.types),
      muscles: normalizeRenames(renamePayload.muscles),
      variants: normalizeRenames(renamePayload.variants),
    };

    const existing = await findUserSettingsPinnedNav(auth.userId);

    const existingPrefs = parseJsonObject(existing?.pinnedNavItems) ?? {};
    const mergedPrefs = mergeExerciseDbOptionsIntoAppPrefs(existingPrefs, incoming);
    const options = getExerciseDbOptionsFromAppPrefs(mergedPrefs);

    await upsertUserSettingsPinnedNav({
      userId: auth.userId,
      pinnedNavItems: JSON.stringify(mergedPrefs),
      hiddenNavItems: existing?.hiddenNavItems ?? "{}",
      panelPosition: existing?.panelPosition ?? "left",
      dualPageView: existing?.dualPageView ?? false,
      combinedView: existing?.combinedView ?? false,
    });

    await applyRenamePropagation(auth.userId, renames);

    return apiSuccess({ success: true, options });
  } catch (error) {
    console.error("Exercise DB settings save error:", error);
    return ApiErrors.internal("Failed to save settings");
  }
});
