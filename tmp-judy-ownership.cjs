const { createClient } = require('@libsql/client');
const c = createClient({ url: 'file:./dev.db' });
(async () => {
  const uid = 'cmmzy983y01kblgc2pggt4tye';
  const q = await c.execute({ sql: `
    SELECT
      COUNT(*) AS totalLogs,
      SUM(CASE WHEN pe.userId = ? THEN 1 ELSE 0 END) AS logsOnJudyExercises,
      SUM(CASE WHEN pe.userId != ? THEN 1 ELSE 0 END) AS logsOnOtherUsersExercises
    FROM ProgressionLog pl
    JOIN UserProgressionLevel upl ON upl.id = pl.userProgressionId
    JOIN ProgressionExercise pe ON pe.id = upl.exerciseId
    WHERE upl.userId = ?
  `, args: [uid, uid, uid] });
  console.log(JSON.stringify(q.rows[0], null, 2));

  const ex = await c.execute({ sql: `
    SELECT DISTINCT pe.userId AS exerciseOwnerId, pe.name
    FROM ProgressionLog pl
    JOIN UserProgressionLevel upl ON upl.id = pl.userProgressionId
    JOIN ProgressionExercise pe ON pe.id = upl.exerciseId
    WHERE upl.userId = ?
    ORDER BY pe.name
  `, args: [uid] });
  console.log('\nDistinct exercise owner IDs in Judy logs:', [...new Set(ex.rows.map(r => r.exerciseOwnerId))]);
  c.close();
})().catch(e => console.error(e));
