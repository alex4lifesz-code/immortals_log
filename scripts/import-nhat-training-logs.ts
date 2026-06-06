import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

type ParsedRow = {
  date: string;
  sourceExercise: string;
  w1: number | null;
  r1: number | null;
  w2: number | null;
  r2: number | null;
  w3: number | null;
  r3: number | null;
  notes: string;
};

type Inference = {
  canonicalExercise: string;
  progressionHint?: string;
  variantHint?: string;
  noteSuffix?: string;
};

const RAW_TSV = `Date\tNhat-Exercise\tW1\tR1\tW2\tR2\tW3\tR3\tNotes
28-Jan-26\tLeg Press\t296\t10\t336\t10\t376\t10\tadd ur first workout here, w1 = weight 1 , r1 = rep 1
28-Jan-26\tDB Shoulder Press\t17.5\t10\t22.5\t10\t27.5\t6\t
28-Jan-26\tDB Bicep Curl\t20\t10\t25\t15\t30\t17\t
28-Jan-26\tBB Bench Press\t60\t10\t80\t10\t100\t2\t
28-Jan-26\tDB Bench Press\t22.5\t10\t27.5\t10\t32.5\t6\t
28-Jan-26\tIncline BB Bench Press\t40\t10\t60\t10\t80\t5\t
28-Jan-26\tPush-Ups\t86\t30\t86\t27\t86\t23\t
28-Jan-26\t1-Arm Push-Ups\t86\t10\t86\t10\t86\t12\t
28-Jan-26\tBB Deadlift\t80\t10\t100\t10\t120\t7\t
28-Jan-26\tChest Fly (Machine & Cable)\t10\t10\t15\t10\t20\t9\t
28-Jan-26\tHip Abduction -\t150\t10\t175\t10\t210\t15\t
28-Jan-26\tHip Adduction +\t100\t10\t120\t10\t140\t7\t
28-Jan-26\tBB Squats\t80\t10\t100\t10\t120\t5\t
28-Jan-26\tCalf Raises\t120\t10\t140\t10\t160\t8\t
28-Jan-26\tDecline BB Bench Press\t40\t10\t60\t10\t80\t5\t
28-Jan-26\tPush-Ups (Diamond)\t86\t15\t86\t15\t86\t15\t
28-Jan-26\tDips (Parallel Bars / Rings)\t86\t6\t86\t7\t86\t8\t
28-Jan-26\tIncline DB Bench Press\t20\t10\t22.5\t10\t25\t9\t
28-Jan-26\tDB Skull Crusher\t10\t10\t12.5\t8\t12.5\t6\t
28-Jan-26\tSeated Cable Row\t70\t10\t80\t10\t80\t8\t
28-Jan-26\tLat Pulldown\t50\t10\t60\t9\t70\t5\t
28-Jan-26\tLeg Extensions\t70\t10\t80\t10\t90\t12\t
28-Jan-26\tDB Lateral Raises\t10\t10\t12.5\t10\t12.5\t15\t
28-Jan-26\tCable Tricep Pushdowns\t40\t10\t50\t10\t60\t7\t
28-Jan-26\tBB Overhead Shoulder Press\t20\t10\t40\t10\t50\t4\t
02-Jan-26\tLeg Press\t373\t10\t413\t8\t453\t6\t
02-Jan-26\tLeg Extensions\t60\t10\t80\t10\t80\t10\t
02-Jan-26\tHamstring Curls\t49\t10\t57\t10\t63\t6\t
02-Jan-26\tLat Pulldown\t50\t10\t60\t10\t70\t7\t
02-Jan-26\tCable Rows\t50\t10\t60\t10\t70\t10\t
05-May-26\tDB Skull Crusher\t10\t10\t12.5\t10\t15\t7\t
05-May-26\tDB Preach Curl\t15\t10\t15\t10\t15\t10\t
05-May-26\tDB Lateral Raises\t10\t10\t10\t12\t10\t15\t
05-May-26\tBB Bicep Curl\t20\t10\t30\t10\t40\t8\t
05-May-26\tBB Overhead Shoulder Press\t20\t10\t30\t10\t40\t6\t
12-May-26\tLeg Press\t40\t10\t80\t8\t120\t8\t5s pause
12-May-26\tLeg Press\t160\t7\t160\t7\t\t\t
12-May-26\tCalf Raises Nhat ver\t40\t40\t60\t40\t100\t45\t
12-May-26\tDB Lunges\t0\t14\t10\t14\t10\t14\t
12-May-26\tAbdominal Crunch\t20\t10\t25\t10\t30\t10\t
12-May-26\tAbdominal Crunch\t45\t5\t\t\t\t\t
19-May-26\tIncline BB Bench Press\t20\t10\t60\t10\t80\t8\tEzzz bb
19-May-26\tIncline BB Bench Press\t90\t4\t\t\t\t\tSpot from 3rd
19-May-26\tDB Chest Fly\t10\t6\t20\t6\t22.5\t6\t
19-May-26\tBB Bench Press\t60\t10\t80\t8\t\t\t
19-May-26\tSeated Cable Row\t35\t10\t50\t10\t70\t10\t
19-May-26\tLat Pulldown\t35\t10\t42.5\t10\t50\t10\t
19-May-26\tStanding Cable Reverse Flyes\t1.25\t10\t6.25\t10\t8.75\t10\t
26-May-26\tBB Overhead Shoulder Press\t30\t10\t40\t10\t50\t7\t
26-May-26\tDB Skull Crusher\t10\t10\t15\t7\t15\t8\t
26-May-26\tDB Shoulder Press\t20\t10\t22.5\t10\t25\t10\t
26-May-26\tDB Chest Fly\t10\t10\t12.5\t10\t15\t10\t
26-May-26\tDB Preach Curl\t10\t10\t15\t10\t17.5\t7\t
26-May-26\tJason chen curl\t10\t5\t10\t5\t12.5\t5\t`;

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  const adapter = new PrismaLibSql({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseNumber(value: string): number | null {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIntOrNull(value: string): number | null {
  const num = parseNumber(value);
  if (num == null) return null;
  const rounded = Math.round(num);
  return Number.isFinite(rounded) ? rounded : null;
}

function parseDate(value: string): Date {
  const raw = value.trim();
  const parts = raw.split("-");
  if (parts.length !== 3) throw new Error(`Invalid date: ${value}`);

  const day = Number.parseInt(parts[0], 10);
  const monthMap: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };
  const month = monthMap[parts[1].toLowerCase()];
  const year = 2000 + Number.parseInt(parts[2], 10);

  if (!Number.isFinite(day) || month == null || !Number.isFinite(year)) {
    throw new Error(`Invalid date parts: ${value}`);
  }

  return new Date(Date.UTC(year, month, day, 12, 0, 0));
}

function parseRows(): ParsedRow[] {
  const lines = RAW_TSV.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length <= 1) return [];

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split("\t");
    while (parts.length < 9) parts.push("");

    const [date, sourceExercise, w1, r1, w2, r2, w3, r3, ...rest] = parts;
    rows.push({
      date: date.trim(),
      sourceExercise: sourceExercise.trim(),
      w1: parseNumber(w1),
      r1: parseIntOrNull(r1),
      w2: parseNumber(w2),
      r2: parseIntOrNull(r2),
      w3: parseNumber(w3),
      r3: parseIntOrNull(r3),
      notes: rest.join("\t").trim(),
    });
  }

  return rows;
}

