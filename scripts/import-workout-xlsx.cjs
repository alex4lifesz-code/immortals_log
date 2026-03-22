const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("xlsx");
const { createClient } = require("@libsql/client");

const WORKBOOK_PATH = process.argv[2] || "C:/Users/Admin/Desktop/workoutxlsx.xlsx";
const TARGET_USERNAME = process.argv[3] || "admin";

const EXERCISE_RENAMES = {
  "1-Arm Pull-Up Negatives": "One Arm Pull Up",
  "BB Bench Press": "Barbell Bench Press",
  "BB Deadlift": "Deadlift",
  "Cable Face Pulls": "Cable Face Pull",
  "Chin-Ups": "Pull Up",
  "DB Bench Press": "Dumbbell Bench Press",
  "DB Bicep Curl": "Dumbbell Curl",
  "DB Forearm": "Dumbbell Forearm Curl",
  "DB Lateral Raises": "Dumbbell Lateral Raise",
  "DB Shoulder Press": "Dumbbell Shoulder Press",
  "Decline BB Bench Press": "Decline Barbell Bench Press",
  "Dips (Parallel Bars / Rings)": "Dip",
  "Front Lever Hold (seconds)": "Front Lever",
  "Front Lever Negatives": "Front Lever",
  "High Pull-Ups": "Pull Up",
  "Ice Cream Maker": "Front Lever",
  "Incline BB Bench Press (45°)": "Incline Barbell Bench Press",
  "Incline DB Bench Press (45°)": "Incline Dumbbell Bench Press",
  "Pull-Ups": "Pull Up",
  "Seated Cable Row": "Cable Row",
  "Tucked Front Lever Negatives": "Front Lever",
  "Tucked Planche Presses": "Planche",
  "Tucked Presses": "Planche",
  "Weighted Pull-Ups": "Pull Up",

  // These do not exist in the current library and will be added before import.
  "BB Squats": "Barbell Squat",
  "Calf Raises": "Calf Raise",
  "Seated Leg Curls": "Seated Leg Curl",
  "Seated Leg Extensions": "Seated Leg Extension",
};

const NEW_EXERCISE_META = {
  "Barbell Squat": {
    wuxiaName: "Iron Pillar Bends the Mountain",
    difficulty: "Immortal",
    type: "Lower Realms",
    targetGroup: "Legs, Gym",
    story: "Heavy lower-body compound lift to fortify foundation and force output.",
  },
  "Calf Raise": {
    wuxiaName: "Crane Heel Ascends the Steps",
    difficulty: "Immortal",
    type: "Lower Realms",
    targetGroup: "Legs, Gym",
    story: "Focused posterior-chain accessory for ankle stiffness and leg endurance.",
  },
  "Seated Leg Curl": {
    wuxiaName: "Coiled Dragon Contracts the Tendon",
    difficulty: "Immortal",
    type: "Lower Realms",
    targetGroup: "Legs, Gym",
    story: "Hamstring isolation movement to strengthen knee flexion under control.",
  },
  "Seated Leg Extension": {
    wuxiaName: "Iron Knee Extends the Meridian",
    difficulty: "Immortal",
    type: "Lower Realms",
    targetGroup: "Legs, Gym",
    story: "Quadriceps isolation movement for controlled knee extension strength.",
  },
  "Dumbbell Forearm Curl": {
    wuxiaName: "Iron Wrist Coils the Serpent",
    difficulty: "Immortal",
    type: "Upper Heaven",
    targetGroup: "Pull, Gym",
    story: "Forearm accessory movement to build grip endurance and wrist flexor strength.",
  },
};

function toIsoDate(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const serial = value;
    const utcDays = Math.floor(serial) - 25569;
    return new Date(utcDays * 86400 * 1000).toISOString();
  }

  const d = new Date(String(value));
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString();
  }
  throw new Error(`Invalid date value: ${value}`);
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

function pickSheetWithRows(workbook) {
  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
    if (rows.length > 0) return { name, ws, rows };
  }
  return null;
}

