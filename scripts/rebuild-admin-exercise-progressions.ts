import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

type ExerciseSpec = {
  name: string;
  aliases?: string[];
  progression: string[];
  variations: string[];
};

const EXERCISE_SPECS: ExerciseSpec[] = [
  { name: "Muscle up", aliases: ["Muscle Up"], progression: ["Transition Drill", "Band Assisted", "Negative", "Strict"], variations: ["Bar", "Ring"] },
  { name: "Pull up", aliases: ["Pull Up"], progression: ["Scapular", "Assisted", "Standard", "Strict", "Weighted", "One Arm Assisted", "One Arm Negatives", "One Arm"], variations: ["Wide grip", "Close grip", "Chin up", "Neutral grip", "Archer", "Typewriter", "L-sit", "Commando", "Chest-to-bar", "High", "Ring", "Explosive", "Kipping"] },
  { name: "Dip", progression: ["Bench", "Negative", "Assisted", "Standard", "Weighted"], variations: ["Parallel bar", "Ring", "Straight bar", "Korean", "L-sit", "Russian"] },
  { name: "Push up", aliases: ["Push Up"], progression: ["Incline", "Standard", "Decline", "Weighted"], variations: ["Wide", "Diamond", "Archer", "One arm", "Clapping", "Planche", "Pike", "Pseudo planche", "Explosive", "Typewriter"] },
  { name: "Handstand", progression: ["Wall Hold", "Freestanding", "One arm"], variations: ["Tuck", "Straddle", "Press to handstand", "Walking", "Fingertip"] },
  { name: "Handstand push up", aliases: ["Handstand Push Up", "Handstand push-up", "Handstand Push-up"], progression: ["Pike", "Elevated Pike", "Wall", "Deficit Wall", "Freestanding"], variations: ["90 degree", "Weighted"] },
  { name: "Front lever", aliases: ["Front Lever"], progression: ["Tuck Hold", "Tucked Negative", "Advanced Tuck Hold", "One Leg Hold", "Straddle Hold", "Full Hold"], variations: ["Pulls", "Raises", "Ice Cream Maker"] },
  { name: "Back lever", aliases: ["Back Lever"], progression: ["Tuck", "Advanced tuck", "Straddle", "Half lay", "Full"], variations: ["One leg", "Pulls"] },
  { name: "Planche", progression: ["Lean", "Tuck", "Tucked Press", "Advanced tuck", "Straddle", "Full"], variations: ["Push up", "Press", "One arm"] },
  { name: "Dragon flag", aliases: ["Dragon Flag"], progression: ["Tuck", "Advanced tuck", "Straddle", "Full"], variations: ["Negatives"] },
  { name: "L-sit", aliases: ["L-Sit", "L sit"], progression: ["Tuck", "One leg", "Full", "Straddle", "V-sit", "Manna"], variations: ["Floor", "Parallettes", "Rings", "Bar"] },
  { name: "Human flag", aliases: ["Human Flag"], progression: ["Tuck", "Straddle", "Half", "Full"], variations: ["Vertical", "Pulls", "Raises"] },
  { name: "Hang", progression: ["Dead", "Active"], variations: ["One arm", "Weighted"] },
  { name: "Support hold", aliases: ["Support Hold"], progression: ["Parallel bar", "Ring"], variations: ["Tuck", "L-sit"] },
  { name: "Leg raise", aliases: ["Leg Raise"], progression: ["Lying", "Hanging"], variations: ["Tuck", "Straight", "Windshield wiper"] },
  { name: "Pistol squat", aliases: ["Pistol Squat"], progression: ["Assisted", "Standard", "Weighted"], variations: ["Jumping", "Elevated", "Airborne"] },
  { name: "Squat", aliases: ["Barbell Squat"], progression: ["Bodyweight", "Barbell", "Weighted"], variations: ["Sumo", "Cossack", "Shrimp", "Sissy", "Hindu", "Jump", "Bulgarian split", "Pendulum"] },
  { name: "Bench press", aliases: ["Bench Press", "Barbell Bench Press", "Dumbbell Bench Press", "Incline Barbell Bench Press", "Decline Barbell Bench Press", "Incline Dumbbell Bench Press"], progression: ["Dumbbell", "Barbell"], variations: ["Flat", "Incline", "Decline"] },
  { name: "Chest fly", aliases: ["Chest Fly"], progression: ["Dumbbell", "Cable", "Machine"], variations: ["Flat", "Incline"] },
  { name: "Row", aliases: ["Barbell Row", "Cable Row", "Row"], progression: ["Dumbbell", "Barbell", "Cable"], variations: ["Bent over", "Seated"] },
  { name: "Lat pulldown", aliases: ["Lat Pulldown"], progression: ["Standard", "Weighted"], variations: ["Wide", "Close", "Neutral"] },
  { name: "Deadlift", progression: ["Conventional", "Sumo", "Romanian"], variations: ["Barbell", "Dumbbell", "Trap bar"] },
  { name: "Leg press", aliases: ["Leg Press"], progression: ["Standard"], variations: ["Single leg", "Wide stance"] },
  { name: "Leg extension", aliases: ["Leg Extension", "Seated Leg Extension"], progression: ["Seated"], variations: ["Single leg"] },
  { name: "Leg curl", aliases: ["Leg Curl", "Seated Leg Curl"], progression: ["Seated", "Lying"], variations: ["Single leg"] },
  { name: "Calf raise", aliases: ["Calf Raise"], progression: ["Standing", "Seated"], variations: ["Single leg", "Weighted"] },
  { name: "Hip abduction", aliases: ["Hip Abduction", "Hip Abduction Machine"], progression: ["Machine", "Cable"], variations: ["Seated", "Standing"] },
  { name: "Shoulder press", aliases: ["Shoulder Press", "Dumbbell Shoulder Press"], progression: ["Dumbbell", "Barbell"], variations: ["Seated", "Standing"] },
  { name: "Lateral raise", aliases: ["Lateral Raise", "Dumbbell Lateral Raise"], progression: ["Dumbbell", "Cable"], variations: ["Standing", "Seated"] },
  { name: "Front raise", aliases: ["Front Raise"], progression: ["Dumbbell", "Cable", "Plate"], variations: ["Standing", "Seated"] },
  { name: "Reverse fly", aliases: ["Reverse Fly"], progression: ["Dumbbell", "Cable", "Machine"], variations: ["Bent over", "Seated"] },
  { name: "Face pull", aliases: ["Face Pull", "Cable Face Pull"], progression: ["Cable", "Band"], variations: ["Standing", "Seated"] },
  { name: "Bicep curl", aliases: ["Bicep Curl", "Barbell Curl", "Dumbbell Curl", "Hammer Curl"], progression: ["Dumbbell", "Barbell", "Cable"], variations: ["Standard", "Hammer", "Preacher"] },
  { name: "Forearm curl", aliases: ["Forearm Curl", "Dumbbell Forearm Curl"], progression: ["Dumbbell", "Barbell"], variations: ["Wrist flexion", "Wrist extension"] },
  { name: "Tricep pushdown", aliases: ["Tricep Pushdown", "Cable Tricep Pushdown"], progression: ["Cable", "Band"], variations: ["Rope", "Bar", "Single arm"] },
  { name: "Cable kickback", aliases: ["Cable Kickback", "Cable Kickbacks"], progression: ["Cable"], variations: ["Single arm"] },
];

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  const adapter = new PrismaLibSql({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(trimmed);
  }

  return output;
}

