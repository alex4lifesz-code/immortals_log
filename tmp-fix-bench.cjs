const crypto = require("crypto");
const { createClient } = require("@libsql/client");
require("dotenv/config");
const c = createClient({ url: process.env.DATABASE_URL });

function newId() {
  return crypto.randomUUID().replace(/-/g, "");
}

async function fix() {
  const userId = String((await c.execute("SELECT id FROM User WHERE username = 'admin'")).rows[0].id);

  // The generic "Bench Press" exercise we created (wrong)
  const wrongExId = "c9752715581f40cdb3c23364eaa8868d";
  const wrongUPId = "622cc9400a9c459d9eae7397febc70b4";

  // Correct target exercises (already existed)
  const targets = {
    null:                       { name: "Barbell Bench Press",          exId: "cmmzz50oh02pelgc2ufjngo6m" },
    "Incline Barbell (45°)":    { name: "Incline Barbell Bench Press",  exId: "cmmzz50q002q8lgc2vqpsdo58" },
    "Decline Barbell":          { name: "Decline Barbell Bench Press",  exId: "cmmzz50p602pvlgc20wm4j27f" },
    "Dumbbell Flat":            { name: "Dumbbell Bench Press",         exId: "cmmzz50qw02qnlgc298rzefon" },
    "Incline Dumbbell (45°)":   { name: "Incline Dumbbell Bench Press", exId: "cmmzz50rj02r3lgc2wfv3k6o1" },
  };

  // Find or create UserProgressionLevel for each target
  const upIds = {};
  for (const [variant, target] of Object.entries(targets)) {
    const existing = await c.execute({
      sql: "SELECT id FROM UserProgressionLevel WHERE userId = ? AND exerciseId = ?",
      args: [userId, target.exId],
    });
    if (existing.rows.length > 0) {
      upIds[variant] = String(existing.rows[0].id);
      console.log("UPL exists for " + target.name + ": " + upIds[variant]);
    } else {
      const upId = newId();
      await c.execute({
        sql: "INSERT INTO UserProgressionLevel (id, userId, exerciseId, currentLevel, createdAt, updatedAt) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        args: [upId, userId, target.exId],
      });
      upIds[variant] = upId;
      console.log("Created UPL for " + target.name + ": " + upId);
    }
  }

  // Move logs from wrong UP to correct UPs
  let totalMoved = 0;
  for (const [variant, target] of Object.entries(targets)) {
    let sql, args;
    if (variant === "null") {
      // null variant = barbell bench press (base)
      sql = "UPDATE ProgressionLog SET userProgressionId = ? WHERE userProgressionId = ? AND variant IS NULL";
      args = [upIds["null"], wrongUPId];
    } else {
      sql = "UPDATE ProgressionLog SET userProgressionId = ?, variant = NULL WHERE userProgressionId = ? AND variant = ?";
      args = [upIds[variant], wrongUPId, variant];
    }
    const res = await c.execute({ sql, args });
    const count = res.rowsAffected;
    console.log("Moved " + count + " logs to " + target.name + (variant !== "null" ? " (was variant: " + variant + ")" : ""));
    totalMoved += count;
  }

  // Delete the wrong UserProgressionLevel (should now have 0 logs)
  const remaining = await c.execute({
    sql: "SELECT COUNT(*) as cnt FROM ProgressionLog WHERE userProgressionId = ?",
    args: [wrongUPId],
  });
  if (Number(remaining.rows[0].cnt) === 0) {
    await c.execute({ sql: "DELETE FROM UserProgressionLevel WHERE id = ?", args: [wrongUPId] });
    console.log("\nDeleted orphan UserProgressionLevel: " + wrongUPId);
  } else {
    console.log("\nWARNING: " + remaining.rows[0].cnt + " logs still on wrong UPL!");
  }

  // Delete the wrong ProgressionExercise "Bench Press"
  // First check no other UPLs reference it
  const otherUPLs = await c.execute({
    sql: "SELECT COUNT(*) as cnt FROM UserProgressionLevel WHERE exerciseId = ?",
    args: [wrongExId],
  });
  if (Number(otherUPLs.rows[0].cnt) === 0) {
    // Delete variations first (cascade should handle but be explicit)
    await c.execute({ sql: "DELETE FROM ProgressionVariation WHERE exerciseId = ?", args: [wrongExId] });
    await c.execute({ sql: "DELETE FROM ProgressionModifier WHERE exerciseId = ?", args: [wrongExId] });
    await c.execute({ sql: "DELETE FROM ProgressionExercise WHERE id = ?", args: [wrongExId] });
    console.log("Deleted orphan ProgressionExercise 'Bench Press': " + wrongExId);
  } else {
    console.log("WARNING: Other UPLs still reference Bench Press!");
  }

  console.log("\nTotal logs moved: " + totalMoved);
  console.log("Done!");
  c.close();
}
fix();
