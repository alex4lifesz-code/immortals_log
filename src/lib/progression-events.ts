export const PROGRESSION_EXERCISES_UPDATED_EVENT = "progression-exercises-updated";
export const EXERCISE_DB_SETTINGS_UPDATED_EVENT = "exercise-db-settings-updated";

export function notifyProgressionExercisesUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PROGRESSION_EXERCISES_UPDATED_EVENT));
}

export function notifyExerciseDbSettingsUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EXERCISE_DB_SETTINGS_UPDATED_EVENT));
  notifyProgressionExercisesUpdated();
}
