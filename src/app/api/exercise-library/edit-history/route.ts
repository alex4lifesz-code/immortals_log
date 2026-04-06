import { apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";

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
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ExerciseEditHistory (
      id TEXT PRIMARY KEY,
      exerciseId TEXT NOT NULL,
      exerciseName TEXT NOT NULL,
      userId TEXT NOT NULL,
      userName TEXT NOT NULL,
      field TEXT NOT NULL,
      beforeValue TEXT,
      afterValue TEXT,
      editedAt TEXT NOT NULL
    )
  `);

  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS idx_exercise_edit_history_editedAt ON ExerciseEditHistory(editedAt DESC)",
  );

  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS idx_exercise_edit_history_exerciseId ON ExerciseEditHistory(exerciseId)",
  );
}

async function backfillMissingCreatedHistoryEntries() {
  const existingHistoryRows = await prisma.$queryRawUnsafe<Array<{ exerciseId: string }>>(`
    SELECT DISTINCT exerciseId
    FROM ExerciseEditHistory
  `);

  const existingHistoryIds = new Set(existingHistoryRows.map((row) => row.exerciseId));
  const exercises = await prisma.progressionExercise.findMany({
    select: {
      id: true,
      name: true,
      userId: true,
      createdAt: true,
    },
  });

  const missingExercises = exercises.filter((exercise) => !existingHistoryIds.has(exercise.id));
  if (missingExercises.length === 0) return;

  const userIds = Array.from(new Set(missingExercises.map((exercise) => exercise.userId).filter(Boolean)));
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, username: true },
      })
    : [];
  const userNameById = new Map(users.map((user) => [user.id, (user.name || user.username || "Unknown").slice(0, 120)]));

  for (const exercise of missingExercises) {
    await prisma.$executeRawUnsafe(
      `
        INSERT OR IGNORE INTO ExerciseEditHistory (id, exerciseId, exerciseName, userId, userName, field, beforeValue, afterValue, editedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      `seed-${exercise.id}`,
      exercise.id,
      exercise.name,
      exercise.userId,
      userNameById.get(exercise.userId) ?? "Unknown",
      "Created",
      "—",
      "Exercise existed before history tracking",
      exercise.createdAt.toISOString(),
    );
  }
}

export const GET = withAuth(async () => {
  try {
    await ensureHistoryTable();
    await backfillMissingCreatedHistoryEntries();

    const rows = await prisma.$queryRawUnsafe<DbHistoryRow[]>(`
      SELECT id, exerciseId, exerciseName, userId, userName, field, beforeValue, afterValue, editedAt
      FROM ExerciseEditHistory
      ORDER BY editedAt DESC
      LIMIT 200
    `);

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

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { name: true, username: true },
    });

    const userName = (user?.name || user?.username || "Unknown").slice(0, 120);
    const editedAt = new Date().toISOString();
    const id = crypto.randomUUID();

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO ExerciseEditHistory (id, exerciseId, exerciseName, userId, userName, field, beforeValue, afterValue, editedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      id,
      exerciseId,
      exerciseName,
      auth.userId,
      userName,
      field,
      beforeValue,
      afterValue,
      editedAt,
    );

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
