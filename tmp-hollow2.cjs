const { createClient } = require('@libsql/client');
const c = createClient({ url: 'file:./dev.db' });
(async () => {
  // Check all tables for exercise-name columns that might store hollow body hold
  const tables = await c.execute({ sql: `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name` });
  console.log('All tables:', tables.rows.map(r => r.name).join(', '));

  // Check SimplifiedWorkoutLog / DetailedWorkoutLog / WorkoutDay / ExerciseAssignment etc
  for (const t of tables.rows) {
    const tname = t.name;
    try {
      const cols = await c.execute({ sql: `PRAGMA table_info(${tname})` });
      const colNames = cols.rows.map(r => r.name);
      // if it has an exerciseName-like column or exerciseId, check for hollow
      const nameCol = colNames.find(n => n.toLowerCase().includes('exercisename') || n.toLowerCase() === 'name');
      const idCol = colNames.find(n => n.toLowerCase() === 'exerciseid');
      if (nameCol) {
        const r = await c.execute({ sql: `SELECT DISTINCT "${nameCol}" FROM "${tname}" WHERE lower("${nameCol}") LIKE '%hollow%'` });
        if (r.rows.length) console.log(`\n[${tname}].${nameCol}:`, r.rows.map(x => x[nameCol]));
      }
    } catch(e) {}
  }
  c.close();
})().catch(e => console.error(e));
