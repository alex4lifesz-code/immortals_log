import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/workouts/import
 * Bulk import training sessions from parsed XLSX data.
 * Body: { userId: string, sessions: Array<{ date, exercise, w1, r1, w2, r2, w3, r3, notes }> }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, sessions } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    if (!Array.isArray(sessions) || sessions.length === 0) {
      return NextResponse.json({ error: "No sessions to import" }, { status: 400 });
    }

    // Fetch all exercises to resolve names -> ids
    // Build lookup map keyed by both conventional and wuxia names for flexible matching
    const exercises = await prisma.exercise.findMany();
    const exerciseMap = new Map<string, { id: string; name: string; difficulty: string }>();
    for (const ex of exercises) {
      exerciseMap.set(ex.name.toLowerCase().trim(), ex);
      if (ex.wuxiaName) {
        exerciseMap.set(ex.wuxiaName.toLowerCase().trim(), ex);
      }
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of sessions) {
      const exerciseName = String(row.exercise || "").trim();
      const exercise = exerciseMap.get(exerciseName.toLowerCase());

      if (!exercise) {
        skipped++;
        errors.push(`Exercise not found: "${exerciseName}"`);
        continue;
      }

      // Parse date
      let date: Date;
      try {
        if (typeof row.date === "number") {
          // Excel serial date number
          date = excelSerialToDate(row.date);
        } else {
          date = new Date(row.date);
        }
        if (isNaN(date.getTime())) throw new Error("Invalid date");
      } catch {
        skipped++;
        errors.push(`Invalid date for "${exerciseName}": ${row.date}`);
        continue;
      }

      const w1 = parseFloat(row.w1);
      const r1 = parseInt(row.r1);
      const w2 = parseFloat(row.w2);
      const r2 = parseInt(row.r2);
      const w3 = parseFloat(row.w3);
      const r3 = parseInt(row.r3);

      // At least one set must have reps
      if (!r1 && !r2 && !r3) {
        skipped++;
        errors.push(`No reps data for "${exerciseName}" on ${row.date}`);
        continue;
      }

      await prisma.workout.create({
        data: {
          userId,
          name: `${exercise.name} Training`,
          date,
          notes: row.notes ? String(row.notes).trim() : null,
          simplifiedExercises: {
            create: {
              exerciseId: exercise.id,
              weight1: isNaN(w1) ? null : w1,
              reps1: isNaN(r1) ? null : r1,
              weight2: isNaN(w2) ? null : w2,
              reps2: isNaN(r2) ? null : r2,
              weight3: isNaN(w3) ? null : w3,
              reps3: isNaN(r3) ? null : r3,
              holdTime: row.holdTime != null && !isNaN(parseInt(String(row.holdTime))) ? parseInt(String(row.holdTime)) : null,
              notes: row.notes ? String(row.notes).trim() : null,
              order: 0,
            },
          },
        },
      });

      imported++;
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: sessions.length,
      errors: errors.slice(0, 20), // limit error messages
    });
  } catch (error) {
    console.error("Workout import error:", error);
    return NextResponse.json({ error: "Failed to import workouts" }, { status: 500 });
  }
}

/**
 * DELETE /api/workouts/import
 * Remove all workouts for a given user (bulk purge).
 * Body: { userId: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Delete all workouts (cascade will delete SimplifiedWorkoutExercise entries)
    const result = await prisma.workout.deleteMany({
      where: { userId },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `Removed ${result.count} training session(s)`,
    });
  } catch (error) {
    console.error("Workout purge error:", error);
    return NextResponse.json({ error: "Failed to remove workouts" }, { status: 500 });
  }
}

function excelSerialToDate(serial: number): Date {
  // Excel epoch is Jan 1 1900, but it erroneously counts 1900 as leap year
  const utcDays = Math.floor(serial) - 25569; // 25569 = days between 1900-01-01 and 1970-01-01
  return new Date(utcDays * 86400 * 1000);
}
