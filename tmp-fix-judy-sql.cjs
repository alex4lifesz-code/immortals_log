const { createClient } = require('@libsql/client');
const crypto = require('crypto');
const c = createClient({ url:'file:./dev.db' });
const JUDY='cmmzy983y01kblgc2pggt4tye';

const id25 = () => crypto.randomBytes(14).toString('hex').slice(0,25);

(async()=>{
  const logNamesRes = await c.execute({ sql:`
    SELECT DISTINCT pe.name
    FROM ProgressionLog pl
    JOIN UserProgressionLevel upl ON upl.id = pl.userProgressionId
    JOIN ProgressionExercise pe ON pe.id = upl.exerciseId
    WHERE upl.userId = ?
  `, args:[JUDY]});
  const neededNames = logNamesRes.rows.map(r=>r.name);

  const judyExRes = await c.execute({ sql:`SELECT id,name FROM ProgressionExercise WHERE userId = ?`, args:[JUDY]});
  const judyByName = new Map(judyExRes.rows.map(r=>[r.name, r.id]));

  let cloned = 0;
  for (const name of neededNames) {
    if (judyByName.has(name)) continue;

    const srcRes = await c.execute({ sql:`SELECT * FROM ProgressionExercise WHERE name = ? AND userId != ? LIMIT 1`, args:[name, JUDY]});
    if (!srcRes.rows.length) continue;
    const s = srcRes.rows[0];

    const newExId = id25();
    await c.execute({
      sql:`INSERT INTO ProgressionExercise (id,name,wuxiaName,difficulty,type,story,tips,category,equipmentType,bodyweight,weighted,rings,primaryMuscles,secondaryMuscles,assignedDays,createdAt,userId,wuxiaDifficulty,wuxiaType,prerequisites,cues,commonMistakes,breathing,safetyConsiderations,competitionStandards)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args:[
        newExId,
        s.name, s.wuxiaName, s.difficulty, s.type, s.story, s.tips, s.category, s.equipmentType,
        s.bodyweight, s.weighted, s.rings, s.primaryMuscles, s.secondaryMuscles, s.assignedDays,
        new Date().toISOString(), JUDY, s.wuxiaDifficulty, s.wuxiaType, s.prerequisites, s.cues,
        s.commonMistakes, s.breathing, s.safetyConsiderations, s.competitionStandards
      ]
    });

    const tiers = await c.execute({ sql:`SELECT * FROM ProgressionTier WHERE exerciseId = ? ORDER BY level`, args:[s.id]});
    for (const t of tiers.rows) {
      await c.execute({
        sql:`INSERT INTO ProgressionTier (id,exerciseId,level,name,wuxiaName,difficulty,description,targetHold,targetReps,wuxiaDifficulty,wuxiaType,targetRepsText)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        args:[id25(), newExId, t.level, t.name, t.wuxiaName, t.difficulty, t.description, t.targetHold, t.targetReps, t.wuxiaDifficulty, t.wuxiaType, t.targetRepsText]
      });
    }

    const vars = await c.execute({ sql:`SELECT * FROM ProgressionVariation WHERE exerciseId = ?`, args:[s.id]});
    for (const v of vars.rows) {
      await c.execute({
        sql:`INSERT INTO ProgressionVariation (id,exerciseId,name,wuxiaName,difficulty,description,wuxiaDifficulty,wuxiaType)
             VALUES (?,?,?,?,?,?,?,?)`,
        args:[id25(), newExId, v.name, v.wuxiaName, v.difficulty, v.description, v.wuxiaDifficulty, v.wuxiaType]
      });
    }

    const mods = await c.execute({ sql:`SELECT * FROM ProgressionModifier WHERE exerciseId = ?`, args:[s.id]});
    for (const m of mods.rows) {
      await c.execute({
        sql:`INSERT INTO ProgressionModifier (id,exerciseId,type,available,difficultyMod,notes,method,difficultyIncrease)
             VALUES (?,?,?,?,?,?,?,?)`,
        args:[id25(), newExId, m.type, m.available, m.difficultyMod, m.notes, m.method, m.difficultyIncrease]
      });
    }

    judyByName.set(name, newExId);
    cloned++;
  }

  // Ensure UPL for Judy-owned exercises
  const uplRes = await c.execute({ sql:`SELECT id, exerciseId FROM UserProgressionLevel WHERE userId = ?`, args:[JUDY]});
  const uplByExercise = new Map(uplRes.rows.map(r=>[r.exerciseId, r.id]));
  for (const [name, exId] of judyByName.entries()) {
    if (neededNames.includes(name) && !uplByExercise.has(exId)) {
      const uid = id25();
      await c.execute({
        sql:`INSERT INTO UserProgressionLevel (id,userId,exerciseId,currentLevel,createdAt,updatedAt) VALUES (?,?,?,1,datetime('now'),datetime('now'))`,
        args:[uid, JUDY, exId]
      });
      uplByExercise.set(exId, uid);
    }
  }

  // Repoint every Judy log to Judy-owned exercise's UPL by exercise name
  const logs = await c.execute({ sql:`
    SELECT pl.id as logId, pe.name as exerciseName
    FROM ProgressionLog pl
    JOIN UserProgressionLevel upl ON upl.id = pl.userProgressionId
    JOIN ProgressionExercise pe ON pe.id = upl.exerciseId
    WHERE upl.userId = ?
  `, args:[JUDY]});

  let repointed = 0;
  for (const row of logs.rows) {
    const targetExId = judyByName.get(row.exerciseName);
    if (!targetExId) continue;
    const targetUplId = uplByExercise.get(targetExId);
    if (!targetUplId) continue;
    await c.execute({ sql:`UPDATE ProgressionLog SET userProgressionId = ? WHERE id = ?`, args:[targetUplId, row.logId]});
    repointed++;
  }

  // delete stale Judy UPL that point to non-Judy exercises and have no logs
  const stale = await c.execute({ sql:`
    SELECT upl.id
    FROM UserProgressionLevel upl
    JOIN ProgressionExercise pe ON pe.id = upl.exerciseId
    WHERE upl.userId = ? AND pe.userId != ?
      AND NOT EXISTS (SELECT 1 FROM ProgressionLog pl WHERE pl.userProgressionId = upl.id)
  `, args:[JUDY, JUDY]});
  if (stale.rows.length) {
    for (const s of stale.rows) {
      await c.execute({ sql:`DELETE FROM UserProgressionLevel WHERE id = ?`, args:[s.id]});
    }
  }

  const verify = await c.execute({ sql:`
    SELECT
      COUNT(*) AS totalLogs,
      SUM(CASE WHEN pe.userId = ? THEN 1 ELSE 0 END) AS logsOnJudyExercises,
      SUM(CASE WHEN pe.userId != ? THEN 1 ELSE 0 END) AS logsOnOtherUsersExercises
    FROM ProgressionLog pl
    JOIN UserProgressionLevel upl ON upl.id = pl.userProgressionId
    JOIN ProgressionExercise pe ON pe.id = upl.exerciseId
    WHERE upl.userId = ?
  `, args:[JUDY, JUDY, JUDY]});

  console.log(JSON.stringify({ clonedExercises: cloned, repointedLogs: repointed, verify: verify.rows[0] }, null, 2));
  c.close();
})();
