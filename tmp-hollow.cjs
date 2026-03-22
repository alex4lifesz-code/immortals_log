const { createClient } = require('@libsql/client');
const c = createClient({ url: 'file:./dev.db' });
(async () => {
  const r = await c.execute({ sql: `SELECT id, name, category FROM ProgressionExercise WHERE lower(name) LIKE '%hollow%'` });
  console.log(JSON.stringify(r.rows, null, 2));
  c.close();
})().catch(e => console.error(e));
