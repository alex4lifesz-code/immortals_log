/**
 * seed-sample-exercises.js
 * 
 * Seeds 3 sample exercises (one per type) for the admin user,
 * each with progression tiers and sample log entries.
 *
 *   1. Bench Press        — GYM / weighted
 *   2. Muscle Up          — Calisthenics / bodyweight
 *   3. Downward Dog Hold  — Yoga / timed
 *
 * Usage:
 *   node scripts/seed-sample-exercises.js [username]
 *   Default username: admin
 */

const { createClient } = require("@libsql/client");
const crypto = require("crypto");

const TARGET_USERNAME = process.argv[2] || "admin";
const DB_URL = process.env.DATABASE_URL || "file:./dev.db";

function cuid() {
  return "c" + crypto.randomBytes(12).toString("hex").slice(0, 24);
}

const SAMPLE_EXERCISES = [
  {
    name: "Barbell Bench Press",
    wuxiaName: "Iron Furnace Forges the Heavens",
    difficulty: "Immortal",
    wuxiaDifficulty: "Immortal",
    type: "Upper Heaven",
    wuxiaType: "Upper Heaven",
    story: "The cultivator lies upon the sacred iron platform, pressing the celestial bar upward to forge the chest meridians with raw mortal iron.",
    tips: '["Retract shoulder blades before unracking","Feet flat, arch naturally","Bar path from mid-chest to over shoulders"]',
    category: "Gym, Push",
    equipmentType: "barbell",
    bodyweight: false,
    weighted: true,
    rings: false,
    primaryMuscles: "Chest, Triceps",
    secondaryMuscles: "Anterior Deltoid, Serratus Anterior",
    tiers: [
      { level: 1, name: "Empty Bar Press", wuxiaName: "Hollow Iron Strike", difficulty: "Mortal", targetReps: 10, targetRepsText: "8-12" },
      { level: 2, name: "Novice Bench Press", wuxiaName: "Forging Flame Press", difficulty: "Foundation Establishment", targetReps: 8, targetRepsText: "6-10" },
      { level: 3, name: "Intermediate Bench Press", wuxiaName: "Iron Furnace Eruption", difficulty: "Immortal", targetReps: 5, targetRepsText: "3-6" },
    ],
    modifiers: [
      { type: "slow tempo", difficultyMod: 0.5, notes: "3-second eccentric" },
      { type: "pause rep", difficultyMod: 0.5, notes: "2s pause at chest" },
    ],
    variations: [
      { name: "Close Grip", wuxiaName: "Narrow Gate Press", difficulty: "Immortal", description: "Hands shoulder-width. Emphasises triceps." },
      { name: "Wide Grip", wuxiaName: "Heaven-Spanning Press", difficulty: "Celestial Spirit", description: "Wider than shoulder width. Greater pec stretch." },
    ],
    sampleLogs: [
      { level: 2, weight1: 60, reps1: 8, weight2: 60, reps2: 7, weight3: 60, reps3: 6, notes: "Felt strong" },
      { level: 2, weight1: 62.5, reps1: 6, weight2: 60, reps2: 7, weight3: 60, reps3: 6, notes: null },
      { level: 3, weight1: 80, reps1: 5, weight2: 80, reps2: 4, weight3: 75, reps3: 5, modifier: "slow tempo", notes: "New max" },
    ],
  },
  {
    name: "Muscle Up",
    wuxiaName: "Dragon Ascends the Gate",
    difficulty: "Celestial Spirit",
    wuxiaDifficulty: "Celestial Spirit",
    type: "Upper Heaven",
    wuxiaType: "Upper Heaven",
    story: "Rising above the bar in a single explosive movement, the cultivator conquers the Dragon Gate—a feat that separates earthbound mortals from those who walk the heavens.",
    tips: '["Master strict pull-ups and dips first","Generate hip drive at the top of pull","Transition over the bar smoothly"]',
    category: "Calisthenics, Pull, Push",
    equipmentType: "bar",
    bodyweight: true,
    weighted: false,
    rings: false,
    primaryMuscles: "Lats, Chest, Triceps",
    secondaryMuscles: "Biceps, Forearms, Core",
    tiers: [
      { level: 1, name: "Negative Muscle Up", wuxiaName: "Falling Dragon Descent", difficulty: "Immortal", targetReps: 5, targetRepsText: "3-5" },
      { level: 2, name: "Kipping Muscle Up", wuxiaName: "Serpent Leaps the Rapids", difficulty: "Celestial Spirit", targetReps: 3, targetRepsText: "1-3" },
      { level: 3, name: "Strict Muscle Up", wuxiaName: "Dragon Ascends the Gate", difficulty: "Heavenly Dao", targetReps: 3, targetRepsText: "1-3" },
    ],
    modifiers: [
      { type: "weighted", difficultyMod: 1.0, notes: "Vest or dip belt" },
      { type: "rings", difficultyMod: 0.5, notes: "Gymnastics rings variant" },
    ],
    variations: [
      { name: "L-sit Muscle Up", wuxiaName: "Frozen Crane Ascends", difficulty: "Heavenly Dao", description: "Hold L-sit throughout. Extreme core demand." },
    ],
    sampleLogs: [
      { level: 1, weight1: null, reps1: 5, weight2: null, reps2: 4, weight3: null, reps3: 3, notes: "Negatives only" },
      { level: 2, weight1: null, reps1: 3, weight2: null, reps2: 2, weight3: null, reps3: 2, notes: "Kipping, cleaning up form" },
      { level: 2, weight1: null, reps1: 3, weight2: null, reps2: 3, weight3: null, reps3: 2, variant: "L-sit Muscle Up", notes: null },
    ],
  },
  {
    name: "Downward Dog Hold",
    wuxiaName: "Crouching Hound Drinks the River",
    difficulty: "Foundation Establishment",
    wuxiaDifficulty: "Foundation Establishment",
    type: "Foundation",
    wuxiaType: "Foundation",
    story: "With heels pressing toward the earth and hips ascending toward heaven, the cultivator opens the posterior chain and restores balance between yin and yang meridians.",
    tips: '["Press hands firmly, spread fingers","Drive heels toward floor","Rotate shoulders externally"]',
    category: "Yoga, Stretching",
    equipmentType: "floor",
    bodyweight: true,
    weighted: false,
    rings: false,
    primaryMuscles: "Hamstrings, Calves, Shoulders",
    secondaryMuscles: "Core, Forearms",
    tiers: [
      { level: 1, name: "Bent-Knee Dog", wuxiaName: "Pup Finds Its Legs", difficulty: "Mortal", targetHold: 15, targetReps: null, targetRepsText: "15s hold" },
      { level: 2, name: "Full Downward Dog", wuxiaName: "Crouching Hound", difficulty: "Foundation Establishment", targetHold: 30, targetReps: null, targetRepsText: "30s hold" },
      { level: 3, name: "Three-Legged Dog", wuxiaName: "Ascending Crane Pose", difficulty: "Immortal", targetHold: 20, targetReps: null, targetRepsText: "20s each side" },
    ],
    modifiers: [],
    variations: [
      { name: "Pedalling Feet", wuxiaName: "Flowing River Steps", difficulty: "Foundation Establishment", description: "Alternately bend knees to deepen calf/hamstring stretch." },
    ],
    sampleLogs: [
      { level: 1, holdTime: 15, holdTime2: 12, holdTime3: 10, reps1: null, reps2: null, reps3: null, notes: "First attempt" },
      { level: 2, holdTime: 30, holdTime2: 28, holdTime3: 25, reps1: null, reps2: null, reps3: null, notes: null },
      { level: 2, holdTime: 35, holdTime2: 30, holdTime3: 30, reps1: null, reps2: null, reps3: null, variant: "Pedalling Feet", notes: "Deeper stretch" },
    ],
  },
];

