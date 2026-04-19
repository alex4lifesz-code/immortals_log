export type ExerciseSearchMatchSource = "name" | "progression" | "variant";

export interface RankedExerciseSearchItem {
  exerciseId?: string;
  displayLabel: string;
  canonicalName: string;
  searchLabel: string;
  hasHistory?: boolean;
  lastLoggedAt?: string | null;
  matchSource?: ExerciseSearchMatchSource;
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getTextMatchRank(text: string, query: string): number {
  const normalizedText = normalizeSearchText(text);
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) return 99;
  if (normalizedText === normalizedQuery) return 0;
  if (normalizedText.startsWith(`${normalizedQuery} `) || normalizedText.startsWith(normalizedQuery)) return 1;
  if (normalizedText.split(" ").includes(normalizedQuery)) return 2;
  if (normalizedText.includes(normalizedQuery)) return 3;
  return 4;
}

function getSourceRank(source: ExerciseSearchMatchSource | undefined): number {
  if (source === "name") return 0;
  if (source === "progression") return 1;
  if (source === "variant") return 2;
  return 3;
}

export function rankExerciseSearchResults<T extends RankedExerciseSearchItem>(
  results: T[],
  query: string,
): T[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [...results];

  return [...results].sort((a, b) => {
    const aHistoryBoost = a.hasHistory && (a.matchSource ?? "name") === "name" ? 0 : 1;
    const bHistoryBoost = b.hasHistory && (b.matchSource ?? "name") === "name" ? 0 : 1;
    if (aHistoryBoost !== bHistoryBoost) return aHistoryBoost - bHistoryBoost;

    const aTextRank = Math.min(
      getTextMatchRank(a.canonicalName || a.displayLabel || a.searchLabel, normalizedQuery),
      getTextMatchRank(a.displayLabel || a.searchLabel || a.canonicalName, normalizedQuery),
    );
    const bTextRank = Math.min(
      getTextMatchRank(b.canonicalName || b.displayLabel || b.searchLabel, normalizedQuery),
      getTextMatchRank(b.displayLabel || b.searchLabel || b.canonicalName, normalizedQuery),
    );
    if (aTextRank !== bTextRank) return aTextRank - bTextRank;

    const aSourceRank = getSourceRank(a.matchSource);
    const bSourceRank = getSourceRank(b.matchSource);
    if (aSourceRank !== bSourceRank) return aSourceRank - bSourceRank;

    const aLastLogged = a.lastLoggedAt ? new Date(a.lastLoggedAt).getTime() : 0;
    const bLastLogged = b.lastLoggedAt ? new Date(b.lastLoggedAt).getTime() : 0;
    if (aLastLogged !== bLastLogged) return bLastLogged - aLastLogged;

    return a.displayLabel.localeCompare(b.displayLabel, undefined, { sensitivity: "base", numeric: true });
  });
}
