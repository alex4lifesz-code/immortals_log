/**
 * Seed admin training logs + check-in attendance for admin & judy.
 *
 * Usage:  npx tsx scripts/seed-training-and-checkins.ts
 *
 * Idempotent: skips duplicate logs/check-ins via dedup checks.
 * Uses @libsql/client directly for speed (Prisma adapter times out on many upserts).
 */

import { createClient, type Client } from "@libsql/client";
import crypto from "crypto";

const DB_URL = process.env.DATABASE_URL || "file:./dev.db";

function cuid() {
  return "c" + crypto.randomBytes(12).toString("hex").slice(0, 24);
}

// ── Admin training log data ──────────────────────────────
// Simulates ~10 weeks of gym training (3-4 days/week) from Feb-Apr 2026

interface LogEntry {
  exercise: string;
  date: string; // YYYY-MM-DD
  level: number;
  w1?: number; r1?: number;
  w2?: number; r2?: number;
  w3?: number; r3?: number;
  holdTime?: number; holdTime2?: number; holdTime3?: number;
  modifier?: string;
  variant?: string;
  notes?: string;
}

const ADMIN_LOGS: LogEntry[] = [
  // Week 1 - Feb 3-7
  { exercise: "Bench press", date: "2026-02-03", level: 1, w1: 40, r1: 12, w2: 40, r2: 10, w3: 40, r3: 10 },
  { exercise: "Chest fly", date: "2026-02-03", level: 1, w1: 10, r1: 12, w2: 10, r2: 12, w3: 10, r3: 10, variant: "Machine" },
  { exercise: "Tricep pushdown", date: "2026-02-03", level: 1, w1: 15, r1: 15, w2: 15, r2: 12, w3: 15, r3: 10, variant: "Cable" },
  { exercise: "Squat", date: "2026-02-04", level: 1, w1: 40, r1: 10, w2: 40, r2: 10, w3: 40, r3: 8 },
  { exercise: "Leg press", date: "2026-02-04", level: 1, w1: 80, r1: 12, w2: 80, r2: 10, w3: 80, r3: 10 },
  { exercise: "Leg extension", date: "2026-02-04", level: 1, w1: 30, r1: 12, w2: 30, r2: 12, w3: 30, r3: 10 },
  { exercise: "Lat pulldown", date: "2026-02-06", level: 1, w1: 35, r1: 10, w2: 35, r2: 10, w3: 35, r3: 8, variant: "Wide" },
  { exercise: "Row", date: "2026-02-06", level: 1, w1: 30, r1: 10, w2: 30, r2: 10, w3: 30, r3: 8, variant: "Seated Cable" },
  { exercise: "Bicep curl", date: "2026-02-06", level: 1, w1: 10, r1: 12, w2: 10, r2: 10, w3: 10, r3: 10, variant: "Dumbbell" },
  { exercise: "Stairmaster", date: "2026-02-07", level: 1, holdTime: 1200, holdTime2: 0, holdTime3: 0, notes: "20 min steady" },

  // Week 2 - Feb 10-14
  { exercise: "Bench press", date: "2026-02-10", level: 1, w1: 42.5, r1: 10, w2: 42.5, r2: 10, w3: 42.5, r3: 8, notes: "Feeling stronger" },
  { exercise: "Chest press", date: "2026-02-10", level: 1, w1: 25, r1: 12, w2: 25, r2: 10, w3: 25, r3: 10, variant: "Incline" },
  { exercise: "Tricep pushdown", date: "2026-02-10", level: 1, w1: 17.5, r1: 12, w2: 17.5, r2: 10, w3: 15, r3: 12, variant: "Cable" },
  { exercise: "Deadlift", date: "2026-02-11", level: 1, w1: 50, r1: 8, w2: 50, r2: 8, w3: 50, r3: 6 },
  { exercise: "Hamstring curl", date: "2026-02-11", level: 1, w1: 25, r1: 12, w2: 25, r2: 10, w3: 25, r3: 10 },
  { exercise: "Hip abduction", date: "2026-02-11", level: 1, w1: 40, r1: 15, w2: 40, r2: 12, w3: 40, r3: 12 },
  { exercise: "Shoulder press", date: "2026-02-13", level: 1, w1: 12, r1: 10, w2: 12, r2: 10, w3: 12, r3: 8, variant: "Seated" },
  { exercise: "Lateral raise", date: "2026-02-13", level: 1, w1: 6, r1: 15, w2: 6, r2: 12, w3: 6, r3: 12, variant: "Dumbbell" },
  { exercise: "Face pull", date: "2026-02-13", level: 1, w1: 15, r1: 15, w2: 15, r2: 12, w3: 15, r3: 12, variant: "Cable" },
  { exercise: "Treadmill", date: "2026-02-14", level: 2, holdTime: 1800, notes: "30 min jog" },

  // Week 3 - Feb 17-21
  { exercise: "Bench press", date: "2026-02-17", level: 1, w1: 45, r1: 10, w2: 45, r2: 8, w3: 45, r3: 8 },
  { exercise: "Chest fly", date: "2026-02-17", level: 1, w1: 12.5, r1: 12, w2: 12.5, r2: 10, w3: 12.5, r3: 10, variant: "Cable" },
  { exercise: "Tricep pushdown", date: "2026-02-17", level: 1, w1: 20, r1: 12, w2: 20, r2: 10, w3: 17.5, r3: 10 },
  { exercise: "Squat", date: "2026-02-18", level: 1, w1: 50, r1: 10, w2: 50, r2: 8, w3: 50, r3: 8 },
  { exercise: "Leg press", date: "2026-02-18", level: 1, w1: 90, r1: 10, w2: 90, r2: 10, w3: 90, r3: 8 },
  { exercise: "Hamstring curl", date: "2026-02-18", level: 1, w1: 27.5, r1: 12, w2: 27.5, r2: 10, w3: 25, r3: 10 },
  { exercise: "Pull up", date: "2026-02-20", level: 1, r1: 3, r2: 2, r3: 2, notes: "First real pull-ups!" },
  { exercise: "Row", date: "2026-02-20", level: 2, w1: 35, r1: 10, w2: 35, r2: 8, w3: 35, r3: 8, variant: "Seated Cable" },
  { exercise: "Bicep curl", date: "2026-02-20", level: 1, w1: 12, r1: 10, w2: 12, r2: 10, w3: 10, r3: 10, variant: "EZ Bar" },
  { exercise: "Bike", date: "2026-02-21", level: 1, holdTime: 1200, notes: "20 min intervals" },

  // Week 4 - Feb 24-28
  { exercise: "Bench press", date: "2026-02-24", level: 2, w1: 50, r1: 8, w2: 50, r2: 8, w3: 47.5, r3: 8, notes: "Moved up to tier 2" },
  { exercise: "Chest press", date: "2026-02-24", level: 1, w1: 27.5, r1: 10, w2: 27.5, r2: 10, w3: 27.5, r3: 8, variant: "Flat" },
  { exercise: "Tricep pushdown", date: "2026-02-24", level: 1, w1: 20, r1: 15, w2: 20, r2: 12, w3: 20, r3: 12 },
  { exercise: "Deadlift", date: "2026-02-25", level: 2, w1: 60, r1: 8, w2: 60, r2: 6, w3: 60, r3: 6 },
  { exercise: "Squat", date: "2026-02-25", level: 2, w1: 55, r1: 8, w2: 55, r2: 8, w3: 55, r3: 6, notes: "Bar path improving" },
  { exercise: "Leg extension", date: "2026-02-25", level: 1, w1: 35, r1: 12, w2: 35, r2: 10, w3: 35, r3: 10 },
  { exercise: "Shoulder press", date: "2026-02-27", level: 1, w1: 14, r1: 10, w2: 14, r2: 8, w3: 12, r3: 10, variant: "Seated" },
  { exercise: "Lateral raise", date: "2026-02-27", level: 1, w1: 7, r1: 15, w2: 7, r2: 12, w3: 7, r3: 12 },
  { exercise: "Rear delt fly", date: "2026-02-27", level: 1, w1: 8, r1: 12, w2: 8, r2: 12, w3: 8, r3: 10, variant: "Machine" },
  { exercise: "Stairmaster", date: "2026-02-28", level: 2, holdTime: 1500, notes: "25 min, higher intensity" },

  // Week 5 - Mar 3-7
  { exercise: "Bench press", date: "2026-03-03", level: 2, w1: 52.5, r1: 8, w2: 52.5, r2: 7, w3: 50, r3: 8 },
  { exercise: "Chest fly", date: "2026-03-03", level: 1, w1: 15, r1: 12, w2: 15, r2: 10, w3: 15, r3: 10, variant: "Machine" },
  { exercise: "Tricep pushdown", date: "2026-03-03", level: 1, w1: 22.5, r1: 12, w2: 22.5, r2: 10, w3: 20, r3: 10 },
  { exercise: "Squat", date: "2026-03-04", level: 2, w1: 57.5, r1: 8, w2: 57.5, r2: 8, w3: 55, r3: 8 },
  { exercise: "Leg press", date: "2026-03-04", level: 1, w1: 100, r1: 10, w2: 100, r2: 8, w3: 100, r3: 8 },
  { exercise: "Cable kickback", date: "2026-03-04", level: 1, w1: 10, r1: 12, w2: 10, r2: 12, w3: 10, r3: 10 },
  { exercise: "Lat pulldown", date: "2026-03-06", level: 1, w1: 40, r1: 10, w2: 40, r2: 8, w3: 40, r3: 8, variant: "Close" },
  { exercise: "Row", date: "2026-03-06", level: 2, w1: 37.5, r1: 10, w2: 37.5, r2: 8, w3: 35, r3: 10, variant: "Machine" },
  { exercise: "Bicep curl", date: "2026-03-06", level: 1, w1: 12, r1: 12, w2: 12, r2: 10, w3: 12, r3: 10, variant: "Hammer" },
  { exercise: "Treadmill", date: "2026-03-07", level: 2, holdTime: 1800, notes: "30 min, incline walk" },

  // Week 6 - Mar 10-14
  { exercise: "Bench press", date: "2026-03-10", level: 2, w1: 55, r1: 8, w2: 55, r2: 6, w3: 52.5, r3: 7 },
  { exercise: "Chest press", date: "2026-03-10", level: 2, w1: 30, r1: 10, w2: 30, r2: 8, w3: 30, r3: 8, variant: "Incline" },
  { exercise: "Tricep pushdown", date: "2026-03-10", level: 1, w1: 25, r1: 12, w2: 25, r2: 10, w3: 22.5, r3: 10 },
  { exercise: "Deadlift", date: "2026-03-11", level: 2, w1: 70, r1: 6, w2: 70, r2: 6, w3: 65, r3: 6, notes: "PR! Form solid" },
  { exercise: "Hamstring curl", date: "2026-03-11", level: 1, w1: 30, r1: 12, w2: 30, r2: 10, w3: 30, r3: 10 },
  { exercise: "Hip abduction", date: "2026-03-11", level: 1, w1: 45, r1: 15, w2: 45, r2: 12, w3: 45, r3: 12 },
  { exercise: "Shoulder press", date: "2026-03-13", level: 2, w1: 16, r1: 8, w2: 16, r2: 8, w3: 14, r3: 10, variant: "Seated", notes: "Tier 2" },
  { exercise: "Lateral raise", date: "2026-03-13", level: 2, w1: 8, r1: 12, w2: 8, r2: 12, w3: 8, r3: 10, variant: "Cable" },
  { exercise: "Front raise", date: "2026-03-13", level: 1, w1: 6, r1: 12, w2: 6, r2: 12, w3: 6, r3: 10, variant: "Dumbbell" },
  { exercise: "Bike", date: "2026-03-14", level: 2, holdTime: 1500, notes: "25 min steady state" },

  // Week 7 - Mar 17-21
  { exercise: "Bench press", date: "2026-03-17", level: 2, w1: 57.5, r1: 7, w2: 55, r2: 8, w3: 55, r3: 7 },
  { exercise: "Chest fly", date: "2026-03-17", level: 1, w1: 15, r1: 12, w2: 15, r2: 12, w3: 15, r3: 10, variant: "Cable" },
  { exercise: "Pull up", date: "2026-03-17", level: 2, r1: 5, r2: 4, r3: 4, notes: "Getting stronger" },
  { exercise: "Squat", date: "2026-03-18", level: 2, w1: 60, r1: 8, w2: 60, r2: 6, w3: 60, r3: 6 },
  { exercise: "Leg press", date: "2026-03-18", level: 2, w1: 110, r1: 8, w2: 110, r2: 8, w3: 110, r3: 6 },
  { exercise: "Leg extension", date: "2026-03-18", level: 1, w1: 37.5, r1: 12, w2: 37.5, r2: 10, w3: 35, r3: 10 },
  { exercise: "Row", date: "2026-03-20", level: 2, w1: 40, r1: 10, w2: 40, r2: 8, w3: 40, r3: 8, variant: "T-Bar" },
  { exercise: "Lat pulldown", date: "2026-03-20", level: 2, w1: 42.5, r1: 10, w2: 42.5, r2: 8, w3: 40, r3: 8, variant: "Wide" },
  { exercise: "Bicep curl", date: "2026-03-20", level: 2, w1: 14, r1: 10, w2: 14, r2: 8, w3: 12, r3: 10, variant: "Dumbbell" },
  { exercise: "Stairmaster", date: "2026-03-21", level: 2, holdTime: 1800, notes: "30 min high intensity" },

  // Week 8 - Mar 24-28
  { exercise: "Bench press", date: "2026-03-24", level: 2, w1: 60, r1: 6, w2: 57.5, r2: 7, w3: 55, r3: 8, notes: "60kg for 6! New PR" },
  { exercise: "Chest press", date: "2026-03-24", level: 2, w1: 32.5, r1: 8, w2: 32.5, r2: 8, w3: 30, r3: 10, variant: "Flat" },
  { exercise: "Tricep pushdown", date: "2026-03-24", level: 1, w1: 25, r1: 15, w2: 25, r2: 12, w3: 25, r3: 12 },
  { exercise: "Deadlift", date: "2026-03-25", level: 2, w1: 75, r1: 5, w2: 75, r2: 5, w3: 70, r3: 6, notes: "75kg x5 PR" },
  { exercise: "Squat", date: "2026-03-25", level: 2, w1: 65, r1: 6, w2: 65, r2: 6, w3: 60, r3: 8 },
  { exercise: "Hamstring curl", date: "2026-03-25", level: 2, w1: 32.5, r1: 10, w2: 32.5, r2: 10, w3: 30, r3: 10 },
  { exercise: "Shoulder press", date: "2026-03-27", level: 2, w1: 18, r1: 8, w2: 18, r2: 6, w3: 16, r3: 8, variant: "Seated" },
  { exercise: "Lateral raise", date: "2026-03-27", level: 2, w1: 8, r1: 15, w2: 8, r2: 12, w3: 8, r3: 12, variant: "Dumbbell" },
  { exercise: "Rear delt fly", date: "2026-03-27", level: 1, w1: 10, r1: 12, w2: 10, r2: 10, w3: 10, r3: 10, variant: "Cable" },
  { exercise: "Treadmill", date: "2026-03-28", level: 2, holdTime: 2400, notes: "40 min jog" },

  // Week 9 - Mar 31 - Apr 4
  { exercise: "Bench press", date: "2026-03-31", level: 2, w1: 60, r1: 7, w2: 60, r2: 6, w3: 57.5, r3: 7 },
  { exercise: "Chest fly", date: "2026-03-31", level: 1, w1: 17.5, r1: 10, w2: 15, r2: 12, w3: 15, r3: 10, variant: "Machine" },
  { exercise: "Pull up", date: "2026-03-31", level: 2, r1: 6, r2: 5, r3: 5, notes: "Consistent 5+ reps now" },
  { exercise: "Squat", date: "2026-04-01", level: 2, w1: 67.5, r1: 6, w2: 65, r2: 6, w3: 65, r3: 6 },
  { exercise: "Leg press", date: "2026-04-01", level: 2, w1: 120, r1: 8, w2: 120, r2: 6, w3: 120, r3: 6, notes: "Solid session" },
  { exercise: "Cable kickback", date: "2026-04-01", level: 1, w1: 12.5, r1: 12, w2: 12.5, r2: 10, w3: 12.5, r3: 10 },
  { exercise: "Lat pulldown", date: "2026-04-03", level: 2, w1: 45, r1: 10, w2: 45, r2: 8, w3: 42.5, r3: 8, variant: "Wide" },
  { exercise: "Row", date: "2026-04-03", level: 2, w1: 42.5, r1: 10, w2: 42.5, r2: 8, w3: 40, r3: 8, variant: "Seated Cable" },
  { exercise: "Bicep curl", date: "2026-04-03", level: 2, w1: 14, r1: 12, w2: 14, r2: 10, w3: 14, r3: 10, variant: "EZ Bar" },
  { exercise: "Upright row", date: "2026-04-03", level: 1, w1: 15, r1: 10, w2: 15, r2: 10, w3: 15, r3: 8, variant: "EZ Bar" },
  { exercise: "Bike", date: "2026-04-04", level: 2, holdTime: 1800, notes: "30 min intervals" },
];

