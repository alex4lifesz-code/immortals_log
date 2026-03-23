const { createClient } = require('@libsql/client');
const c = createClient({ url: 'file:./dev.db' });

async function main() {
  // Check tables
  const tables = await c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log('Tables:', tables.rows.map(r => r.name));

  // Check WeightStandard table
  try {
    const ws = await c.execute("SELECT COUNT(*) as cnt FROM WeightStandard");
    console.log('WeightStandard count:', ws.rows[0].cnt);
  } catch (e) {
    console.error('WeightStandard error:', e.message);
  }

  // Check exercises
  const exs = await c.execute("SELECT id, name FROM ProgressionExercise");
  console.log('Exercises:', exs.rows);
}

main().catch(e => console.error(e));