async function main() {
  const client = createClient({ url: DB_URL });
  console.log(`\n🏋️  Seeding sample exercises for user "${TARGET_USERNAME}"...\n`);

  const userResult = await client.execute({
    sql: "SELECT id FROM User WHERE username = ?",
    args: [TARGET_USERNAME],
  });
  if (userResult.rows.length === 0) {
    console.error(`❌ User "${TARGET_USERNAME}" not found. Run seed-admin-simple.js first.`);
    process.exit(1);
  }
  const userId = String(userResult.rows[0].id);

  for (const data of SAMPLE_EXERCISES) {
    // Check if already exists
    const existing = await client.execute({
      sql: "SELECT id FROM ProgressionExercise WHERE userId = ? AND name = ?",
      args: [userId, data.name],
    });
    if (existing.rows.length > 0) {
      console.log(`  ⏭️  "${data.name}" already exists — skipping`);
      continue;
    }

    const exerciseId = cuid();
    const now = new Date().toISOString();

    await client.execute({
      sql: `INSERT INTO ProgressionExercise (id, name, wuxiaName, difficulty, wuxiaDifficulty, type, wuxiaType, story, tips, category, equipmentType, bodyweight, weighted, rings, primaryMuscles, secondaryMuscles, assignedDays, userId, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [exerciseId, data.name, data.wuxiaName, data.difficulty, data.wuxiaDifficulty, data.type, data.wuxiaType, data.story, data.tips, data.category, data.equipmentType, data.bodyweight ? 1 : 0, data.weighted ? 1 : 0, data.rings ? 1 : 0, data.primaryMuscles, data.secondaryMuscles, "", userId, now],
    });
    console.log(`  ✅ Created "${data.name}" (${exerciseId})`);

    // Create tiers
    for (const tier of data.tiers) {
      await client.execute({
        sql: `INSERT INTO ProgressionTier (id, exerciseId, level, name, wuxiaName, difficulty, wuxiaDifficulty, wuxiaType, description, targetHold, targetReps, targetRepsText)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [cuid(), exerciseId, tier.level, tier.name, tier.wuxiaName || "", tier.difficulty || "", tier.difficulty || "", "", "", tier.targetHold ?? null, tier.targetReps ?? null, tier.targetRepsText || ""],
      });
    }
    console.log(`     → ${data.tiers.length} tier(s)`);

    // Create modifiers
    for (const mod of data.modifiers) {
      await client.execute({
        sql: `INSERT INTO ProgressionModifier (id, exerciseId, type, available, difficultyMod, notes, method, difficultyIncrease)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [cuid(), exerciseId, mod.type, 1, mod.difficultyMod, mod.notes, "", ""],
      });
    }
    if (data.modifiers.length) console.log(`     → ${data.modifiers.length} modifier(s)`);

    // Create variations
    for (const v of data.variations) {
      await client.execute({
        sql: `INSERT INTO ProgressionVariation (id, exerciseId, name, wuxiaName, difficulty, wuxiaDifficulty, wuxiaType, description)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [cuid(), exerciseId, v.name, v.wuxiaName || "", v.difficulty || "", v.difficulty || "", "", v.description || ""],
      });
    }
    if (data.variations.length) console.log(`     → ${data.variations.length} variation(s)`);

    // Create UserProgressionLevel
    const maxLogLevel = Math.max(...data.sampleLogs.map((l) => l.level));
    const progressId = cuid();
    await client.execute({
      sql: `INSERT INTO UserProgressionLevel (id, userId, exerciseId, currentLevel, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [progressId, userId, exerciseId, maxLogLevel, now, now],
    });

    // Create sample logs
    const nowMs = Date.now();
    for (let i = 0; i < data.sampleLogs.length; i++) {
      const log = data.sampleLogs[i];
      const logDate = new Date(nowMs - (data.sampleLogs.length - i) * 86400000).toISOString();
      await client.execute({
        sql: `INSERT INTO ProgressionLog (id, userProgressionId, level, weight1, reps1, weight2, reps2, weight3, reps3, holdTime, holdTime2, holdTime3, modifier, variant, notes, completed, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [cuid(), progressId, log.level, log.weight1 ?? null, log.reps1 ?? null, log.weight2 ?? null, log.reps2 ?? null, log.weight3 ?? null, log.reps3 ?? null, log.holdTime ?? null, log.holdTime2 ?? null, log.holdTime3 ?? null, log.modifier ?? null, log.variant ?? null, log.notes ?? null, 0, logDate],
      });
    }
    console.log(`     → ${data.sampleLogs.length} sample log(s)`);
  }

  console.log("\n✅ Sample exercise seeding complete!\n");
  client.close();
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  });
