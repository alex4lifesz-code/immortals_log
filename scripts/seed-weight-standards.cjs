// Seed exercise-specific weight standards (% of bodyweight) for all exercises
// Based on established strength standards (Symmetric Strength, ExRx, StrengthLevel)
//
// Key assumptions:
//  - Barbell lifts: total barbell weight as % BW
//  - Dumbbell lifts: PER dumbbell weight as % BW
//  - Cable/machine lifts: stack weight as % BW
//  - Bodyweight exercises (pull-up, dip, etc.): TOTAL weight (BW + added) as % BW
//    so 100% = just bodyweight, 125% = BW + 25% added
//  - Yoga/isometric holds: total weight (usually just BW)

const { createClient } = require("@libsql/client");
const c = createClient({ url: "file:./dev.db" });

// ── STANDARDS DATA ──
// Format: { male: [t1max, t2max, t3max, t4max, t5max], female: [...] }
// tier1Min is always 0, tier6Max is always 999, each tierNMin = previous tierMax
const STANDARDS = {
  // ═══ BARBELL COMPOUNDS ═══
  "Barbell Bench Press":   { male: [50,  75, 100, 125, 150], female: [30,  50,  70,  85, 105] },
  "Bench Press":           { male: [50,  75, 100, 125, 150], female: [30,  50,  70,  85, 105] },
  "Decline Barbell Bench Press": { male: [55, 80, 105, 135, 160], female: [35, 55, 75, 95, 115] },
  "Incline Barbell Bench Press": { male: [40, 65,  85, 110, 135], female: [25, 45, 60, 80, 100] },
  "Barbell Squat":         { male: [60, 100, 130, 170, 210], female: [45, 75, 100, 130, 165] },
  "Deadlift":              { male: [75, 115, 150, 190, 240], female: [55, 85, 115, 150, 190] },
  "Barbell Row":           { male: [40,  60,  80, 100, 125], female: [25, 40,  55,  70,  90] },
  "Barbell Curl":          { male: [20,  35,  50,  65,  80], female: [12, 22,  32,  42,  55] },

  // ═══ DUMBBELL (per dumbbell) ═══
  "Dumbbell Bench Press":         { male: [20, 30, 40, 50, 60], female: [12, 20, 28, 36, 45] },
  "Incline Dumbbell Bench Press": { male: [15, 25, 35, 45, 55], female: [10, 17, 25, 32, 40] },
  "Dumbbell Curl":                { male: [10, 17, 23, 30, 38], female: [ 6, 11, 16, 22, 28] },
  "Dumbbell Forearm Curl":        { male: [ 7, 12, 17, 22, 28], female: [ 5,  8, 12, 16, 20] },
  "Dumbbell Lateral Raise":       { male: [ 7, 12, 17, 22, 28], female: [ 5,  8, 12, 16, 20] },
  "Dumbbell Shoulder Press":      { male: [15, 25, 35, 45, 55], female: [10, 17, 25, 33, 42] },
  "Hammer Curl":                  { male: [10, 18, 25, 32, 40], female: [ 7, 12, 17, 23, 30] },
  "Front Raise":                  { male: [ 7, 12, 17, 22, 28], female: [ 5,  8, 12, 16, 20] },
  "Chest Fly":                    { male: [10, 17, 25, 32, 40], female: [ 6, 11, 17, 23, 30] },
  "Reverse Fly":                  { male: [ 7, 12, 17, 22, 28], female: [ 5,  8, 12, 16, 20] },

  // ═══ CABLE / MACHINE ═══
  "Cable Face Pull":        { male: [15, 25, 35, 45, 55], female: [10, 17, 25, 33, 42] },
  "Cable Kickbacks":        { male: [10, 18, 25, 35, 45], female: [ 7, 12, 18, 25, 33] },
  "Cable Row":              { male: [30, 50, 70, 90, 110], female: [20, 35, 50, 65, 80] },
  "Cable Tricep Pushdown":  { male: [15, 25, 35, 50,  65], female: [10, 17, 25, 35, 45] },
  "Lat Pulldown":           { male: [40, 60, 80, 100, 120], female: [30, 45, 60, 75, 90] },
  "Leg Press":              { male: [100, 150, 200, 275, 350], female: [75, 115, 160, 215, 275] },
  "Seated Leg Curl":        { male: [25, 40,  55,  70,  85], female: [17, 28,  40,  52,  65] },
  "Seated Leg Extension":   { male: [25, 40,  60,  75,  95], female: [17, 28,  42,  55,  70] },
  "Hip Abduction Machine":  { male: [25, 40,  55,  75,  95], female: [20, 35,  50,  65,  80] },
  "Pendulum Squat":         { male: [50, 85, 120, 160, 200], female: [35, 60,  90, 125, 160] },
  "Calf Raise":             { male: [50, 80, 110, 150, 200], female: [35, 60,  85, 115, 150] },

  // ═══ BODYWEIGHT / CALISTHENICS (total weight = BW + any added) ═══
  // 100% = just bodyweight, >100% = weighted
  "Pull Up":          { male: [70, 100, 115, 135, 165], female: [50,  80, 100, 115, 135] },
  "Dip":              { male: [70, 100, 120, 145, 170], female: [50,  80, 100, 120, 140] },
  "One Arm Pull Up":  { male: [50,  75, 100, 110, 125], female: [40,  60,  85, 100, 115] },
  "Hanging Leg Raise":{ male: [50,  85, 100, 115, 130], female: [40,  65,  90, 100, 115] },
  "Dragon Flag":      { male: [40,  70, 100, 115, 130], female: [30,  55,  80, 100, 115] },
  "Front Lever":      { male: [50,  75, 100, 115, 130], female: [40,  60,  85, 100, 115] },
  "Back Lever":       { male: [50,  75, 100, 110, 125], female: [40,  60,  85, 100, 110] },
  "Planche":          { male: [40,  60,  80, 100, 115], female: [30,  50,  70,  90, 105] },

  // ═══ YOGA ═══
  "Warrior II Pose":  { male: [50,  75, 100, 105, 110], female: [50,  75, 100, 105, 110] },
};

