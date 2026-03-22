const { createClient } = require("@libsql/client");
require("dotenv/config");
const c = createClient({ url: process.env.DATABASE_URL });

async function consolidate() {
  // Pairs: [keep, remove] — keep the ones with more logs
  const pairs = [
    { name: "Barbell Bench Press",          keep: "cmmzz50oh02pelgc2ufjngo6m", remove: "cmmzz1dsi01zjlgc2fj0c5l24",  keepUPL: "cmmzz50ot02pulgc2l8w72hdl", removeUPL: "cmmzz1dsu01zzlgc27oc53ee3" },
    { name: "Decline Barbell Bench Press",  keep: "cmmzz50p602pvlgc20wm4j27f", remove: "cmmzz1dt40200lgc2aq4urbpd",  keepUPL: "cmmzz50pi02q7lgc2tqena6jc", removeUPL: "cmmzz1dte020clgc2d7irsr6p" },
    { name: "Dumbbell Bench Press",         keep: "cmmzz50qw02qnlgc298rzefon", remove: "cmmzz1du9020slgc2b3lerqp3",  keepUPL: "cmmzz50r902r2lgc2ygj5csin", removeUPL: "cmmzz1dul0217lgc2n05elsb9" },
    { name: "Incline Barbell Bench Press",  keep: "cmmzz50q002q8lgc2vqpsdo58", remove: "cmmzz1dto020dlgc2720zplib",  keepUPL: "cmmzz50qe02qmlgc287kv8msa", removeUPL: "cmmzz1dtz020rlgc2y597ih0l" },
    { name: "Incline Dumbbell Bench Press", keep: "cmmzz50rj02r3lgc2wfv3k6o1", remove: "cmmzz1duv0218lgc24mfqliys",  keepUPL: "cmmzz50ru02rhlgc20jdky3se", removeUPL: "cmmzz1dv8021mlgc24s36gzqz" },
  ];

  for (const p of pairs) {
    // Move any logs from the remove UPL to the keep UPL
    const moved = await c.execute({
      sql: "UPDATE ProgressionLog SET userProgressionId = ? WHERE userProgressionId = ?",
      args: [p.keepUPL, p.removeUPL],
    });
    console.log(p.name + ": moved " + moved.rowsAffected + " logs");

    // Delete the remove UPL
    await c.execute({ sql: "DELETE FROM UserProgressionLevel WHERE id = ?", args: [p.removeUPL] });

    // Move any tiers, variations, modifiers from remove exercise to keep exercise
    for (const table of ["ProgressionTier", "ProgressionVariation", "ProgressionModifier"]) {
      const m = await c.execute({
        sql: `UPDATE ${table} SET exerciseId = ? WHERE exerciseId = ?`,
        args: [p.keep, p.remove],
      });
      if (m.rowsAffected > 0) console.log("  Moved " + m.rowsAffected + " " + table + " records");
    }

    // Delete the duplicate exercise
    await c.execute({ sql: "DELETE FROM ProgressionExercise WHERE id = ?", args: [p.remove] });
    console.log("  Deleted duplicate exercise: " + p.remove);
  }

  // Verify
  console.log("\n=== Verification ===");
  const res = await c.execute(`
    SELECT pe.name, COUNT(pl.id) as logCount
    FROM ProgressionExercise pe
    LEFT JOIN UserProgressionLevel up ON up.exerciseId = pe.id
    LEFT JOIN ProgressionLog pl ON pl.userProgressionId = up.id
    WHERE pe.name LIKE '%Bench Press%'
    GROUP BY pe.id ORDER BY pe.name
  `);
  for (const r of res.rows) console.log("  " + r.name + ": " + r.logCount + " logs");

  c.close();
  console.log("\nDone!");
}
consolidate();