function inferMapping(sourceExercise: string, notes: string): Inference | null {
  const name = normalizeKey(sourceExercise);
  const note = normalizeKey(notes);

  if (name.includes("leg press")) {
    const noteSuffix = note.includes("pause") ? "Paused reps" : undefined;
    return { canonicalExercise: "Leg press", progressionHint: "Standard", noteSuffix };
  }

  if (name.includes("db shoulder press")) return { canonicalExercise: "Shoulder press", progressionHint: "Dumbbell" };
  if (name.includes("bb overhead shoulder press")) return { canonicalExercise: "Shoulder press", progressionHint: "Barbell" };

  if (name.includes("db bicep curl")) return { canonicalExercise: "Bicep curl", progressionHint: "Dumbbell" };
  if (name.includes("bb bicep curl")) return { canonicalExercise: "Bicep curl", progressionHint: "Barbell" };
  if (name.includes("db preach curl") || name.includes("db preacher curl")) {
    return { canonicalExercise: "Bicep curl", progressionHint: "Dumbbell", variantHint: "Preacher" };
  }
  if (name.includes("jason chen curl")) {
    return { canonicalExercise: "Bicep curl", progressionHint: "Dumbbell", variantHint: "Standard", noteSuffix: "Jason chen curl" };
  }

  if (name.includes("bb bench press")) return { canonicalExercise: "Bench press", progressionHint: "Barbell", variantHint: "Flat" };
  if (name.includes("db bench press")) return { canonicalExercise: "Bench press", progressionHint: "Dumbbell", variantHint: "Flat" };
  if (name.includes("incline bb bench press")) return { canonicalExercise: "Bench press", progressionHint: "Barbell", variantHint: "Incline" };
  if (name.includes("decline bb bench press")) return { canonicalExercise: "Bench press", progressionHint: "Barbell", variantHint: "Decline" };
  if (name.includes("incline db bench press")) return { canonicalExercise: "Bench press", progressionHint: "Dumbbell", variantHint: "Incline" };

  if (name.includes("push ups diamond")) return { canonicalExercise: "Push up", progressionHint: "Standard", variantHint: "Diamond" };
  if (name.includes("1 arm push ups") || name.includes("one arm push ups")) {
    return { canonicalExercise: "Push up", progressionHint: "Standard", variantHint: "One arm" };
  }
  if (name.includes("push ups")) return { canonicalExercise: "Push up", progressionHint: "Standard" };

  if (name.includes("dips parallel bars") || name.includes("dips")) {
    return { canonicalExercise: "Dip", progressionHint: "Standard", variantHint: "Parallel bar" };
  }

  if (name.includes("bb deadlift")) return { canonicalExercise: "Deadlift", progressionHint: "Conventional" };
  if (name.includes("bb squats")) return { canonicalExercise: "Squat", progressionHint: "Barbell", variantHint: "Back" };

  if (name.includes("chest fly machine cable")) return { canonicalExercise: "Chest fly", progressionHint: "Machine" };
  if (name.includes("db chest fly")) return { canonicalExercise: "Chest fly", progressionHint: "Dumbbell", variantHint: "Flat" };

  if (name.includes("hip abduction")) return { canonicalExercise: "Hip abduction", progressionHint: "Machine" };
  if (name.includes("hip adduction")) return { canonicalExercise: "Hip adduction", progressionHint: "Machine" };

  if (name.includes("calf raises nhat ver") || name.includes("calf raises")) return { canonicalExercise: "Calf raise" };

  if (name.includes("seated cable row") || name.includes("cable rows")) {
    return { canonicalExercise: "Row", progressionHint: "Cable", variantHint: "Seated" };
  }
  if (name.includes("lat pulldown")) return { canonicalExercise: "Lat pulldown", progressionHint: "Standard" };

  if (name.includes("leg extensions")) return { canonicalExercise: "Leg extension", progressionHint: "Seated" };
  if (name.includes("hamstring curls")) return { canonicalExercise: "Leg curl", progressionHint: "Seated" };

  if (name.includes("db lateral raises")) return { canonicalExercise: "Lateral raise", progressionHint: "Dumbbell" };
  if (name.includes("cable tricep pushdowns")) return { canonicalExercise: "Tricep extension", progressionHint: "Cable", variantHint: "Pushdown" };
  if (name.includes("db skull crusher")) return { canonicalExercise: "Tricep extension", progressionHint: "Dumbbell", variantHint: "Skull crusher" };

  if (name.includes("db lunges")) return { canonicalExercise: "Lunge", progressionHint: "Dumbbell" };
  if (name.includes("abdominal crunch")) return { canonicalExercise: "Crunch", progressionHint: "Weighted" };

  if (name.includes("standing cable reverse flyes")) {
    return { canonicalExercise: "Rear delt fly", progressionHint: "Cable", variantHint: "Standing" };
  }

  return null;
}

