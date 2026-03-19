import { TerminologyMode } from "@/context/DisplaySettingsContext";

export interface ExerciseNameLike {
  name?: string | null;
  wuxiaName?: string | null;
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

export function getExerciseNameTooltip(
  exercise: ExerciseNameLike,
  terminologyMode: TerminologyMode,
  story?: string | null
): string {
  const normalName = exercise.name?.trim() || "";
  const fantasyName = exercise.wuxiaName?.trim() || "";
  const conventionalName = normalName || fantasyName;
  const cultivationName = fantasyName || normalName;

  const lines: string[] = [];

  if (terminologyMode === "normal") {
    if (conventionalName) lines.push(`Conventional: ${conventionalName}`);
    if (cultivationName) lines.push(`Cultivation: ${cultivationName}`);
  } else {
    if (cultivationName) lines.push(`Cultivation: ${cultivationName}`);
    if (conventionalName) lines.push(`Conventional: ${conventionalName}`);
  }

  if (lines.length === 0) {
    return terminologyMode === "normal" ? "Unknown Exercise" : "Unknown Technique";
  }

  return lines.join("\n");
}
