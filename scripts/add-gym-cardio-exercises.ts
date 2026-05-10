import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

type Row = {
  name: string;
  category: string;
  type: "weighted" | "bodyweight" | "timed";
  primaryMuscles: string;
  progression: string[];
  variations: string[];
};

const ROWS: Row[] = [
  { name: "Lat pulldown", category: "Gym", type: "weighted", primaryMuscles: "Back", progression: ["Assisted", "Standard", "Weighted"], variations: ["Wide", "Close", "Neutral", "Overhead"] },
  { name: "Row", category: "Gym", type: "weighted", primaryMuscles: "Back", progression: ["Beginner", "Standard", "Weighted"], variations: ["Seated Cable", "Machine", "T-Bar", "Barbell"] },
  { name: "Pull up", category: "Calisthenics", type: "bodyweight", primaryMuscles: "Back", progression: ["Negative", "Assisted", "Standard", "Weighted"], variations: ["Wide", "Close", "Neutral"] },
  { name: "Bench press", category: "Gym", type: "weighted", primaryMuscles: "Chest", progression: ["Machine", "Dumbbell", "Barbell"], variations: ["Flat", "Incline 45"] },
  { name: "Chest fly", category: "Gym", type: "weighted", primaryMuscles: "Chest", progression: ["Standard"], variations: ["Machine", "Cable"] },
  { name: "Chest press", category: "Gym", type: "weighted", primaryMuscles: "Chest", progression: ["Machine", "Dumbbell", "Barbell"], variations: ["Flat", "Incline"] },
  { name: "Squat", category: "Gym", type: "weighted", primaryMuscles: "Quads", progression: ["Bodyweight", "Barbell", "Weighted"], variations: ["Standard", "Pendulum"] },
  { name: "Leg press", category: "Gym", type: "weighted", primaryMuscles: "Quads", progression: ["Standard", "Weighted"], variations: ["Single leg", "Wide stance"] },
  { name: "Leg extension", category: "Gym", type: "weighted", primaryMuscles: "Quads", progression: ["Seated", "Single Leg"], variations: ["Standard"] },
  { name: "Deadlift", category: "Gym", type: "weighted", primaryMuscles: "Hamstrings", progression: ["Romanian", "Standard"], variations: ["Barbell", "B Stance"] },
  { name: "Hamstring curl", category: "Gym", type: "weighted", primaryMuscles: "Hamstrings", progression: ["Seated", "Lying"], variations: ["Single leg"] },
  { name: "Hip abduction", category: "Gym", type: "weighted", primaryMuscles: "Glutes", progression: ["Standard"], variations: ["Leaning Back", "Leaning Forward", "Pulses"] },
  { name: "Cable kickback", category: "Gym", type: "weighted", primaryMuscles: "Glutes", progression: ["Standard"], variations: ["Single leg"] },
  { name: "Shoulder press", category: "Gym", type: "weighted", primaryMuscles: "Shoulders", progression: ["Dumbbell", "Barbell"], variations: ["Seated", "Standing"] },
  { name: "Lateral raise", category: "Gym", type: "weighted", primaryMuscles: "Shoulders", progression: ["Standard", "Weighted"], variations: ["Dumbbell", "Cable"] },
  { name: "Front raise", category: "Gym", type: "weighted", primaryMuscles: "Shoulders", progression: ["Standard", "Weighted"], variations: ["Dumbbell", "Cable", "Plate"] },
  { name: "Upright row", category: "Gym", type: "weighted", primaryMuscles: "Shoulders", progression: ["Dumbbell", "EZ Bar", "Barbell"], variations: ["Wide", "Close"] },
  { name: "Rear delt fly", category: "Gym", type: "weighted", primaryMuscles: "Shoulders", progression: ["Standard"], variations: ["Dumbbell", "Cable", "Machine"] },
  { name: "Face pull", category: "Gym", type: "weighted", primaryMuscles: "Shoulders", progression: ["Standard"], variations: ["Cable", "Band"] },
  { name: "Bicep curl", category: "Gym", type: "weighted", primaryMuscles: "Biceps", progression: ["Standard", "Weighted"], variations: ["EZ Bar", "Dumbbell", "Cable", "Hammer"] },
  { name: "Tricep pushdown", category: "Gym", type: "weighted", primaryMuscles: "Triceps", progression: ["Standard"], variations: ["Cable", "One Arm Cable"] },
  { name: "Leg raise", category: "Calisthenics", type: "bodyweight", primaryMuscles: "Core", progression: ["Lying", "Hanging"], variations: ["Tuck", "Straight"] },
  { name: "Stairmaster", category: "Cardio", type: "timed", primaryMuscles: "Full Body", progression: ["Low", "Medium", "High"], variations: ["Intervals"] },
  { name: "Treadmill", category: "Cardio", type: "timed", primaryMuscles: "Full Body", progression: ["Walk", "Jog", "Run"], variations: ["Incline", "Intervals"] },
  { name: "Bike", category: "Cardio", type: "timed", primaryMuscles: "Full Body", progression: ["Low", "Medium", "High"], variations: ["Intervals", "Steady state"] },
];

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  const adapter = new PrismaLibSql({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const next = String(value || "").trim();
    if (!next) continue;
    const key = next.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }
  return out;
}

