const { createClient } = require("@libsql/client");
require("dotenv/config");
const c = createClient({ url: process.env.DATABASE_URL });

async function investigate() {
  const userId = (await c.execute("SELECT id FROM User WHERE username = 'admin'")).rows[0].id;

  // Find all ProgressionExercises with "Bench" in the name for admin
  const benches = await c.execute({
    sql: "SELECT id, name, category, equipmentType FROM ProgressionExercise WHERE name LIKE '%Bench%' AND userId = ?",
    args: [userId],
  });
  console.log("=== Bench Press exercises for admin ===");
  benches.rows.forEach(r => console.log("  " + r.id + " | " + r.name + " [" + r.category + "/" + r.equipmentType + "]"));

  // Find variations on "Bench Press" base
  const benchId = benches.rows.find(r => r.name === "Bench Press")?.id;
  if (benchId) {
    const vars = await c.execute({
      sql: "SELECT id, name FROM ProgressionVariation WHERE exerciseId = ?",
      args: [benchId],
    });
    console.log("\n=== Variations on Bench Press (" + benchId + ") ===");
    vars.rows.forEach(r => console.log("  " + r.id + " | " + r.name));
  }

  // Find the UserProgressionLevel for "Bench Press" base
  const benchUP = await c.execute({
    sql: "SELECT id, exerciseId FROM UserProgressionLevel WHERE userId = ? AND exerciseId = ?",
    args: [userId, benchId],
  });
  console.log("\n=== UserProgressionLevel for Bench Press ===");
  benchUP.rows.forEach(r => console.log("  UP: " + r.id + " -> exercise: " + r.exerciseId));

  // Count logs on Bench Press UP, broken down by variant
  if (benchUP.rows.length > 0) {
    const upId = benchUP.rows[0].id;
    const logsByVariant = await c.execute({
      sql: "SELECT variant, COUNT(*) as cnt FROM ProgressionLog WHERE userProgressionId = ? GROUP BY variant",
      args: [upId],
    });
    console.log("\n=== Bench Press logs by variant ===");
    logsByVariant.rows.forEach(r => console.log("  variant=" + JSON.stringify(r.variant) + " : " + r.cnt + " logs"));
  }

  // Check if Dumbbell Bench Press and Incline Dumbbell Bench Press exist
  const dbBench = benches.rows.find(r => r.name === "Dumbbell Bench Press");
  const incDbBench = benches.rows.find(r => r.name === "Incline Dumbbell Bench Press");
  console.log("\n=== Target exercises ===");
  console.log("  Dumbbell Bench Press:", dbBench ? dbBench.id : "NOT FOUND");
  console.log("  Incline Dumbbell Bench Press:", incDbBench ? incDbBench.id : "NOT FOUND");

  // Check UPLs for those
  if (dbBench) {
    const up = await c.execute({ sql: "SELECT id FROM UserProgressionLevel WHERE userId = ? AND exerciseId = ?", args: [userId, dbBench.id] });
    console.log("  DB Bench Press UPL:", up.rows.length > 0 ? up.rows[0].id : "NONE");
  }
  if (incDbBench) {
    const up = await c.execute({ sql: "SELECT id FROM UserProgressionLevel WHERE userId = ? AND exerciseId = ?", args: [userId, incDbBench.id] });
    console.log("  Incline DB Bench Press UPL:", up.rows.length > 0 ? up.rows[0].id : "NONE");
  }

  c.close();
}
investigate();
