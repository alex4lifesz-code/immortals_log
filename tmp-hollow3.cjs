const { createClient } = require('@libsql/client');
const c = createClient({ url: 'file:./dev.db' });
(async () => {
  // 1. Which exercise has "Hollow Body Hold" as a tier name?
  const tier = await c.execute({ sql: `
    SELECT pt.name AS tierName, pt.level, pe.name AS exerciseName, pe.id AS exerciseId
    FROM ProgressionTier pt
    JOIN ProgressionExercise pe ON pe.id = pt.exerciseId
    WHERE lower(pt.name) LIKE '%hollow%'
  ` });
  console.log('Tier named Hollow Body Hold:', JSON.stringify(tier.rows, null, 2));

  // 2. Check the old Exercise table
  const cols = await c.execute({ sql: `PRAGMA table_info(Exercise)` });
  console.log('\nExercise table columns:', cols.rows.map(r => r.name).join(', '));
  const oldEx = await c.execute({ sql: `SELECT * FROM Exercise WHERE lower(name) LIKE '%hollow%' LIMIT 5` });
  console.log('Old Exercise table hollow:', JSON.stringify(oldEx.rows, null, 2));

  // 3. Show all exercises in the old Exercise table
  const allOld = await c.execute({ sql: `SELECT id, name FROM Exercise ORDER BY name` });
  console.log('\nAll old Exercise records:', allOld.rows.map(r => r.name).join(', '));
  c.close();
})().catch(e => console.error(e));