async function main() {
  const prisma = createPrismaClient();

  try {
    const admin = await prisma.user.findFirst({ where: { username: "admin" }, select: { id: true, username: true } });
    if (!admin) throw new Error("Admin user not found (username=admin).");

    let created = 0;
    let updated = 0;
    const duplicates: string[] = [];

    for (const row of ROWS) {
      const progression = dedupe(row.progression);
      const variations = dedupe(row.variations);

      const existing = await prisma.progressionExercise.findFirst({
        where: { name: row.name },
        select: { id: true },
      });

      let exerciseId: string;

      if (!existing) {
        const createdExercise = await prisma.progressionExercise.create({
          data: {
            name: row.name,
            wuxiaName: row.name,
            category: row.category,
            equipmentType: "",
            bodyweight: row.type !== "weighted",
            weighted: row.type === "weighted",
            rings: false,
            primaryMuscles: row.primaryMuscles,
            secondaryMuscles: "",
            difficulty: "",
            wuxiaDifficulty: "",
            type: "",
            wuxiaType: "",
            story: "",
            tips: "[]",
            progression: JSON.stringify(progression),
            prerequisites: "[]",
            cues: "[]",
            commonMistakes: "[]",
            breathing: "",
            safetyConsiderations: "[]",
            competitionStandards: "{}",
            assignedDays: "",
            userId: admin.id,
          },
          select: { id: true },
        });
        exerciseId = createdExercise.id;
        created++;
      } else {
        exerciseId = existing.id;
        duplicates.push(row.name);
        await prisma.progressionExercise.update({
          where: { id: exerciseId },
          data: {
            category: row.category,
            bodyweight: row.type !== "weighted",
            weighted: row.type === "weighted",
            primaryMuscles: row.primaryMuscles,
            progression: JSON.stringify(progression),
          },
        });
        updated++;
      }

      await prisma.progressionTier.deleteMany({ where: { exerciseId } });
      if (progression.length > 0) {
        await prisma.progressionTier.createMany({
          data: progression.map((name, index) => ({
            exerciseId,
            level: index + 1,
            name,
            wuxiaName: name,
            difficulty: "",
            wuxiaDifficulty: "",
            wuxiaType: "",
            description: "",
            targetHold: null,
            targetReps: null,
            targetRepsText: "",
          })),
        });
      }

      await prisma.progressionVariation.deleteMany({ where: { exerciseId } });
      if (variations.length > 0) {
        await prisma.progressionVariation.createMany({
          data: variations.map((name) => ({
            exerciseId,
            name,
            wuxiaName: name,
            difficulty: "",
            wuxiaDifficulty: "",
            wuxiaType: "",
            description: "",
          })),
        });
      }

      await prisma.userProgressionLevel.upsert({
        where: {
          userId_exerciseId: {
            userId: admin.id,
            exerciseId,
          },
        },
        update: {},
        create: {
          userId: admin.id,
          exerciseId,
          currentLevel: 1,
        },
      });
    }

    console.log("Gym/Cardio exercise import complete.");
    console.log(`Admin: ${admin.username} (${admin.id})`);
    console.log(`Total rows requested: ${ROWS.length}`);
    console.log(`Created: ${created}`);
    console.log(`Updated (duplicates): ${updated}`);
    console.log(`Duplicate names: ${JSON.stringify(dedupe(duplicates))}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to import gym/cardio exercises:", error);
  process.exitCode = 1;
});