function bestTierLevel(
  tiers: Array<{ level: number; name: string }>,
  progressionHint: string | undefined,
): number {
  if (!tiers || tiers.length === 0) return 1;
  if (!progressionHint) return tiers[0].level;

  const hint = normalizeKey(progressionHint);
  const direct = tiers.find((tier) => normalizeKey(tier.name) === hint);
  if (direct) return direct.level;

  const fuzzy = tiers.find((tier) => {
    const key = normalizeKey(tier.name);
    return key.includes(hint) || hint.includes(key);
  });
  if (fuzzy) return fuzzy.level;

  return tiers[0].level;
}

function bestVariantName(
  variations: Array<{ name: string }>,
  variantHint: string | undefined,
): string | null {
  if (!variantHint) return null;
  if (!variations || variations.length === 0) return variantHint;

  const hint = normalizeKey(variantHint);
  const direct = variations.find((variation) => normalizeKey(variation.name) === hint);
  if (direct) return direct.name;

  const fuzzy = variations.find((variation) => {
    const key = normalizeKey(variation.name);
    return key.includes(hint) || hint.includes(key);
  });
  if (fuzzy) return fuzzy.name;

  return variantHint;
}

async function main() {
  const prisma = createPrismaClient();

  try {
    const nhat = await prisma.user.findFirst({
      where: {
        OR: [
          { username: "nhat" },
          { username: "Nhat" },
          { name: "nhat" },
          { name: "Nhat" },
        ],
      },
      select: { id: true, username: true, name: true },
    });

    if (!nhat) {
      throw new Error("Could not find user 'nhat' by username/name.");
    }

    const exercises = await prisma.progressionExercise.findMany({
      include: {
        tiers: { select: { level: true, name: true }, orderBy: { level: "asc" } },
        variations: { select: { name: true }, orderBy: { name: "asc" } },
      },
    });

    const exerciseByName = new Map<string, (typeof exercises)[number]>();
    for (const exercise of exercises) {
      exerciseByName.set(normalizeKey(exercise.name), exercise);
    }

    const rows = parseRows();
    let inserted = 0;
    let skippedDuplicates = 0;
    let unmapped = 0;
    const unmappedNames = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const inferred = inferMapping(row.sourceExercise, row.notes);
      if (!inferred) {
        unmapped++;
        unmappedNames.add(row.sourceExercise);
        continue;
      }

      const exercise = exerciseByName.get(normalizeKey(inferred.canonicalExercise));
      if (!exercise) {
        unmapped++;
        unmappedNames.add(`${row.sourceExercise} -> ${inferred.canonicalExercise} (missing in library)`);
        continue;
      }

      const level = bestTierLevel(exercise.tiers, inferred.progressionHint);
      const variant = bestVariantName(exercise.variations, inferred.variantHint);

      const userProgress = await prisma.userProgressionLevel.upsert({
        where: {
          userId_exerciseId: {
            userId: nhat.id,
            exerciseId: exercise.id,
          },
        },
        update: {
          currentLevel: level,
        },
        create: {
          userId: nhat.id,
          exerciseId: exercise.id,
          currentLevel: level,
        },
        select: { id: true },
      });

      const baseDate = parseDate(row.date);
      const createdAt = new Date(baseDate.getTime() + i * 1000);
      const dayStart = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 0, 0, 0));
      const dayEnd = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 23, 59, 59));

      const finalNotes = [row.notes, inferred.noteSuffix].filter(Boolean).join(" | ").trim() || null;

      const existing = await prisma.progressionLog.findFirst({
        where: {
          userProgressionId: userProgress.id,
          level,
          createdAt: { gte: dayStart, lte: dayEnd },
          weight1: row.w1,
          reps1: row.r1,
          weight2: row.w2,
          reps2: row.r2,
          weight3: row.w3,
          reps3: row.r3,
          variant,
          notes: finalNotes,
        },
        select: { id: true },
      });

      if (existing) {
        skippedDuplicates++;
        continue;
      }

      await prisma.progressionLog.create({
        data: {
          userProgressionId: userProgress.id,
          level,
          weight1: row.w1,
          reps1: row.r1,
          weight2: row.w2,
          reps2: row.r2,
          weight3: row.w3,
          reps3: row.r3,
          modifier: null,
          variant,
          notes: finalNotes,
          completed: false,
          createdAt,
        },
      });

      inserted++;
    }

    console.log("Nhat import complete.");
    console.log(`User: ${nhat.username || nhat.name || nhat.id} (${nhat.id})`);
    console.log(`Rows parsed: ${rows.length}`);
    console.log(`Inserted logs: ${inserted}`);
    console.log(`Skipped as duplicates: ${skippedDuplicates}`);
    console.log(`Unmapped rows: ${unmapped}`);
    if (unmappedNames.size > 0) {
      console.log(`Unmapped labels: ${JSON.stringify(Array.from(unmappedNames).sort())}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to import Nhat logs:", error);
  process.exitCode = 1;
});
