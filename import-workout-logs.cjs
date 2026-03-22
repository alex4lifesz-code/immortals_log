const { createClient } = require('@libsql/client');
const XLSX = require('xlsx');
const crypto = require('crypto');

const uid = 'cmmw327mb00001sc2w39wdmos';
const c = createClient({ url: 'file:./dev.db' });

// Exercise name → DB ID (canonical when two Front Levers exist)
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

// Exercises where W column = bodyweight
const BW_EXERCISES = new Set(['Pull Up', 'Dip', 'Front Lever', 'Planche', 'Dragon Flag', 'One Arm Pull Up']);

function toISODate(excelSerial, seqOffsetMs = 0) {
  // Excel date serial → UTC noon + sequence offset
  const ms = Math.round((excelSerial - 25569) * 86400 * 1000) + 43200000 + seqOffsetMs;
  return new Date(ms).toISOString();
}

function buildModifier(baseModifier, resistanceBandKg) {
  const parts = [];
  if (baseModifier) parts.push(baseModifier);
  if (resistanceBandKg) parts.push(`RB:${resistanceBandKg}kg`);
  return parts.length > 0 ? parts.join(' | ') : null;
}

function parseRow(row) {
  const exName = row.judy;
  const note = (row.Notes || '').trim();
  const noteLower = note.toLowerCase();

  const w1 = row.W1 != null && row.W1 !== '' ? parseFloat(row.W1) : null;
  const w2 = row.W2 != null && row.W2 !== '' ? parseFloat(row.W2) : null;
  const w3 = row.W3 != null && row.W3 !== '' ? parseFloat(row.W3) : null;
  const r1 = row.R1 != null && row.R1 !== '' ? parseInt(row.R1) : null;
  const r2 = row.R2 != null && row.R2 !== '' ? parseInt(row.R2) : null;
  const r3 = row.R3 != null && row.R3 !== '' ? parseInt(row.R3) : null;

  let weight1 = null, weight2 = null, weight3 = null;
  let holdTime = null, holdTime2 = null, holdTime3 = null;
  let reps1 = r1, reps2 = r2, reps3 = r3;
  let variant = null;
  let modifier = null;
  let resistanceBandKg = null;

  const wValues = [w1, w2, w3].filter(v => v != null);
  const maxW = wValues.length ? Math.max(...wValues) : 0;

  if (exName === 'Front Lever') {
    if (maxW < 30) {
      // Small values = hold times in seconds (e.g. tucked FL W:5/6/7)
      holdTime  = w1 != null ? Math.round(w1) : null;
      holdTime2 = w2 != null ? Math.round(w2) : null;
      holdTime3 = w3 != null ? Math.round(w3) : null;
    } else {
      weight1 = w1; weight2 = w2; weight3 = w3;
    }
    if (noteLower.includes('tucked'))         variant = 'Tucked';
    else if (noteLower.includes('raises'))    variant = 'Front Lever Raises';
    else if (noteLower.includes('pulls'))     variant = 'Front Lever Pulls';

  } else if (exName === 'Pull Up') {
    weight1 = w1; weight2 = w2; weight3 = w3;
    if (maxW < 30) {
      // Small W = added weight (weighted pull up)
      variant = 'Weighted Pull Up';
    }
    if (noteLower.includes('blue resistance') || noteLower.includes('blue band')) {
      resistanceBandKg = 10;
      variant = null; // band-assisted, not weighted pull up
    }

  } else if (BW_EXERCISES.has(exName)) {
    // Dip, Planche, Dragon Flag, One Arm Pull Up — body weight
    weight1 = w1; weight2 = w2; weight3 = w3;

  } else {
    // Gym exercises — actual weight
    weight1 = w1; weight2 = w2; weight3 = w3;

    // Cable Row variants from notes
    if (exName === 'Cable Row') {
      if (noteLower.includes('close grip') || noteLower.includes('flat close grip')) {
        variant = 'Close Grip Cable Row';
      }
    }
  }

  const modifierStr = buildModifier(modifier, resistanceBandKg);

  return {
    weight1, weight2, weight3,
    reps1, reps2, reps3,
    holdTime, holdTime2, holdTime3,
    variant,
    modifier: modifierStr,
    notes: note || null,
  };
}

