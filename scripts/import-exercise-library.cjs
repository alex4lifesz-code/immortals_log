/**
 * import-exercise-library.cjs
 *
 * Imports all exercises from seed-data/exercise-library-full.json into the
 * ProgressionExercise table for the admin user using @libsql/client directly.
 *
 * Usage:
 *   node scripts/import-exercise-library.cjs [username]
 *   Default username: admin
 */

const { createClient } = require("@libsql/client");
const crypto = require("crypto");
const { readFileSync } = require("fs");
const { resolve } = require("path");

const TARGET_USERNAME = process.argv[2] || "admin";
const APP_LIBRARY_USERNAME = "__app_exercise_library__";
const APP_LIBRARY_NAME = "Application Exercise Library";
const DB_URL = process.env.DATABASE_URL || "file:./dev.db";

function cuid() {
  return "c" + crypto.randomBytes(12).toString("hex").slice(0, 24);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function withRetry(fn, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i < retries - 1 && String(err.message || err).includes("SQLITE_BUSY")) {
        await sleep(200 * (i + 1));
        continue;
      }
      throw err;
    }
  }
}

async function ensureTargetUser(client) {
  const userResult = await client.execute({
    sql: "SELECT id FROM User WHERE username = ?",
    args: [TARGET_USERNAME],
  });

  if (userResult.rows.length > 0) {
    return String(userResult.rows[0].id);
  }

  if (TARGET_USERNAME !== APP_LIBRARY_USERNAME) {
    throw new Error(`User "${TARGET_USERNAME}" not found.`);
  }

  const userId = cuid();
  const now = new Date().toISOString();
  const friendCode = crypto.randomBytes(6).toString("hex");

  await client.execute({
    sql: `INSERT INTO User (id, friendCode, username, password, name, role, onboardingCompleted, onboardingSkipped, onboardingStep, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      userId,
      friendCode,
      APP_LIBRARY_USERNAME,
      `system:${crypto.randomBytes(16).toString("hex")}`,
      APP_LIBRARY_NAME,
      "system",
      1,
      1,
      0,
      now,
      now,
    ],
  });

  console.log(`Created ${APP_LIBRARY_NAME} owner (${userId})`);
  return userId;
}

async function main() {
  const seedPath = resolve(__dirname, "../seed-data/exercise-library-full.json");
  const raw = readFileSync(seedPath, "utf-8");
  const seedData = JSON.parse(raw);

  console.log(`\nLoaded ${seedData.exercises.length} exercises from seed file (v${seedData.version})\n`);

  const client = createClient({ url: DB_URL });

  // Enable WAL mode to reduce locking conflicts
  await client.execute("PRAGMA journal_mode=WAL");
  await client.execute("PRAGMA busy_timeout=5000");

  const userId = await ensureTargetUser(client);
  console.log(`Target user: ${TARGET_USERNAME} (${userId})\n`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const row of seedData.exercises) {
    const progression = [...new Set(row.progression.map(s => s.trim()).filter(Boolean))];
    const variations = [...new Set(row.variations.map(s => s.trim()).filter(Boolean))];

    try {
      await withRetry(async () => {
        // Check if exists
        const existing = await client.execute({
          sql: "SELECT id FROM ProgressionExercise WHERE userId = ? AND name = ?",
          args: [userId, row.name],
        });

        let exerciseId;
        let isNew = false;

        if (existing.rows.length === 0) {
          exerciseId = cuid();
          isNew = true;
        } else {
          exerciseId = String(existing.rows[0].id);
        }

        // Build all statements for a batch transaction
        const stmts = [];

        if (isNew) {
          const now = new Date().toISOString();
          stmts.push({
            sql: `INSERT INTO ProgressionExercise (id, name, wuxiaName, difficulty, wuxiaDifficulty, type, wuxiaType, story, tips, category, equipmentType, bodyweight, weighted, rings, primaryMuscles, secondaryMuscles, prerequisites, cues, commonMistakes, breathing, safetyConsiderations, competitionStandards, progression, assignedDays, userId, createdAt)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              exerciseId, row.name, row.name, "", "", "", "", "", "[]",
              row.category, row.equipmentType,
              row.bodyweight ? 1 : 0, row.weighted ? 1 : 0, row.rings ? 1 : 0,
              row.primaryMuscles, "",
              "[]", "[]", "[]", "", "[]", "{}",
              JSON.stringify(progression), "", userId, now,
            ],
          });
        } else {
          stmts.push({
            sql: `UPDATE ProgressionExercise SET category = ?, equipmentType = ?, bodyweight = ?, weighted = ?, rings = ?, primaryMuscles = ?, progression = ? WHERE id = ?`,
            args: [
              row.category, row.equipmentType,
              row.bodyweight ? 1 : 0, row.weighted ? 1 : 0, row.rings ? 1 : 0,
              row.primaryMuscles, JSON.stringify(progression), exerciseId,
            ],
          });
        }

        // Delete old tiers/variations
        stmts.push({ sql: "DELETE FROM ProgressionTier WHERE exerciseId = ?", args: [exerciseId] });
        stmts.push({ sql: "DELETE FROM ProgressionVariation WHERE exerciseId = ?", args: [exerciseId] });

        // Insert tiers
        for (let i = 0; i < progression.length; i++) {
          stmts.push({
            sql: `INSERT INTO ProgressionTier (id, exerciseId, level, name, wuxiaName, difficulty, wuxiaDifficulty, wuxiaType, description, targetHold, targetReps, targetRepsText)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [cuid(), exerciseId, i + 1, progression[i], progression[i], "", "", "", "", null, null, ""],
          });
        }

        // Insert variations
        for (const v of variations) {
          stmts.push({
            sql: `INSERT INTO ProgressionVariation (id, exerciseId, name, wuxiaName, difficulty, wuxiaDifficulty, wuxiaType, description)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [cuid(), exerciseId, v, v, "", "", "", ""],
          });
        }

        // Ensure UserProgressionLevel
        const existingProgress = await client.execute({
          sql: "SELECT id FROM UserProgressionLevel WHERE userId = ? AND exerciseId = ?",
          args: [userId, exerciseId],
        });
        if (existingProgress.rows.length === 0) {
          const now = new Date().toISOString();
          stmts.push({
            sql: `INSERT INTO UserProgressionLevel (id, userId, exerciseId, currentLevel, createdAt, updatedAt)
                  VALUES (?, ?, ?, ?, ?, ?)`,
            args: [cuid(), userId, exerciseId, 1, now, now],
          });
        }

        await client.batch(stmts, "write");

        if (isNew) created++;
        else updated++;
      });
    } catch (err) {
      console.error(`  Error: ${row.name}: ${err.message || err}`);
      errors++;
    }
  }

  console.log("\nExercise library import complete.");
  console.log(`  Total: ${seedData.exercises.length}`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  if (errors > 0) console.log(`  Errors: ${errors}`);

  client.close();
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
