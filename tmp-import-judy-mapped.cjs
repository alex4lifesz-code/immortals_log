const { createClient } = require('@libsql/client');
const XLSX = require('xlsx');
const crypto = require('crypto');

const uid = 'cmmzy983y01kblgc2pggt4tye'; // judy
const c = createClient({ url: 'file:./dev.db' });

const EXERCISE_IDS = {
  'Barbell Bench Press':          'cmmzsqdvt017zlgc2yqigo8m8',
  'Barbell Curl':                 'cmmzt3ym101gilgc2y2g048in',
  'Barbell Row':                  'cmmzt3yi601dhlgc2f7jptkwc',
  'Barbell Squat':                'c9a3113c43164d99914293b609ffc7b8',
  'Cable Face Pull':              'cmmzt3ykq01fglgc2q19cwr2r',
  'Cable Row':                    'cmmzt3yk001eylgc20n0dw1gn',
  'Cable Tricep Pushdown':        'cmmzsqe1b01c2lgc2bempc0aj',
  'Calf Raise':                   'cb7b7fdbc01044d997d6b623111fb640',
  'Chest Fly':                    'cmmzsqe0p01bjlgc28v4oacvh',
  'Deadlift':                     'cmmzt3ypx01jilgc2ddrgcqlt',
  'Decline Barbell Bench Press':  'cmmzsqdwf018glgc2gmh4udcb',
  'Dip':                          'cmmzsqe1w01cllgc2di3d2ko3',
  'Dumbbell Bench Press':         'cmmzsqdxo0198lgc29r2iojpu',
  'Dumbbell Curl':                'cmmzt3ymm01gzlgc26pawfr73',
  'Dumbbell Lateral Raise':       'cmmzsqdzg01aklgc2dto117sm',
  'Dumbbell Shoulder Press':      'cmmzsqdyw01a3lgc2dfurhzem',
  'Front Raise':                  'cmmzsqe0501b1lgc21lio9g22',
  'Hammer Curl':                  'cmmzt3yn801hjlgc2kcgrbv3u',
  'Incline Dumbbell Bench Press': 'cmmzsqdya019olgc29v1upslk',
  'Lat Pulldown':                 'cmmzt3yje01eflgc27946aej5',
  'Pull Up':                      'cmmzt3yld01fxlgc2fei4nyux',
  'Reverse Fly':                  'cmmzt3ynv01i1lgc2l24eff4z',
  'Seated Leg Curl':              '56b2515633084bda9491c44b42a4d1e0',
  'Seated Leg Extension':         'd35f66801da54593907db45c37738681',
  'Shrug':                        'cmmzt3yp801j0lgc2cpc36880',
};

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
  'Incline DB Bench Press (45°)': 'Incline Dumbbell Bench Press',
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

  const uplResult = await c.execute({ sql: 'SELECT id, exerciseId FROM UserProgressionLevel WHERE userId = ?', args: [uid] });
  const uplByExId = new Map(uplResult.rows.map(r => [r.exerciseId, r.id]));

  let createdUpl = 0;
  for (const row of rows) {
    const rawName = String(row.judy || '').trim();
    const canonical = ALIAS[rawName] || rawName;
    const exId = EXERCISE_IDS[canonical];
    if (!exId || uplByExId.has(exId)) continue;
    const newId = crypto.randomBytes(14).toString('hex').substring(0, 25);
    await c.execute({
      sql: `INSERT INTO UserProgressionLevel (id, userId, exerciseId, currentLevel, createdAt, updatedAt)
            VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))`,
      args: [newId, uid, exId],
    });
    uplByExId.set(exId, newId);
    createdUpl++;
  }

  // Rebuild Judy logs from workbook to avoid partial/duplicate import
  const del = await c.execute({
    sql: `DELETE FROM ProgressionLog WHERE userProgressionId IN (SELECT id FROM UserProgressionLevel WHERE userId = ?)`,
    args: [uid],
  });

  const seqMap = new Map();
  let inserted = 0;
  let skipped = 0;
  const skippedNames = new Set();

  for (const row of rows) {
    const rawName = String(row.judy || '').trim();
    const canonical = ALIAS[rawName] || rawName;
    const exId = EXERCISE_IDS[canonical];
    if (!exId) { skipped++; skippedNames.add(rawName); continue; }
    const uplId = uplByExId.get(exId);
    if (!uplId) { skipped++; skippedNames.add(rawName); continue; }

    const dateVal = row.date;
    if (typeof dateVal !== 'number') { skipped++; skippedNames.add(rawName); continue; }

    const seqKey = `${dateVal}-${canonical}`;
    const seq = seqMap.get(seqKey) || 0;
    seqMap.set(seqKey, seq + 1);
    const createdAt = toISODate(dateVal, seq * 5000);

    const w1 = row.W1 != null && row.W1 !== '' ? Number(row.W1) : null;
    const w2 = row.W2 != null && row.W2 !== '' ? Number(row.W2) : null;
    const w3 = row.W3 != null && row.W3 !== '' ? Number(row.W3) : null;
    const r1 = row.R1 != null && row.R1 !== '' ? Math.floor(Number(row.R1)) : null;
    const r2 = row.R2 != null && row.R2 !== '' ? Math.floor(Number(row.R2)) : null;
    const r3 = row.R3 != null && row.R3 !== '' ? Math.floor(Number(row.R3)) : null;

    const note = row.Notes ? String(row.Notes).slice(0, 1000) : null;
    let modifier = null;
    if (rawName === 'Assisted Pull Ups') modifier = 'RB:10kg';

    const id = crypto.randomBytes(14).toString('hex').substring(0, 25);
    await c.execute({
      sql: `INSERT INTO ProgressionLog
            (id, userProgressionId, level, weight1, reps1, weight2, reps2, weight3, reps3, holdTime, holdTime2, holdTime3, modifier, variant, notes, completed, createdAt)
            VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, NULL, ?, 1, ?)`,
      args: [
        id, uplId,
        Number.isFinite(w1) ? w1 : null,
        Number.isFinite(r1) ? r1 : null,
        Number.isFinite(w2) ? w2 : null,
        Number.isFinite(r2) ? r2 : null,
        Number.isFinite(w3) ? w3 : null,
        Number.isFinite(r3) ? r3 : null,
        modifier,
        note,
        createdAt,
      ],
    });
    inserted++;
  }

  const count = await c.execute({
    sql: `SELECT COUNT(*) AS c FROM ProgressionLog pl JOIN UserProgressionLevel upl ON upl.id = pl.userProgressionId WHERE upl.userId = ?`,
    args: [uid],
  });

  console.log(JSON.stringify({
    workbookRows: rows.length,
    deletedPreviousLogs: del.rowsAffected,
    createdUserProgressionLevels: createdUpl,
    inserted,
    skipped,
    skippedExerciseNames: [...skippedNames].sort(),
    totalLogsForJudy: count.rows[0]?.c ?? null,
  }, null, 2));

  c.close();
})().catch(e => { console.error(e); process.exit(1); });
