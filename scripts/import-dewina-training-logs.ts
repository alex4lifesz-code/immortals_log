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

const RAW_TSV = `Date\tDewina-Exercise\tW1\tR1\tW2\tR2\tW3\tR3\tNotes
28-Jan-26\tBB Squats\t50\t8\t50\t6\t50\t8\tadd ur first workout here
28-Jan-26\tBB Overhead Shoulder Press\t10\t10\t10\t10\t10\t10\t
09-Feb-26\tBB Bicep Curl\t5\t10\t7.5\t10\t7.5\t10\t
09-Feb-26\tDB Bench Press\t20\t2\t20\t3\t20\t2\tnhat spotting til 6-7th reps
05-May-26\tDB Skull Crusher\t4\t5\t4\t6\t4\t8\t
05-May-26\tDB Preach Curl\t5\t10\t6\t10\t7\t10\t
05-May-26\tDB Lateral Raises\t3\t8\t2\t10\t3\t10\t
05-May-26\tBB Bicep Curl\t10\t10\t15\t7\t15\t11\t
05-May-26\tBB Overhead Shoulder Press\t10\t8\t10\t10\t10\t15\t
12-May-26\tLeg Press\t0\t8\t10\t8\t12.5\t6\t5s pause
12-May-26\tLeg Press\t12.5\t7\t15\t5\t\t\t
12-May-26\tCalf Raises Nhat ver\t40\t40\t60\t40\t100\t45\t
12-May-26\tDB Lunges\t0\t14\t2\t14\t3\t14\t
12-May-26\tAbdominal Crunch\t5\t10\t5\t10\t5\t10\t
19-May-26\tIncline BB Bench Press\t0\t5\t0\t5\t0\t5\tSpot from 2/3
19-May-26\tIncline BB Bench Press\t0\t6\t\t\t\t\t
19-May-26\tDB Chest Fly\t5\t8\t6\t6\t7.5\t4\tFailll
19-May-26\tBB Bench Press\t20\t4\t20\t5\t\t\tDead
19-May-26\tSeated Cable Row\t20\t10\t20\t10\t27.5\t8\t
19-May-26\tLat Pulldown\t20\t10\t20\t10\t20\t10\t
19-May-26\tStanding Cable Reverse Flyes\t1.25\t10\t1.25\t10\t1.25\t10\t
26-May-26\tBB Overhead Shoulder Press\t15\t5\t15\t7\t15\t9\tSpot from 6
26-May-26\tDB Skull Crusher\t4\t7\t4\t7\t4\t7\tSpot from 6
26-May-26\tDB Shoulder Press\t4\t10\t5\t10\t6\t9\tSpot from 8
26-May-26\tDB Chest Fly\t3\t10\t3\t10\t4\t6\t
26-May-26\tDB Preach Curl\t5\t10\t6\t10\t7.5\t8\t
26-May-26\tbicep curl\t10\t5\t10\t5\t12.5\t5\tjason chen curl`;

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

  if (name.includes("bb squats") || name.includes("barbell squat")) {
    return { canonicalExercise: "Squat", progressionHint: "Barbell", variantHint: "Back" };
  }

  if (name.includes("bb overhead shoulder press")) {
    return { canonicalExercise: "Shoulder press", progressionHint: "Barbell" };
  }

  if (name.includes("db shoulder press")) {
    return { canonicalExercise: "Shoulder press", progressionHint: "Dumbbell" };
  }

  if (name.includes("bb bicep curl")) {
    return { canonicalExercise: "Bicep curl", progressionHint: "Barbell" };
  }

  if (name.includes("db preach curl") || name.includes("db preacher curl")) {
    return { canonicalExercise: "Bicep curl", progressionHint: "Dumbbell", variantHint: "Preacher" };
  }

  if (name === "bicep curl") {
    if (note.includes("jason chen curl")) {
      return { canonicalExercise: "Bicep curl", progressionHint: "Dumbbell", variantHint: "Standard", noteSuffix: "Jason chen curl" };
    }
    return { canonicalExercise: "Bicep curl" };
  }

  if (name.includes("db bench press")) {
    return { canonicalExercise: "Bench press", progressionHint: "Dumbbell", variantHint: "Flat" };
  }

  if (name.includes("incline bb bench press")) {
    return { canonicalExercise: "Bench press", progressionHint: "Barbell", variantHint: "Incline" };
  }

  if (name.includes("bb bench press")) {
    return { canonicalExercise: "Bench press", progressionHint: "Barbell", variantHint: "Flat" };
  }

  if (name.includes("db skull crusher")) {
    return { canonicalExercise: "Tricep extension", progressionHint: "Dumbbell", variantHint: "Skull crusher" };
  }

  if (name.includes("db lateral raises")) {
    return { canonicalExercise: "Lateral raise", progressionHint: "Dumbbell" };
  }

  if (name.includes("leg press")) {
    const noteSuffix = note.includes("pause") ? "Paused reps" : undefined;
    return { canonicalExercise: "Leg press", progressionHint: "Standard", noteSuffix };
  }

  if (name.includes("calf raises")) {
    return { canonicalExercise: "Calf raise" };
  }

  if (name.includes("db lunges")) {
    return { canonicalExercise: "Lunge", progressionHint: "Dumbbell" };
  }

  if (name.includes("abdominal crunch")) {
    return { canonicalExercise: "Crunch", progressionHint: "Weighted" };
  }

  if (name.includes("db chest fly")) {
    return { canonicalExercise: "Chest fly", progressionHint: "Dumbbell", variantHint: "Flat" };
  }

  if (name.includes("seated cable row")) {
    return { canonicalExercise: "Row", progressionHint: "Cable", variantHint: "Seated" };
  }

  if (name.includes("lat pulldown")) {
    return { canonicalExercise: "Lat pulldown", progressionHint: "Standard" };
  }

  if (name.includes("standing cable reverse flyes") || name.includes("reverse fly")) {
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
    const dewina = await prisma.user.findFirst({
      where: {
        OR: [
          { username: "dewina" },
          { username: "Dewina" },
          { name: "dewina" },
          { name: "Dewina" },
        ],
      },
      select: { id: true, username: true, name: true },
    });

    if (!dewina) {
      throw new Error("Could not find user 'dewina' by username/name.");
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
            userId: dewina.id,
            exerciseId: exercise.id,
          },
        },
        update: {
          currentLevel: level,
        },
        create: {
          userId: dewina.id,
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

    console.log("Dewina import complete.");
    console.log(`User: ${dewina.username || dewina.name || dewina.id} (${dewina.id})`);
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
  console.error("Failed to import Dewina logs:", error);
  process.exitCode = 1;
});