function buildTiers(maxValues) {
  // maxValues = [t1max, t2max, t3max, t4max, t5max]
  return {
    tier1Min: 0,        tier1Max: maxValues[0],
    tier2Min: maxValues[0], tier2Max: maxValues[1],
    tier3Min: maxValues[1], tier3Max: maxValues[2],
    tier4Min: maxValues[2], tier4Max: maxValues[3],
    tier5Min: maxValues[3], tier5Max: maxValues[4],
    tier6Min: maxValues[4], tier6Max: 999,
  };
}

async function main() {
  // Get admin user
  const adminRes = await c.execute("SELECT id FROM User WHERE role = 'admin' LIMIT 1");
  const adminId = adminRes.rows[0]?.id;
  if (!adminId) { console.error("No admin user found"); process.exit(1); }
  console.log(`Admin user: ${adminId}\n`);

  // Get all exercises
  const exRes = await c.execute("SELECT id, name, category FROM ProgressionExercise ORDER BY name COLLATE NOCASE");
  console.log(`Found ${exRes.rows.length} exercises\n`);

  // Check existing standards
  const existingRes = await c.execute("SELECT exerciseId, gender FROM WeightStandard");
  const existingSet = new Set(existingRes.rows.map(r => `${r.exerciseId}|${r.gender}`));
  console.log(`Existing weight standard records: ${existingRes.rows.length}\n`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const ex of exRes.rows) {
    const std = STANDARDS[ex.name];
    if (!std) {
      console.log(`  ⚠ No standards defined for: ${ex.name} — skipping`);
      skipped++;
      continue;
    }

    for (const gender of ["MALE", "FEMALE"]) {
      const tiers = buildTiers(gender === "MALE" ? std.male : std.female);
      const key = `${ex.id}|${gender}`;
      const exists = existingSet.has(key);

      if (exists) {
        await c.execute({
          sql: `UPDATE WeightStandard SET
            tier1Min=?, tier1Max=?, tier2Min=?, tier2Max=?,
            tier3Min=?, tier3Max=?, tier4Min=?, tier4Max=?,
            tier5Min=?, tier5Max=?, tier6Min=?, tier6Max=?,
            updatedBy=?, updatedAt=?
            WHERE exerciseId=? AND gender=?`,
          args: [
            tiers.tier1Min, tiers.tier1Max, tiers.tier2Min, tiers.tier2Max,
            tiers.tier3Min, tiers.tier3Max, tiers.tier4Min, tiers.tier4Max,
            tiers.tier5Min, tiers.tier5Max, tiers.tier6Min, tiers.tier6Max,
            adminId, now, ex.id, gender
          ]
        });
        updated++;
      } else {
        const id = `ws_${ex.id.slice(0, 12)}_${gender.toLowerCase()}`;
        await c.execute({
          sql: `INSERT INTO WeightStandard (id, exerciseId, gender,
            tier1Min, tier1Max, tier2Min, tier2Max,
            tier3Min, tier3Max, tier4Min, tier4Max,
            tier5Min, tier5Max, tier6Min, tier6Max,
            createdAt, updatedAt, updatedBy)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          args: [
            id, ex.id, gender,
            tiers.tier1Min, tiers.tier1Max, tiers.tier2Min, tiers.tier2Max,
            tiers.tier3Min, tiers.tier3Max, tiers.tier4Min, tiers.tier4Max,
            tiers.tier5Min, tiers.tier5Max, tiers.tier6Min, tiers.tier6Max,
            now, now, adminId
          ]
        });
        inserted++;
      }
    }
    console.log(`  ✓ ${ex.name} — MALE & FEMALE standards set`);
  }

  console.log(`\n═══ SUMMARY ═══`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Updated:  ${updated}`);
  console.log(`  Skipped:  ${skipped}`);

  // Verify final count
  const finalRes = await c.execute("SELECT COUNT(*) as cnt FROM WeightStandard");
  console.log(`  Total records in DB: ${finalRes.rows[0].cnt}`);
}

main().catch(e => { console.error(e); process.exit(1); });
