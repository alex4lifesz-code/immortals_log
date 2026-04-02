import {
  ALL_MUSCLE_GROUPS,
  ALL_TRAINING_CATEGORIES,
} from "@/lib/exercise-types";

export interface ExerciseDbOptions {
  categories: string[];
  types: string[];
  muscles: string[];
  variants: string[];
}

const APP_PREFS_KEY = "exerciseDbSettings";

function capitalizeFirst(value: string): string {
  if (!value) return value;
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function normalizeList(values: unknown, maxItems: number, fallback: string[] = []): string[] {
  if (!Array.isArray(values)) return [...fallback];
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = capitalizeFirst(String(value ?? "").trim().slice(0, 60));
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
    if (out.length >= maxItems) break;
  }

  return out.length > 0 ? out : [...fallback];
}

function normalizeTypeList(values: unknown): string[] {
  const normalized = normalizeList(values, 50, ["Weighted", "Timed", "Bodyweight"]);
  const canonical: string[] = [];
  const seen = new Set<string>();

  const toCanonical = (value: string): string => {
    const lower = value.trim().toLowerCase();
    if (lower === "weighted" || lower === "weight") return "Weighted";
    if (lower === "timed" || lower === "time" || lower === "hold") return "Timed";
    if (lower === "bodyweight" || lower === "body type" || lower === "bodytype" || lower === "body") return "Bodyweight";
    return value;
  };

  for (const value of normalized) {
    const canonicalValue = toCanonical(value);
    const key = canonicalValue.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    canonical.push(canonicalValue);
  }

  return canonical.length > 0 ? canonical : ["Weighted", "Timed", "Bodyweight"];
}

export function getDefaultExerciseDbOptions(): ExerciseDbOptions {
  return {
    categories: [...ALL_TRAINING_CATEGORIES],
    types: ["Weighted", "Timed", "Bodyweight"],
    muscles: [...ALL_MUSCLE_GROUPS],
    variants: [],
  };
}

export function getExerciseDbOptionsFromAppPrefs(appPrefs: unknown): ExerciseDbOptions {
  const defaults = getDefaultExerciseDbOptions();
  const root = appPrefs && typeof appPrefs === "object" && !Array.isArray(appPrefs)
    ? appPrefs as Record<string, unknown>
    : {};
  const stored = root[APP_PREFS_KEY];
  const settings = stored && typeof stored === "object" && !Array.isArray(stored)
    ? stored as Record<string, unknown>
    : {};

  return {
    categories: normalizeList(settings.categories, 80, defaults.categories),
    types: normalizeTypeList(settings.types),
    muscles: normalizeList(settings.muscles, 120, defaults.muscles),
    variants: normalizeList(settings.variants, 200, []),
  };
}

export function mergeExerciseDbOptionsIntoAppPrefs(
  appPrefs: unknown,
  options: ExerciseDbOptions,
): Record<string, unknown> {
  const root = appPrefs && typeof appPrefs === "object" && !Array.isArray(appPrefs)
    ? { ...(appPrefs as Record<string, unknown>) }
    : {};

  root[APP_PREFS_KEY] = {
    categories: normalizeList(options.categories, 80, [...ALL_TRAINING_CATEGORIES]),
    types: normalizeTypeList(options.types),
    muscles: normalizeList(options.muscles, 120, [...ALL_MUSCLE_GROUPS]),
    variants: normalizeList(options.variants, 200, []),
  };

  return root;
}
