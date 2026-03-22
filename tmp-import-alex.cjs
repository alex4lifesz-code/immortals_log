const crypto = require("crypto");
const XLSX = require("xlsx");
const { createClient } = require("@libsql/client");
require("dotenv/config");

const USERNAME = process.argv[2] || "admin";
const XLSX_PATH = process.argv[3] || "./alexworkout.xlsx";

const EXERCISE_RENAMES = {
  "Pull Up": "Pull-Up",
  "Cable Row": "Seated Cable Row",
  "Dumbbell Curl": "Dumbbell Bicep Curl",
  "Seated Leg Curl": "Leg Curl",
  "Seated Leg Extension": "Leg Extension",
};

const SOURCE_VARIANT = {
  "High Pull-Ups": "High Pull-Up",
  "Chin-Ups": "Chin-Up",
  "1-Arm Pull-Up Negatives": "1-Arm Pull-Up Negative",
  "Front Lever Negatives": "Full Negative",
  "Tucked Front Lever Negatives": "Tucked Negative",
  "Front Lever Hold (seconds)": "Hold",
  "Ice Cream Maker": "Ice Cream Maker",
  "Tucked Presses": "Tucked Press",
  "Tucked Planche Presses": "Tucked Planche Press",
};

const SOURCE_MODIFIER = {
  "Weighted Pull-Ups": "weighted",
};

function newId() {
  return crypto.randomUUID().replace(/-/g, "");
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ");
}

function toNullableFloat(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toNullableInt(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

function toISODate(value, offsetMs = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const utcDays = Math.floor(value) - 25569;
    return new Date(utcDays * 86400 * 1000 + 43200000 + offsetMs).toISOString();
  }

  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + offsetMs).toISOString();
}

function inferExerciseDefaults(name) {
  const n = normalizeName(name);
  if (n.includes("squat") || n.includes("deadlift") || n.includes("leg") || n.includes("calf")) {
    return { category: "Legs", equipmentType: "machine", bodyweight: 0, weighted: 1, primaryMuscles: "Legs" };
  }
  if (n.includes("pull") || n.includes("row") || n.includes("curl") || n.includes("lever") || n.includes("lat")) {
    return { category: "Pull", equipmentType: "bar", bodyweight: 1, weighted: 0, primaryMuscles: "Back,Biceps" };
  }
  if (n.includes("bench") || n.includes("dip") || n.includes("press") || n.includes("planche")) {
    return { category: "Push", equipmentType: "bar", bodyweight: 0, weighted: 1, primaryMuscles: "Chest,Shoulders,Triceps" };
  }
  return { category: "Core", equipmentType: "bar", bodyweight: 1, weighted: 0, primaryMuscles: "Core" };
}

function resolveExerciseName(row) {
  const sourceName = String(row.__sourceExercise || "").trim();
  const importedName = String(row.judy || row.Exercise || row.exercise || sourceName).trim();
  const renamed = EXERCISE_RENAMES[importedName] || EXERCISE_RENAMES[sourceName] || importedName;
  return { sourceName, importedName, targetName: renamed };
}

function parseVariantAndModifier(targetName, sourceName, notes) {
  const note = String(notes || "").trim();
  const noteLower = note.toLowerCase();

  let variant = SOURCE_VARIANT[sourceName] || null;
  let modifier = SOURCE_MODIFIER[sourceName] || null;

  if (normalizeName(targetName) === "seated cable row" && /close grip/.test(noteLower)) {
    variant = "Close Grip";
  }

  if (normalizeName(targetName) === "dumbbell bicep curl" && /standard curls?/.test(noteLower)) {
    variant = "Standard Curl";
  }

  if (/blue resistance|blue band/.test(noteLower)) {
    modifier = "blue_band_assist";
  } else if (/no resistance band/.test(noteLower) && normalizeName(targetName) === "pull up") {
    modifier = "bodyweight";
  }

  return { variant, modifier, notes: note || null };
}

