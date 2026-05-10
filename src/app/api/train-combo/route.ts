import { apiSuccess, ApiErrors } from "@/lib/api";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/prisma";
import { normalizeTrainComboLogs, type TrainComboExerciseItem, type TrainComboLog } from "@/lib/train-combo";

function parseJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore invalid JSON and return a safe fallback.
  }
  return {};
}

function normalizePostExerciseItem(value: unknown): TrainComboExerciseItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const rawExerciseId = "exerciseId" in value ? value.exerciseId : null;
  const rawName = "name" in value ? value.name : null;
  const rawProgressionLevel = "progressionLevel" in value ? value.progressionLevel : null;
  const rawVariant = "variant" in value ? value.variant : null;
  const rawSetupOption = "setupOption" in value ? value.setupOption : null;

  const exerciseId = typeof rawExerciseId === "string" ? rawExerciseId.trim() : "";
  const name = typeof rawName === "string" ? rawName.trim() : "";
  const variant = typeof rawVariant === "string" ? rawVariant.trim() : "";
  const setupOption = typeof rawSetupOption === "string" ? rawSetupOption.trim() : "";
  const progressionLevel = typeof rawProgressionLevel === "number" && Number.isFinite(rawProgressionLevel)
    ? Math.max(1, Math.trunc(rawProgressionLevel))
    : null;
  if (!exerciseId || !name) return null;

  return {
    exerciseId: exerciseId.slice(0, 120),
    name: name.slice(0, 200),
    ...(progressionLevel ? { progressionLevel } : {}),
    ...(variant ? { variant: variant.slice(0, 120) } : {}),
    ...(setupOption ? { setupOption: setupOption.slice(0, 120) } : {}),
  };
}

function normalizeTrainingDate(value: unknown): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return new Date().toISOString().slice(0, 10);
}

function normalizeCreatedAt(value: unknown): string {
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date().toISOString();
}

export const GET = withAuth(async (_request, { auth }) => {
  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId: auth.userId },
      select: { pinnedNavItems: true },
    });

    const appPrefs = parseJsonObject(settings?.pinnedNavItems);
    const logs = normalizeTrainComboLogs(appPrefs.trainComboLogs);
    const routines = normalizeTrainComboLogs(appPrefs.trainComboRoutines);

    // Legacy behavior stored newly created combo routines in trainComboLogs.
    // If routines are empty but logs exist, migrate once and clear logs.
    if (routines.length === 0 && logs.length > 0 && settings) {
      const nextAppPrefs = {
        ...appPrefs,
        trainComboRoutines: logs,
        trainComboLogs: [],
      };

      await prisma.userSettings.update({
        where: { userId: auth.userId },
        data: {
          pinnedNavItems: JSON.stringify(nextAppPrefs),
        },
      });

      return apiSuccess({ logs: [], routines: logs });
    }

    return apiSuccess({ logs, routines });
  } catch (error) {
    console.error("Train combo GET error:", error);
    return ApiErrors.internal("Failed to fetch combo logs");
  }
});

export const POST = withAuth(async (request, { auth }) => {
  try {
    const body = await request.json();
    const entryType = body.entryType === "log" ? "log" : "routine";

    const routineName = typeof body.routineName === "string" ? body.routineName.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const assignedDays = typeof body.assignedDays === "string" ? body.assignedDays.trim() : "";
    const trainingDate = normalizeTrainingDate(body.trainingDate);
    const createdAt = normalizeCreatedAt(body.createdAt);
    const exercises = Array.isArray(body.exercises)
      ? body.exercises
          .map((entry: unknown) => normalizePostExerciseItem(entry))
          .filter((entry: TrainComboExerciseItem | null): entry is TrainComboExerciseItem => Boolean(entry))
      : [];

    if (routineName.length < 2) {
      return ApiErrors.badRequest("routineName must be at least 2 characters");
    }
    if (exercises.length === 0) {
      return ApiErrors.badRequest("At least one exercise is required");
    }

    const settings = await prisma.userSettings.findUnique({
      where: { userId: auth.userId },
      select: { pinnedNavItems: true, hiddenNavItems: true, panelPosition: true, dualPageView: true, combinedView: true },
    });

    const appPrefs = parseJsonObject(settings?.pinnedNavItems);
    const existingRoutines = normalizeTrainComboLogs(appPrefs.trainComboRoutines);
    const existingLogs = normalizeTrainComboLogs(appPrefs.trainComboLogs);

    const entry: TrainComboLog = {
      id: crypto.randomUUID(),
      routineName: routineName.slice(0, 140),
      notes: notes ? notes.slice(0, 1000) : null,
      trainingDate,
      createdAt,
      ...(assignedDays ? { assignedDays: assignedDays.slice(0, 1500) } : {}),
      exercises: exercises.slice(0, 32),
    };

    const nextRoutines = entryType === "routine" ? [entry, ...existingRoutines].slice(0, 250) : existingRoutines;
    const nextLogs = entryType === "log" ? [entry, ...existingLogs].slice(0, 500) : existingLogs;
    const nextAppPrefs = {
      ...appPrefs,
      trainComboRoutines: nextRoutines,
      trainComboLogs: nextLogs,
    };

    await prisma.userSettings.upsert({
      where: { userId: auth.userId },
      create: {
        userId: auth.userId,
        pinnedNavItems: JSON.stringify(nextAppPrefs),
        hiddenNavItems: settings?.hiddenNavItems ?? "{}",
        panelPosition: settings?.panelPosition ?? "left",
        dualPageView: settings?.dualPageView ?? false,
        combinedView: settings?.combinedView ?? false,
      },
      update: {
        pinnedNavItems: JSON.stringify(nextAppPrefs),
      },
    });

    return apiSuccess({ entry, entryType, routines: nextRoutines, logs: nextLogs });
  } catch (error) {
    console.error("Train combo POST error:", error);
    return ApiErrors.internal("Failed to save combo log");
  }
});