// ── Check-in / attendance data ───────────────────────────
// Generate realistic check-in data for admin & judy Feb-Apr 2026

function generateCheckIns(userId: string, username: string): Array<{
  date: string;
  userId: string;
  present: boolean;
  weight: number | null;
  comment: string | null;
}> {
  const checkins: Array<{
    date: string;
    userId: string;
    present: boolean;
    weight: number | null;
    comment: string | null;
  }> = [];

  // Start weight and target
  const isAdmin = username === "admin";
  let weight = isAdmin ? 78.5 : 55.2;
  const weightTrend = isAdmin ? -0.15 : -0.08; // gradual loss

  // Training days by week pattern
  // Admin: Mon, Tue, Thu, Fri (sometimes Sat)
  // Judy: Mon, Wed, Thu, Sat
  const adminDays = [1, 2, 4, 5]; // Mon=1, Tue=2, Thu=4, Fri=5
  const judyDays = [1, 3, 4, 6];
  const trainingDays = isAdmin ? adminDays : judyDays;

  const start = new Date("2026-02-02"); // First Monday of Feb
  const end = new Date("2026-04-06");

  const comments = isAdmin
    ? [null, null, null, "Good session", "Felt strong today", null, "A bit tired", null, null, "Great energy", null, "Deload week", null, null, null]
    : [null, null, "Nice workout", null, null, null, "Sore from yesterday", null, null, null, "Feeling great!", null, null, null, null];

  let commentIdx = 0;
  const current = new Date(start);

  while (current <= end) {
    const dow = current.getDay(); // 0=Sun
    const dateStr = current.toISOString().split("T")[0];

    if (trainingDays.includes(dow)) {
      // ~90% attendance rate
      const present = Math.random() < 0.9;

      if (present) {
        // Weight fluctuates ±0.5kg day-to-day
        weight += weightTrend + (Math.random() - 0.5) * 0.6;
        weight = Math.round(weight * 10) / 10;

        checkins.push({
          date: dateStr,
          userId,
          present: true,
          weight: Math.random() < 0.75 ? weight : null, // 75% log weight
          comment: comments[commentIdx % comments.length],
        });
        commentIdx++;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return checkins;
}

// ─────────────────────────────────────────────────────────

function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

async function main() {
  const client = createClient({ url: DB_URL });

  try {
    console.log("=== Seed Admin Training Logs & Check-ins ===\n");

    // ── Find users ──
    const adminRow = await client.execute({ sql: "SELECT id FROM User WHERE username = ?", args: ["admin"] });
    const judyRow = await client.execute({ sql: "SELECT id FROM User WHERE username = ?", args: ["judy"] });

    if (!adminRow.rows.length) throw new Error("Admin user not found.");
    if (!judyRow.rows.length) throw new Error("Judy user not found.");

    const adminId = String(adminRow.rows[0].id);
    const judyId = String(judyRow.rows[0].id);

    // ── Load exercises ──
    const exerciseRows = await client.execute("SELECT id, name FROM ProgressionExercise");
    const exerciseByName = new Map<string, string>();
    for (const row of exerciseRows.rows) {
      exerciseByName.set(normalizeKey(String(row.name)), String(row.id));
    }

    // Load tiers and variations
    const tierRows = await client.execute("SELECT id, exerciseId, level, name FROM ProgressionTier ORDER BY level ASC");
    const tiersByExercise = new Map<string, Array<{ level: number; name: string }>>();
    for (const row of tierRows.rows) {
      const exId = String(row.exerciseId);
      if (!tiersByExercise.has(exId)) tiersByExercise.set(exId, []);
      tiersByExercise.get(exId)!.push({ level: Number(row.level), name: String(row.name) });
    }

    const varRows = await client.execute("SELECT id, exerciseId, name FROM ProgressionVariation");
    const varsByExercise = new Map<string, string[]>();
    for (const row of varRows.rows) {
      const exId = String(row.exerciseId);
      if (!varsByExercise.has(exId)) varsByExercise.set(exId, []);
      varsByExercise.get(exId)!.push(String(row.name));
    }

    // ── 1. Admin training logs ───────────────────────────
    console.log("── Admin Training Logs ──");

    let logInserted = 0;
    let logSkipped = 0;

    for (const entry of ADMIN_LOGS) {
      const exerciseId = exerciseByName.get(normalizeKey(entry.exercise));
      if (!exerciseId) {
        console.log(`  ⚠ Exercise "${entry.exercise}" not found — skipping`);
        continue;
      }

      // Upsert UserProgressionLevel
      const existingUPL = await client.execute({
        sql: "SELECT id, currentLevel FROM UserProgressionLevel WHERE userId = ? AND exerciseId = ?",
        args: [adminId, exerciseId],
      });

      let progressId: string;
      if (existingUPL.rows.length > 0) {
        progressId = String(existingUPL.rows[0].id);
        const curLevel = Number(existingUPL.rows[0].currentLevel);
        if (entry.level > curLevel) {
          await client.execute({
            sql: "UPDATE UserProgressionLevel SET currentLevel = ?, updatedAt = ? WHERE id = ?",
            args: [entry.level, new Date().toISOString(), progressId],
          });
        }
      } else {
        progressId = cuid();
        const now = new Date().toISOString();
        await client.execute({
          sql: "INSERT INTO UserProgressionLevel (id, userId, exerciseId, currentLevel, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
          args: [progressId, adminId, exerciseId, entry.level, now, now],
        });
      }

      // Check for existing log on same day
      const dayStart = entry.date + "T00:00:00.000Z";
      const dayEnd = entry.date + "T23:59:59.999Z";
      const existingLog = await client.execute({
        sql: "SELECT id FROM ProgressionLog WHERE userProgressionId = ? AND createdAt >= ? AND createdAt <= ?",
        args: [progressId, dayStart, dayEnd],
      });

      if (existingLog.rows.length > 0) {
        logSkipped++;
        continue;
      }

      // Resolve variant
      let variant: string | null = entry.variant ?? null;
      if (variant) {
        const vars = varsByExercise.get(exerciseId) ?? [];
        const match = vars.find((v) => normalizeKey(v) === normalizeKey(variant!));
        variant = match ?? variant;
      }

      await client.execute({
        sql: `INSERT INTO ProgressionLog (id, userProgressionId, level, weight1, reps1, weight2, reps2, weight3, reps3, holdTime, holdTime2, holdTime3, modifier, variant, notes, completed, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          cuid(), progressId, entry.level,
          entry.w1 ?? null, entry.r1 ?? null,
          entry.w2 ?? null, entry.r2 ?? null,
          entry.w3 ?? null, entry.r3 ?? null,
          entry.holdTime ?? null, entry.holdTime2 ?? null, entry.holdTime3 ?? null,
          entry.modifier ?? null, variant, entry.notes ?? null,
          0, // completed = false
          entry.date + "T09:00:00.000Z",
        ],
      });

      logInserted++;
    }

    console.log(`  Inserted: ${logInserted} logs`);
    console.log(`  Skipped (duplicates): ${logSkipped}`);
    console.log(`  Exercises touched: ${new Set(ADMIN_LOGS.map((l) => l.exercise)).size}`);

    // ── 2. Check-ins / attendance ────────────────────────
    console.log("\n── Check-in Attendance ──");

    const adminCheckins = generateCheckIns(adminId, "admin");
    const judyCheckins = generateCheckIns(judyId, "judy");
    const allCheckins = [...adminCheckins, ...judyCheckins];

    let ciInserted = 0;
    let ciSkipped = 0;

    for (const ci of allCheckins) {
      const dateISO = ci.date + "T00:00:00.000Z";

      const existing = await client.execute({
        sql: "SELECT id FROM CheckIn WHERE date = ? AND userId = ?",
        args: [dateISO, ci.userId],
      });

      if (existing.rows.length > 0) {
        ciSkipped++;
        continue;
      }

      await client.execute({
        sql: "INSERT INTO CheckIn (id, date, userId, present, weight, comment, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [cuid(), dateISO, ci.userId, ci.present ? 1 : 0, ci.weight, ci.comment, new Date().toISOString()],
      });

      ciInserted++;
    }

    console.log(`  Admin check-ins generated: ${adminCheckins.length}`);
    console.log(`  Judy check-ins generated: ${judyCheckins.length}`);
    console.log(`  Inserted: ${ciInserted}`);
    console.log(`  Skipped (existing): ${ciSkipped}`);

    console.log("\n✓ All training logs and check-ins seeded.");
  } catch (error) {
    console.error("Seed error:", error);
    process.exit(1);
  } finally {
    client.close();
  }
}

main();
