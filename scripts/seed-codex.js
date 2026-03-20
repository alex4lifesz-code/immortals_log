// Seed exercises from 200codex.json into the database
// Usage: node scripts/seed-codex.js
// Optional: node scripts/seed-codex.js --path /custom/path/to/200codex.json

const { PrismaClient } = require("../src/generated/prisma/client");
const path = require("path");
const fs = require("fs");

const prisma = new PrismaClient();

function resolveJsonPath() {
  // Check for --path argument
  const pathArgIndex = process.argv.indexOf("--path");
  if (pathArgIndex !== -1 && process.argv[pathArgIndex + 1]) {
    return process.argv[pathArgIndex + 1];
  }
  // Default: one level up from project root (Desktop/200codex.json)
  const defaultPath = path.join(__dirname, "..", "..", "200codex.json");
  if (fs.existsSync(defaultPath)) return defaultPath;
  // Fallback: check inside project root
  const localPath = path.join(__dirname, "..", "200codex.json");
  if (fs.existsSync(localPath)) return localPath;
  return null;
}

function mapExercise(exercise) {
  // If already in flat converted format, use directly
  if (exercise.difficulty && !exercise.subcategory && !exercise.primaryMuscles) {
    return {
      name: exercise.name,
      wuxiaName: exercise.wuxiaName || null,
      difficulty: exercise.difficulty,
      type: exercise.type,
      story: exercise.story || null,
      targetGroup: exercise.targetGroup || null,
      assignedDays: exercise.assignedDays ?? "",
    };
  }

  // Legacy: original nested 200codex.json format
  const subcategoryToType = {
    Barbell: "barbell",
    Dumbbell: "dumbbell",
    Machine: "machine",
    Cardio: "cardio",
    Bodyweight: "bodyweight",
    Cable: "cable",
  };

  const type = subcategoryToType[exercise.subcategory] || exercise.subcategory?.toLowerCase() || "strength";

  const primaryMuscles = Array.isArray(exercise.primaryMuscles)
    ? exercise.primaryMuscles.join(", ")
    : exercise.primaryMuscles || "";

  const progressionCount = Array.isArray(exercise.progressions) ? exercise.progressions.length : 0;
  const difficulty = progressionCount >= 5 ? "advanced" : progressionCount >= 3 ? "intermediate" : "beginner";

  const story =
    exercise.story && exercise.story !== "To be added" ? exercise.story : null;

  return {
    name: exercise.name,
    wuxiaName: exercise.wuxiaName || null,
    difficulty,
    type,
    story,
    targetGroup: primaryMuscles || null,
    assignedDays: "",
  };
}

async function seedCodex() {
  const jsonPath = resolveJsonPath();
  if (!jsonPath) {
    console.error(
      "❌ Could not find 200codex.json. Place it in the project root or pass --path <filepath>"
    );
    process.exit(1);
  }

  console.log(`📂 Loading exercises from: ${jsonPath}`);
  const raw = fs.readFileSync(jsonPath, "utf-8");
  const exercises = JSON.parse(raw);

  if (!Array.isArray(exercises)) {
    console.error("❌ Expected an array of exercises in the JSON file.");
    process.exit(1);
  }

  console.log(`📋 Found ${exercises.length} exercises to seed.\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const exercise of exercises) {
    const data = mapExercise(exercise);
    try {
      const existing = await prisma.exercise.findFirst({
        where: { name: data.name },
      });
      if (existing) {
        console.log(`⏭  Skipped (already exists): ${data.name}`);
        skipped++;
        continue;
      }
      await prisma.exercise.create({ data });
      console.log(`✓  Created: ${data.name} [${data.type}]`);
      created++;
    } catch (err) {
      console.error(`✗  Failed to create "${data.name}":`, err.message);
      failed++;
    }
  }

  console.log(`\n✅ Done. Created: ${created}, Skipped: ${skipped}, Failed: ${failed}`);
}

seedCodex()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
