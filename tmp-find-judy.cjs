const { createClient } = require('@libsql/client');
const c = createClient({ url: 'file:./dev.db' });
(async () => {
  const users = await c.execute({ sql: `SELECT id, username, name FROM User WHERE lower(username) LIKE '%judy%' OR lower(name) LIKE '%judy%'` });
  console.log(JSON.stringify(users.rows, null, 2));
  c.close();
})().catch(e => console.error(e));
