const { createClient } = require('@libsql/client');
const c = createClient({ url: 'file:./dev.db' });
(async () => {
  const uid = 'cmmw327mb00001sc2w39wdmos';
  const pe = await c.execute({ sql: `SELECT id, name, category, bodyweight, weighted, rings, equipmentType FROM ProgressionExercise WHERE userId = ? AND name = 'Dumbbell Curl' LIMIT 1`, args: [uid] });
  console.log('EX', JSON.stringify(pe.rows, null, 2));
  if (!pe.rows.length) return;
  const exId = pe.rows[0].id;
  const tiers = await c.execute({ sql: `SELECT level, name, targetRepsText, targetReps, description FROM ProgressionTier WHERE exerciseId = ? ORDER BY level`, args: [exId] });
  console.log('TIERS', JSON.stringify(tiers.rows, null, 2));
  const logs = await c.execute({ sql: `SELECT pl.id, pl.level, pl.weight1, pl.weight2, pl.weight3, pl.createdAt FROM ProgressionLog pl JOIN UserProgressionLevel upl ON upl.id = pl.userProgressionId WHERE upl.userId = ? AND upl.exerciseId = ? ORDER BY pl.createdAt DESC LIMIT 6`, args: [uid, exId] });
  console.log('LOGS', JSON.stringify(logs.rows, null, 2));
  c.close();
})().catch(e => { console.error(e); process.exit(1); });
