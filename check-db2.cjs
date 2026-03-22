// Simulate the progression upload for Front Lever
const { createClient } = require("@libsql/client");

async function test() {
  const client = createClient({ url: "file:./dev.db" });
  
  try {
    // Check if Front Lever already exists in ProgressionExercise
    const existing = await client.execute(
      "SELECT id, name FROM ProgressionExercise WHERE name = 'Front Lever' LIMIT 1"
    );
    console.log("Front Lever in ProgressionExercise:", existing.rows);

    // Check Exercise table for Front Lever
    const libEx = await client.execute(
      "SELECT id, name FROM Exercise WHERE name = 'Front Lever' LIMIT 1"
    );
    console.log("Front Lever in Exercise:", libEx.rows);

    // Check users (to get a userId for testing)
    const users = await client.execute("SELECT id, username FROM User LIMIT 3");
    console.log("Users:", users.rows);

    // Check _prisma_migrations for the latest migration
    const migrations = await client.execute(
      "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5"
    );
    console.log("\nLatest migrations applied:");
    for (const row of migrations.rows) {
      console.log(" -", row.migration_name, row.finished_at ? "OK" : "PENDING");
    }
  } catch(e) {
    console.error("Error:", e.message);
  } finally {
    client.close();
  }
}

test();
