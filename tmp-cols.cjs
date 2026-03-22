const { createClient } = require('@libsql/client');
const c = createClient({ url:'file:./dev.db' });
(async()=>{
  for (const t of ['ProgressionExercise','ProgressionTier','ProgressionVariation','ProgressionModifier','UserProgressionLevel']) {
    const cols = await c.execute({ sql:`PRAGMA table_info(${t})`});
    console.log(t, cols.rows.map(r=>r.name).join(', '));
  }
  c.close();
})();
