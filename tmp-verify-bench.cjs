const { createClient } = require("@libsql/client");
require("dotenv/config");
const c = createClient({ url: process.env.DATABASE_URL });

async function verify() {
  // Check no generic "Bench Press" exercise remains
  const generic = await c.execute("SELECT * FROM ProgressionExercise WHERE name = 'Bench Press'");
  console.log("Generic 'Bench Press' rows:", generic.rows.length, generic.rows.length === 0 ? "✓ GOOD" : "✗ BAD");

  // Check bench press log counts per exercise
  const res = await c.execute(`
    SELECT pe.name, COUNT(pl.id) as logCount,
           GROUP_CONCAT(DISTINCT pl.variant) as variants
    FROM ProgressionLog pl
    JOIN UserProgressionLevel up ON pl.userProgressionId = up.id
    JOIN ProgressionExercise pe ON up.exerciseId = pe.id
    WHERE pe.name LIKE '%Bench Press%'
    GROUP BY pe.id
    ORDER BY pe.name
  `);
  console.log("\n=== Bench Press logs by exercise ===");
  for (const r of res.rows) {
    console.log("  " + r.name + ": " + r.logCount + " logs" + (r.variants ? " (variants: " + r.variants + ")" : ""));
  }

  // Check no orphan variations
  const orphans = await c.execute("SELECT * FROM ProgressionVariation WHERE exerciseId = 'c9752715581f40cdb3c23364eaa8868d'");
  console.log("\nOrphan variations:", orphans.rows.length, orphans.rows.length === 0 ? "✓ GOOD" : "✗ BAD");

  c.close();
}
verify();
