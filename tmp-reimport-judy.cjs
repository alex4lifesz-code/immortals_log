const { createClient } = require('@libsql/client');
const XLSX = require('xlsx');
const crypto = require('crypto');

const uid = 'cmmzy983y01kblgc2pggt4tye';
const workbookPath = './judyworkout.xlsx';
const c = createClient({ url: 'file:./dev.db' });

const ALIAS = {
  '1-Arm Cable Tricep Pushdowns': 'Cable Tricep Pushdown',
  '1-Arm Pull-Up Negatives': 'One Arm Pull Up',
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
  'Dips (Parallel Bars / Rings)': 'Dip',
  'EB Bicep Curl  (Ezy Bar)': 'Barbell Curl',
  'Front Raises': 'Front Raise',
  'Front Lever Hold (seconds)': 'Front Lever',
  'Front Lever Negatives': 'Front Lever',
  'Hamstring Curls': 'Seated Leg Curl',
  'Hanging Leg Raises': 'Hanging Leg Raise',
  'High Pull-Ups': 'Pull Up',
  'Hip Abduction - (Leaning Back)': 'Hip Abduction (Leaning Back)',
  'Hip Abduction - (Leaning Forward)': 'Hip Abduction (Leaning Forward)',
  'Hip Abduction - (Pulses)': 'Hip Abduction (Pulses)',
  'Ice Cream Maker': 'Front Lever',
  'Incline DB Bench Press (45°)': 'Incline Dumbbell Bench Press',
  'Incline DB Bench Press (45�)': 'Incline Dumbbell Bench Press',
  'Machine Row': 'Cable Row',
  'Negative Pull Ups': 'Pull Up',
  'Overhead Lat Pulldowns': 'Lat Pulldown',
  'Pull-Ups': 'Pull Up',
  'Rear Delt Flys': 'Reverse Fly',
  'Romanian Deadlifts': 'Deadlift',
  'Seated Cable Row': 'Cable Row',
  'Seated Leg Extensions': 'Seated Leg Extension',
  'Single-Leg Extensions': 'Seated Leg Extension',
  'T-Bar': 'Barbell Row',
  'Tucked Front Lever Negatives': 'Front Lever',
  'Tucked Planche Presses': 'Planche',
  'Tucked Presses': 'Planche',
  'Weighted Pull-Ups': 'Pull Up',
};

function normKey(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
    .replace(/\uFFFD/g, '°')
    .replace(/\s+/g, ' ');
}

function id25() {
  return crypto.randomBytes(14).toString('hex').slice(0, 25);
}

function toISODate(excelSerial, seqOffsetMs = 0) {
  const base = Math.round((excelSerial - 25569) * 86400 * 1000) + 43200000;
  return new Date(base + seqOffsetMs).toISOString();
}

function toNum(v) {
  return v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
}

function toInt(v) {
  return v != null && v !== '' && Number.isFinite(Number(v)) ? Math.floor(Number(v)) : null;
}

function deriveVariantAndModifier(rawName, sourceName, notes, canonicalName) {
  const src = String(sourceName || rawName || '').trim().toLowerCase();
  const note = String(notes || '').trim().toLowerCase();

  let variant = null;
  let modifier = null;

  if (canonicalName === 'Pull Up') {
    if (src.includes('weighted')) variant = 'Weighted Pull Up';
    else if (src.includes('chin-up') || src.includes('chin up')) variant = 'Chin Up';
    else if (src.includes('high pull')) variant = 'High Pull Up';
    else if (src.includes('assisted')) variant = 'Assisted Pull Up';

    if (note.includes('blue resistance') || note.includes('blue band')) {
      modifier = 'RB:10kg';
      if (!variant) variant = 'Band Assisted Pull Up';
    }
  }

  if (canonicalName === 'Front Lever') {
    if (src.includes('tucked')) variant = 'Tucked Front Lever';
    else if (src.includes('ice cream maker')) variant = 'Ice Cream Maker';
    else if (src.includes('negative')) variant = 'Front Lever Negative';
    else if (src.includes('hold (seconds)')) variant = 'Front Lever Hold';
  }

  if (canonicalName === 'Dip' && src.includes('parallel bars')) {
    variant = 'Parallel Bar Dip';
  }

  if (canonicalName === 'Cable Row') {
    if (note.includes('flat close grip')) variant = 'Flat Close Grip Cable Row';
    else if (note.includes('close grip')) variant = 'Close Grip Cable Row';
  }

  if (canonicalName === 'Planche' && src.includes('tucked')) {
    variant = 'Tucked Planche';
  }

  if (canonicalName === 'One Arm Pull Up' && src.includes('negative')) {
    variant = 'One Arm Pull Up Negative';
  }

  return { variant, modifier, isHoldSeconds: src.includes('hold (seconds)') };
}

