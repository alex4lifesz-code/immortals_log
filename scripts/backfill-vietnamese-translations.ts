import { prisma } from "../src/lib/prisma";
import { autoTranslateToVietnamese } from "../src/lib/auto-vietnamese";

function shouldBackfill(english: string | null | undefined, vietnamese: string | null | undefined): boolean {
  const en = (english || "").trim().toLowerCase();
  const vi = (vietnamese || "").trim().toLowerCase();
  return !vi || vi === en;
}

async function main() {
  const exerciseRows = await prisma.exerciseTranslation.findMany();
  let exerciseUpdates = 0;

  for (const row of exerciseRows) {
    const next: Record<string, string | null> = {};
    if (shouldBackfill(row.englishName, row.vietnameseName)) next.vietnameseName = autoTranslateToVietnamese(row.englishName);
    if (shouldBackfill(row.englishStory, row.vietnameseStory)) next.vietnameseStory = autoTranslateToVietnamese(row.englishStory || "");
    if (shouldBackfill(row.englishDifficulty, row.vietnameseDifficulty)) next.vietnameseDifficulty = autoTranslateToVietnamese(row.englishDifficulty || "");
    if (shouldBackfill(row.englishType, row.vietnameseType)) next.vietnameseType = autoTranslateToVietnamese(row.englishType || "");

    if (Object.keys(next).length > 0) {
      await prisma.exerciseTranslation.update({ where: { id: row.id }, data: next });
      exerciseUpdates += 1;
    }
  }

  const progressionRows = await prisma.progressionExerciseTranslation.findMany();
  let progressionUpdates = 0;

  for (const row of progressionRows) {
    const next: Record<string, string | null> = {};
    if (shouldBackfill(row.englishName, row.vietnameseName)) next.vietnameseName = autoTranslateToVietnamese(row.englishName);
    if (shouldBackfill(row.englishStory, row.vietnameseStory)) next.vietnameseStory = autoTranslateToVietnamese(row.englishStory || "");
    if (shouldBackfill(row.englishDifficulty, row.vietnameseDifficulty)) next.vietnameseDifficulty = autoTranslateToVietnamese(row.englishDifficulty || "");
    if (shouldBackfill(row.englishType, row.vietnameseType)) next.vietnameseType = autoTranslateToVietnamese(row.englishType || "");

    if (Object.keys(next).length > 0) {
      await prisma.progressionExerciseTranslation.update({ where: { id: row.id }, data: next });
      progressionUpdates += 1;
    }
  }

  const tierRows = await prisma.progressionTierTranslation.findMany();
  let tierUpdates = 0;

  for (const row of tierRows) {
    const next: Record<string, string | null> = {};
    if (shouldBackfill(row.englishName, row.vietnameseName)) next.vietnameseName = autoTranslateToVietnamese(row.englishName);
    if (shouldBackfill(row.englishDescription, row.vietnameseDescription)) next.vietnameseDescription = autoTranslateToVietnamese(row.englishDescription || "");
    if (shouldBackfill(row.englishDifficulty, row.vietnameseDifficulty)) next.vietnameseDifficulty = autoTranslateToVietnamese(row.englishDifficulty || "");

    if (Object.keys(next).length > 0) {
      await prisma.progressionTierTranslation.update({ where: { id: row.id }, data: next });
      tierUpdates += 1;
    }
  }

  const variationRows = await prisma.progressionVariationTranslation.findMany();
  let variationUpdates = 0;

  for (const row of variationRows) {
    const next: Record<string, string | null> = {};
    if (shouldBackfill(row.englishName, row.vietnameseName)) next.vietnameseName = autoTranslateToVietnamese(row.englishName);
    if (shouldBackfill(row.englishDescription, row.vietnameseDescription)) next.vietnameseDescription = autoTranslateToVietnamese(row.englishDescription || "");
    if (shouldBackfill(row.englishDifficulty, row.vietnameseDifficulty)) next.vietnameseDifficulty = autoTranslateToVietnamese(row.englishDifficulty || "");

    if (Object.keys(next).length > 0) {
      await prisma.progressionVariationTranslation.update({ where: { id: row.id }, data: next });
      variationUpdates += 1;
    }
  }

  console.log(JSON.stringify({
    exerciseUpdates,
    progressionUpdates,
    tierUpdates,
    variationUpdates,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
