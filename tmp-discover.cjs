const { createClient } = require('@libsql/client');
const c = createClient({ url: 'file:./dev.db' });
(async () => {
  const uid = 'cmmw327mb00001sc2w39wdmos';

  // Schema of ProgressionLog
  const schema = await c.execute({ sql: `PRAGMA table_info(ProgressionLog)` });
  console.log('ProgressionLog columns:', schema.rows.map(r => r.name).join(', '));

  // Variants and modifiers for relevant exercises
  const exercises = ['Front Lever', 'Pull Up', 'Planche', 'Dragon Flag', 'Dip', 'One Arm Pull Up', 'Cable Row'];
  for (const name of exercises) {
    const ex = await c.execute({ sql: `SELECT id FROM ProgressionExercise WHERE name = ?`, args: [name] });
    if (!ex.rows.length) { console.log(`${name}: NOT FOUND`); continue; }
    const exId = ex.rows[0].id;
    const vars = await c.execute({ sql: `SELECT name FROM ProgressionVariation WHERE exerciseId = ?`, args: [exId] });
    const mods = await c.execute({ sql: `SELECT type FROM ProgressionModifier WHERE exerciseId = ?`, args: [exId] });
    console.log(`${name} variants: [${vars.rows.map(r => r.name).join(', ')}] | modifiers: [${mods.rows.map(r => r.type).join(', ')}]`);
  }

  // Also grab all exercise name->id mapping
  const allEx = await c.execute({ sql: `SELECT id, name FROM ProgressionExercise ORDER BY name` });
  console.log('\nAll exercises:');
  allEx.rows.forEach(r => console.log(`  ${r.name}: ${r.id}`));
  c.close();
})().catch(e => console.error(e));
