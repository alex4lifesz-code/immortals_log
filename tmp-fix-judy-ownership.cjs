const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JUDY_ID = 'cmmzy983y01kblgc2pggt4tye';

(async () => {
  // Distinct exercise names currently referenced by Judy logs
  const judyLogNames = await prisma.progressionLog.findMany({
    where: { userProgression: { userId: JUDY_ID } },
    select: { userProgression: { select: { exercise: { select: { name: true } } } } },
    distinct: ['userProgressionId'],
  });

  const names = [...new Set(judyLogNames.map(r => r.userProgression.exercise.name))];

  const judyExercises = await prisma.progressionExercise.findMany({
    where: { userId: JUDY_ID },
    select: { id: true, name: true },
  });
  const judyByName = new Map(judyExercises.map(e => [e.name, e]));

  let createdExercises = 0;
  for (const name of names) {
    if (judyByName.has(name)) continue;

    const source = await prisma.progressionExercise.findFirst({
      where: { name, NOT: { userId: JUDY_ID } },
      include: { tiers: true, variations: true, modifiers: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!source) continue;

    const created = await prisma.progressionExercise.create({
      data: {
        name: source.name,
        wuxiaName: source.wuxiaName,
        difficulty: source.difficulty,
        wuxiaDifficulty: source.wuxiaDifficulty,
        type: source.type,
        wuxiaType: source.wuxiaType,
        story: source.story,
        tips: source.tips,
        category: source.category,
        equipmentType: source.equipmentType,
        bodyweight: source.bodyweight,
        weighted: source.weighted,
        rings: source.rings,
        primaryMuscles: source.primaryMuscles,
        secondaryMuscles: source.secondaryMuscles,
        prerequisites: source.prerequisites,
        cues: source.cues,
        commonMistakes: source.commonMistakes,
        breathing: source.breathing,
        safetyConsiderations: source.safetyConsiderations,
        competitionStandards: source.competitionStandards,
        assignedDays: source.assignedDays,
        userId: JUDY_ID,
        tiers: {
          create: source.tiers.map(t => ({
            level: t.level,
            name: t.name,
            wuxiaName: t.wuxiaName,
            difficulty: t.difficulty,
            wuxiaDifficulty: t.wuxiaDifficulty,
            wuxiaType: t.wuxiaType,
            description: t.description,
            targetHold: t.targetHold,
            targetReps: t.targetReps,
            targetRepsText: t.targetRepsText,
          })),
        },
        variations: {
          create: source.variations.map(v => ({
            name: v.name,
            wuxiaName: v.wuxiaName,
            difficulty: v.difficulty,
            wuxiaDifficulty: v.wuxiaDifficulty,
            wuxiaType: v.wuxiaType,
            description: v.description,
          })),
        },
        modifiers: {
          create: source.modifiers.map(m => ({
            type: m.type,
            available: m.available,
            difficultyMod: m.difficultyMod,
            notes: m.notes,
            method: m.method,
            difficultyIncrease: m.difficultyIncrease,
          })),
        },
      },
      select: { id: true, name: true },
    });

    judyByName.set(created.name, created);
    createdExercises++;
  }

  // Repoint Judy logs to Judy-owned UserProgressionLevels by exercise name
  const judyLogs = await prisma.progressionLog.findMany({
    where: { userProgression: { userId: JUDY_ID } },
    select: {
      id: true,
      userProgression: {
        select: {
          exercise: { select: { name: true } },
        },
      },
    },
  });

  let repointed = 0;
  for (const log of judyLogs) {
    const exName = log.userProgression.exercise.name;
    const judyEx = judyByName.get(exName);
    if (!judyEx) continue;

    let upl = await prisma.userProgressionLevel.findUnique({
      where: { userId_exerciseId: { userId: JUDY_ID, exerciseId: judyEx.id } },
      select: { id: true },
    });

    if (!upl) {
      upl = await prisma.userProgressionLevel.create({
        data: { userId: JUDY_ID, exerciseId: judyEx.id, currentLevel: 1 },
        select: { id: true },
      });
    }

    await prisma.progressionLog.update({
      where: { id: log.id },
      data: { userProgressionId: upl.id },
    });
    repointed++;
  }

  // cleanup Judy UPLs that still point to non-Judy exercises and have no logs
  const staleUpl = await prisma.userProgressionLevel.findMany({
    where: {
      userId: JUDY_ID,
      exercise: { NOT: { userId: JUDY_ID } },
      logs: { none: {} },
    },
    select: { id: true },
  });
  if (staleUpl.length) {
    await prisma.userProgressionLevel.deleteMany({ where: { id: { in: staleUpl.map(s => s.id) } } });
  }

  const verify = await prisma.$queryRaw`
    SELECT
      COUNT(*) as totalLogs,
      SUM(CASE WHEN pe.userId = ${JUDY_ID} THEN 1 ELSE 0 END) as logsOnJudyExercises
    FROM ProgressionLog pl
    JOIN UserProgressionLevel upl ON upl.id = pl.userProgressionId
    JOIN ProgressionExercise pe ON pe.id = upl.exerciseId
    WHERE upl.userId = ${JUDY_ID}
  `;

  console.log(JSON.stringify({ createdExercises, repointed, verify: verify[0] }, null, 2));

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
