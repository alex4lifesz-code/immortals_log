const { createClient } = require("@libsql/client");
require("dotenv/config");
const c = createClient({ url: process.env.DATABASE_URL });
(async () => {
  const r = await c.execute(`
    SELECT pe.id, pe.name, up.id as uplId,
      (SELECT COUNT(*) FROM ProgressionLog WHERE userProgressionId = up.id) as logCount
    FROM ProgressionExercise pe
    JOIN UserProgressionLevel up ON up.exerciseId = pe.id
    WHERE pe.name LIKE '%Bench Press%' OR pe.name LIKE '%bench%'
    ORDER BY pe.name, logCount DESC
  `);
  for (const x of r.rows) {
    console.log(x.id, "|", x.name, "| UPL:", x.uplId, "| logs:", x.logCount);
  }

  // Also check if there are duplicate exercise names
  const dupes = await c.execute(`
    SELECT name, COUNT(*) as cnt, GROUP_CONCAT(id) as ids
    FROM ProgressionExercise
    WHERE name LIKE '%Bench Press%'
    GROUP BY name HAVING cnt > 1
  `);
  if (dupes.rows.length > 0) {
    console.log("\n=== DUPLICATE EXERCISES ===");
    for (const d of dupes.rows) console.log(d.name, ":", d.cnt, "copies, IDs:", d.ids);
  } else {
    // Check if there are duplicate UPLs for same exercise
    const dupUPL = await c.execute(`
      SELECT up.exerciseId, pe.name, COUNT(*) as cnt, GROUP_CONCAT(up.id) as upIds
      FROM UserProgressionLevel up
      JOIN ProgressionExercise pe ON pe.id = up.exerciseId
      WHERE pe.name LIKE '%Bench Press%'
      GROUP BY up.exerciseId HAVING cnt > 1
    `);
    if (dupUPL.rows.length > 0) {
      console.log("\n=== DUPLICATE UPLs ===");
      for (const d of dupUPL.rows) console.log(d.name, ":", d.cnt, "UPLs, IDs:", d.upIds);
    }
  }

  c.close();
})();
