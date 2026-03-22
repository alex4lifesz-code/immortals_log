import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface PrerequisiteInput {
  name: string;
  minimumReps?: number;
  minimumHold?: string | number;
  notes?: string;
}

interface TierInput {
  level: number | string;
  name: string;
  wuxiaName?: string;
  difficulty?: string;
  wuxiaDifficulty?: string;
  wuxiaType?: string;
  description?: string;
  targetHold?: number;
  targetHoldTime?: string | number;
  targetReps?: number | string;
  targetWeight?: string | number;
}

interface VariationInput {
  name: string;
  wuxiaName?: string;
  difficulty?: string;
  wuxiaDifficulty?: string;
  wuxiaType?: string;
  description?: string;
}

interface ModifierInput {
  type: string;
  available?: boolean;
  difficultyMod?: number;
  notes?: string;
  method?: string;
  difficultyIncrease?: string;
}

interface ExerciseInput {
  name: string;
  wuxiaName?: string;
  difficulty?: string;
  wuxiaDifficulty?: string;
  type?: string;
  wuxiaType?: string;
  story?: string;
  tips?: string[];
  category: string | string[];
  equipment?: {
    type?: string;
    bodyweight?: boolean;
    weighted?: boolean;
    rings?: boolean;
  };
  primaryMuscles: string[] | string;
  secondaryMuscles?: string[] | string;
  prerequisites?: PrerequisiteInput[];
  cues?: string[];
  commonMistakes?: { mistake: string; correction: string }[];
  breathing?: string;
  safetyConsiderations?: string[];
  competitionStandards?: Record<string, string>;
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
  const category = e.category;
  const hasValidCategory =
    (typeof category === "string" && category.trim().length > 0) ||
    (Array.isArray(category) && category.some((c) => typeof c === "string" && c.trim().length > 0));
  if (!hasValidCategory) {
    return { valid: false, error: `Entry ${index}: missing or invalid "category" (string or string[] expected)` };
  }