async function ensureUserExercise(client, userId, targetName, peByNormName) {
  const norm = normalizeName(targetName);
  if (peByNormName.has(norm)) return peByNormName.get(norm);

  const fromLibrary = await client.execute({
    sql: "SELECT * FROM ProgressionExercise WHERE LOWER(name) = LOWER(?) ORDER BY CASE WHEN userId = ? THEN 0 ELSE 1 END, createdAt DESC LIMIT 1",
    args: [targetName, userId],
  });

  const peId = newId();
  if (fromLibrary.rows.length > 0) {
    const r = fromLibrary.rows[0];
    await client.execute({
      sql: `
        INSERT INTO ProgressionExercise
          (id, name, wuxiaName, difficulty, wuxiaDifficulty, type, wuxiaType, story, tips, category,
           equipmentType, bodyweight, weighted, rings, primaryMuscles, secondaryMuscles, prerequisites,
           cues, commonMistakes, breathing, safetyConsiderations, competitionStandards, assignedDays, createdAt, userId)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      `,
      args: [
        peId,
        String(r.name),
        String(r.wuxiaName || ""),
        String(r.difficulty || ""),
        String(r.wuxiaDifficulty || ""),
        String(r.type || ""),
        String(r.wuxiaType || ""),
        String(r.story || ""),
        String(r.tips || "[]"),
        String(r.category || "Pull"),
        String(r.equipmentType || "bar"),
        Number(r.bodyweight) ? 1 : 0,
        Number(r.weighted) ? 1 : 0,
        Number(r.rings) ? 1 : 0,
        String(r.primaryMuscles || ""),
        String(r.secondaryMuscles || ""),
        String(r.prerequisites || "[]"),
        String(r.cues || "[]"),
        String(r.commonMistakes || "[]"),
        String(r.breathing || ""),
        String(r.safetyConsiderations || "[]"),
        String(r.competitionStandards || "{}"),
        String(r.assignedDays || ""),
        userId,
      ],
    });
  } else {
    const exRes = await client.execute({
      sql: "SELECT * FROM Exercise WHERE LOWER(name) = LOWER(?) LIMIT 1",
      args: [targetName],
    });

    const fallback = inferExerciseDefaults(targetName);
    const ex = exRes.rows[0] || null;
    await client.execute({
      sql: `
        INSERT INTO ProgressionExercise
          (id, name, wuxiaName, difficulty, wuxiaDifficulty, type, wuxiaType, story, tips, category,
           equipmentType, bodyweight, weighted, rings, primaryMuscles, secondaryMuscles, prerequisites,
           cues, commonMistakes, breathing, safetyConsiderations, competitionStandards, assignedDays, createdAt, userId)
        VALUES
          (?, ?, ?, ?, '', ?, '', ?, '[]', ?, ?, ?, ?, 0, ?, '', '[]', '[]', '[]', '', '[]', '{}', '', CURRENT_TIMESTAMP, ?)
      `,
      args: [
        peId,
        targetName,
        String(ex ? ex.wuxiaName || "" : ""),
        String(ex ? ex.difficulty || "" : ""),
        String(ex ? ex.type || "" : ""),
        String(ex ? ex.story || "" : ""),
        String(fallback.category),
        String(fallback.equipmentType),
        fallback.bodyweight,
        fallback.weighted,
        String(fallback.primaryMuscles),
        userId,
      ],
    });
  }

  const entity = { id: peId, name: targetName };
  peByNormName.set(norm, entity);
  return entity;
}

