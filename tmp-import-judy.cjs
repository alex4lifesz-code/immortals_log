const { createClient } = require('@libsql/client');
const XLSX = require('xlsx');
const crypto = require('crypto');

const uid = 'cmmzy983y01kblgc2pggt4tye'; // judy
const c = createClient({ url: 'file:./dev.db' });

const EXERCISE_IDS = {
  'Barbell Bench Press':          'cmmzsqdvt017zlgc2yqigo8m8',
  'Barbell Squat':                'c9a3113c43164d99914293b609ffc7b8',
  'Cable Face Pull':              'cmmzt3ykq01fglgc2q19cwr2r',
  'Cable Row':                    'cmmzt3yk001eylgc20n0dw1gn',
  'Calf Raise':                   'cb7b7fdbc01044d997d6b623111fb640',
  'Deadlift':                     'cmmzt3ypx01jilgc2ddrgcqlt',
  'Decline Barbell Bench Press':  'cmmzsqdwf018glgc2gmh4udcb',
  'Dip':                          'cmmzsqe1w01cllgc2di3d2ko3',
  'Dragon Flag':                  'cmmzsq3u70143lgc2vg8w1gas',
  'Dumbbell Bench Press':         'cmmzsqdxo0198lgc29r2iojpu',
  'Dumbbell Curl':                'cmmzt3ymm01gzlgc26pawfr73',
  'Dumbbell Forearm Curl':        '801a72eaadc9470fab1c0e3863a89ebc',
  'Dumbbell Lateral Raise':       'cmmzsqdzg01aklgc2dto117sm',
  'Dumbbell Shoulder Press':      'cmmzsqdyw01a3lgc2dfurhzem',
  'Front Lever':                  'cmmw1u2gr000sn8c2qppiwjsj',
  'Incline Barbell Bench Press':  'cmmzsqdx1018tlgc2qo0mqnmw',
  'Incline Dumbbell Bench Press': 'cmmzsqdya019olgc29v1upslk',
  'Lat Pulldown':                 'cmmzt3yje01eflgc27946aej5',
  'One Arm Pull Up':              'cmmzsq3oa00yvlgc2t3l8vaec',
  'Planche':                      'cmmzsq3po0105lgc2jjn8x0wz',
  'Pull Up':                      'cmmzt3yld01fxlgc2fei4nyux',
  'Seated Leg Curl':              '56b2515633084bda9491c44b42a4d1e0',
  'Seated Leg Extension':         'd35f66801da54593907db45c37738681',
};

function toISODate(excelSerial, seqOffsetMs = 0) {
  const ms = Math.round((excelSerial - 25569) * 86400 * 1000) + 43200000 + seqOffsetMs;
  return new Date(ms).toISOString();
}

function normalizeName(name) {
  return String(name || '').trim();
}

(async () => {
  const wb = XLSX.readFile('./judyworkout.xlsx');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { defval: null });

  const uplResult = await c.execute({
    sql: 'SELECT id, exerciseId FROM UserProgressionLevel WHERE userId = ?',
    args: [uid],
  });
  const uplByExId = new Map(uplResult.rows.map(r => [r.exerciseId, r.id]));

  let createdUpl = 0;
  for (const row of rows) {
    const exName = normalizeName(row.judy);
    const exId = EXERCISE_IDS[exName];
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

  const seqMap = new Map();
  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const exName = normalizeName(row.judy);
    const exId = EXERCISE_IDS[exName];
    if (!exId) { skipped++; continue; }

    const uplId = uplByExId.get(exId);
    if (!uplId) { skipped++; continue; }

    const dateVal = row.date;
    if (typeof dateVal !== 'number') { skipped++; continue; }

    const seqKey = `${dateVal}-${exName}`;
    const seq = seqMap.get(seqKey) || 0;
    seqMap.set(seqKey, seq + 1);
    const createdAt = toISODate(dateVal, seq * 5000);

    const w1 = row.W1 != null && row.W1 !== '' ? Number(row.W1) : null;
    const w2 = row.W2 != null && row.W2 !== '' ? Number(row.W2) : null;
    const w3 = row.W3 != null && row.W3 !== '' ? Number(row.W3) : null;
    const r1 = row.R1 != null && row.R1 !== '' ? Math.floor(Number(row.R1)) : null;
    const r2 = row.R2 != null && row.R2 !== '' ? Math.floor(Number(row.R2)) : null;
    const r3 = row.R3 != null && row.R3 !== '' ? Math.floor(Number(row.R3)) : null;

    const id = crypto.randomBytes(14).toString('hex').substring(0, 25);
    await c.execute({
      sql: `INSERT INTO ProgressionLog
            (id, userProgressionId, level, weight1, reps1, weight2, reps2, weight3, reps3, holdTime, holdTime2, holdTime3, modifier, variant, notes, completed, createdAt)
            VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, 1, ?)`,
      args: [
        id, uplId,
        Number.isFinite(w1) ? w1 : null,
        Number.isFinite(r1) ? r1 : null,
        Number.isFinite(w2) ? w2 : null,
        Number.isFinite(r2) ? r2 : null,
        Number.isFinite(w3) ? w3 : null,
        Number.isFinite(r3) ? r3 : null,
        row.Notes ? String(row.Notes).slice(0, 1000) : null,
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
    createdUserProgressionLevels: createdUpl,
    inserted,
    skipped,
    totalLogsForJudy: count.rows[0]?.c ?? null,
  }, null, 2));

  c.close();
})().catch(e => { console.error(e); process.exit(1); });
