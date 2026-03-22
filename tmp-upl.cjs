const { createClient } = require('@libsql/client');
const c = createClient({ url: 'file:./dev.db' });
(async () => {
  const cols = await c.execute({ sql: `PRAGMA table_info(UserProgressionLevel)` });
  console.log('UPL columns:', cols.rows.map(r => `${r.name} (${r.type})`).join(', '));
  c.close();
})().catch(e => console.error(e));