  const tiers = (e.progressions || e.tiers) as TierInput[] | undefined;
  if (tiers && !Array.isArray(tiers)) {
    return { valid: false, error: `Entry ${index}: "progressions" must be an array` };
  }
  if (tiers) {
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      const parsedLevel = Number(t.level);
      if (!Number.isFinite(parsedLevel) || !t.name || typeof t.name !== "string") {
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

function normalizeCategory(val: string[] | string | undefined): string {
  const category = toCommaSeparated(val);
  return category || "Uncategorized";
}

function stripUnsupportedWuxiaFields<T>(data: T): T {
  const cloned = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;

  delete cloned.wuxiaDifficulty;
  delete cloned.wuxiaType;

  const tiers = (cloned.tiers as { create?: Record<string, unknown>[] } | undefined)?.create;
  if (Array.isArray(tiers)) {
    for (const tier of tiers) {
      delete tier.wuxiaDifficulty;
      delete tier.wuxiaType;
    }
  }

  const variations = (cloned.variations as { create?: Record<string, unknown>[] } | undefined)?.create;
  if (Array.isArray(variations)) {
    for (const variation of variations) {
      delete variation.wuxiaDifficulty;
      delete variation.wuxiaType;
    }
  }

  return cloned as T;
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

    // Find existing exercises for this user; needed to enrich previously-created minimal rows.
    const existing = await prisma.progressionExercise.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            tiers: true,
            variations: true,
            modifiers: true,
          },
        },
      },
    });
    const existingByName = new Map(existing.map((e) => [e.name.trim().toLowerCase(), e]));
    const processedNames = new Set<string>();

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    let enriched = 0;

    for (let i = 0; i < validExercises.length; i++) {
      const ex = validExercises[i];
      const trimmedName = String(ex.name).trim();
      const normalizedName = trimmedName.toLowerCase();
      if (processedNames.has(normalizedName)) {
        skipped++;
        continue;
      }
      processedNames.add(normalizedName);

      const existingExercise = existingByName.get(normalizedName);
      try {
        const equipment = ex.equipment || {};
        const tiers = (ex.progressions || ex.tiers || []);
        const variations = ex.variations || [];
        const modifiers = ex.modifiers || [];

        const hasIncomingProgressionData =
          tiers.length > 0 || variations.length > 0 || modifiers.length > 0;

        if (existingExercise) {
          const existingHasProgressionData =
            existingExercise._count.tiers > 0 ||
            existingExercise._count.variations > 0 ||
            existingExercise._count.modifiers > 0;

          // Enrich existing minimal exercise records when upload includes full progression data.
          if (hasIncomingProgressionData && !existingHasProgressionData) {
            // Store conventional in difficulty/type; wuxia in wuxiaDifficulty/wuxiaType
            const conventionalDifficulty = (ex.difficulty || "").trim().slice(0, 100);
            const wuxiaDifficulty = (ex.wuxiaDifficulty || ex.difficulty || "").trim().slice(0, 100);
            const conventionalType = (ex.type || "").trim().slice(0, 100);
            const wuxiaType = (ex.wuxiaType || ex.type || "").trim().slice(0, 100);

            const updateData = {
              name: String(ex.name).trim().slice(0, 200),
              wuxiaName: ex.wuxiaName ? String(ex.wuxiaName).trim().slice(0, 300) : "",
              difficulty: conventionalDifficulty,
              wuxiaDifficulty: wuxiaDifficulty,
              type: conventionalType,
              wuxiaType: wuxiaType,
              story: ex.story ? String(ex.story).trim().slice(0, 5000) : "",
              tips: Array.isArray(ex.tips) ? JSON.stringify(ex.tips.map(t => String(t).trim()).filter(Boolean)) : "",
              category: normalizeCategory(ex.category).slice(0, 100),
              equipmentType: String(equipment.type || "bodyweight").trim().slice(0, 100),
              bodyweight: equipment.bodyweight !== false,
              weighted: equipment.weighted === true,
              rings: equipment.rings === true,
              primaryMuscles: toCommaSeparated(ex.primaryMuscles).slice(0, 500),
              secondaryMuscles: toCommaSeparated(ex.secondaryMuscles).slice(0, 500),
              prerequisites: JSON.stringify(Array.isArray(ex.prerequisites) ? ex.prerequisites : []),
              cues: JSON.stringify(Array.isArray(ex.cues) ? ex.cues.map(c => String(c).trim()).filter(Boolean) : []),
              commonMistakes: JSON.stringify(Array.isArray(ex.commonMistakes) ? ex.commonMistakes : []),
              breathing: ex.breathing ? String(ex.breathing).trim().slice(0, 1000) : "",
              safetyConsiderations: JSON.stringify(Array.isArray(ex.safetyConsiderations) ? ex.safetyConsiderations.map(s => String(s).trim()).filter(Boolean) : []),
              competitionStandards: ex.competitionStandards && typeof ex.competitionStandards === "object" ? JSON.stringify(ex.competitionStandards) : "{}",
              tiers: {
                deleteMany: {},
                create: tiers.map((t: TierInput) => {
                  let holdVal: number | null = null;
                  const holdSource = t.targetHold ?? t.targetHoldTime;
                  if (holdSource != null) {
                    if (typeof holdSource === "number") {
                      holdVal = holdSource;
                    } else {
                      const nums = String(holdSource).match(/\d+/g);
                      if (nums && nums.length > 0) {
                        holdVal = Math.max(...nums.map(Number));
                      }
                    }
                  }

                  const rawTargetReps = t.targetReps;
                  const targetRepsText = rawTargetReps != null ? String(rawTargetReps).trim() : "";
                  const targetRepsNum = typeof rawTargetReps === "number" ? rawTargetReps : null;

                  let desc = t.description ? String(t.description).trim() : "";
                  if (t.targetHoldTime && typeof t.targetHoldTime === "string") {
                    desc = desc ? `${desc} (Target: ${t.targetHoldTime})` : `Target: ${t.targetHoldTime}`;
                  }
                  if (t.targetWeight != null) {
                    const targetWeightText = String(t.targetWeight).trim();
                    if (targetWeightText.length > 0) {
                      desc = desc
                        ? `${desc} (Target Weight: ${targetWeightText})`
                        : `Target Weight: ${targetWeightText}`;
                    }
                  }

                  return {
                    level: Number(t.level),
                    name: String(t.name).trim().slice(0, 200),
                    wuxiaName: t.wuxiaName ? String(t.wuxiaName).trim().slice(0, 300) : "",
                    difficulty: (t.difficulty || "").trim().slice(0, 100),
                    wuxiaDifficulty: (t.wuxiaDifficulty || t.difficulty || "").trim().slice(0, 100),
                    wuxiaType: (t.wuxiaType || "").trim().slice(0, 100),
                    description: desc.slice(0, 1000),
                    targetHold: holdVal,
                    targetReps: targetRepsNum,
                    targetRepsText: targetRepsText.slice(0, 50),
                  };
                }),
              },
              variations: {
                deleteMany: {},
                create: variations.map((v: VariationInput) => ({
                  name: String(v.name).trim().slice(0, 200),
                  wuxiaName: v.wuxiaName ? String(v.wuxiaName).trim().slice(0, 300) : "",
                  difficulty: (v.difficulty || "").trim().slice(0, 100),
                  wuxiaDifficulty: (v.wuxiaDifficulty || v.difficulty || "").trim().slice(0, 100),
                  wuxiaType: v.wuxiaType ? String(v.wuxiaType).trim().slice(0, 100) : "",
                  description: v.description ? String(v.description).trim().slice(0, 1000) : "",
                })),
              },
              modifiers: {
                deleteMany: {},
                create: modifiers.map((m: ModifierInput) => ({
                  type: String(m.type).trim().slice(0, 50),
                  available: m.available === true,
                  difficultyMod: m.difficultyMod != null ? Number(m.difficultyMod) : 0,
                  notes: (m.notes || "").toString().trim().slice(0, 500),
                  method: (m.method || "").toString().trim().slice(0, 500),
                  difficultyIncrease: (m.difficultyIncrease || "").toString().trim().slice(0, 200),
                })),
              },
            };

            try {
              await prisma.progressionExercise.update({
                where: { id: existingExercise.id },
                data: updateData,
              });
            } catch (updateError) {
              const message = updateError instanceof Error ? updateError.message : "";
              const hasUnsupportedWuxiaField =
                message.includes("Unknown argument `wuxiaDifficulty`") ||
                message.includes("Unknown argument `wuxiaType`");

              if (!hasUnsupportedWuxiaField) {
                throw updateError;
              }

              const legacyData = stripUnsupportedWuxiaFields(updateData);
              await prisma.progressionExercise.update({
                where: { id: existingExercise.id },
                data: legacyData,
              });
            }

            await prisma.userProgressionLevel.upsert({
              where: { userId_exerciseId: { userId, exerciseId: existingExercise.id } },
              create: { userId, exerciseId: existingExercise.id, currentLevel: 1 },
              update: {},
            });

            imported++;
            enriched++;
          } else {
            skipped++;
          }

          continue;
        }

        // Store conventional in difficulty/type; wuxia in wuxiaDifficulty/wuxiaType
        const conventionalDifficulty = (ex.difficulty || "").trim().slice(0, 100);
        const wuxiaDifficulty = (ex.wuxiaDifficulty || ex.difficulty || "").trim().slice(0, 100);
        const conventionalType = (ex.type || "").trim().slice(0, 100);
        const wuxiaType = (ex.wuxiaType || ex.type || "").trim().slice(0, 100);

        const createData = {
            name: String(ex.name).trim().slice(0, 200),
            wuxiaName: ex.wuxiaName ? String(ex.wuxiaName).trim().slice(0, 300) : "",
            difficulty: conventionalDifficulty,
            wuxiaDifficulty: wuxiaDifficulty,
            type: conventionalType,
            wuxiaType: wuxiaType,
            story: ex.story ? String(ex.story).trim().slice(0, 5000) : "",
            tips: Array.isArray(ex.tips) ? JSON.stringify(ex.tips.map(t => String(t).trim()).filter(Boolean)) : "",
            category: normalizeCategory(ex.category).slice(0, 100),
            equipmentType: String(equipment.type || "bodyweight").trim().slice(0, 100),
            bodyweight: equipment.bodyweight !== false,
            weighted: equipment.weighted === true,
            rings: equipment.rings === true,
            primaryMuscles: toCommaSeparated(ex.primaryMuscles).slice(0, 500),
            secondaryMuscles: toCommaSeparated(ex.secondaryMuscles).slice(0, 500),
            prerequisites: JSON.stringify(Array.isArray(ex.prerequisites) ? ex.prerequisites : []),
            cues: JSON.stringify(Array.isArray(ex.cues) ? ex.cues.map(c => String(c).trim()).filter(Boolean) : []),
            commonMistakes: JSON.stringify(Array.isArray(ex.commonMistakes) ? ex.commonMistakes : []),
            breathing: ex.breathing ? String(ex.breathing).trim().slice(0, 1000) : "",
            safetyConsiderations: JSON.stringify(Array.isArray(ex.safetyConsiderations) ? ex.safetyConsiderations.map(s => String(s).trim()).filter(Boolean) : []),
            competitionStandards: ex.competitionStandards && typeof ex.competitionStandards === "object" ? JSON.stringify(ex.competitionStandards) : "{}",
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

                // targetReps: store the raw string if provided, also parse numeric
                const rawTargetReps = t.targetReps;
                const targetRepsText = rawTargetReps != null ? String(rawTargetReps).trim() : "";
                const targetRepsNum = typeof rawTargetReps === "number" ? rawTargetReps : null;

                // Build description, appending original hold/weight text if present
                let desc = t.description ? String(t.description).trim() : "";
                if (t.targetHoldTime && typeof t.targetHoldTime === "string") {
                  desc = desc ? `${desc} (Target: ${t.targetHoldTime})` : `Target: ${t.targetHoldTime}`;
                }
                if (t.targetWeight != null) {
                  const targetWeightText = String(t.targetWeight).trim();
                  if (targetWeightText.length > 0) {
                    desc = desc
                      ? `${desc} (Target Weight: ${targetWeightText})`
                      : `Target Weight: ${targetWeightText}`;
                  }
                }

                return {
                  level: Number(t.level),
                  name: String(t.name).trim().slice(0, 200),
                  wuxiaName: t.wuxiaName ? String(t.wuxiaName).trim().slice(0, 300) : "",
                  difficulty: (t.difficulty || "").trim().slice(0, 100),
                  wuxiaDifficulty: (t.wuxiaDifficulty || t.difficulty || "").trim().slice(0, 100),
                  wuxiaType: (t.wuxiaType || "").trim().slice(0, 100),
                  description: desc.slice(0, 1000),
                  targetHold: holdVal,
                  targetReps: targetRepsNum,
                  targetRepsText: targetRepsText.slice(0, 50),
                };
              }),
            },
            variations: {
              create: variations.map((v: VariationInput) => ({
                name: String(v.name).trim().slice(0, 200),
                wuxiaName: v.wuxiaName ? String(v.wuxiaName).trim().slice(0, 300) : "",
                difficulty: (v.difficulty || "").trim().slice(0, 100),
                wuxiaDifficulty: (v.wuxiaDifficulty || v.difficulty || "").trim().slice(0, 100),
                wuxiaType: v.wuxiaType ? String(v.wuxiaType).trim().slice(0, 100) : "",
                description: v.description ? String(v.description).trim().slice(0, 1000) : "",
              })),
            },
            modifiers: {
              create: modifiers.map((m: ModifierInput) => ({
                type: String(m.type).trim().slice(0, 50),
                available: m.available === true,
                difficultyMod: m.difficultyMod != null ? Number(m.difficultyMod) : 0,
                notes: (m.notes || "").toString().trim().slice(0, 500),
                method: (m.method || "").toString().trim().slice(0, 500),
                difficultyIncrease: (m.difficultyIncrease || "").toString().trim().slice(0, 200),
              })),
            },
          };

        let created;
        try {
          created = await prisma.progressionExercise.create({ data: createData });
        } catch (createError) {
          const message = createError instanceof Error ? createError.message : "";
          const hasUnsupportedWuxiaField =
            message.includes("Unknown argument `wuxiaDifficulty`") ||
            message.includes("Unknown argument `wuxiaType`");

          if (!hasUnsupportedWuxiaField) {
            throw createError;
          }

          const legacyData = stripUnsupportedWuxiaFields(createData);
          created = await prisma.progressionExercise.create({ data: legacyData });
        }

        // Initialize user progression for this exercise at level 1
        await prisma.userProgressionLevel.create({
          data: {
            userId,
            exerciseId: created.id,
            currentLevel: 1,
          },
        });

        imported++;
      } catch (entryError) {
        failed++;
        errors.push(`Entry ${i}: ${entryError instanceof Error ? entryError.message : "Failed to import"}`);
      }
    }

    if (imported === 0 && failed > 0 && skipped === 0) {
      return NextResponse.json({
        error: "Failed to upload progressions",
        details: errors,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      imported,
      enriched: enriched > 0 ? enriched : undefined,
      skipped: skipped > 0 ? skipped : undefined,
      failed: failed > 0 ? failed : undefined,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Progression upload error:", error);
    return NextResponse.json({
      error: "Failed to upload progressions",
      details: error instanceof Error ? [error.message] : undefined,
    }, { status: 500 });
  }
}
