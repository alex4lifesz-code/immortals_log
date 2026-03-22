const { createClient } = require("@libsql/client");
require("dotenv/config");
const c = createClient({ url: process.env.DATABASE_URL });

async function verify() {
  // New exercises created by import
  const newExercises = ['Pull-Up','Bench Press','Leg Extension','Leg Curl','Seated Cable Row','Dumbbell Bicep Curl'];
  for (const name of newExercises) {
    const r = await c.execute({ sql: "SELECT id FROM ProgressionExercise WHERE name = ? AND userId = (SELECT id FROM User WHERE username = 'admin')", args: [name] });
    console.log(name + ': ' + (r.rows.length > 0 ? 'EXISTS (' + r.rows[0].id + ')' : 'MISSING'));
  }

  // Variations created
  const newVars = await c.execute("SELECT v.name, e.name as eName FROM ProgressionVariation v JOIN ProgressionExercise e ON v.exerciseId = e.id WHERE v.name IN ('High Pull-Up','Chin-Up','1-Arm Pull-Up Negative','Full Negative','Tucked Negative','Hold','Ice Cream Maker','Incline Barbell (45°)','Decline Barbell','Dumbbell Flat','Incline Dumbbell (45°)','Tucked Press','Tucked Planche Press')");
  console.log('\nNew variations (' + newVars.rows.length + '):');
  newVars.rows.forEach(r => console.log('  ' + r.eName + ' -> ' + r.name));

  // Modifier
  const mods = await c.execute("SELECT m.type, e.name as eName FROM ProgressionModifier m JOIN ProgressionExercise e ON m.exerciseId = e.id WHERE e.name = 'Pull-Up' AND m.type = 'weighted'");
  console.log('\nWeighted modifier on Pull-Up:', mods.rows.length > 0 ? 'EXISTS' : 'MISSING');

  // Logs count by exercise
  const logStats = await c.execute(`
    SELECT pe.name, COUNT(pl.id) as logCount
    FROM ProgressionLog pl
    JOIN UserProgressionLevel upl ON pl.userProgressionId = upl.id
    JOIN ProgressionExercise pe ON upl.exerciseId = pe.id
    WHERE upl.userId = (SELECT id FROM User WHERE username = 'admin')
    GROUP BY pe.name
    ORDER BY logCount DESC
  `);
  console.log('\nLogs by exercise:');
  logStats.rows.forEach(r => console.log('  ' + r.name + ': ' + r.logCount + ' logs'));

  // Date range
  const dates = await c.execute(`
    SELECT MIN(pl.createdAt) as earliest, MAX(pl.createdAt) as latest, COUNT(*) as total
    FROM ProgressionLog pl
    JOIN UserProgressionLevel upl ON pl.userProgressionId = upl.id
    WHERE upl.userId = (SELECT id FROM User WHERE username = 'admin')
  `);
  console.log('\nDate range:', dates.rows[0].earliest, 'to', dates.rows[0].latest, '(' + dates.rows[0].total + ' total)');

  c.close();
}
verify();
