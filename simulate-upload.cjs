// Simulate the full progression upload for Front Lever
// This mirrors the route logic exactly
const { createClient } = require("@libsql/client");

const client = createClient({ url: "file:./dev.db" });

const { readFileSync } = require("fs");
const frontLever = JSON.parse(readFileSync("C:\\Users\\Admin\\Desktop\\codex300.json", "utf8"))[0];

async function simulateUpload(userId) {
  const trimmedName = frontLever.name.trim();
  
  // Check existing
  const existing = await client.execute({
    sql: "SELECT name FROM ProgressionExercise WHERE userId = ? LIMIT 200",
    args: [userId]
  });
  const existingNames = new Set(existing.rows.map(r => String(r.name).trim().toLowerCase()));
  console.log(`User ${userId} has ${existingNames.size} exercises`);
  console.log("Front Lever already exists:", existingNames.has("front lever"));
  
  if (existingNames.has(trimmedName.toLowerCase())) {
    console.log("→ Would SKIP (duplicate)");
    return;
  }
  
  console.log("→ Would CREATE new ProgressionExercise");
  
  // Test the actual create
  const { createClient: cc } = require("@libsql/client");
  const c2 = cc({ url: "file:./dev.db" });
  try {
    const id = "test_" + Date.now();
    const ex = frontLever;
    const tiers = ex.progressions || ex.tiers || [];
    
    await c2.batch([
      {
        sql: `INSERT INTO ProgressionExercise 
          (id, name, wuxiaName, difficulty, wuxiaDifficulty, type, wuxiaType, story, tips, category, equipmentType, bodyweight, weighted, rings, primaryMuscles, secondaryMuscles, prerequisites, cues, commonMistakes, breathing, safetyConsiderations, competitionStandards, assignedDays, createdAt, userId)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
        args: [
          id,
          ex.name,
          ex.wuxiaName || "",
          ex.difficulty || "",
          ex.wuxiaDifficulty || "",
          ex.type || "",
          ex.wuxiaType || "",
          ex.story || "",
          "[]",
          ex.category,
          (ex.equipment || {}).type || "bodyweight",
          1, 1, 1,
          Array.isArray(ex.primaryMuscles) ? ex.primaryMuscles.join(",") : ex.primaryMuscles || "",
          Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles.join(",") : ex.secondaryMuscles || "",
          JSON.stringify(ex.prerequisites || []),
          JSON.stringify(ex.cues || []),
          JSON.stringify(ex.commonMistakes || []),
          ex.breathing || "",
          JSON.stringify(ex.safetyConsiderations || []),
          JSON.stringify(ex.competitionStandards || {}),
          "",
          userId
        ]
      },
      // Insert first tier
      ...tiers.slice(0, 3).map(t => ({
        sql: `INSERT INTO ProgressionTier 
          (id, exerciseId, level, name, wuxiaName, difficulty, wuxiaDifficulty, wuxiaType, description, targetHold, targetReps, targetRepsText)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          "tier_" + t.level + "_" + Date.now(),
          id,
          t.level,
          t.name,
          t.wuxiaName || "",
          t.difficulty || "",
          t.wuxiaDifficulty || t.difficulty || "",
          t.wuxiaType || "",
          t.description || "",
          null,
          null,
          String(t.targetReps || t.targetHoldTime || "").trim()
        ]
      }))
    ], "write");
    
    console.log("✓ CREATE would succeed!");
    
    // Cleanup
    await c2.execute({ sql: "DELETE FROM ProgressionTier WHERE exerciseId = ?", args: [id] });
    await c2.execute({ sql: "DELETE FROM ProgressionExercise WHERE id = ?", args: [id] });
    console.log("✓ Cleanup done");
  } catch(e) {
    console.error("✗ CREATE FAILED:", e.message);
  } finally {
    c2.close();
  }
}

async function main() {
  try {
    const users = await client.execute("SELECT id, username FROM User");
    console.log("Users:", users.rows.map(r => `${r.username} (${r.id})`));
    
    for (const user of users.rows) {
      await simulateUpload(String(user.id));
    }
  } finally {
    client.close();
  }
}

main().catch(console.error);
