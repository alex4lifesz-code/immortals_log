import { TerminologyMode } from "@/context/DisplaySettingsContext";
import { isDeletedExerciseDescription } from "@/lib/pending-exercises";
import { t } from "@/lib/terminology";

export interface ExerciseNameLike {
  name?: string | null;
  wuxiaName?: string | null;
  englishName?: string | null;
  vietnameseName?: string | null;
  story?: string | null;
}

export interface ExerciseTypeLike {
  type?: string | null;
  wuxiaType?: string | null;
}

export interface ExerciseDifficultyLike {
  difficulty?: string | null;
  wuxiaDifficulty?: string | null;
}

function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singularizeToken(token: string): string {
  if (token.endsWith("ies") && token.length > 3) return `${token.slice(0, -3)}y`;
  if (token.endsWith("es") && token.length > 3) return token.slice(0, -2);
  if (token.endsWith("s") && token.length > 2) return token.slice(0, -1);
  return token;
}

function tokenVariants(token: string): string[] {
  const singular = singularizeToken(token);
  return Array.from(new Set([token, singular]));
}

function getPrimaryExerciseName(exercise: ExerciseNameLike): string {
  return exercise.englishName?.trim()
    || exercise.name?.trim()
    || exercise.vietnameseName?.trim()
    || exercise.wuxiaName?.trim()
    || "";
}

export function getDeletedExerciseLabel(exercise: ExerciseNameLike): string {
  const originalName = getPrimaryExerciseName(exercise);
  return originalName ? `Deleted exercise - ${originalName}` : "Deleted exercise";
}

export function getExerciseDisplayName(
  exercise: ExerciseNameLike,
  _terminologyMode: TerminologyMode,
  _showForeignLanguage = false
): string {
  if (isDeletedExerciseDescription(exercise.story)) {
    return getDeletedExerciseLabel(exercise);
  }

  return getPrimaryExerciseName(exercise) || "Unknown Exercise";
}

export function getTypeDisplayName(
  exercise: ExerciseTypeLike,
  _terminologyMode: TerminologyMode
): string {
  const raw = exercise.type?.trim() || exercise.wuxiaType?.trim() || "";
  return raw ? t(raw, "normal", "english") : "";
}

export function getDifficultyDisplayName(
  exercise: ExerciseDifficultyLike,
  _terminologyMode: TerminologyMode
): string {
  const raw = exercise.difficulty?.trim() || exercise.wuxiaDifficulty?.trim() || "";
  return raw ? t(raw, "normal", "english") : "";
}

export function getDifficultyColorKey(exercise: ExerciseDifficultyLike): string {
  return exercise.wuxiaDifficulty?.trim() || exercise.difficulty?.trim() || "";
}

export function getTypeColorKey(exercise: ExerciseTypeLike): string {
  return exercise.wuxiaType?.trim() || exercise.type?.trim() || "";
}

export function getExerciseSearchText(exercise: ExerciseNameLike): string {
  return [exercise.englishName, exercise.name, exercise.vietnameseName, exercise.wuxiaName]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ")
    .toLowerCase()
    .trim();
}

export function matchesLooseSearch(haystack: string, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const normalizedHaystack = normalizeSearchText(haystack);
  if (!normalizedHaystack) return false;

  if (normalizedHaystack.includes(normalizedQuery)) return true;

  const compactHaystack = normalizedHaystack.replace(/\s+/g, "");
  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  if (compactHaystack.includes(compactQuery)) return true;

  const haystackTokens = normalizedHaystack.split(" ");
  const queryTokens = normalizedQuery.split(" ");

  return queryTokens.every((queryToken) => {
    const variants = tokenVariants(queryToken);
    return haystackTokens.some((haystackToken) =>
      variants.some((variant) => haystackToken.includes(variant))
    );
  });
}

export function matchesLooseSearchInFields(query: string, fields: Array<string | null | undefined>): boolean {
  return fields.some((field) => matchesLooseSearch(field || "", query));
}

export function getExerciseNameTooltip(
  exercise: ExerciseNameLike,
  _terminologyMode: TerminologyMode,
  story?: string | null,
  _showForeignLanguage = false
): string {
  if (isDeletedExerciseDescription(story ?? exercise.story)) {
    return getDeletedExerciseLabel(exercise);
  }

  const lines: string[] = [];
  const primaryName = getPrimaryExerciseName(exercise);

  if (primaryName) {
    lines.push(primaryName);
  }

  if (story?.trim()) {
    lines.push("");
    lines.push(story.trim().slice(0, 180));
  }

  return lines.join("\n") || "Unknown Exercise";
}