(async function run() {
  const client = createClient({ url: process.env.DATABASE_URL || "file:./dev.db" });

  try {
    const userRes = await client.execute({
      sql: "SELECT id FROM User WHERE username = ? LIMIT 1",
      args: [USERNAME],
    });
    if (userRes.rows.length === 0) {
      throw new Error(`User not found: ${USERNAME}`);
    }
    const userId = String(userRes.rows[0].id);

    const workbook = XLSX.readFile(XLSX_PATH);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
    console.log(`User: ${USERNAME} (${userId})`);
    console.log(`Rows loaded: ${rows.length}`);

    const existingPe = await client.execute({
      sql: "SELECT id, name FROM ProgressionExercise WHERE userId = ?",
      args: [userId],
    });
    const peByNormName = new Map();
    for (const r of existingPe.rows) {
      peByNormName.set(normalizeName(r.name), { id: String(r.id), name: String(r.name) });
    }

    const uplRes = await client.execute({
      sql: "SELECT id, exerciseId FROM UserProgressionLevel WHERE userId = ?",
      args: [userId],
    });
    const uplByExerciseId = new Map();
    for (const r of uplRes.rows) {
      uplByExerciseId.set(String(r.exerciseId), String(r.id));
    }

    const variationRes = await client.execute("SELECT exerciseId, name FROM ProgressionVariation");
    const variationSet = new Set(variationRes.rows.map((r) => `${r.exerciseId}::${normalizeName(r.name)}`));

    const modifierRes = await client.execute("SELECT exerciseId, type FROM ProgressionModifier");
    const modifierSet = new Set(modifierRes.rows.map((r) => `${r.exerciseId}::${normalizeName(r.type)}`));

    let createdExercises = 0;
    let createdUpls = 0;
    let createdVariations = 0;
    let createdModifiers = 0;
    let imported = 0;
    const skipped = [];
    const seqMap = new Map();

    for (const row of rows) {
      const { sourceName, importedName, targetName } = resolveExerciseName(row);
      if (!targetName) continue;

      const pe = await ensureUserExercise(client, userId, targetName, peByNormName);
      if (pe.name === targetName && normalizeName(targetName) === normalizeName(importedName) && !existingPe.rows.length) {
        createdExercises++;
      }

      if (!uplByExerciseId.has(pe.id)) {
        const uplId = newId();
        await client.execute({
          sql: "INSERT INTO UserProgressionLevel (id, userId, exerciseId, currentLevel, createdAt, updatedAt) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
          args: [uplId, userId, pe.id],
        });
        uplByExerciseId.set(pe.id, uplId);
        createdUpls++;
      }

      const p1 = toNullableFloat(row.W1);
      const p2 = toNullableFloat(row.W2);
      const p3 = toNullableFloat(row.W3);
      const r1 = toNullableInt(row.R1);
      const r2 = toNullableInt(row.R2);
      const r3 = toNullableInt(row.R3);
      const hasData = [p1, p2, p3, r1, r2, r3].some((v) => v !== null);
      if (!hasData) continue;

      const dateKey = `${row.Date}::${pe.id}`;
      const seq = seqMap.get(dateKey) || 0;
      seqMap.set(dateKey, seq + 1);
      const createdAt = toISODate(row.Date, seq * 5000);
      if (!createdAt) {
        skipped.push(`Invalid date for ${targetName}: ${row.Date}`);
        continue;
      }

      const parsed = parseVariantAndModifier(targetName, sourceName, row.Notes);

      if (parsed.variant) {
        const vKey = `${pe.id}::${normalizeName(parsed.variant)}`;
        if (!variationSet.has(vKey)) {
          await client.execute({
            sql: "INSERT INTO ProgressionVariation (id, exerciseId, name, wuxiaName, difficulty, wuxiaDifficulty, wuxiaType, description) VALUES (?, ?, ?, '', '', '', '', '')",
            args: [newId(), pe.id, parsed.variant],
          });
          variationSet.add(vKey);
          createdVariations++;
        }
      }

      if (parsed.modifier) {
        const mKey = `${pe.id}::${normalizeName(parsed.modifier)}`;
        if (!modifierSet.has(mKey)) {
          await client.execute({
            sql: "INSERT INTO ProgressionModifier (id, exerciseId, type, available, difficultyMod, notes, method, difficultyIncrease) VALUES (?, ?, ?, 1, 0, '', '', '')",
            args: [newId(), pe.id, parsed.modifier],
          });
          modifierSet.add(mKey);
          createdModifiers++;
        }
      }

      const isHold = normalizeName(sourceName) === normalizeName("Front Lever Hold (seconds)");

      await client.execute({
        sql: `
          INSERT INTO ProgressionLog
            (id, userProgressionId, level, weight1, reps1, weight2, reps2, weight3, reps3, holdTime, holdTime2, holdTime3, reps, modifier, variant, notes, completed, createdAt)
          VALUES
            (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 1, ?)
        `,
        args: [
          newId(),
          uplByExerciseId.get(pe.id),
          isHold ? null : p1,
          r1,
          isHold ? null : p2,
          r2,
          isHold ? null : p3,
          r3,
          isHold ? (p1 !== null ? Math.round(p1) : null) : null,
          isHold ? (p2 !== null ? Math.round(p2) : null) : null,
          isHold ? (p3 !== null ? Math.round(p3) : null) : null,
          parsed.modifier,
          parsed.variant,
          parsed.notes,
          createdAt,
        ],
      });
      imported++;
    }

    console.log("\nImport complete");
    console.log(`Workbook: ${XLSX_PATH}`);
    console.log(`Imported logs: ${imported}`);
    console.log(`Created UserProgressionLevel rows: ${createdUpls}`);
    console.log(`Created variations: ${createdVariations}`);
    console.log(`Created modifiers: ${createdModifiers}`);
    console.log(`Skipped rows: ${skipped.length}`);
    if (skipped.length > 0) {
      for (const s of skipped.slice(0, 20)) {
        console.log(`- ${s}`);
      }
    }
  } finally {
    client.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
