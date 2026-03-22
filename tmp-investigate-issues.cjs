const { createClient } = require("@libsql/client");
require("dotenv/config");
const c = createClient({ url: process.env.DATABASE_URL });

(async () => {
  const userId = "cmmw327mb00001sc2w39wdmos";

  // 1. Dead Hang — check exercise and logs
  console.log("=== DEAD HANG ===");
  const dh = await c.execute("SELECT id, name, category, equipment FROM ProgressionExercise WHERE name LIKE '%Dead Hang%' OR name LIKE '%dead hang%'");
  for (const r of dh.rows) console.log("  Exercise:", r.id, "|", r.name, "|", r.category, "|", r.equipment);

  const dhLogs = await c.execute(`
    SELECT pl.id, pl.createdAt, pl.weight1, pl.reps1, pl.holdTime1, pl.variant, pl.notes, pe.name
    FROM ProgressionLog pl
    JOIN UserProgressionLevel up ON pl.userProgressionId = up.id
    JOIN ProgressionExercise pe ON up.exerciseId = pe.id
    WHERE (pe.name LIKE '%Dead Hang%' OR pe.name LIKE '%dead hang%')
    AND up.userId = ?
    ORDER BY pl.createdAt
  `, [userId]);
  console.log("  Logs:", dhLogs.rows.length);
  for (const r of dhLogs.rows) console.log("   ", r.createdAt, "| w:", r.weight1, "r:", r.reps1, "h:", r.holdTime1, "| variant:", r.variant, "| notes:", r.notes);

  // 2. Leg Extension
  console.log("\n=== LEG EXTENSION ===");
  const le = await c.execute("SELECT id, name, category, equipment FROM ProgressionExercise WHERE name LIKE '%Leg Extension%'");
  for (const r of le.rows) console.log("  Exercise:", r.id, "|", r.name, "|", r.category, "|", r.equipment);

  // 3. Seated Cable Row / Cable Row
  console.log("\n=== CABLE ROW ===");
  const cr = await c.execute("SELECT id, name, category, equipment FROM ProgressionExercise WHERE name LIKE '%Cable Row%' OR name LIKE '%Seated%Row%'");
  for (const r of cr.rows) console.log("  Exercise:", r.id, "|", r.name, "|", r.category, "|", r.equipment);

  // Also check what the XLSX mapped "Dead Hang" from
  console.log("\n=== Check XLSX source exercise names that became logs ===");
  const allLogs = await c.execute(`
    SELECT pe.name, pe.category, pe.equipment, COUNT(pl.id) as cnt
    FROM ProgressionLog pl
    JOIN UserProgressionLevel up ON pl.userProgressionId = up.id
    JOIN ProgressionExercise pe ON up.exerciseId = pe.id
    WHERE up.userId = ?
    GROUP BY pe.id ORDER BY pe.name
  `, [userId]);
  for (const r of allLogs.rows) console.log("  " + r.name + " [" + r.category + "/" + r.equipment + "]: " + r.cnt + " logs");

  c.close();
})();
