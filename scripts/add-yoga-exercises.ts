import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

type YogaRow = {
  name: string;
  progression: string[];
  variations: string[];
};

const YOGA_ROWS: YogaRow[] = [
  { name: "Downward Dog", progression: ["Puppy Pose", "Dolphin Pose", "Full"], variations: ["One Leg", "Bent Knee"] },
  { name: "Warrior I", progression: ["Low Lunge", "Crescent Lunge", "Full"], variations: ["Arms Overhead", "Hands at Heart"] },
  { name: "Warrior II", progression: ["Wide Stance", "Full"], variations: ["Extended", "Reverse"] },
  { name: "Warrior III", progression: ["Kickstand", "Full"], variations: ["Arms Forward", "Arms Back", "Arms Wide"] },
  { name: "Triangle Pose", progression: ["Half", "Full", "Extended"], variations: ["Revolved", "Bound"] },
  { name: "Chair Pose", progression: ["Half", "Full"], variations: ["Twisted", "One Leg"] },
  { name: "Tree Pose", progression: ["Kickstand", "Ankle", "Calf", "Thigh"], variations: ["Arms at Heart", "Arms Overhead", "Arms Wide"] },
  { name: "Eagle Pose", progression: ["Half Wrap", "Full"], variations: ["Standing", "Seated"] },
  { name: "Crow Pose", progression: ["Frogger", "Toes Down", "Full"], variations: ["Side Crow", "One Leg"] },
  { name: "Headstand", progression: ["Tripod", "Supported", "Full"], variations: ["Tuck", "Straddle", "Pike", "Lotus"] },
  { name: "Forearm Stand", progression: ["Wall", "Scorpion Prep", "Full"], variations: ["Tuck", "Straddle", "Scorpion"] },
  { name: "Shoulder Stand", progression: ["Supported", "Full"], variations: ["Plow", "Lotus"] },
  { name: "Bridge Pose", progression: ["Supported", "Full"], variations: ["One Leg", "Wheel Prep"] },
  { name: "Wheel Pose", progression: ["Bridge", "Half Wheel", "Full"], variations: ["One Leg", "One Arm", "Scorpion"] },
  { name: "Cobra Pose", progression: ["Baby Cobra", "Full"], variations: ["Upward Dog"] },
  { name: "Locust Pose", progression: ["Arms Back", "Arms Forward", "Full"], variations: ["One Leg", "Superman"] },
  { name: "Bow Pose", progression: ["Half", "Full"], variations: ["One Leg", "Side"] },
  { name: "Pigeon Pose", progression: ["Supported", "Sleeping", "Full"], variations: ["King Pigeon", "One Legged King"] },
  { name: "Lotus Pose", progression: ["Easy Seat", "Half Lotus", "Full"], variations: ["Bound", "Elevated"] },
  { name: "Seated Forward Fold", progression: ["Half", "Full"], variations: ["Wide Leg", "One Leg"] },
  { name: "Standing Forward Fold", progression: ["Half", "Full"], variations: ["Wide Leg", "Ragdoll"] },
  { name: "Camel Pose", progression: ["Hands on Hips", "Blocks", "Full"], variations: ["One Arm"] },
  { name: "Fish Pose", progression: ["Supported", "Full"], variations: ["Lotus"] },
  { name: "Boat Pose", progression: ["Bent Knee", "Half", "Full"], variations: ["Low Boat", "Twisted"] },
  { name: "Side Plank", progression: ["Knee Down", "Half", "Full"], variations: ["Tree", "Top Leg Raised", "Wild Thing"] },
  { name: "Plank", progression: ["Knee", "Forearm", "High"], variations: ["Side", "Reverse"] },
  { name: "Chaturanga", progression: ["Knee Down", "Full"], variations: ["Hover", "Slow Lower"] },
  { name: "Cat Cow", progression: ["Seated", "Tabletop"], variations: ["Flow", "Isolated"] },
  { name: "Child's Pose", progression: ["Narrow", "Wide"], variations: ["Extended Arms", "Side Stretch"] },
  { name: "Corpse Pose", progression: ["Supported", "Full"], variations: ["Legs Up Wall"] },
  { name: "Half Moon Pose", progression: ["Block", "Full"], variations: ["Revolved", "Sugarcane"] },
  { name: "Dancer Pose", progression: ["Kickstand", "Half", "Full"], variations: ["King Dancer"] },
  { name: "Standing Split", progression: ["Half", "Full"], variations: ["Wall Supported"] },
  { name: "Compass Pose", progression: ["Seated Side Stretch", "Half", "Full"], variations: ["Bound"] },
  { name: "Firefly Pose", progression: ["Tuck", "Half", "Full"], variations: ["Floating"] },
  { name: "Eight Angle Pose", progression: ["Prep", "Full"], variations: ["Flying"] },
  { name: "Peacock Pose", progression: ["Wrist Prep", "Lotus Peacock", "Full"], variations: ["One Leg"] },
  { name: "Handstand", progression: ["Wall", "L-Shape", "Full"], variations: ["Scorpion", "Lotus", "Straddle"] },
  { name: "Splits", progression: ["Half", "Wall Supported", "Full"], variations: ["Oversplit", "Standing"] },
  { name: "Frog Pose", progression: ["Half", "Full"], variations: ["Deep Frog"] },
  { name: "Lizard Pose", progression: ["High", "Low", "Full"], variations: ["Twisted", "Bound"] },
  { name: "Malasana", progression: ["Supported", "Full"], variations: ["Twisted", "Arms Bound"] },
  { name: "Crescent Lunge", progression: ["Low", "High"], variations: ["Twisted", "Arms Overhead"] },
  { name: "Gate Pose", progression: ["Half", "Full"], variations: ["Extended"] },
  { name: "Reclined Twist", progression: ["Bent Knee", "Full"], variations: ["Eagle Legs", "Straight Leg"] },
  { name: "Happy Baby", progression: ["One Leg", "Full"], variations: ["Extended"] },
  { name: "Thread the Needle", progression: ["Half", "Full"], variations: ["Extended"] },
  { name: "Puppy Pose", progression: ["Half", "Full"], variations: ["Extended", "Twisted"] },
  { name: "Sphinx Pose", progression: ["Half", "Full"], variations: ["Seal"] },
  { name: "Side Angle Pose", progression: ["Forearm on Thigh", "Full"], variations: ["Extended", "Bound", "Revolved"] },
  { name: "Revolved Chair", progression: ["Half Twist", "Full"], variations: ["Bound"] },
  { name: "Garland Pose", progression: ["Elevated Heels", "Full"], variations: ["Twisted", "Arms Bound"] },
];

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  const adapter = new PrismaLibSql({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const next = String(value || "").trim();
    if (!next) continue;
    const key = next.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(next);
  }
  return result;
}

