const crypto = require("crypto");
const { createClient } = require("@libsql/client");

const USERNAME = process.argv[2] || "admin";

function newId() {
  return crypto.randomUUID().replace(/-/g, "");
}

async function ensureProgressionExercise(client, userId, exerciseRow, progressionByName) {
  const key = String(exerciseRow.name).trim().toLowerCase();
  if (progressionByName.has(key)) {
    return progressionByName.get(key);
  }

  const peId = newId();
  await client.execute({
    sql: `
      INSERT INTO ProgressionExercise
      (id, name, wuxiaName, difficulty, wuxiaDifficulty, type, wuxiaType, story, tips, category, equipmentType, bodyweight, weighted, rings, primaryMuscles, secondaryMuscles, prerequisites, cues, commonMistakes, breathing, safetyConsiderations, competitionStandards, assignedDays, createdAt, userId)
      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, 1, 0, 0, ?, ?, '[]', '[]', '[]', '', '[]', '{}', '', CURRENT_TIMESTAMP, ?)
    `,
    args: [
      peId,
      exerciseRow.name,
      exerciseRow.wuxiaName || "",
      exerciseRow.difficulty || "Immortal",
      exerciseRow.difficulty || "Immortal",
      exerciseRow.type || "Heaven and Earth United",
      exerciseRow.type || "Heaven and Earth United",
      exerciseRow.story || "",
      exerciseRow.targetGroup || "Imported",
      "mixed",
      exerciseRow.targetGroup || "General",
      "",
      userId,
    ],
  });

  progressionByName.set(key, {
    id: peId,
    name: exerciseRow.name,
  });

  return progressionByName.get(key);
}