async function main() {
  const prisma = createPrismaClient();

  try {
    const admin = await prisma.user.findFirst({ where: { username: "admin" }, select: { id: true, username: true } });
    if (!admin) {
      throw new Error("Admin user not found (username=admin).");
    }

    const exercises = await prisma.progressionExercise.findMany({
      where: { userId: admin.id },
      include: {
        tiers: { orderBy: { level: "asc" } },
        variations: true,
      },
      orderBy: { name: "asc" },
    });

    const byName = new Map<string, (typeof exercises)[number]>();
    for (const exercise of exercises) {
      byName.set(exercise.name.toLowerCase(), exercise);
    }

    let createdExercises = 0;
    let renamedExercises = 0;
    let rebuiltTiers = 0;
    let rebuiltVariations = 0;

    for (const spec of EXERCISE_SPECS) {
      const candidates = dedupe([spec.name, ...(spec.aliases || [])]).map((value) => value.toLowerCase());

      let target = byName.get(spec.name.toLowerCase());
      if (!target) {
        target = candidates
          .map((name) => byName.get(name))
          .find((item): item is NonNullable<typeof item> => Boolean(item));
      }

      if (!target) {
        target = await prisma.progressionExercise.create({
          data: {
            name: spec.name,
            wuxiaName: spec.name,
            difficulty: "",
            wuxiaDifficulty: "",
            type: "",
            wuxiaType: "",
            story: "",
            tips: "[]",
            category: "Other",
            equipmentType: "",
            bodyweight: true,
            weighted: false,
            rings: false,
            primaryMuscles: "Other",
            secondaryMuscles: "",
            prerequisites: "[]",
            cues: "[]",
            commonMistakes: "[]",
            breathing: "",
            safetyConsiderations: "[]",
            competitionStandards: "{}",
            progression: JSON.stringify(spec.progression),
            assignedDays: "",
            userId: admin.id,
          },
          include: {
            tiers: { orderBy: { level: "asc" } },
            variations: true,
          },
        });
        byName.set(target.name.toLowerCase(), target);
        createdExercises++;
      }

      if (target.name !== spec.name) {
        const existingCanonical = byName.get(spec.name.toLowerCase());
        if (!existingCanonical || existingCanonical.id === target.id) {
          const previousName = target.name;
          const shouldSyncWuxia = !target.wuxiaName || target.wuxiaName.trim().toLowerCase() === target.name.toLowerCase();
          target = await prisma.progressionExercise.update({
            where: { id: target.id },
            data: {
              name: spec.name,
              wuxiaName: shouldSyncWuxia ? spec.name : target.wuxiaName,
            },
            include: {
              tiers: { orderBy: { level: "asc" } },
              variations: true,
            },
          });
          byName.delete(previousName.toLowerCase());
          byName.set(spec.name.toLowerCase(), target);
          renamedExercises++;
        } else {
          target = existingCanonical;
        }
      }

      const progression = dedupe(spec.progression);
      const variations = dedupe(spec.variations);

      await prisma.progressionExercise.update({
        where: { id: target.id },
        data: { progression: JSON.stringify(progression) },
      });

      await prisma.progressionTier.deleteMany({ where: { exerciseId: target.id } });
      if (progression.length > 0) {
        await prisma.progressionTier.createMany({
          data: progression.map((name, index) => ({
            exerciseId: target!.id,
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
      } else {
        await prisma.progressionTier.create({
          data: {
            exerciseId: target.id,
            level: 1,
            name: spec.name,
            wuxiaName: spec.name,
          },
        });
      }
      rebuiltTiers++;

      await prisma.progressionVariation.deleteMany({ where: { exerciseId: target.id } });
      if (variations.length > 0) {
        await prisma.progressionVariation.createMany({
          data: variations.map((name) => ({
            exerciseId: target!.id,
            name,
            wuxiaName: name,
            difficulty: "",
            wuxiaDifficulty: "",
            wuxiaType: "",
            description: "",
          })),
        });
      }
      rebuiltVariations++;

      await prisma.userProgressionLevel.upsert({
        where: {
          userId_exerciseId: {
            userId: admin.id,
            exerciseId: target.id,
          },
        },
        update: {},
        create: {
          userId: admin.id,
          exerciseId: target.id,
          currentLevel: 1,
        },
      });
    }

    console.log("Admin exercise progression rebuild complete.");
    console.log(`Admin user: ${admin.username} (${admin.id})`);
    console.log(`Exercises created: ${createdExercises}`);
    console.log(`Exercises renamed: ${renamedExercises}`);
    console.log(`Exercises updated (tiers rebuilt): ${rebuiltTiers}`);
    console.log(`Exercises updated (variations rebuilt): ${rebuiltVariations}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to rebuild admin exercise progressions:", error);
  process.exitCode = 1;
});
