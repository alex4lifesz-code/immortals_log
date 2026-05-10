import fs from "fs";
import path from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

type SeedLogEntry = {
  exercise: string;
  date: string;
  level: number;
  w1?: number;
  r1?: number;
  w2?: number;
  r2?: number;
  w3?: number;
  r3?: number;
  holdTime?: number;
  holdTime2?: number;
  holdTime3?: number;
  modifier?: string;
  variant?: string;
  notes?: string;
};

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function normalizeKey(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeNumber(value: number | null | undefined): string {
  if (value == null) return "";
  if (!Number.isFinite(value)) return "";
  return String(Number(value));
}

function remapAdminExercise(inputExercise: string, inputVariant?: string): { exercise: string; variant: string } {
  const name = normalizeKey(inputExercise);
  const variant = normalizeText(inputVariant);

  if (name === "chest press") return { exercise: "Chest press machine", variant: variant || "Flat" };
  if (name === "hamstring curl") return { exercise: "Leg curl", variant: variant || "Seated" };
  if (name === "lateral raise") return { exercise: "Shoulder raise", variant: "Lateral" };
  if (name === "front raise") return { exercise: "Shoulder raise", variant: "Front" };
  if (name === "rear delt fly") return { exercise: "Shoulder raise", variant: "Rear" };
  if (name === "hip abduction") return { exercise: "Abductor machine", variant: variant || "Weighted" };
  if (name === "cable kickback") return { exercise: "Glute kickback machine", variant: variant || "Cable" };
  if (name === "bike") return { exercise: "Stationary bike", variant: variant || "Steady state" };

  return { exercise: inputExercise, variant };
}

function signatureFromSeed(entry: SeedLogEntry): string {
  const remapped = remapAdminExercise(entry.exercise, entry.variant);
  return [
    normalizeText(entry.date),
    normalizeKey(remapped.exercise),
    String(entry.level),
    normalizeNumber(entry.w1),
    normalizeNumber(entry.r1),
    normalizeNumber(entry.w2),
    normalizeNumber(entry.r2),
    normalizeNumber(entry.w3),
    normalizeNumber(entry.r3),
    normalizeNumber(entry.holdTime),
    normalizeNumber(entry.holdTime2),
    normalizeNumber(entry.holdTime3),
    normalizeText(entry.modifier),
    normalizeKey(remapped.variant),
    normalizeText(entry.notes),
  ].join("|");
}

function looseSignatureFromSeed(entry: SeedLogEntry): string {
  const remapped = remapAdminExercise(entry.exercise, entry.variant);
  return [normalizeText(entry.date), normalizeKey(remapped.exercise), String(entry.level)].join("|");
}

function signatureFromDb(log: {
  createdAt: Date;
  level: number;
  weight1: number | null;
  reps1: number | null;
  weight2: number | null;
  reps2: number | null;
  weight3: number | null;
  reps3: number | null;
  holdTime: number | null;
  holdTime2: number | null;
  holdTime3: number | null;
  modifier: string | null;
  variant: string | null;
  notes: string | null;
  exerciseName: string;
}): string {
  const date = log.createdAt.toISOString().slice(0, 10);
  return [
    date,
    normalizeKey(log.exerciseName),
    String(log.level),
    normalizeNumber(log.weight1),
    normalizeNumber(log.reps1),
    normalizeNumber(log.weight2),
    normalizeNumber(log.reps2),
    normalizeNumber(log.weight3),
    normalizeNumber(log.reps3),
    normalizeNumber(log.holdTime),
    normalizeNumber(log.holdTime2),
    normalizeNumber(log.holdTime3),
    normalizeText(log.modifier),
    normalizeKey(log.variant),
    normalizeText(log.notes),
  ].join("|");
}

function looseSignatureFromDb(log: { createdAt: Date; exerciseName: string; level: number }): string {
  return [log.createdAt.toISOString().slice(0, 10), normalizeKey(log.exerciseName), String(log.level)].join("|");
}

function extractSeedLogsFromFile(filePath: string): SeedLogEntry[] {
  const source = fs.readFileSync(filePath, "utf8");
  const match = source.match(/const\s+ADMIN_LOGS\s*:[^=]*=\s*(\[[\s\S]*?\n\]);/m);
  if (!match) {
    throw new Error("Could not locate ADMIN_LOGS array in seed-training-and-checkins.ts");
  }

  const literal = match[1];
  // eslint-disable-next-line no-new-func
  const parsed = new Function(`return (${literal});`)();
  if (!Array.isArray(parsed)) {
    throw new Error("Parsed ADMIN_LOGS is not an array");
  }
  return parsed as SeedLogEntry[];
}

async function main() {
  const apply = process.argv.includes("--apply");
  const loose = process.argv.includes("--loose");
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: dbUrl }) });

  try {
    const seedFile = path.resolve(process.cwd(), "scripts", "seed-training-and-checkins.ts");
    const seedLogs = extractSeedLogsFromFile(seedFile);
    const signatures = new Set(seedLogs.map(signatureFromSeed));
    const looseSignatures = new Set(seedLogs.map(looseSignatureFromSeed));

    const users = await prisma.user.findMany({ select: { id: true, username: true } });
    const usernameById = new Map(users.map((u) => [u.id, u.username]));

    const logs = await prisma.progressionLog.findMany({
      select: {
        id: true,
        createdAt: true,
        level: true,
        weight1: true,
        reps1: true,
        weight2: true,
        reps2: true,
        weight3: true,
        reps3: true,
        holdTime: true,
        holdTime2: true,
        holdTime3: true,
        modifier: true,
        variant: true,
        notes: true,
        userProgression: {
          select: {
            userId: true,
            exercise: { select: { name: true } },
          },
        },
      },
    });

    const matched = logs.filter((log) => {
      if (loose) {
        return looseSignatures.has(
          looseSignatureFromDb({
            createdAt: log.createdAt,
            exerciseName: log.userProgression.exercise.name,
            level: log.level,
          }),
        );
      }

      return signatures.has(signatureFromDb({
        createdAt: log.createdAt,
        level: log.level,
        weight1: log.weight1,
        reps1: log.reps1,
        weight2: log.weight2,
        reps2: log.reps2,
        weight3: log.weight3,
        reps3: log.reps3,
        holdTime: log.holdTime,
        holdTime2: log.holdTime2,
        holdTime3: log.holdTime3,
        modifier: log.modifier,
        variant: log.variant,
        notes: log.notes,
        exerciseName: log.userProgression.exercise.name,
      }));
    });

    const perUser = new Map<string, number>();
    for (const log of matched) {
      const username = usernameById.get(log.userProgression.userId) || "<unknown>";
      perUser.set(username, (perUser.get(username) || 0) + 1);
    }

    console.log("Demo log purge summary:");
    console.log(`  Matching mode: ${loose ? "loose" : "strict"}`);
    console.log(`  Seed signatures loaded: ${signatures.size}`);
    console.log(`  Matched logs in DB: ${matched.length}`);
    if (perUser.size > 0) {
      console.log("  Matched by user:");
      for (const [username, count] of [...perUser.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`    - ${username}: ${count}`);
      }
    }

    if (!apply) {
      console.log(`Dry-run only. Re-run with --apply${loose ? " --loose" : ""} to delete matched demo logs.`);
      return;
    }

    const ids = matched.map((m) => m.id);
    const chunkSize = 200;
    let deleted = 0;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const result = await prisma.progressionLog.deleteMany({ where: { id: { in: chunk } } });
      deleted += result.count;
    }

    console.log(`Deleted demo logs: ${deleted}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to purge demo logs:", error);
  process.exitCode = 1;
});
