// Seed exercises into the database from a converted flat JSON file
// Usage:  npx tsx scripts/seed-codex.ts
// Custom: npx tsx scripts/seed-codex.ts --path C:\path\to\file.json

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import * as path from "path";
import * as fs from "fs";

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function resolveJsonPath(): string | null {
  const pathArgIndex = process.argv.indexOf("--path");
  if (pathArgIndex !== -1 && process.argv[pathArgIndex + 1]) {
    return process.argv[pathArgIndex + 1];
  }
  const defaultPath = path.join(__dirname, "..", "..", "200codex-converted.json");
  if (fs.existsSync(defaultPath)) return defaultPath;
  const desktop = path.join(__dirname, "..", "..", "200codex.json");
  if (fs.existsSync(desktop)) return desktop;
  return null;
}

interface ExerciseInput {
  name: string;
  wuxiaName?: string | null;
  difficulty: string;
  type: string;
  story?: string | null;
  targetGroup?: string | null;
  assignedDays?: string;
}

async function seedCodex() {
  const jsonPath = resolveJsonPath();
  if (!jsonPath) {
    console.error(
      "❌ Could not find JSON file. Pass --path <filepath> or place 200codex-converted.json on the Desktop."
    );
    process.exit(1);
  }

  console.log(`📂 Loading from: ${jsonPath}\n`);
  const exercises: ExerciseInput[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  if (!Array.isArray(exercises)) {
    console.error("❌ Expected a JSON array.");
    process.exit(1);
  }

  console.log(`📋 ${exercises.length} exercises to import.\n`);

  let created = 0, skipped = 0, failed = 0;

  for (const ex of exercises) {
    try {
      const existing = await prisma.exercise.findFirst({ where: { name: ex.name } });
      if (existing) {
        console.log(`⏭  Skipped (exists): ${ex.name}`);
        skipped++;
        continue;
      }
      await prisma.exercise.create({
        data: {
          name: ex.name,
          wuxiaName: ex.wuxiaName ?? null,
          difficulty: ex.difficulty,
          type: ex.type,
          story: ex.story ?? null,
          targetGroup: ex.targetGroup ?? null,
          assignedDays: ex.assignedDays ?? "",
        },
      });
      console.log(`✓  Created: ${ex.name} [${ex.type}]`);
      created++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`✗  Failed: ${ex.name} — ${msg}`);
      failed++;
    }
  }

  console.log(`\n✅ Done — Created: ${created}, Skipped: ${skipped}, Failed: ${failed}`);
}

seedCodex()
  .catch((err) => { console.error("Fatal:", err); process.exit(1); })
  .finally(() => prisma.$disconnect());
