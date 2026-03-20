import { TerminologyMode } from "@/context/DisplaySettingsContext";

export interface ExerciseNameLike {
  name?: string | null;
  wuxiaName?: string | null;
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
  terminologyMode: TerminologyMode
): string {
  if (terminologyMode === "normal") {
    return exercise.name?.trim() || exercise.wuxiaName?.trim() || "Unknown Exercise";
  }
  return exercise.wuxiaName?.trim() || exercise.name?.trim() || "Unknown Technique";
}

export function getExerciseSearchText(exercise: ExerciseNameLike): string {
  return `${exercise.name || ""} ${exercise.wuxiaName || ""}`.toLowerCase().trim();
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
