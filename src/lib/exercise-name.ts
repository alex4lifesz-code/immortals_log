import { TerminologyMode } from "@/context/DisplaySettingsContext";
import { t } from "@/lib/terminology";

export interface ExerciseNameLike {
  name?: string | null;
  wuxiaName?: string | null;
  englishName?: string | null;
  vietnameseName?: string | null;
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

export function getExerciseDisplayName(
  exercise: ExerciseNameLike,
  terminologyMode: TerminologyMode,
  showForeignLanguage = true
): string {
  const englishName = exercise.englishName?.trim() || "";
  const vietnameseName = exercise.vietnameseName?.trim() || "";
  const canonicalName = exercise.name?.trim() || "";
  const canonicalForeignName = exercise.wuxiaName?.trim() || "";
  const normalName = englishName || canonicalName || vietnameseName || canonicalForeignName;
  const wuxiaName = vietnameseName || canonicalForeignName || englishName || canonicalName;

  const primary = terminologyMode === "normal"
    ? normalName || wuxiaName || "Unknown Exercise"
    : wuxiaName || normalName || "Unknown Technique";

  if (!showForeignLanguage) return primary;

  const preferredSecondary = terminologyMode === "normal" ? wuxiaName : normalName;
  const secondary = [
    preferredSecondary,
    ...(terminologyMode === "normal" ? [vietnameseName, englishName] : [englishName, vietnameseName]),
  ].find((candidate) => {
    const value = candidate?.trim();
    return value && value.toLowerCase() !== primary.toLowerCase();
  }) || "";

  if (!secondary) return primary;

  return `${primary} (${secondary})`;
}

/** Returns the type label to display based on the current terminology mode. */
export function getTypeDisplayName(
  exercise: ExerciseTypeLike,
  terminologyMode: TerminologyMode
): string {
  if (terminologyMode === "normal") {
    const raw = exercise.type?.trim() || exercise.wuxiaType?.trim() || "";
    return raw ? t(raw, "normal") : "";
  }
  return exercise.wuxiaType?.trim() || exercise.type?.trim() || "";
}

/** Returns the difficulty label to display based on the current terminology mode. */
export function getDifficultyDisplayName(
  exercise: ExerciseDifficultyLike,
  terminologyMode: TerminologyMode
): string {
  if (terminologyMode === "normal") {
    const raw = exercise.difficulty?.trim() || exercise.wuxiaDifficulty?.trim() || "";
    return raw ? t(raw, "normal") : "";
  }
  return exercise.wuxiaDifficulty?.trim() || exercise.difficulty?.trim() || "";
}

/**
 * Returns the wuxia difficulty key to use for color/glow lookups.
 * Always uses wuxiaDifficulty when available so color mapping stays consistent.
 */
export function getDifficultyColorKey(exercise: ExerciseDifficultyLike): string {
  return exercise.wuxiaDifficulty?.trim() || exercise.difficulty?.trim() || "";
}

/**
 * Returns the wuxia type key to use for icon/color lookups.
 * Always uses wuxiaType when available so icon mapping stays consistent.
 */
export function getTypeColorKey(exercise: ExerciseTypeLike): string {
  return exercise.wuxiaType?.trim() || exercise.type?.trim() || "";
}

export function getExerciseSearchText(exercise: ExerciseNameLike): string {
  return `${exercise.name || ""} ${exercise.wuxiaName || ""} ${exercise.englishName || ""} ${exercise.vietnameseName || ""}`.toLowerCase().trim();
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
  terminologyMode: TerminologyMode,
  story?: string | null,
  showForeignLanguage = true
): string {
  const normalName = exercise.englishName?.trim() || exercise.name?.trim() || "";
  const fantasyName = exercise.vietnameseName?.trim() || exercise.wuxiaName?.trim() || "";
  const conventionalName = normalName || fantasyName;
  const cultivationName = fantasyName || normalName;

  const lines: string[] = [];

  if (showForeignLanguage) {
    if (terminologyMode === "normal") {
      if (conventionalName) lines.push(`Conventional: ${conventionalName}`);
      if (cultivationName) lines.push(`Cultivation: ${cultivationName}`);
    } else {
      if (cultivationName) lines.push(`Cultivation: ${cultivationName}`);
      if (conventionalName) lines.push(`Conventional: ${conventionalName}`);
    }
  } else {
    const single = terminologyMode === "normal" ? conventionalName : cultivationName;
    if (single) lines.push(single);
  }

  if (lines.length === 0) {
    return terminologyMode === "normal" ? "Unknown Exercise" : "Unknown Technique";
  }

  if (story?.trim()) {
    lines.push("");
    lines.push(story.trim().slice(0, 180));
  }

  return lines.join("\n");
}