export const PUT = withAuth(async (request, { auth }) => {
  try {
    const body = await request.json();

    const id = typeof body.id === "string" ? body.id.trim() : "";
    const routineName = typeof body.routineName === "string" ? body.routineName.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const hasAssignedDays = typeof body.assignedDays === "string";
    const assignedDaysInput = hasAssignedDays ? body.assignedDays.trim() : "";
    const trainingDate = normalizeTrainingDate(body.trainingDate);
    const exercises = Array.isArray(body.exercises)
      ? body.exercises
          .map((entry: unknown) => normalizePostExerciseItem(entry))
          .filter((entry: TrainComboExerciseItem | null): entry is TrainComboExerciseItem => Boolean(entry))
      : [];

    if (!id) {
      return ApiErrors.badRequest("Routine id is required");
    }
    if (routineName.length < 2) {
      return ApiErrors.badRequest("routineName must be at least 2 characters");
    }
    if (exercises.length === 0) {
      return ApiErrors.badRequest("At least one exercise is required");
    }

    const settings = await prisma.userSettings.findUnique({
      where: { userId: auth.userId },
      select: { pinnedNavItems: true, hiddenNavItems: true, panelPosition: true, dualPageView: true, combinedView: true },
    });

    const appPrefs = parseJsonObject(settings?.pinnedNavItems);
    const existingRoutines = normalizeTrainComboLogs(appPrefs.trainComboRoutines);
    const targetIndex = existingRoutines.findIndex((routine) => routine.id === id);

    if (targetIndex === -1) {
      return ApiErrors.notFound("Combo routine not found");
    }

    const current = existingRoutines[targetIndex];
    const assignedDays = hasAssignedDays ? assignedDaysInput : (current.assignedDays || "");
    const updated: TrainComboLog = {
      id: current.id,
      routineName: routineName.slice(0, 140),
      notes: notes ? notes.slice(0, 1000) : null,
      trainingDate,
      createdAt: current.createdAt,
      ...(assignedDays ? { assignedDays: assignedDays.slice(0, 1500) } : {}),
      exercises: exercises.slice(0, 32),
    };

    const nextRoutines = [...existingRoutines];
    nextRoutines[targetIndex] = updated;

    const nextAppPrefs = {
      ...appPrefs,
      trainComboRoutines: nextRoutines,
    };

    await prisma.userSettings.upsert({
      where: { userId: auth.userId },
      create: {
        userId: auth.userId,
        pinnedNavItems: JSON.stringify(nextAppPrefs),
        hiddenNavItems: settings?.hiddenNavItems ?? "{}",
        panelPosition: settings?.panelPosition ?? "left",
        dualPageView: settings?.dualPageView ?? false,
        combinedView: settings?.combinedView ?? false,
      },
      update: {
        pinnedNavItems: JSON.stringify(nextAppPrefs),
      },
    });

    return apiSuccess({ routine: updated, routines: nextRoutines });
  } catch (error) {
    console.error("Train combo PUT error:", error);
    return ApiErrors.internal("Failed to update combo routine");
  }
});

export const DELETE = withAuth(async (request, { auth }) => {
  try {
    const url = new URL(request.url);
    const queryId = (url.searchParams.get("id") || "").trim();

    let bodyId = "";
    try {
      const body = await request.json();
      bodyId = typeof body?.id === "string" ? body.id.trim() : "";
    } catch {
      // Body is optional for DELETE.
    }

    const id = queryId || bodyId;
    if (!id) {
      return ApiErrors.badRequest("Routine id is required");
    }

    const settings = await prisma.userSettings.findUnique({
      where: { userId: auth.userId },
      select: { pinnedNavItems: true, hiddenNavItems: true, panelPosition: true, dualPageView: true, combinedView: true },
    });

    const appPrefs = parseJsonObject(settings?.pinnedNavItems);
    const existingRoutines = normalizeTrainComboLogs(appPrefs.trainComboRoutines);
    const nextRoutines = existingRoutines.filter((routine) => routine.id !== id);

    if (nextRoutines.length === existingRoutines.length) {
      return ApiErrors.notFound("Combo routine not found");
    }

    const nextAppPrefs = {
      ...appPrefs,
      trainComboRoutines: nextRoutines,
    };

    await prisma.userSettings.upsert({
      where: { userId: auth.userId },
      create: {
        userId: auth.userId,
        pinnedNavItems: JSON.stringify(nextAppPrefs),
        hiddenNavItems: settings?.hiddenNavItems ?? "{}",
        panelPosition: settings?.panelPosition ?? "left",
        dualPageView: settings?.dualPageView ?? false,
        combinedView: settings?.combinedView ?? false,
      },
      update: {
        pinnedNavItems: JSON.stringify(nextAppPrefs),
      },
    });

    return apiSuccess({ routines: nextRoutines });
  } catch (error) {
    console.error("Train combo DELETE error:", error);
    return ApiErrors.internal("Failed to delete combo routine");
  }
});
