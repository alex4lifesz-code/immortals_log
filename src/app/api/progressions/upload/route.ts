import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface TierInput {
  level: number;
  name: string;
  wuxiaName?: string;
  difficulty?: string;
  description?: string;
  targetHold?: number;
  targetHoldTime?: string | number;
  targetReps?: number;
}

interface VariationInput {
  name: string;
  wuxiaName?: string;
  difficulty?: string;
  description?: string;
}

interface ModifierInput {
  type: string;
  available?: boolean;
  difficultyMod?: number;
  notes?: string;
  method?: string;
}

interface ExerciseInput {
  name: string;
  wuxiaName?: string;
  difficulty?: string;
  type?: string;
  story?: string;
  tips?: string[];
  category: string;
  equipment?: {
    type?: string;
    bodyweight?: boolean;
    weighted?: boolean;
    rings?: boolean;
  };
  primaryMuscles: string[] | string;
  secondaryMuscles?: string[] | string;
  progressions?: TierInput[];
  tiers?: TierInput[];
  variations?: VariationInput[];
  modifiers?: ModifierInput[];
}

function validateExercise(ex: unknown, index: number): { valid: boolean; error?: string; data?: ExerciseInput } {
  if (!ex || typeof ex !== "object") {
    return { valid: false, error: `Entry ${index}: not a valid object` };
  }

  const e = ex as Record<string, unknown>;

  if (!e.name || typeof e.name !== "string") {
    return { valid: false, error: `Entry ${index}: missing or invalid "name"` };
  }
  if (!e.category || typeof e.category !== "string") {
    return { valid: false, error: `Entry ${index}: missing or invalid "category"` };
  }

  const tiers = (e.progressions || e.tiers) as TierInput[] | undefined;
  if (tiers && !Array.isArray(tiers)) {
    return { valid: false, error: `Entry ${index}: "progressions" must be an array` };
  }
  if (tiers) {
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      if (typeof t.level !== "number" || !t.name || typeof t.name !== "string") {
        return { valid: false, error: `Entry ${index}, tier ${i}: requires numeric "level" and string "name"` };
      }
    }
  }

  return { valid: true, data: e as unknown as ExerciseInput };
}

function toCommaSeparated(val: string[] | string | undefined): string {
  if (!val) return "";
  if (Array.isArray(val)) return val.map(s => String(s).trim()).filter(Boolean).join(",");
  return String(val).trim();
}

