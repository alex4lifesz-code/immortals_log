// ── Unit Conversion Utilities ──
// Default storage unit is KG. All weights stored in KG in the database.

const LBS_TO_KG = 0.453592;
const KG_TO_LBS = 2.20462;

export type WeightUnit = "kg" | "lbs";
export type TimedUnitPref = "seconds" | "minutes";
export type ExerciseType = "weighted" | "timed" | "bodyweight";
export type TrainingCategory = "Calisthenics" | "Gym" | "Yoga" | "Cardio" | "Other";

export function lbsToKg(lbs: number): number {
  return Math.round(lbs * LBS_TO_KG * 10) / 10;
}

export function kgToLbs(kg: number): number {
  return Math.round(kg * KG_TO_LBS * 10) / 10;
}

export function convertToKg(value: number, inputUnit: WeightUnit): number {
  return inputUnit === "lbs" ? lbsToKg(value) : value;
}

export function displayWeight(kg: number, displayUnit: WeightUnit): string {
  const value = displayUnit === "lbs" ? kgToLbs(kg) : kg;
  return `${value}`;
}

export function formatTimedDuration(seconds: number, unit: TimedUnitPref): string {
  if (unit === "minutes") {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s === 0 ? `${m}m` : `${m}m ${s}s`;
  }
  return `${seconds}s`;
}

export function formatSetValue(
  value: number | null,
  exerciseType: ExerciseType,
  displayUnit: WeightUnit,
  addedWeight?: number | null,
  timedUnit: TimedUnitPref = "seconds",
): string {
  if (value == null) return "—";

  if (exerciseType === "timed") {
    return formatTimedDuration(Math.round(value), timedUnit);
  }

  if (exerciseType === "bodyweight") {
    if (value != null && value > 0) {
      const display = displayUnit === "lbs" ? kgToLbs(value) : value;
      return `${display}`;
    }
    return "BW";
  }

  // Weighted exercise
  const display = displayUnit === "lbs" ? kgToLbs(value) : value;
  return `${display}`;
}

export function formatSetReps(reps: number | null, exerciseType: ExerciseType): string {
  if (reps != null) return String(reps);
  if (exerciseType === "timed") return "—";
  return "—";
}

/** Determine the exercise type from existing exercise data */
export function inferExerciseType(exercise: {
  bodyweight?: boolean;
  weighted?: boolean;
  category?: string;
  type?: string;
}, hasHold?: boolean): ExerciseType {
  if (hasHold) return "timed";
  if (exercise.bodyweight && !exercise.weighted) return "bodyweight";
  if (exercise.weighted) return "weighted";

  // Fallback: check category tags
  const cat = (exercise.category || "").toLowerCase();
  if (cat.includes("yoga") || cat.includes("stretch")) return "timed";
  if (cat.includes("gym") || cat.includes("weight")) return "weighted";

  return "bodyweight";
}

/** Get column headers based on exercise types visible in the current table view */
export function getColumnHeaders(
  exerciseTypes: ExerciseType[],
  grouped: boolean,
): { labels: string[]; types: ("value" | "reps")[]; keys: string[] } {
  const uniqueTypes = new Set(exerciseTypes);
  const isMixed = uniqueTypes.size > 1;
  const isAllTimed = uniqueTypes.size === 1 && uniqueTypes.has("timed");

  // Generic labels for mixed or default
  let valueLabel = "S";
  if (!isMixed) {
    if (isAllTimed) valueLabel = "T";
    else valueLabel = "W";
  }
  const repsLabel = "R";

  if (grouped) {
    return {
      labels: [`${valueLabel}1`, `${valueLabel}2`, `${valueLabel}3`, `${repsLabel}1`, `${repsLabel}2`, `${repsLabel}3`],
      types: ["value", "value", "value", "reps", "reps", "reps"],
      keys: ["val1", "val2", "val3", "reps1", "reps2", "reps3"],
    };
  }
  return {
    labels: [`${valueLabel}1`, `${repsLabel}1`, `${valueLabel}2`, `${repsLabel}2`, `${valueLabel}3`, `${repsLabel}3`],
    types: ["value", "reps", "value", "reps", "value", "reps"],
    keys: ["val1", "reps1", "val2", "reps2", "val3", "reps3"],
  };
}
