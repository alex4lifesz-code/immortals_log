const { createClient } = require('@libsql/client');
const XLSX = require('xlsx');
const crypto = require('crypto');

const uid = 'cmmzy983y01kblgc2pggt4tye';
const c = createClient({ url: 'file:./dev.db' });

const ALIAS = {
  '1-Arm Cable Tricep Pushdowns': 'Cable Tricep Pushdown',
  'Assisted Pull Ups': 'Pull Up',
  'B Stance RDL': 'Deadlift',
  'BB Row': 'Barbell Row',
  'BB Squats': 'Barbell Squat',
  'Cable Bicep Curl': 'Barbell Curl',
  'Cable Face Pulls': 'Cable Face Pull',
  'Cable Rear Delt': 'Reverse Fly',
  'Cable Tricep Pushdowns': 'Cable Tricep Pushdown',
  'Chest Fly (Machine & Cable)': 'Chest Fly',
  'DB Bench Press': 'Dumbbell Bench Press',
  'DB Hammer Curl': 'Hammer Curl',
  'DB Lateral Raises': 'Dumbbell Lateral Raise',
  'DB Shoulder Press': 'Dumbbell Shoulder Press',
  'EB Bicep Curl  (Ezy Bar)': 'Barbell Curl',
  'Front Raises': 'Front Raise',
  'Hamstring Curls': 'Seated Leg Curl',
  'Hanging Leg Raises': 'Hanging Leg Raise',
  'Hip Abduction - (Leaning Back)': 'Hip Abduction (Leaning Back)',
  'Hip Abduction - (Leaning Forward)': 'Hip Abduction (Leaning Forward)',
  'Hip Abduction - (Pulses)': 'Hip Abduction (Pulses)',
  'Incline DB Bench Press (45°)': 'Incline Dumbbell Bench Press',
  'Incline DB Bench Press (45�)': 'Incline Dumbbell Bench Press',
  'Machine Row': 'Cable Row',
  'Negative Pull Ups': 'Pull Up',
  'Overhead Lat Pulldowns': 'Lat Pulldown',
  'Rear Delt Flys': 'Reverse Fly',
  'Romanian Deadlifts': 'Deadlift',
  'Seated Cable Row': 'Cable Row',
  'Seated Leg Extensions': 'Seated Leg Extension',
  'Single-Leg Extensions': 'Seated Leg Extension',
  'T-Bar': 'Barbell Row'
};

function toISODate(excelSerial, seqOffsetMs = 0) {
  const ms = Math.round((excelSerial - 25569) * 86400 * 1000) + 43200000 + seqOffsetMs;
  return new Date(ms).toISOString();
}

(async () => {
  const wb = XLSX.readFile('./judyworkout.xlsx');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { defval: null });

  const progressionExerciseRows = await c.execute({
    sql: 'SELECT id, name FROM ProgressionExercise WHERE userId = ?',
    args: [uid],
  });
  const exerciseIdByName = new Map(
    progressionExerciseRows.rows.map((row) => [String(row.name).trim().toLowerCase(), row.id])
  );

  const uplRows = await c.execute({ sql: 'SELECT id, exerciseId FROM UserProgressionLevel WHERE userId = ?', args: [uid] });
  const uplByExId = new Map(uplRows.rows.map(r => [r.exerciseId, r.id]));

  for (const row of rows) {
    const rawName = String(row.judy || '').trim();
    const canonical = ALIAS[rawName] || rawName;
    const exId = exerciseIdByName.get(canonical.toLowerCase());
    if (!exId || uplByExId.has(exId)) continue;
    const newId = crypto.randomBytes(14).toString('hex').substring(0, 25);
    await c.execute({
      sql: `INSERT INTO UserProgressionLevel (id, userId, exerciseId, currentLevel, createdAt, updatedAt) VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))`,
      args: [newId, uid, exId],
    });
    uplByExId.set(exId, newId);
  }

  await c.execute({ sql: `DELETE FROM ProgressionLog WHERE userProgressionId IN (SELECT id FROM UserProgressionLevel WHERE userId = ?)`, args: [uid] });

  let lastDate = null;
  const seqMap = new Map();
  let inserted = 0;
  let skipped = 0;
  const skippedNames = new Set();

  for (const row of rows) {
    const rawName = String(row.judy || '').trim();
    const canonical = ALIAS[rawName] || rawName;
    const exId = exerciseIdByName.get(canonical.toLowerCase());
    const uplId = exId ? uplByExId.get(exId) : null;

    const dateVal = typeof row.date === 'number' ? row.date : lastDate;
    if (typeof row.date === 'number') lastDate = row.date;

    if (!exId || !uplId || typeof dateVal !== 'number') {
      skipped++;
      skippedNames.add(rawName);
      continue;
    }

    const seqKey = `${dateVal}-${canonical}`;
    const seq = seqMap.get(seqKey) || 0;
    seqMap.set(seqKey, seq + 1);
    const createdAt = toISODate(dateVal, seq * 5000);

    const num = (v) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
    const int = (v) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Math.floor(Number(v)) : null);

    const id = crypto.randomBytes(14).toString('hex').substring(0, 25);
    await c.execute({
      sql: `INSERT INTO ProgressionLog (id, userProgressionId, level, weight1, reps1, weight2, reps2, weight3, reps3, holdTime, holdTime2, holdTime3, modifier, variant, notes, completed, createdAt)
            VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, NULL, ?, 1, ?)`,
      args: [
        id,
        uplId,
        num(row.W1), int(row.R1),
        num(row.W2), int(row.R2),
        num(row.W3), int(row.R3),
        rawName === 'Assisted Pull Ups' ? 'RB:10kg' : null,
        row.Notes ? String(row.Notes).slice(0, 1000) : null,
        createdAt,
      ],
    });
    inserted++;
  }

  const count = await c.execute({ sql: `SELECT COUNT(*) AS c FROM ProgressionLog pl JOIN UserProgressionLevel upl ON upl.id = pl.userProgressionId WHERE upl.userId = ?`, args: [uid] });
  console.log(JSON.stringify({ inserted, skipped, skippedExerciseNames: [...skippedNames].sort(), totalLogsForJudy: count.rows[0]?.c ?? null }, null, 2));

  c.close();
})().catch(e => { console.error(e); process.exit(1); });
