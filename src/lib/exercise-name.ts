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
