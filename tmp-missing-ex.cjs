const { createClient } = require('@libsql/client');
const c = createClient({ url: 'file:./dev.db' });
(async () => {
  // Get all distinct exercise IDs referenced in logs via UserProgressionLevel
  const logsEx = await c.execute({ sql: `
    SELECT DISTINCT upl.exerciseId, pe.name
    FROM ProgressionLog pl
    JOIN UserProgressionLevel upl ON upl.id = pl.userProgressionId
    LEFT JOIN ProgressionExercise pe ON pe.id = upl.exerciseId
    ORDER BY pe.name
  ` });
  
  // Get all exercises in the library
  const allEx = await c.execute({ sql: `SELECT id, name FROM ProgressionExercise ORDER BY name` });
  const libraryIds = new Set(allEx.rows.map(r => r.id));
  
  const missing = logsEx.rows.filter(r => !libraryIds.has(r.exerciseId));
  const found = logsEx.rows.filter(r => libraryIds.has(r.exerciseId));
  
  console.log('=== IN LOGS BUT NOT IN LIBRARY ===');
  missing.forEach(r => console.log(`  ID: ${r.exerciseId}  Name: ${r.name ?? '(null - deleted?)'}`));
  console.log(`\nTotal logged exercises: ${logsEx.rows.length}`);
  console.log(`In library: ${found.length}`);
  console.log(`Missing from library: ${missing.length}`);
  c.close();
})().catch(e => console.error(e));
