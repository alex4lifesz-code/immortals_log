const { createClient } = require('@libsql/client');

const client = createClient({ url: 'file:./dev.db' });

async function main() {
  const users = await client.execute('SELECT id, username FROM "User" ORDER BY username');

  for (const user of users.rows) {
    const countRes = await client.execute({
      sql: 'SELECT COUNT(*) AS c FROM "CheckIn" WHERE "userId" = ?',
      args: [user.id],
    });
    const weightedRes = await client.execute({
      sql: 'SELECT COUNT(*) AS c FROM "CheckIn" WHERE "userId" = ? AND weight IS NOT NULL',
      args: [user.id],
    });
    const latestRes = await client.execute({
      sql: 'SELECT date, weight, present FROM "CheckIn" WHERE "userId" = ? ORDER BY date DESC LIMIT 3',
      args: [user.id],
    });

    console.log(`USER ${user.username} (${user.id})`);
    console.log(`  checkins: ${Number(countRes.rows[0].c)}`);
    console.log(`  withWeight: ${Number(weightedRes.rows[0].c)}`);
    for (const row of latestRes.rows) {
      console.log(`  latest: ${row.date} weight=${row.weight} present=${row.present}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
