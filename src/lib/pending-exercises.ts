const PENDING_EXERCISE_MARKER = "[PENDING_EXERCISE]";
const PENDING_EXERCISE_EDITED_MARKER = "[PENDING_EXERCISE_EDITED]";
const DELETED_EXERCISE_MARKER = "[DELETED_EXERCISE]";

export function markExerciseAsPending(description: string | null | undefined): string {
  const normalized = String(description || "").trim();
  if (!normalized) return `${PENDING_EXERCISE_MARKER} `;
  if (normalized.startsWith(PENDING_EXERCISE_MARKER)) return normalized;
  return `${PENDING_EXERCISE_MARKER} ${normalized}`;
}

export function isPendingExerciseDescription(description: string | null | undefined): boolean {
  return String(description || "").trim().startsWith(PENDING_EXERCISE_MARKER);
}

export function markPendingExerciseAsEdited(description: string | null | undefined): string {
  const withPending = markExerciseAsPending(description);
  if (isPendingExerciseEditedDescription(withPending)) return withPending;
  return withPending.replace(
    PENDING_EXERCISE_MARKER,
    `${PENDING_EXERCISE_MARKER} ${PENDING_EXERCISE_EDITED_MARKER}`,
  ).trim();
}

export function isPendingExerciseEditedDescription(description: string | null | undefined): boolean {
  return String(description || "").includes(PENDING_EXERCISE_EDITED_MARKER);
}

export function markExerciseAsDeleted(description: string | null | undefined): string {
  const normalized = stripExerciseStatusMarkers(String(description || "").trim());
  if (!normalized) return `${DELETED_EXERCISE_MARKER} `;
  if (normalized.startsWith(DELETED_EXERCISE_MARKER)) return normalized;
  return `${DELETED_EXERCISE_MARKER} ${normalized}`;
}

export function isDeletedExerciseDescription(description: string | null | undefined): boolean {
  return String(description || "").trim().startsWith(DELETED_EXERCISE_MARKER);
}

export function stripDeletedExerciseMarker(description: string | null | undefined): string {
  return String(description || "").replace(DELETED_EXERCISE_MARKER, "").trim();
}

export function stripPendingExerciseEditedMarker(description: string | null | undefined): string {
  return String(description || "").replace(PENDING_EXERCISE_EDITED_MARKER, "").trim();
}

export function stripPendingExerciseMarker(description: string | null | undefined): string {
  return String(description || "").replace(PENDING_EXERCISE_MARKER, "").trim();
}

export function stripExerciseStatusMarkers(description: string | null | undefined): string {
  const withoutPending = stripPendingExerciseMarker(description);
  const withoutPendingEdited = stripPendingExerciseEditedMarker(withoutPending);
  return stripDeletedExerciseMarker(withoutPendingEdited);
}
