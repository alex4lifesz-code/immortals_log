const { createClient } = require('@libsql/client');

const client = createClient({ url: 'file:./dev.db' });

async function main() {
  // Find orphaned exercises (userId not in User table)
  const orphaned = await client.execute(
    'SELECT pe.id, pe.name, pe.userId FROM ProgressionExercise pe LEFT JOIN User u ON pe.userId = u.id WHERE u.id IS NULL'
  );
  console.log(`Found ${orphaned.rows.length} orphaned exercises to purge:\n`);
  for (const row of orphaned.rows) {
    console.log(`  - ${row.name} [user: ${row.userId}]`);
  }

  if (orphaned.rows.length === 0) {
    console.log('Nothing to purge.');
    return;
  }

  // Delete dependent records first (cascade order)
  const orphanedIds = orphaned.rows.map(r => r.id);
  const placeholders = orphanedIds.map(() => '?').join(',');

  const tables = [
    'ProgressionLog',
    'UserProgressionLevel', 
    'ProgressionModifier',
    'ProgressionVariation',
    'ProgressionTier',
  ];

  // Delete ProgressionLog via UserProgressionLevel
  const uplIds = await client.execute({
    sql: `SELECT id FROM UserProgressionLevel WHERE exerciseId IN (${placeholders})`,
    args: orphanedIds
  });
  if (uplIds.rows.length > 0) {
    const uplPlaceholders = uplIds.rows.map(() => '?').join(',');
    const delLogs = await client.execute({
      sql: `DELETE FROM ProgressionLog WHERE userProgressionId IN (${uplPlaceholders})`,
      args: uplIds.rows.map(r => r.id)
    });
    console.log(`\n  Deleted ${delLogs.rowsAffected} ProgressionLog records`);
  }

  for (const table of tables.slice(1)) { // Skip ProgressionLog, already handled
    const result = await client.execute({
      sql: `DELETE FROM ${table} WHERE exerciseId IN (${placeholders})`,
      args: orphanedIds
    });
    console.log(`  Deleted ${result.rowsAffected} ${table} records`);
  }

  // Finally delete the exercises themselves
  const delEx = await client.execute({
    sql: `DELETE FROM ProgressionExercise WHERE id IN (${placeholders})`,
    args: orphanedIds
  });
  console.log(`  Deleted ${delEx.rowsAffected} ProgressionExercise records`);

  // Verify
  const remaining = await client.execute('SELECT id, name, userId FROM ProgressionExercise');
  console.log(`\n=== REMAINING EXERCISES (${remaining.rows.length}) ===`);
  for (const row of remaining.rows) {
    console.log(`  - ${row.name} [user: ${row.userId}]`);
  }
}

main().catch(console.error);
