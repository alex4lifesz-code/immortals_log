const { createClient } = require("@libsql/client");

async function main() {
  const targetUrl = process.argv[2] || "file:./seed-data/cultivation.seed.sqlite";
  const client = createClient({ url: targetUrl });

  try {
    const columns = await client.execute('PRAGMA table_info("User")');
    console.log("USER_COLUMNS");
    console.log(JSON.stringify(columns.rows, null, 2));

    const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('FriendRequest', '_prisma_migrations') ORDER BY name");
    console.log("TABLES");
    console.log(JSON.stringify(tables.rows, null, 2));

    const migrations = await client.execute("SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10");
    console.log("MIGRATIONS");
    console.log(JSON.stringify(migrations.rows, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
