const { createClient } = require("@libsql/client");
const c = createClient({ url: "file:./dev.db" });
(async () => {
  // Check all text columns for "Imported"
  const r = await c.execute(`
    SELECT name, category, type, difficulty, equipmentType, wuxiaType, wuxiaDifficulty
    FROM ProgressionExercise
    WHERE category LIKE '%mport%' OR type LIKE '%mport%' OR difficulty LIKE '%mport%'
       OR equipmentType LIKE '%mport%' OR wuxiaType LIKE '%mport%' OR wuxiaDifficulty LIKE '%mport%'
  `);
  console.log("Rows with 'Imported' in any field:", r.rows.length);
  for (const row of r.rows) console.log(JSON.stringify(row));

  // Also show a few sample rows to see what text appears
  const s = await c.execute("SELECT name, category, type, difficulty, equipmentType FROM ProgressionExercise LIMIT 5");
  console.log("\nSample rows:");
  for (const row of s.rows) console.log(JSON.stringify(row));
})().catch(e => console.error(e));
