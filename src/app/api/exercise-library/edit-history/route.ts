import { apiSuccess, ApiErrors } from "@/lib/api";
import { withAuth } from "@/lib/auth/middleware";
import {
  ensureExerciseEditHistoryTable,
  findUserDisplayNameById,
  findUsersForHistoryBackfill,
  insertExerciseEditHistoryRow,
  listExerciseEditHistoryExerciseIds,
  listExerciseEditHistoryRows,
  listProgressionExercisesForHistoryBackfill,
} from "@/lib/repositories/exercise-library.repository";

type DbHistoryRow = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  userId: string;
  userName: string;
  field: string;
  beforeValue: string | null;
  afterValue: string | null;
  editedAt: string;
};

async function ensureHistoryTable() {
  await ensureExerciseEditHistoryTable();
}

async function backfillMissingCreatedHistoryEntries() {
  const existingHistoryRows = await listExerciseEditHistoryExerciseIds();

  const existingHistoryIds = new Set(existingHistoryRows.map((row) => row.exerciseId));
  const exercises = await listProgressionExercisesForHistoryBackfill();

  const missingExercises = exercises.filter((exercise) => !existingHistoryIds.has(exercise.id));
  if (missingExercises.length === 0) return;

  const userIds = Array.from(new Set(missingExercises.map((exercise) => exercise.userId).filter(Boolean)));
  const users = userIds.length > 0 ? await findUsersForHistoryBackfill(userIds) : [];
  const userNameById = new Map(users.map((user) => [user.id, (user.name || user.username || "Unknown").slice(0, 120)]));

  for (const exercise of missingExercises) {
    await insertExerciseEditHistoryRow({
      id: `seed-${exercise.id}`,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      userId: exercise.userId,
      userName: userNameById.get(exercise.userId) ?? "Unknown",
      field: "Created",
      beforeValue: "—",
      afterValue: "Exercise existed before history tracking",
      editedAt: exercise.createdAt.toISOString(),
    });
  }
}

export const GET = withAuth(async () => {
  try {
    await ensureHistoryTable();
    await backfillMissingCreatedHistoryEntries();

    const rows = await listExerciseEditHistoryRows(200) as DbHistoryRow[];

    const history = rows.map((row) => ({
      id: row.id,
      exerciseId: row.exerciseId,
      exerciseName: row.exerciseName,
      userName: row.userName,
      field: row.field,
      beforeValue: row.beforeValue ?? "",
      afterValue: row.afterValue ?? "",
      editedAt: row.editedAt,
    }));

    const lastEditedById: Record<string, string> = {};
    for (const entry of history) {
      if (!lastEditedById[entry.exerciseId]) {
        lastEditedById[entry.exerciseId] = entry.editedAt;
      }
    }

    return apiSuccess({ history, lastEditedById });
  } catch (error) {
    console.error("Exercise edit history fetch error:", error);
    return ApiErrors.internal("Failed to fetch edit history");
  }
});

export const POST = withAuth(async (req, { auth }) => {
  try {
    await ensureHistoryTable();

    const body = await req.json();
    const exerciseId = String(body.exerciseId || "").trim();
    const exerciseName = String(body.exerciseName || "").trim().slice(0, 200);
    const field = String(body.field || "").trim().slice(0, 50);
    const beforeValue = String(body.beforeValue || "").trim().slice(0, 500);
    const afterValue = String(body.afterValue || "").trim().slice(0, 500);

    if (!exerciseId || !exerciseName || !field) {
      return ApiErrors.badRequest("exerciseId, exerciseName, and field are required");
    }

    const user = await findUserDisplayNameById(auth.userId);

    const userName = (user?.name || user?.username || "Unknown").slice(0, 120);
    const editedAt = new Date().toISOString();
    const id = crypto.randomUUID();

    await insertExerciseEditHistoryRow({
      id,
      exerciseId,
      exerciseName,
      userId: auth.userId,
      userName,
      field,
      beforeValue,
      afterValue,
      editedAt,
    });

    return apiSuccess({
      entry: {
        id,
        exerciseId,
        exerciseName,
        userName,
        field,
        beforeValue,
        afterValue,
        editedAt,
      },
    });
  } catch (error) {
    console.error("Exercise edit history write error:", error);
    return ApiErrors.internal("Failed to save edit history");
  }
});