async function ensureUserProgression(client, userId, exerciseId, upByExerciseId) {
  if (upByExerciseId.has(exerciseId)) {
    return upByExerciseId.get(exerciseId);
  }

  const upId = newId();
  await client.execute({
    sql: `
      INSERT INTO UserProgressionLevel (id, userId, exerciseId, currentLevel, createdAt, updatedAt)
      VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    args: [upId, userId, exerciseId],
  });

  const created = { id: upId, currentLevel: 1 };
  upByExerciseId.set(exerciseId, created);
  return created;
}

async function logExists(client, userProgressionId, level, createdAt, row) {
  const res = await client.execute({
    sql: `
      SELECT COUNT(*) AS c
      FROM ProgressionLog
      WHERE userProgressionId = ?
        AND level = ?
        AND createdAt = ?
        AND IFNULL(weight1, -1) = IFNULL(?, -1)
        AND IFNULL(reps1, -1) = IFNULL(?, -1)
        AND IFNULL(weight2, -1) = IFNULL(?, -1)
        AND IFNULL(reps2, -1) = IFNULL(?, -1)
        AND IFNULL(weight3, -1) = IFNULL(?, -1)
        AND IFNULL(reps3, -1) = IFNULL(?, -1)
        AND IFNULL(holdTime, -1) = IFNULL(?, -1)
        AND IFNULL(notes, '') = IFNULL(?, '')
    `,
    args: [
      userProgressionId,
      level,
      createdAt,
      row.weight1,
      row.reps1,
      row.weight2,
      row.reps2,
      row.weight3,
      row.reps3,
      row.holdTime,
      row.notes,
    ],
  });
  return Number(res.rows[0].c) > 0;
}

(async function run() {
  const client = createClient({ url: "file:./dev.db" });

  try {
    const userRes = await client.execute({
      sql: "SELECT id, username FROM User WHERE username = ? LIMIT 1",
      args: [USERNAME],
    });

    if (userRes.rows.length === 0) {
      throw new Error(`User not found: ${USERNAME}`);
    }

    const userId = String(userRes.rows[0].id);

    const exerciseRows = await client.execute("SELECT id, name, IFNULL(wuxiaName, '') AS wuxiaName, difficulty, type, IFNULL(story, '') AS story, IFNULL(targetGroup, '') AS targetGroup FROM Exercise");
    const exerciseById = new Map(exerciseRows.rows.map((r) => [String(r.id), r]));

    const progressionRows = await client.execute({
      sql: "SELECT id, name FROM ProgressionExercise WHERE userId = ?",
      args: [userId],
    });
    const progressionByName = new Map(
      progressionRows.rows.map((r) => [String(r.name).trim().toLowerCase(), { id: String(r.id), name: String(r.name) }])
    );

    const upRows = await client.execute({
      sql: "SELECT id, exerciseId, currentLevel FROM UserProgressionLevel WHERE userId = ?",
      args: [userId],
    });
    const upByExerciseId = new Map(
      upRows.rows.map((r) => [String(r.exerciseId), { id: String(r.id), currentLevel: Number(r.currentLevel) || 1 }])
    );

    const importedRows = await client.execute({
      sql: `
        SELECT
          w.id AS workoutId,
          w.date,
          w.notes AS workoutNotes,
          s.id AS setId,
          s.exerciseId,
          s.weight1,
          s.reps1,
          s.weight2,
          s.reps2,
          s.weight3,
          s.reps3,
          s.holdTime,
          s.notes AS setNotes
        FROM Workout w
        JOIN SimplifiedWorkoutExercise s ON s.workoutId = w.id
        WHERE w.userId = ?
        ORDER BY w.date ASC, s.createdAt ASC
      `,
      args: [userId],
    });

    let createdProgressionExercises = 0;
    let createdUserProgressions = 0;
    let insertedLogs = 0;
    let skippedExistingLogs = 0;

    for (const row of importedRows.rows) {
      const exerciseId = String(row.exerciseId);
      const exercise = exerciseById.get(exerciseId);
      if (!exercise) continue;

      let progression = progressionByName.get(String(exercise.name).trim().toLowerCase());
      if (!progression) {
        progression = await ensureProgressionExercise(client, userId, exercise, progressionByName);
        createdProgressionExercises++;
      }

      let userProgress = upByExerciseId.get(progression.id);
      if (!userProgress) {
        userProgress = await ensureUserProgression(client, userId, progression.id, upByExerciseId);
        createdUserProgressions++;
      }

      const payload = {
        weight1: row.weight1 == null ? null : Number(row.weight1),
        reps1: row.reps1 == null ? null : Number(row.reps1),
        weight2: row.weight2 == null ? null : Number(row.weight2),
        reps2: row.reps2 == null ? null : Number(row.reps2),
        weight3: row.weight3 == null ? null : Number(row.weight3),
        reps3: row.reps3 == null ? null : Number(row.reps3),
        holdTime: row.holdTime == null ? null : Number(row.holdTime),
        notes: (row.setNotes || row.workoutNotes || "") ? String(row.setNotes || row.workoutNotes || "").trim() : null,
      };

      const createdAt = String(row.date);
      const level = Math.max(1, Number(userProgress.currentLevel) || 1);

      const exists = await logExists(client, userProgress.id, level, createdAt, payload);
      if (exists) {
        skippedExistingLogs++;
        continue;
      }

      await client.execute({
        sql: `
          INSERT INTO ProgressionLog
          (id, userProgressionId, level, weight1, reps1, weight2, reps2, weight3, reps3, holdTime, holdTime2, holdTime3, reps, modifier, variant, notes, completed, createdAt)
          VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, 0, ?)
        `,
        args: [
          newId(),
          userProgress.id,
          level,
          payload.weight1,
          payload.reps1,
          payload.weight2,
          payload.reps2,
          payload.weight3,
          payload.reps3,
          payload.holdTime,
          payload.notes,
          createdAt,
        ],
      });

      insertedLogs++;
    }

    console.log("Backfill complete");
    console.log(`User: ${USERNAME}`);
    console.log(`Imported workout rows scanned: ${importedRows.rows.length}`);
    console.log(`Progression exercises created: ${createdProgressionExercises}`);
    console.log(`User progression levels created: ${createdUserProgressions}`);
    console.log(`Progression logs inserted: ${insertedLogs}`);
    console.log(`Skipped existing logs: ${skippedExistingLogs}`);
  } finally {
    client.close();
  }
})().catch((err) => {
  console.error("Backfill failed:", err.message);
  process.exit(1);
});