// POST /api/progressions/upload — upload JSON file of progression exercises
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = body.userId;
    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    let exercises: unknown[] = body.exercises;
    if (!Array.isArray(exercises)) {
      // Allow root-level array
      if (Array.isArray(body)) {
        exercises = body;
      } else {
        return NextResponse.json({ error: "Expected an 'exercises' array or a root-level array" }, { status: 400 });
      }
    }

    if (exercises.length === 0) {
      return NextResponse.json({ error: "No exercises provided" }, { status: 400 });
    }

    if (exercises.length > 500) {
      return NextResponse.json({ error: "Maximum 500 exercises per upload" }, { status: 400 });
    }

    const errors: string[] = [];
    const validExercises: ExerciseInput[] = [];

    for (let i = 0; i < exercises.length; i++) {
      const result = validateExercise(exercises[i], i);
      if (!result.valid) {
        errors.push(result.error!);
      } else {
        validExercises.push(result.data!);
      }
    }

    if (errors.length > 0 && validExercises.length === 0) {
      return NextResponse.json({ error: "All entries failed validation", details: errors }, { status: 400 });
    }

    // Find existing exercise names for this user to skip duplicates
    const existing = await prisma.progressionExercise.findMany({
      where: { userId },
      select: { name: true },
    });
    const existingNames = new Set(existing.map(e => e.name.trim().toLowerCase()));

    let imported = 0;
    let skipped = 0;

    for (const ex of validExercises) {
      const trimmedName = String(ex.name).trim();
      if (existingNames.has(trimmedName.toLowerCase())) {
        skipped++;
        continue;
      }
      existingNames.add(trimmedName.toLowerCase());

      const equipment = ex.equipment || {};
      const tiers = (ex.progressions || ex.tiers || []);

      const created = await prisma.progressionExercise.create({
        data: {
          name: String(ex.name).trim().slice(0, 200),
          wuxiaName: ex.wuxiaName ? String(ex.wuxiaName).trim().slice(0, 300) : "",
          difficulty: ex.difficulty ? String(ex.difficulty).trim().slice(0, 100) : "",
          type: ex.type ? String(ex.type).trim().slice(0, 100) : "",
          story: ex.story ? String(ex.story).trim().slice(0, 5000) : "",
          tips: Array.isArray(ex.tips) ? JSON.stringify(ex.tips.map(t => String(t).trim()).filter(Boolean)) : "",
          category: String(ex.category).trim().slice(0, 100),
          equipmentType: String(equipment.type || "bodyweight").trim().slice(0, 100),
          bodyweight: equipment.bodyweight !== false,
          weighted: equipment.weighted === true,
          rings: equipment.rings === true,
          primaryMuscles: toCommaSeparated(ex.primaryMuscles).slice(0, 500),
          secondaryMuscles: toCommaSeparated(ex.secondaryMuscles).slice(0, 500),
          userId,
          tiers: {
            create: tiers.map((t: TierInput) => {
              // Parse targetHold from targetHold (number) or targetHoldTime (string like "10-30 seconds")
              let holdVal: number | null = null;
              const holdSource = t.targetHold ?? t.targetHoldTime;
              if (holdSource != null) {
                if (typeof holdSource === "number") {
                  holdVal = holdSource;
                } else {
                  // Extract the highest number from strings like "10-30 seconds"
                  const nums = String(holdSource).match(/\d+/g);
                  if (nums && nums.length > 0) {
                    holdVal = Math.max(...nums.map(Number));
                  }
                }
              }

              // Build description, appending original hold time text if present
              let desc = t.description ? String(t.description).trim() : "";
              if (t.targetHoldTime && typeof t.targetHoldTime === "string") {
                desc = desc ? `${desc} (Target: ${t.targetHoldTime})` : `Target: ${t.targetHoldTime}`;
              }

              return {
                level: Number(t.level),
                name: String(t.name).trim().slice(0, 200),
                wuxiaName: t.wuxiaName ? String(t.wuxiaName).trim().slice(0, 300) : "",
                difficulty: t.difficulty ? String(t.difficulty).trim().slice(0, 100) : "",
                description: desc.slice(0, 1000),
                targetHold: holdVal,
                targetReps: t.targetReps != null ? Number(t.targetReps) : null,
              };
            }),
          },
          variations: {
            create: (ex.variations || []).map((v: VariationInput) => ({
              name: String(v.name).trim().slice(0, 200),
              wuxiaName: v.wuxiaName ? String(v.wuxiaName).trim().slice(0, 300) : "",
              difficulty: v.difficulty ? String(v.difficulty).trim().slice(0, 100) : "",
              description: v.description ? String(v.description).trim().slice(0, 1000) : "",
            })),
          },
          modifiers: {
            create: (ex.modifiers || []).map((m: ModifierInput) => ({
              type: String(m.type).trim().slice(0, 50),
              available: m.available === true,
              difficultyMod: m.difficultyMod != null ? Number(m.difficultyMod) : 0,
              notes: (m.notes || m.method || "").toString().trim().slice(0, 500),
            })),
          },
        },
      });

      // Initialize user progression for this exercise at level 1
      await prisma.userProgressionLevel.create({
        data: {
          userId,
          exerciseId: created.id,
          currentLevel: 1,
        },
      });

      imported++;
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped: skipped > 0 ? skipped : undefined,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Progression upload error:", error);
    return NextResponse.json({ error: "Failed to upload progressions" }, { status: 500 });
  }
}