async function cloneProgressionExerciseForUser(sourceExerciseId, sourceName, userId) {
  const source = await c.execute({
    sql: 'SELECT * FROM ProgressionExercise WHERE id = ? LIMIT 1',
    args: [sourceExerciseId],
  });

  let src = source.rows[0];

  if (!src) {
    const e = await c.execute({
      sql: 'SELECT * FROM Exercise WHERE id = ? LIMIT 1',
      args: [sourceExerciseId],
    });
    if (!e.rows.length) return null;
    src = e.rows[0];
  }

  const newExId = id25();
  await c.execute({
    sql: `INSERT INTO ProgressionExercise
      (id, name, wuxiaName, difficulty, type, story, tips, category, equipmentType, bodyweight, weighted, rings, primaryMuscles, secondaryMuscles, assignedDays, createdAt, userId, wuxiaDifficulty, wuxiaType, prerequisites, cues, commonMistakes, breathing, safetyConsiderations, competitionStandards)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      newExId,
      src.name || sourceName,
      src.wuxiaName || '',
      src.difficulty || 'Immortal',
      src.type || 'Heaven and Earth United',
      src.story || '',
      src.tips || '[]',
      src.category || src.targetGroup || 'Imported',
      src.equipmentType || 'mixed',
      src.bodyweight == null ? 0 : src.bodyweight,
      src.weighted == null ? 0 : src.weighted,
      src.rings == null ? 0 : src.rings,
      src.primaryMuscles || '',
      src.secondaryMuscles || '',
      src.assignedDays || '',
      new Date().toISOString(),
      userId,
      src.wuxiaDifficulty || src.difficulty || 'Immortal',
      src.wuxiaType || src.type || 'Heaven and Earth United',
      src.prerequisites || '[]',
      src.cues || '[]',
      src.commonMistakes || '[]',
      src.breathing || '',
      src.safetyConsiderations || '[]',
      src.competitionStandards || '{}',
    ],
  });

  const tiers = await c.execute({
    sql: 'SELECT * FROM ProgressionTier WHERE exerciseId = ? ORDER BY level',
    args: [sourceExerciseId],
  });

  for (const t of tiers.rows) {
    await c.execute({
      sql: `INSERT INTO ProgressionTier (id, exerciseId, level, name, wuxiaName, difficulty, description, targetHold, targetReps, wuxiaDifficulty, wuxiaType, targetRepsText)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id25(), newExId, t.level, t.name, t.wuxiaName, t.difficulty, t.description, t.targetHold, t.targetReps, t.wuxiaDifficulty, t.wuxiaType, t.targetRepsText],
    });
  }

  const vars = await c.execute({
    sql: 'SELECT * FROM ProgressionVariation WHERE exerciseId = ?',
    args: [sourceExerciseId],
  });

  for (const v of vars.rows) {
    await c.execute({
      sql: `INSERT INTO ProgressionVariation (id, exerciseId, name, wuxiaName, difficulty, description, wuxiaDifficulty, wuxiaType)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id25(), newExId, v.name, v.wuxiaName, v.difficulty, v.description, v.wuxiaDifficulty, v.wuxiaType],
    });
  }

  const mods = await c.execute({
    sql: 'SELECT * FROM ProgressionModifier WHERE exerciseId = ?',
    args: [sourceExerciseId],
  });

  for (const m of mods.rows) {
    await c.execute({
      sql: `INSERT INTO ProgressionModifier (id, exerciseId, type, available, difficultyMod, notes, method, difficultyIncrease)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id25(), newExId, m.type, m.available, m.difficultyMod, m.notes, m.method, m.difficultyIncrease],
    });
  }

  return newExId;
}

