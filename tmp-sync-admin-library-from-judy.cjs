const crypto = require('crypto');
const { createClient } = require('@libsql/client');

const SOURCE_USERNAME = 'judy';
const TARGET_USERNAME = 'admin';

function newId() {
  return crypto.randomUUID().replace(/-/g, '');
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ');
}

async function getUserId(client, username) {
  const res = await client.execute({
    sql: 'SELECT id FROM User WHERE username = ? LIMIT 1',
    args: [username],
  });
  return res.rows.length ? String(res.rows[0].id) : null;
}

(async function run() {
  const client = createClient({ url: 'file:./dev.db' });

  try {
    const sourceUserId = await getUserId(client, SOURCE_USERNAME);
    const targetUserId = await getUserId(client, TARGET_USERNAME);

    if (!sourceUserId) throw new Error(`Source user not found: ${SOURCE_USERNAME}`);
    if (!targetUserId) throw new Error(`Target user not found: ${TARGET_USERNAME}`);

    const sourceExercisesRes = await client.execute({
      sql: `
        SELECT
          id, name, wuxiaName, difficulty, wuxiaDifficulty, type, wuxiaType, story, tips,
          category, equipmentType, bodyweight, weighted, rings, primaryMuscles, secondaryMuscles,
          prerequisites, cues, commonMistakes, breathing, safetyConsiderations, competitionStandards,
          assignedDays
        FROM ProgressionExercise
        WHERE userId = ?
        ORDER BY name
      `,
      args: [sourceUserId],
    });
    const sourceExercises = sourceExercisesRes.rows;

    const targetExercisesRes = await client.execute({
      sql: 'SELECT id, name FROM ProgressionExercise WHERE userId = ?',
      args: [targetUserId],
    });
    const targetByName = new Map(
      targetExercisesRes.rows.map((r) => [normalizeName(r.name), { id: String(r.id), name: String(r.name) }])
    );

    const targetUplRes = await client.execute({
      sql: 'SELECT id, exerciseId FROM UserProgressionLevel WHERE userId = ?',
      args: [targetUserId],
    });
    const targetUplByExerciseId = new Map(
      targetUplRes.rows.map((r) => [String(r.exerciseId), String(r.id)])
    );

    let createdExercises = 0;
    let updatedExercises = 0;
    let syncedTiers = 0;
    let syncedVariations = 0;
    let syncedModifiers = 0;
    let createdUpl = 0;

    for (const source of sourceExercises) {
      const key = normalizeName(source.name);
      let target = targetByName.get(key);

      if (!target) {
        const targetExerciseId = newId();
        await client.execute({
          sql: `
            INSERT INTO ProgressionExercise
              (id, name, wuxiaName, difficulty, wuxiaDifficulty, type, wuxiaType, story, tips, category,
               equipmentType, bodyweight, weighted, rings, primaryMuscles, secondaryMuscles, prerequisites,
               cues, commonMistakes, breathing, safetyConsiderations, competitionStandards, assignedDays, createdAt, userId)
            VALUES
              (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
          `,
          args: [
            targetExerciseId,
            String(source.name),
            String(source.wuxiaName || ''),
            String(source.difficulty || ''),
            String(source.wuxiaDifficulty || ''),
            String(source.type || ''),
            String(source.wuxiaType || ''),
            String(source.story || ''),
            String(source.tips || '[]'),
            String(source.category || ''),
            String(source.equipmentType || ''),
            Number(source.bodyweight) ? 1 : 0,
            Number(source.weighted) ? 1 : 0,
            Number(source.rings) ? 1 : 0,
            String(source.primaryMuscles || ''),
            String(source.secondaryMuscles || ''),
            String(source.prerequisites || '[]'),
            String(source.cues || '[]'),
            String(source.commonMistakes || '[]'),
            String(source.breathing || ''),
            String(source.safetyConsiderations || '[]'),
            String(source.competitionStandards || '{}'),
            String(source.assignedDays || ''),
            targetUserId,
          ],
        });

        target = { id: targetExerciseId, name: String(source.name) };
        targetByName.set(key, target);
        createdExercises++;
      } else {
        await client.execute({
          sql: `
            UPDATE ProgressionExercise
            SET
              name = ?, wuxiaName = ?, difficulty = ?, wuxiaDifficulty = ?, type = ?, wuxiaType = ?,
              story = ?, tips = ?, category = ?, equipmentType = ?, bodyweight = ?, weighted = ?,
              rings = ?, primaryMuscles = ?, secondaryMuscles = ?, prerequisites = ?, cues = ?,
              commonMistakes = ?, breathing = ?, safetyConsiderations = ?, competitionStandards = ?,
              assignedDays = ?
            WHERE id = ?
          `,
          args: [
            String(source.name),
            String(source.wuxiaName || ''),
            String(source.difficulty || ''),
            String(source.wuxiaDifficulty || ''),
            String(source.type || ''),
            String(source.wuxiaType || ''),
            String(source.story || ''),
            String(source.tips || '[]'),
            String(source.category || ''),
            String(source.equipmentType || ''),
            Number(source.bodyweight) ? 1 : 0,
            Number(source.weighted) ? 1 : 0,
            Number(source.rings) ? 1 : 0,
            String(source.primaryMuscles || ''),
            String(source.secondaryMuscles || ''),
            String(source.prerequisites || '[]'),
            String(source.cues || '[]'),
            String(source.commonMistakes || '[]'),
            String(source.breathing || ''),
            String(source.safetyConsiderations || '[]'),
            String(source.competitionStandards || '{}'),
            String(source.assignedDays || ''),
            target.id,
          ],
        });
        updatedExercises++;
      }

      await client.execute({ sql: 'DELETE FROM ProgressionTier WHERE exerciseId = ?', args: [target.id] });
      await client.execute({ sql: 'DELETE FROM ProgressionVariation WHERE exerciseId = ?', args: [target.id] });
      await client.execute({ sql: 'DELETE FROM ProgressionModifier WHERE exerciseId = ?', args: [target.id] });

      const sourceTiers = await client.execute({
        sql: `
          SELECT level, name, wuxiaName, difficulty, wuxiaDifficulty, wuxiaType, description, targetHold, targetReps, targetRepsText
          FROM ProgressionTier
          WHERE exerciseId = ?
          ORDER BY level
        `,
        args: [source.id],
      });
      for (const tier of sourceTiers.rows) {
        await client.execute({
          sql: `
            INSERT INTO ProgressionTier
              (id, exerciseId, level, name, wuxiaName, difficulty, wuxiaDifficulty, wuxiaType, description, targetHold, targetReps, targetRepsText)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          args: [
            newId(),
            target.id,
            Number(tier.level),
            String(tier.name || ''),
            String(tier.wuxiaName || ''),
            String(tier.difficulty || ''),
            String(tier.wuxiaDifficulty || ''),
            String(tier.wuxiaType || ''),
            String(tier.description || ''),
            tier.targetHold === null || tier.targetHold === undefined ? null : Number(tier.targetHold),
            tier.targetReps === null || tier.targetReps === undefined ? null : Number(tier.targetReps),
            String(tier.targetRepsText || ''),
          ],
        });
        syncedTiers++;
      }

      const sourceVariations = await client.execute({
        sql: `
          SELECT name, wuxiaName, difficulty, wuxiaDifficulty, wuxiaType, description
          FROM ProgressionVariation
          WHERE exerciseId = ?
        `,
        args: [source.id],
      });
      for (const variation of sourceVariations.rows) {
        await client.execute({
          sql: `
            INSERT INTO ProgressionVariation
              (id, exerciseId, name, wuxiaName, difficulty, wuxiaDifficulty, wuxiaType, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          args: [
            newId(),
            target.id,
            String(variation.name || ''),
            String(variation.wuxiaName || ''),
            String(variation.difficulty || ''),
            String(variation.wuxiaDifficulty || ''),
            String(variation.wuxiaType || ''),
            String(variation.description || ''),
          ],
        });
        syncedVariations++;
      }

      const sourceModifiers = await client.execute({
        sql: `
          SELECT type, available, difficultyMod, notes, method, difficultyIncrease
          FROM ProgressionModifier
          WHERE exerciseId = ?
        `,
        args: [source.id],
      });
      for (const modifier of sourceModifiers.rows) {
        await client.execute({
          sql: `
            INSERT INTO ProgressionModifier
              (id, exerciseId, type, available, difficultyMod, notes, method, difficultyIncrease)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          args: [
            newId(),
            target.id,
            String(modifier.type || ''),
            Number(modifier.available) ? 1 : 0,
            modifier.difficultyMod === null || modifier.difficultyMod === undefined ? 0 : Number(modifier.difficultyMod),
            String(modifier.notes || ''),
            String(modifier.method || ''),
            String(modifier.difficultyIncrease || ''),
          ],
        });
        syncedModifiers++;
      }

      if (!targetUplByExerciseId.has(target.id)) {
        const uplId = newId();
        await client.execute({
          sql: 'INSERT INTO UserProgressionLevel (id, userId, exerciseId, currentLevel, createdAt, updatedAt) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
          args: [uplId, targetUserId, target.id],
        });
        targetUplByExerciseId.set(target.id, uplId);
        createdUpl++;
      }
    }

    const missingCheck = await client.execute({
      sql: `
        SELECT s.name
        FROM ProgressionExercise s
        WHERE s.userId = ?
          AND NOT EXISTS (
            SELECT 1
            FROM ProgressionExercise t
            WHERE t.userId = ?
              AND LOWER(REPLACE(REPLACE(t.name, '-', ' '), '_', ' ')) = LOWER(REPLACE(REPLACE(s.name, '-', ' '), '_', ' '))
          )
        ORDER BY s.name
      `,
      args: [sourceUserId, targetUserId],
    });

    console.log(JSON.stringify({
      sourceUsername: SOURCE_USERNAME,
      targetUsername: TARGET_USERNAME,
      sourceExercises: sourceExercises.length,
      createdExercises,
      updatedExercises,
      syncedTiers,
      syncedVariations,
      syncedModifiers,
      createdUserProgressionLevels: createdUpl,
      missingAfterSync: missingCheck.rows.map((r) => String(r.name)),
    }, null, 2));
  } finally {
    client.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
