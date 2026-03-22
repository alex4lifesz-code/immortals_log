const { createClient } = require("@libsql/client");

async function check() {
  const client = createClient({ url: "file:./dev.db" });
  try {
    // Check UserProgressionLevel for Front Lever
    const upl = await client.execute(`
      SELECT upl.id, upl.userId, upl.exerciseId, upl.currentLevel, pe.name 
      FROM UserProgressionLevel upl
      JOIN ProgressionExercise pe ON pe.id = upl.exerciseId
      WHERE pe.name = 'Front Lever'
    `);
    console.log("UserProgressionLevel for Front Lever:", upl.rows);
    
    // Check total UserProgressionLevel rows
    const uplCount = await client.execute("SELECT COUNT(*) as cnt FROM UserProgressionLevel");
    console.log("Total UserProgressionLevel rows:", uplCount.rows[0].cnt);
    
    // Check ProgressionExercise row for Front Lever with wuxia fields
    const pe = await client.execute(`
      SELECT id, name, wuxiaDifficulty, wuxiaType, prerequisites, cues FROM ProgressionExercise WHERE name = 'Front Lever'
    `);
    console.log("Front Lever ProgressionExercise:", pe.rows);
    
    // Check ProgressionTier for Front Lever with new fields
    const pt = await client.execute(`
      SELECT t.level, t.name, t.wuxiaDifficulty, t.targetRepsText 
      FROM ProgressionTier t
      JOIN ProgressionExercise pe ON pe.id = t.exerciseId
      WHERE pe.name = 'Front Lever'
      ORDER BY t.level
      LIMIT 5
    `);
    console.log("Front Lever ProgressionTier (first 5):", pt.rows);
    
    // Try to manually insert a test ProgressionExercise
    console.log("\nTrying test insert of ProgressionExercise...");
    try {
      await client.execute(`
        INSERT INTO ProgressionExercise 
          (id, name, wuxiaName, difficulty, wuxiaDifficulty, type, wuxiaType, story, tips, category, equipmentType, bodyweight, weighted, rings, primaryMuscles, secondaryMuscles, prerequisites, cues, commonMistakes, breathing, safetyConsiderations, competitionStandards, assignedDays, createdAt, userId)
        VALUES
          ('test_id_delete_me', 'TEST EXERCISE DELETE', '', 'Expert', 'Tribulation Transcendence', 'Upper Body', 'Upper Heaven', '', '[]', 'Pull', 'bar', 1, 0, 0, 'Lats', '', '[]', '[]', '[]', '', '[]', '{}', '', datetime('now'), 'cmmw327mb00001sc2w39wdmos')
      `);
      console.log("Test insert succeeded!");
      // Clean up
      await client.execute("DELETE FROM ProgressionExercise WHERE id = 'test_id_delete_me'");
      console.log("Test cleanup done");
    } catch(e) {
      console.error("Test insert FAILED:", e.message);
    }
  } catch(e) {
    console.error("Error:", e.message);
  } finally {
    client.close();
  }
}

check();