(async () => {
  const wb = XLSX.readFile(workbookPath);
  const ws = wb.Sheets['Sheet1'] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

  const peRows = await c.execute({
    sql: 'SELECT id, name FROM ProgressionExercise WHERE userId = ?',
    args: [uid],
  });
  const judyByName = new Map(peRows.rows.map((r) => [normKey(r.name), r.id]));

  const allProgressions = await c.execute({
    sql: 'SELECT id, name FROM ProgressionExercise',
  });
  const globalProgressionByName = new Map();
  for (const row of allProgressions.rows) {
    const key = normKey(row.name);
    if (!globalProgressionByName.has(key)) {
      globalProgressionByName.set(key, row.id);
    }
  }

  const allExercises = await c.execute({ sql: 'SELECT id, name FROM Exercise' });
  const globalExerciseByName = new Map(allExercises.rows.map((r) => [normKey(r.name), r.id]));

  const canonicalNames = new Set();
  for (const row of rows) {
    const rawName = String(row.judy || '').trim();
    if (!rawName) continue;
    canonicalNames.add(ALIAS[rawName] || rawName);
  }

  let clonedExercises = 0;
  const unresolved = new Set();

  for (const canonical of canonicalNames) {
    const key = normKey(canonical);
    if (judyByName.has(key)) continue;

    const srcProgressionId = globalProgressionByName.get(key);
    const srcExerciseId = globalExerciseByName.get(key);
    const sourceId = srcProgressionId || srcExerciseId;

    if (!sourceId) {
      unresolved.add(canonical);
      continue;
    }

    const clonedId = await cloneProgressionExerciseForUser(sourceId, canonical, uid);
    if (!clonedId) {
      unresolved.add(canonical);
      continue;
    }

    judyByName.set(key, clonedId);
    clonedExercises++;
  }

  const uplRows = await c.execute({
    sql: 'SELECT id, exerciseId FROM UserProgressionLevel WHERE userId = ?',
    args: [uid],
  });
  const uplByExId = new Map(uplRows.rows.map((r) => [r.exerciseId, r.id]));

  let createdUpl = 0;
  for (const exId of judyByName.values()) {
    if (uplByExId.has(exId)) continue;
    const uplId = id25();
    await c.execute({
      sql: `INSERT INTO UserProgressionLevel (id, userId, exerciseId, currentLevel, createdAt, updatedAt)
            VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))`,
      args: [uplId, uid, exId],
    });
    uplByExId.set(exId, uplId);
    createdUpl++;
  }

  const before = await c.execute({
    sql: `SELECT COUNT(*) AS c
          FROM ProgressionLog pl
          JOIN UserProgressionLevel upl ON upl.id = pl.userProgressionId
          WHERE upl.userId = ?`,
    args: [uid],
  });

  const del = await c.execute({
    sql: `DELETE FROM ProgressionLog
          WHERE userProgressionId IN (SELECT id FROM UserProgressionLevel WHERE userId = ?)`,
    args: [uid],
  });

  let lastDate = null;
  const seqMap = new Map();
  let inserted = 0;
  let skipped = 0;
  let inferredVariantRows = 0;
  const skippedNames = new Set();

  for (const row of rows) {
    const rawName = String(row.judy || '').trim();
    if (!rawName) continue;

    const sourceName = String(row.__sourceExercise || rawName).trim();
    const canonical = ALIAS[rawName] || rawName;
    const exId = judyByName.get(normKey(canonical));
    const uplId = exId ? uplByExId.get(exId) : null;

    const rowDate = typeof row.Date === 'number' ? row.Date : row.date;
    if (typeof rowDate === 'number') lastDate = rowDate;
    const dateVal = typeof rowDate === 'number' ? rowDate : lastDate;

    if (!exId || !uplId || typeof dateVal !== 'number') {
      skipped++;
      skippedNames.add(rawName);
      continue;
    }

    const seqKey = `${dateVal}-${canonical}`;
    const seq = seqMap.get(seqKey) || 0;
    seqMap.set(seqKey, seq + 1);
    const createdAt = toISODate(dateVal, seq * 5000);

    const derived = deriveVariantAndModifier(rawName, sourceName, row.Notes, canonical);
    if (derived.variant) inferredVariantRows++;

    const holdTime = derived.isHoldSeconds ? toInt(row.W1) : null;
    const holdTime2 = derived.isHoldSeconds ? toInt(row.W2) : null;
    const holdTime3 = derived.isHoldSeconds ? toInt(row.W3) : null;

    await c.execute({
      sql: `INSERT INTO ProgressionLog
            (id, userProgressionId, level, weight1, reps1, weight2, reps2, weight3, reps3, holdTime, holdTime2, holdTime3, modifier, variant, notes, completed, createdAt)
            VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      args: [
        id25(),
        uplId,
        derived.isHoldSeconds ? null : toNum(row.W1), toInt(row.R1),
        derived.isHoldSeconds ? null : toNum(row.W2), toInt(row.R2),
        derived.isHoldSeconds ? null : toNum(row.W3), toInt(row.R3),
        holdTime,
        holdTime2,
        holdTime3,
        derived.modifier,
        derived.variant,
        row.Notes ? String(row.Notes).slice(0, 1000) : null,
        createdAt,
      ],
    });
    inserted++;
  }

  const after = await c.execute({
    sql: `SELECT COUNT(*) AS c
          FROM ProgressionLog pl
          JOIN UserProgressionLevel upl ON upl.id = pl.userProgressionId
          WHERE upl.userId = ?`,
    args: [uid],
  });

  const variantCount = await c.execute({
    sql: `SELECT COUNT(*) AS c
          FROM ProgressionLog pl
          JOIN UserProgressionLevel upl ON upl.id = pl.userProgressionId
          WHERE upl.userId = ? AND pl.variant IS NOT NULL AND trim(pl.variant) != ''`,
    args: [uid],
  });

  const keyNames = [
    'Cable Kickbacks',
    'Hanging Leg Raise',
    'Hip Abduction (Leaning Back)',
    'Hip Abduction (Leaning Forward)',
    'Hip Abduction (Pulses)',
    'Incline Dumbbell Bench Press',
    'Leg Press',
    'Pendulum Squat',
  ];
  const placeholders = keyNames.map(() => '?').join(',');
  const keyCounts = await c.execute({
    sql: `SELECT pe.name, COUNT(*) AS c
          FROM ProgressionLog pl
          JOIN UserProgressionLevel upl ON upl.id = pl.userProgressionId
          JOIN ProgressionExercise pe ON pe.id = upl.exerciseId
          WHERE upl.userId = ? AND pe.name IN (${placeholders})
          GROUP BY pe.name ORDER BY pe.name`,
    args: [uid, ...keyNames],
  });

  console.log(JSON.stringify({
    workbookRows: rows.length,
    logsBefore: before.rows[0]?.c ?? null,
    deletedRows: del.rowsAffected ?? null,
    clonedExercises,
    createdUserProgressionLevels: createdUpl,
    inserted,
    skipped,
    skippedExerciseNames: [...skippedNames].sort(),
    unresolvedCanonicalExercises: [...unresolved].sort(),
    inferredVariantRows,
    storedVariantRows: variantCount.rows[0]?.c ?? null,
    logsAfter: after.rows[0]?.c ?? null,
    keyExerciseCounts: keyCounts.rows,
  }, null, 2));

  c.close();
})().catch((e) => {
  console.error(e);
  c.close();
  process.exit(1);
});