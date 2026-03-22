const { createClient } = require('@libsql/client');
const c = createClient({ url: 'file:./dev.db' });
(async () => {
  const uid = 'cmmw327mb00001sc2w39wdmos';
  const logs = await c.execute({ sql: `
    SELECT pl.id, pe.name AS exName, pe.id AS exId, pl.level,
           pl.reps1, pl.reps2, pl.reps3,
           pl.holdTime, pl.holdTime2, pl.holdTime3,
           pl.weight1, pl.weight2, pl.weight3,
           pl.modifier, pl.variant, pl.notes, pl.createdAt
    FROM ProgressionLog pl
    JOIN UserProgressionLevel upl ON upl.id = pl.userProgressionId
    JOIN ProgressionExercise pe ON pe.id = upl.exerciseId
    WHERE upl.userId = ?
    ORDER BY pe.name, pl.createdAt DESC
  `, args: [uid] });

  // Exercises that have holdTime populated
  const withHold = logs.rows.filter(r => r.holdTime != null || r.holdTime2 != null || r.holdTime3 != null);
  // Exercises that have NO holdTime but ARE "hold-type" based on name
  const holdExerciseNames = ['Hollow Body Hold', 'Dragon Flag', 'Front Lever', 'Back Lever', 'Planche', 'Human Flag', 'L-Sit'];
  const repsAsHold = logs.rows.filter(r =>
    r.holdTime == null && r.holdTime2 == null && r.holdTime3 == null &&
    r.weight1 == null && r.weight2 == null && r.weight3 == null &&
    (r.reps1 != null || r.reps2 != null || r.reps3 != null) &&
    holdExerciseNames.some(n => r.exName && r.exName.toLowerCase().includes(n.toLowerCase()))
  );

  console.log('=== LOGS WITH holdTime ALREADY ===');
  withHold.forEach(r => console.log(`  ${r.exName} lv${r.level}: T=${r.holdTime}/${r.holdTime2}/${r.holdTime3} R=${r.reps1}/${r.reps2}/${r.reps3}`));

  console.log('\n=== HOLD EXERCISES WITH REPS ONLY (no holdTime) ===');
  repsAsHold.forEach(r => console.log(`  ${r.exName} lv${r.level}: R=${r.reps1}/${r.reps2}/${r.reps3} id=${r.id}`));

  // Show ALL logs for Dragon Flag / Hollow Body Hold tier exercises
  const dragonFlag = logs.rows.filter(r => r.exName === 'Dragon Flag');
  console.log('\n=== ALL DRAGON FLAG LOGS ===');
  dragonFlag.forEach(r => console.log(`  lv${r.level}: weight=${r.weight1}/${r.weight2}/${r.weight3} reps=${r.reps1}/${r.reps2}/${r.reps3} hold=${r.holdTime}/${r.holdTime2}/${r.holdTime3}`));

  c.close();
})().catch(e => console.error(e));
