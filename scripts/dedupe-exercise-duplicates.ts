/**
 * Dedupe ProgressionExercise records that share the same (case-insensitive) name.
 * Picks the record with the most tiers as canonical; migrates UserProgressionLevel
 * and ProgressionLog entries from duplicates onto the canonical record, then deletes
 * the duplicate and its tiers/variations/modifiers.
 *
 * Dry-run by default. Pass --apply to commit.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  const adapter = new PrismaLibSql({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

async function main() {
  const apply = process.argv.includes("--apply");
  const prisma = createPrismaClient();
  try {
    const all = await prisma.progressionExercise.findMany({
      include: { tiers: true },
    });
    const groups = new Map<string, typeof all>();
    for (const ex of all) {
      const key = ex.name.trim().toLowerCase();
      const arr = groups.get(key) || [];
      arr.push(ex);
      groups.set(key, arr);
    }

    let dupGroups = 0;
    let migratedLogs = 0;
    let migratedLevels = 0;
    let deletedExercises = 0;

    for (const [key, list] of groups) {
      if (list.length <= 1) continue;
      dupGroups++;
      // Canonical = most tiers; tie -> earliest createdAt (smallest id)
      list.sort((a, b) => {
        if (b.tiers.length !== a.tiers.length) return b.tiers.length - a.tiers.length;
        return a.id.localeCompare(b.id);
      });
      const canonical = list[0];
      const dups = list.slice(1);
      console.log(`\n[${key}] canonical=${canonical.id} (${canonical.tiers.length} tiers) dups=${dups.length}`);

      for (const dup of dups) {
        const levelCount = await prisma.userProgressionLevel.count({ where: { exerciseId: dup.id } });
        const dupLevels = await prisma.userProgressionLevel.findMany({ where: { exerciseId: dup.id } });
        const logCount = await prisma.progressionLog.count({
          where: { userProgression: { exerciseId: dup.id } },
        });
        console.log(`  dup ${dup.id}: ${levelCount} userProgressionLevel, ${logCount} logs`);

        if (!apply) continue;

        // Migrate logs: move ProgressionLog entries from dup's UserProgressionLevel to canonical's
        for (const dupLevel of dupLevels) {
          // Find or create canonical UserProgressionLevel for same user
          let canonicalLevel = await prisma.userProgressionLevel.findUnique({
            where: { userId_exerciseId: { userId: dupLevel.userId, exerciseId: canonical.id } },
          });
          if (!canonicalLevel) {
            canonicalLevel = await prisma.userProgressionLevel.create({
              data: {
                userId: dupLevel.userId,
                exerciseId: canonical.id,
                currentLevel: Math.max(1, dupLevel.currentLevel),
              },
            });
            migratedLevels++;
          } else if (dupLevel.currentLevel > canonicalLevel.currentLevel) {
            await prisma.userProgressionLevel.update({
              where: { id: canonicalLevel.id },
              data: { currentLevel: dupLevel.currentLevel },
            });
          }

          const moved = await prisma.progressionLog.updateMany({
            where: { userProgressionId: dupLevel.id },
            data: { userProgressionId: canonicalLevel.id },
          });
          migratedLogs += moved.count;
        }

        // Delete dup's UserProgressionLevel rows
        await prisma.userProgressionLevel.deleteMany({ where: { exerciseId: dup.id } });
        // Delete dup's tiers/variations/modifiers
        await prisma.progressionTier.deleteMany({ where: { exerciseId: dup.id } });
        await prisma.progressionVariation.deleteMany({ where: { exerciseId: dup.id } });
        await prisma.progressionModifier.deleteMany({ where: { exerciseId: dup.id } });
        await prisma.progressionExercise.delete({ where: { id: dup.id } });
        deletedExercises++;
      }
    }

    console.log(`\n${apply ? "APPLIED" : "DRY-RUN"}: ${dupGroups} duplicate groups, would delete ${apply ? deletedExercises : "?"} exercises`);
    if (apply) {
      console.log(`Migrated ${migratedLogs} logs and ${migratedLevels} new userProgressionLevels`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