async function main() {
  const wb = XLSX.readFile('./workoutxlsx.xlsx');
  const ws = wb.Sheets['Sheet1'];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  console.log(`Loaded ${rows.length} rows from xlsx`);

  // Get all UserProgressionLevel records for this user
  const uplResult = await c.execute({
    sql: 'SELECT id, exerciseId FROM UserProgressionLevel WHERE userId = ?',
    args: [uid],
  });
  const uplByExId = new Map(uplResult.rows.map(r => [r.exerciseId, r.id]));

  // Create UserProgressionLevel for any exercise missing one
  const neededNames = [...new Set(rows.map(r => r.judy))];
  for (const name of neededNames) {
    const exId = EXERCISE_IDS[name];
    if (!exId) { console.warn(`  ⚠ No exercise mapping for: "${name}"`); continue; }
    if (!uplByExId.has(exId)) {
      const newId = crypto.randomBytes(14).toString('hex').substring(0, 25);
      await c.execute({
        sql: `INSERT INTO UserProgressionLevel (id, userId, exerciseId, currentLevel, createdAt, updatedAt)
              VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))`,
        args: [newId, uid, exId],
      });
      uplByExId.set(exId, newId);
      console.log(`  ✓ Created UPL for: ${name}`);
    }
  }

  // Delete all existing ProgressionLog entries for this user
  const del = await c.execute({
    sql: `DELETE FROM ProgressionLog
          WHERE userProgressionId IN (SELECT id FROM UserProgressionLevel WHERE userId = ?)`,
    args: [uid],
  });
  console.log(`Deleted ${del.rowsAffected} existing log entries`);

  // Track per-(date+exercise) sequence to preserve row order within a session
  const seqMap = new Map();

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const exName = row.judy;
    const exId = EXERCISE_IDS[exName];
    if (!exId) { skipped++; continue; }

    const uplId = uplByExId.get(exId);
    if (!uplId) { skipped++; continue; }

    const seqKey = `${row.Date}-${exName}`;
    const seq = seqMap.get(seqKey) || 0;
    seqMap.set(seqKey, seq + 1);
    const createdAt = toISODate(row.Date, seq * 5000); // 5-sec spacing per duplicate

    const p = parseRow(row);
    const logId = crypto.randomBytes(14).toString('hex').substring(0, 25);

    await c.execute({
      sql: `INSERT INTO ProgressionLog
              (id, userProgressionId, level,
               weight1, reps1, weight2, reps2, weight3, reps3,
               holdTime, holdTime2, holdTime3,
              modifier, variant, notes, completed, createdAt)
            VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      args: [
        logId, uplId,
        p.weight1, p.reps1,
        p.weight2, p.reps2,
        p.weight3, p.reps3,
        p.holdTime, p.holdTime2, p.holdTime3,
        p.modifier, p.variant, p.notes,
          createdAt,
      ],
    });
    inserted++;
  }

  console.log(`\nDone — inserted: ${inserted}, skipped: ${skipped}`);

  // Quick verification
  const verify = await c.execute({
    sql: `SELECT pe.name, COUNT(*) as cnt
          FROM ProgressionLog pl
          JOIN UserProgressionLevel upl ON upl.id = pl.userProgressionId
          JOIN ProgressionExercise pe ON pe.id = upl.exerciseId
          WHERE upl.userId = ?
          GROUP BY pe.name ORDER BY pe.name`,
    args: [uid],
  });
  console.log('\nLog counts by exercise:');
  verify.rows.forEach(r => console.log(`  ${r.name}: ${r.cnt}`));

  c.close();
}

main().catch(e => { console.error(e); process.exit(1); });
