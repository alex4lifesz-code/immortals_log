import { apiSuccess, ApiErrors } from "@/lib/api";
import { withAuth } from "@/lib/auth/middleware";
import { isDeletedExerciseDescription } from "@/lib/pending-exercises";
import {
  findProgressionExerciseLightById,
  findProgressionLogsWithOwnerByIds,
  updateProgressionLogById,
  upsertUserProgressionForExercise,
} from "@/lib/repositories/progression.repository";

interface LogUpdate {
  id: string;
  exerciseId?: string | null;
  level?: number | null;
  weight1: number | null;
  reps1: number | null;
  weight2: number | null;
  reps2: number | null;
  weight3: number | null;
  reps3: number | null;
  holdTime: number | null;
  holdTime2: number | null;
  holdTime3: number | null;
  modifier: string | null;
  variant: string | null;
  setupOption: string | null;
  notes: string | null;
  sets?: Array<{
    value: number | null;
    reps: number | null;
    metric?: "weight" | "time";
  }>;
}

function extractBaseNotes(value: string | null | undefined): string {
  if (!value) return "";
  const normalized = String(value).trim();
  if (!normalized) return "";

  const markerIndex = normalized.indexOf("\n\nExtra sets:");
  if (markerIndex >= 0) {
    return normalized.slice(0, markerIndex).trim();
  }

  if (normalized.startsWith("Extra sets:")) {
    return "";
  }

  return normalized;
}

function buildDynamicSetSummary(sets: LogUpdate["sets"]): string {
  if (!Array.isArray(sets)) return "";

  return sets
    .slice(3)
    .map((entry, index) => {
      const rawValue = entry?.value;
      const rawReps = entry?.reps;
      const hasValue = typeof rawValue === "number" && Number.isFinite(rawValue);
      const hasReps = typeof rawReps === "number" && Number.isFinite(rawReps);
      const unit = entry?.metric === "time" ? "s" : "kg";
      const valueLabel = hasValue ? `${rawValue}${unit}` : "-";
      const repsLabel = hasReps ? `${Math.trunc(rawReps)} reps` : "-";
      return `Set ${index + 4}: ${valueLabel} / ${repsLabel}`;
    })
    .join(" | ");
}

export const POST = withAuth(async (request, { auth }) => {
  try {
    const { updates } = await request.json() as { updates: LogUpdate[] };
    const callerUserId = auth.userId;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return ApiErrors.badRequest("Updates array is required and must not be empty");
    }

    for (const update of updates) {
      if (!update.id) {
        return ApiErrors.badRequest("Log ID is required for all updates");
      }

      // Validate weight ranges
      for (const field of ["weight1", "weight2", "weight3"] as const) {
        const val = update[field];
        if (val !== null && val !== undefined && (val < 0 || val > 10000)) {
          return ApiErrors.badRequest(`${field} must be between 0 and 10000`);
        }
      }

      // Validate reps ranges
      for (const field of ["reps1", "reps2", "reps3"] as const) {
        const val = update[field];
        if (val !== null && val !== undefined && (val < 0 || val > 500)) {
          return ApiErrors.badRequest(`${field} must be between 0 and 500`);
        }
      }

      // Validate hold time ranges
      for (const field of ["holdTime", "holdTime2", "holdTime3"] as const) {
        const val = update[field];
        if (val !== null && val !== undefined && (val < 0 || val > 9999)) {
          return ApiErrors.badRequest(`${field} must be between 0 and 9999`);
        }
      }

      if (update.sets != null && !Array.isArray(update.sets)) {
        return ApiErrors.badRequest("sets must be an array when provided");
      }

      if (Array.isArray(update.sets)) {
        for (const set of update.sets) {
          if (set == null || typeof set !== "object") {
            return ApiErrors.badRequest("each set must be an object");
          }

          const value = set.value;
          const reps = set.reps;

          if (value !== null && value !== undefined && (!Number.isFinite(value) || value < 0 || value > 10000)) {
            return ApiErrors.badRequest("set value must be between 0 and 10000");
          }

          if (reps !== null && reps !== undefined && (!Number.isFinite(reps) || reps < 0 || reps > 500)) {
            return ApiErrors.badRequest("set reps must be between 0 and 500");
          }

          if (set.metric != null && set.metric !== "weight" && set.metric !== "time") {
            return ApiErrors.badRequest("set metric must be either 'weight' or 'time'");
          }
        }
      }

      if (update.level !== null && update.level !== undefined) {
        if (!Number.isFinite(update.level) || update.level < 1 || update.level > 999) {
          return ApiErrors.badRequest("level must be between 1 and 999");
        }
      }
    }

    // Verify ownership: users can only edit their own logs
    const logIds = updates.map(u => u.id);
    const logs = await findProgressionLogsWithOwnerByIds(logIds);

    if (logs.length !== logIds.length) {
      return ApiErrors.notFound("One or more log records not found");
    }

    for (const log of logs) {
      if (log.userProgression.userId !== callerUserId) {
        return ApiErrors.forbidden("Unauthorized");
      }
    }

    const logById = new Map(logs.map((log) => [log.id, log]));

    for (const update of updates) {
      const existingLog = logById.get(update.id);
      if (!existingLog) {
        return ApiErrors.notFound("One or more log records not found");
      }

      let nextUserProgressionId: string | undefined;
      const requestedExerciseId = typeof update.exerciseId === "string" ? update.exerciseId.trim() : "";
      if (requestedExerciseId) {
        const requestedExercise = await findProgressionExerciseLightById(requestedExerciseId);

        if (!requestedExercise || isDeletedExerciseDescription(requestedExercise.story)) {
          return ApiErrors.notFound("Exercise not found");
        }

        const currentExerciseId = existingLog.userProgression.exerciseId;
        if (currentExerciseId !== requestedExerciseId) {
          const linkedProgression = await upsertUserProgressionForExercise({
            userId: callerUserId,
            exerciseId: requestedExerciseId,
            currentLevel: update.level != null ? Math.max(1, Math.floor(update.level)) : existingLog.level,
          });

          nextUserProgressionId = linkedProgression.id;
        }
      }

      const dynamicSetSummary = buildDynamicSetSummary(update.sets);
      const baseNotes = extractBaseNotes(update.notes);
      const notesWithDynamicSets = [
        baseNotes,
        dynamicSetSummary ? `Extra sets: ${dynamicSetSummary}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      await updateProgressionLogById(update.id, {
        userProgressionId: nextUserProgressionId,
        level: update.level != null ? Math.floor(update.level) : undefined,
        weight1: update.weight1,
        reps1: update.reps1,
        weight2: update.weight2,
        reps2: update.reps2,
        weight3: update.weight3,
        reps3: update.reps3,
        holdTime: update.holdTime,
        holdTime2: update.holdTime2,
        holdTime3: update.holdTime3,
        modifier: update.modifier ? String(update.modifier).trim().slice(0, 100) : null,
        variant: update.variant ? String(update.variant).trim().slice(0, 200) : null,
        setupOption: update.setupOption ? String(update.setupOption).trim().slice(0, 100) : null,
        notes: notesWithDynamicSets ? notesWithDynamicSets.slice(0, 1000) : null,
      });
    }

    return apiSuccess({ success: true, message: "Progression logs updated successfully" });
  } catch (error) {
    console.error("Progression log update error:", error);
    return ApiErrors.internal("Failed to update progression logs");
  }
});
