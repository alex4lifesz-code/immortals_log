const { createClient } = require("@libsql/client");
const c = createClient({ url: "file:./dev.db" });
(async () => {
  const r = await c.execute("UPDATE ProgressionExercise SET category = REPLACE(REPLACE(category, 'Imported, ', ''), 'Imported', '') WHERE category LIKE '%Imported%'");
  console.log("Updated " + r.rowsAffected + " rows");
  const v = await c.execute("SELECT DISTINCT category FROM ProgressionExercise ORDER BY category");
  for (const row of v.rows) console.log("  " + row.category);
})().catch(e => console.error(e));
