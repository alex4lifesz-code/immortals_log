const { createClient } = require('@libsql/client');
const c = createClient({ url: 'file:./dev.db' });
(async () => {
  const uid = 'cmmw327mb00001sc2w39wdmos';
  // Get all logs, check which have holdTime vs reps-only
  const logs = await c.execute({ sql: `
    SELECT pl.id, pe.name AS exName, pl.level, pl.reps1, pl.reps2, pl.reps3, pl.holdTime, pl.holdTime2, pl.holdTime3, pl.weight1, pl.weight2, pl.weight3
    FROM ProgressionLog pl
    JOIN UserProgressionLevel upl ON upl.id = pl.userProgressionId
    JOIN ProgressionExercise pe ON pe.id = upl.exerciseId
    WHERE upl.userId = ?
    ORDER BY pe.name, pl.createdAt DESC
  `, args: [uid] });
  
  // Separate: has holdTime, has reps only, has weights
  const holdLogs = logs.rows.filter(r => r.holdTime != null || r.holdTime2 != null || r.holdTime3 != null);
  const repsOnlyNoHold = logs.rows.filter(r => r.holdTime == null && r.holdTime2 == null && r.holdTime3 == null && (r.reps1 != null || r.reps2 != null || r.reps3 != null) && r.weight1 == null && r.weight2 == null && r.weight3 == null);
  
  console.log('=== ENTRIES WITH holdTime ===');
  holdLogs.forEach(r => console.log(`  ${r.exName} lv${r.level}: hold=${r.holdTime}/${r.holdTime2}/${r.holdTime3} reps=${r.reps1}/${r.reps2}/${r.reps3}`));
  
  console.log('\n=== REPS-ONLY (no holdTime, no weight) ===');
  repsOnlyNoHold.forEach(r => console.log(`  ${r.exName} lv${r.level}: reps=${r.reps1}/${r.reps2}/${r.reps3}`));
  
  c.close();
})().catch(e => console.error(e));
