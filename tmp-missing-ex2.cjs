const { createClient } = require('@libsql/client');
const c = createClient({ url: 'file:./dev.db' });
(async () => {
  // List all exercise names in logs alongside the library name
  const logsEx = await c.execute({ sql: `
    SELECT DISTINCT upl.exerciseId, pe.name AS libraryName
    FROM ProgressionLog pl
    JOIN UserProgressionLevel upl ON upl.id = pl.userProgressionId
    LEFT JOIN ProgressionExercise pe ON pe.id = upl.exerciseId
    ORDER BY pe.name
  ` });
  
  console.log('All exercises referenced in logs:');
  logsEx.rows.forEach(r => console.log(`  ${r.libraryName ?? '(MISSING)'} [${r.exerciseId}]`));

  // Also check if hollow body appears under any name in the exercise library
  const allEx = await c.execute({ sql: `SELECT id, name, wuxiaName FROM ProgressionExercise ORDER BY name` });
  console.log(`\nTotal exercises in library: ${allEx.rows.length}`);
  console.log('\nAll library exercises:');
  allEx.rows.forEach(r => console.log(`  ${r.name} / ${r.wuxiaName}`));
  c.close();
})().catch(e => console.error(e));
