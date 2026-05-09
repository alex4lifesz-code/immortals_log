export type TrainComboExerciseItem = {
  exerciseId: string;
  name: string;
  progressionLevel?: number;
  variant?: string;
};

export type TrainComboLog = {
  id: string;
  routineName: string;
  notes: string | null;
  trainingDate: string;
  createdAt: string;
  assignedDays?: string;
  exercises: TrainComboExerciseItem[];
};

function normalizeExerciseItem(value: unknown): TrainComboExerciseItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const rawId = "exerciseId" in value ? value.exerciseId : null;
  const rawName = "name" in value ? value.name : null;
  const rawProgressionLevel = "progressionLevel" in value ? value.progressionLevel : null;
  const rawVariant = "variant" in value ? value.variant : null;
  const exerciseId = typeof rawId === "string" ? rawId.trim() : "";
  const name = typeof rawName === "string" ? rawName.trim() : "";
  const variant = typeof rawVariant === "string" ? rawVariant.trim() : "";
  const progressionLevel = typeof rawProgressionLevel === "number" && Number.isFinite(rawProgressionLevel)
    ? Math.max(1, Math.trunc(rawProgressionLevel))
    : null;

  if (!exerciseId || !name) return null;
  return {
    exerciseId: exerciseId.slice(0, 120),
    name: name.slice(0, 200),
    ...(progressionLevel ? { progressionLevel } : {}),
    ...(variant ? { variant: variant.slice(0, 120) } : {}),
  };
}

function normalizeTrainingDate(value: unknown): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return new Date().toISOString().slice(0, 10);
}

function normalizeIsoDate(value: unknown): string {
  if (typeof value !== "string") return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

export function normalizeTrainComboLog(value: unknown): TrainComboLog | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const rawId = "id" in value ? value.id : null;
  const rawRoutineName = "routineName" in value ? value.routineName : null;
  const rawNotes = "notes" in value ? value.notes : null;
  const rawTrainingDate = "trainingDate" in value ? value.trainingDate : null;
  const rawCreatedAt = "createdAt" in value ? value.createdAt : null;
  const rawAssignedDays = "assignedDays" in value ? value.assignedDays : null;
  const rawExercises = "exercises" in value ? value.exercises : null;

  const id = typeof rawId === "string" ? rawId.trim() : "";
  const routineName = typeof rawRoutineName === "string" ? rawRoutineName.trim() : "";
  const notes = typeof rawNotes === "string" ? rawNotes.trim() : "";
  const assignedDays = typeof rawAssignedDays === "string" ? rawAssignedDays.trim() : "";
  const exercises = Array.isArray(rawExercises)
    ? rawExercises.map((entry) => normalizeExerciseItem(entry)).filter((entry): entry is TrainComboExerciseItem => Boolean(entry))
    : [];

  if (!id || !routineName || exercises.length === 0) return null;

  return {
    id: id.slice(0, 120),
    routineName: routineName.slice(0, 140),
    notes: notes ? notes.slice(0, 1000) : null,
    trainingDate: normalizeTrainingDate(rawTrainingDate),
    createdAt: normalizeIsoDate(rawCreatedAt),
    ...(assignedDays ? { assignedDays: assignedDays.slice(0, 1500) } : {}),
    exercises,
  };
}

export function normalizeTrainComboLogs(value: unknown): TrainComboLog[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeTrainComboLog(entry))
    .filter((entry): entry is TrainComboLog => Boolean(entry))
    .sort((left, right) => {
      const leftMs = new Date(left.createdAt).getTime();
      const rightMs = new Date(right.createdAt).getTime();
      if (rightMs !== leftMs) return rightMs - leftMs;
      return right.id.localeCompare(left.id);
    });
}
