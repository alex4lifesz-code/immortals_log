// Check DB tables and columns
const { createClient } = require("@libsql/client");

async function check() {
  const client = createClient({ url: "file:./dev.db" });
  try {
    // List all tables
    const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    console.log("Tables:", tables.rows.map(r => r.name));

    // Check ProgressionExercise columns
    const cols = await client.execute("PRAGMA table_info(ProgressionExercise)");
    console.log("\nProgressionExercise columns:", cols.rows.map(r => r.name));

    // Check ProgressionTier columns
    const tierCols = await client.execute("PRAGMA table_info(ProgressionTier)");
    console.log("\nProgressionTier columns:", tierCols.rows.map(r => r.name));

    // Count rows
    const exCount = await client.execute("SELECT COUNT(*) as cnt FROM ProgressionExercise");
    const exerciseCount = await client.execute("SELECT COUNT(*) as cnt FROM Exercise");
    console.log("\nProgressionExercise rows:", exCount.rows[0].cnt);
    console.log("Exercise rows:", exerciseCount.rows[0].cnt);
  } catch(e) {
    console.error("Error:", e.message);
  } finally {
    client.close();
  }
}

check();
