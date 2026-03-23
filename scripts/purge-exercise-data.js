/**
 * purge-exercise-data.js
 * 
 * Purges all exercise-related data from the database while preserving:
 *   - User accounts
 *   - Check-in records
 *   - User settings
 *   - Table structure
 * 
 * Usage:
 *   node scripts/purge-exercise-data.js
 */

const { PrismaClient } = require("../src/generated/prisma");

const prisma = new PrismaClient();

async function main() {
  console.log("🗑️  Starting exercise data purge...\n");

  // Delete in reverse dependency order
  const steps = [
    { label: "ProgressionLog", fn: () => prisma.progressionLog.deleteMany() },
    { label: "UserProgressionLevel", fn: () => prisma.userProgressionLevel.deleteMany() },
    { label: "ProgressionModifier", fn: () => prisma.progressionModifier.deleteMany() },
    { label: "ProgressionVariation", fn: () => prisma.progressionVariation.deleteMany() },
    { label: "ProgressionTier", fn: () => prisma.progressionTier.deleteMany() },
    { label: "ProgressionExercise", fn: () => prisma.progressionExercise.deleteMany() },
    { label: "Exercise", fn: () => prisma.exercise.deleteMany() },
  ];

  for (const step of steps) {
    const result = await step.fn();
    console.log(`  ✅ ${step.label}: ${result.count} rows deleted`);
  }

  console.log("\n✅ Exercise data purge complete.");
  console.log("   Tables are empty but structure is preserved.");
  console.log("   User accounts, check-ins, and settings are intact.");
}

main()
  .catch((e) => {
    console.error("❌ Purge failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