(async function run() {
  if (!fs.existsSync(WORKBOOK_PATH)) {
    throw new Error(`Workbook not found: ${WORKBOOK_PATH}`);
  }

  const client = createClient({ url: "file:./dev.db" });

  try {
    const workbook = XLSX.readFile(WORKBOOK_PATH);
    const picked = pickSheetWithRows(workbook);
    if (!picked) {
      throw new Error("No non-empty sheet found in workbook");
    }

    const { name: sheetName, rows } = picked;

    // Keep a backup before renaming in-place.
    const backupPath = `${WORKBOOK_PATH}.backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    fs.copyFileSync(WORKBOOK_PATH, backupPath);

    const renameCounts = new Map();
    const unresolved = [];

    for (const row of rows) {
      const original = String(row.judy || row.Exercise || row.exercise || "").trim();
      if (!original) continue;

      const renamed = EXERCISE_RENAMES[original] || original;
      if (renamed !== original) {
        renameCounts.set(`${original} -> ${renamed}`, (renameCounts.get(`${original} -> ${renamed}`) || 0) + 1);
      }

      row.judy = renamed;
      row.__sourceExercise = original;

      if (!renamed) {
        unresolved.push(original);
      }
    }

    // Write renamed workbook back to the same file.
    const newSheet = XLSX.utils.json_to_sheet(rows, {
      header: ["Date", "judy", "W1", "R1", "W2", "R2", "W3", "R3", "Notes"],
      skipHeader: false,
    });
    workbook.Sheets[sheetName] = newSheet;
    XLSX.writeFile(workbook, WORKBOOK_PATH);

    const userRes = await client.execute({
      sql: "SELECT id, username FROM User WHERE username = ? LIMIT 1",
      args: [TARGET_USERNAME],
    });

    if (userRes.rows.length === 0) {
      throw new Error(`User not found: ${TARGET_USERNAME}`);
    }
    const userId = String(userRes.rows[0].id);

    const exerciseRes = await client.execute("SELECT id, name FROM Exercise");
    const exerciseByName = new Map(
      exerciseRes.rows.map((r) => [String(r.name).trim().toLowerCase(), String(r.id)])
    );

    // Add newly needed exercises so all workbook rows can map cleanly.
    const renamedNames = [...new Set(rows.map((r) => String(r.judy || "").trim()).filter(Boolean))];
    let createdExercises = 0;

    for (const name of renamedNames) {
      const key = name.toLowerCase();
      if (exerciseByName.has(key)) continue;

      const meta = NEW_EXERCISE_META[name] || {
        wuxiaName: "",
        difficulty: "Immortal",
        type: "Heaven and Earth United",
        targetGroup: "",
        story: "",
      };

      const id = crypto.randomUUID().replace(/-/g, "");
      await client.execute({
        sql: `
          INSERT INTO Exercise (id, name, wuxiaName, difficulty, type, story, targetGroup, assignedDays, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, '', CURRENT_TIMESTAMP)
        `,
        args: [id, name, meta.wuxiaName || null, meta.difficulty, meta.type, meta.story || null, meta.targetGroup || null],
      });

      exerciseByName.set(key, id);
      createdExercises++;
    }

    let imported = 0;
    const skipped = [];

    for (const row of rows) {
      const exerciseName = String(row.judy || "").trim();
      if (!exerciseName) continue;

      const exerciseId = exerciseByName.get(exerciseName.toLowerCase());
      if (!exerciseId) {
        skipped.push(`Exercise unresolved: ${exerciseName}`);
        continue;
      }

      let isoDate;
      try {
        isoDate = toIsoDate(row.Date);
      } catch (err) {
        skipped.push(`Invalid date for ${exerciseName}: ${row.Date}`);
        continue;
      }

      const w1 = toNullableFloat(row.W1);
      const r1 = toNullableInt(row.R1);
      const w2 = toNullableFloat(row.W2);
      const r2 = toNullableInt(row.R2);
      const w3 = toNullableFloat(row.W3);
      const r3 = toNullableInt(row.R3);

      const hasData = r1 !== null || r2 !== null || r3 !== null || w1 !== null || w2 !== null || w3 !== null;
      if (!hasData) {
        skipped.push(`No set data for ${exerciseName} on ${row.Date}`);
        continue;
      }

      const sourceName = String(row.__sourceExercise || "").trim();
      const isHoldImport = sourceName === "Front Lever Hold (seconds)";
      const holdTime = isHoldImport ? toNullableInt(row.W1) : null;

      const workoutId = crypto.randomUUID().replace(/-/g, "");
      const simplifiedId = crypto.randomUUID().replace(/-/g, "");

      await client.execute("BEGIN");
      try {
        await client.execute({
          sql: `
            INSERT INTO Workout (id, userId, name, date, notes, targetGroups, createdAt)
            VALUES (?, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP)
          `,
          args: [
            workoutId,
            userId,
            `${exerciseName} Training`,
            isoDate,
            row.Notes ? String(row.Notes).trim() : null,
          ],
        });

        await client.execute({
          sql: `
            INSERT INTO SimplifiedWorkoutExercise
              (id, workoutId, exerciseId, weight1, reps1, weight2, reps2, weight3, reps3, holdTime, notes, "order", createdAt)
            VALUES
              (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
          `,
          args: [
            simplifiedId,
            workoutId,
            exerciseId,
            isHoldImport ? null : w1,
            r1,
            isHoldImport ? null : w2,
            r2,
            isHoldImport ? null : w3,
            r3,
            holdTime,
            row.Notes ? String(row.Notes).trim() : null,
          ],
        });

        await client.execute("COMMIT");
        imported++;
      } catch (err) {
        await client.execute("ROLLBACK");
        skipped.push(`Insert failed for ${exerciseName} on ${row.Date}: ${err.message}`);
      }
    }

    console.log("\nImport complete");
    console.log(`Workbook: ${WORKBOOK_PATH}`);
    console.log(`Backup:   ${backupPath}`);
    console.log(`Sheet:    ${sheetName}`);
    console.log(`Rows:     ${rows.length}`);
    console.log(`Imported: ${imported}`);
    console.log(`Created exercises: ${createdExercises}`);
    console.log(`Skipped:  ${skipped.length}`);

    if (renameCounts.size > 0) {
      console.log("\nRenames applied:");
      for (const [label, count] of [...renameCounts.entries()].sort()) {
        console.log(`- ${label} (${count})`);
      }
    }

    if (unresolved.length > 0) {
      console.log("\nUnresolved names:");
      for (const n of unresolved) console.log(`- ${n}`);
    }

    if (skipped.length > 0) {
      console.log("\nSkipped details (first 30):");
      for (const s of skipped.slice(0, 30)) console.log(`- ${s}`);
    }
  } finally {
    client.close();
  }
})().catch((err) => {
  console.error("Import failed:", err.message);
  process.exit(1);
});