async function main() {
  const prisma = createPrismaClient();

  try {
    const admin = await prisma.user.findFirst({ where: { username: "admin" }, select: { id: true, username: true } });
    if (!admin) {
      throw new Error("Admin user not found (username=admin).");
    }

    let created = 0;
    let updated = 0;

    for (const row of YOGA_ROWS) {
      const progression = dedupe(row.progression);
      const variations = dedupe(row.variations);

      const existing = await prisma.progressionExercise.findFirst({
        where: { userId: admin.id, name: row.name },
        select: { id: true },
      });

      let exerciseId: string;

      if (!existing) {
        const createdExercise = await prisma.progressionExercise.create({
          data: {
            name: row.name,
            wuxiaName: row.name,
            category: "Yoga",
            equipmentType: "Mat",
            bodyweight: true,
            weighted: false,
            rings: false,
            primaryMuscles: "Full Body",
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
        await prisma.progressionExercise.update({
          where: { id: exerciseId },
          data: {
            category: "Yoga",
            equipmentType: "Mat",
            bodyweight: true,
            weighted: false,
            progression: JSON.stringify(progression),
            primaryMuscles: "Full Body",
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

    console.log("Yoga exercise import complete.");
    console.log(`Admin: ${admin.username} (${admin.id})`);
    console.log(`Total rows requested: ${YOGA_ROWS.length}`);
    console.log(`Created: ${created}`);
    console.log(`Updated: ${updated}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to import yoga exercises:", error);
  process.exitCode = 1;
});
