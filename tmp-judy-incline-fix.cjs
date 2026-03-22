const { createClient } = require('@libsql/client');
const XLSX = require('xlsx');
const crypto = require('crypto');
const uid = 'cmmzy983y01kblgc2pggt4tye';
const EX_ID = 'cmmzsqdya019olgc29v1upslk'; // Incline Dumbbell Bench Press
const c = createClient({ url: 'file:./dev.db' });

function toISODate(excelSerial, seqOffsetMs = 0) {
  const ms = Math.round((excelSerial - 25569) * 86400 * 1000) + 43200000 + seqOffsetMs;
  return new Date(ms).toISOString();
}

(async () => {
  const upl = await c.execute({ sql: `SELECT id FROM UserProgressionLevel WHERE userId = ? AND exerciseId = ? LIMIT 1`, args: [uid, EX_ID] });
  if (!upl.rows.length) throw new Error('Missing UserProgressionLevel for Incline DB Bench Press');
  const uplId = upl.rows[0].id;

  const wb = XLSX.readFile('./judyworkout.xlsx');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { defval: null });
  let lastDate = null;
  let added = 0;
  let candidates = 0;

  for (const row of rows) {
    if (typeof row.date === 'number') lastDate = row.date;
    const name = String(row.judy || '').trim().toLowerCase();
    if (!name.includes('incline db bench press')) continue;
    candidates++;
    const d = typeof row.date === 'number' ? row.date : lastDate;
    if (typeof d !== 'number') continue;

    const id = crypto.randomBytes(14).toString('hex').substring(0, 25);
    const num = (v) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
    const int = (v) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Math.floor(Number(v)) : null);
    const createdAt = toISODate(d, added * 5000);

    await c.execute({
      sql: `INSERT INTO ProgressionLog (id, userProgressionId, level, weight1, reps1, weight2, reps2, weight3, reps3, holdTime, holdTime2, holdTime3, modifier, variant, notes, completed, createdAt)
            VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, 1, ?)`,
      args: [id, uplId, num(row.W1), int(row.R1), num(row.W2), int(row.R2), num(row.W3), int(row.R3), row.Notes ? String(row.Notes).slice(0, 1000) : null, createdAt],
    });
    added++;
  }

  const total = await c.execute({ sql: `SELECT COUNT(*) AS c FROM ProgressionLog pl JOIN UserProgressionLevel upl ON upl.id=pl.userProgressionId WHERE upl.userId=?`, args: [uid] });
  console.log(JSON.stringify({ inclineRowsFound: candidates, inclineRowsAdded: added, totalLogsForJudy: total.rows[0]?.c ?? null }, null, 2));

  c.close();
})().catch(e => { console.error(e); process.exit(1); });
