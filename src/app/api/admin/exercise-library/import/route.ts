import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/auth/middleware";

interface TierImport {
  level: number;
  name?: string;
  wuxiaName?: string;
  difficulty?: string;
  wuxiaDifficulty?: string;
  wuxiaType?: string;
  description?: string;
  targetHold?: number | null;
  targetReps?: number | null;
  targetRepsText?: string;
}

interface VariationImport {
  name: string;
  wuxiaName?: string;
  difficulty?: string;
  wuxiaDifficulty?: string;
  wuxiaType?: string;
  description?: string;
}

interface ModifierImport {
  type: string;
  available?: boolean;
  difficultyMod?: number;
  notes?: string;
  method?: string;
  difficultyIncrease?: string;
}

interface ExerciseImport {
  name: string;
  wuxiaName?: string;
  difficulty?: string;
  wuxiaDifficulty?: string;
  type?: string;
  wuxiaType?: string;
  story?: string;
  category: string;
  equipmentType?: string;
  bodyweight?: boolean;
  weighted?: boolean;
  rings?: boolean;
  primaryMuscles?: string;
  secondaryMuscles?: string;
  tips?: string;
  prerequisites?: string;
  cues?: string;
  commonMistakes?: string;
  breathing?: string;
  safetyConsiderations?: string;
  competitionStandards?: string;
  progression?: string[];
  assignedDays?: string;
  tiers?: TierImport[];
  variations?: VariationImport[];
  modifiers?: ModifierImport[];
}

/**
 * POST /api/admin/exercise-library/import
 *
 * Body (JSON): { targetUserId: string, exercises: ExerciseImport[], skipDuplicates?: boolean }
 *
 * Imports exercises into the exercise library for targetUserId.
 * Requires admin role (enforced by withAdmin).
 * skipDuplicates (default true): silently skip exercises whose name already exists for targetUserId.
 */
export const POST = withAdmin(async (request, { auth }) => {
  try {
    const body = await request.json();
    const { targetUserId, exercises, skipDuplicates = true } = body;

    const destUserId: string = targetUserId && typeof targetUserId === "string" ? targetUserId : auth.userId;

    // Validate target user exists
    const destUser = await prisma.user.findUnique({ where: { id: destUserId } });
    if (!destUser) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    if (!Array.isArray(exercises) || exercises.length === 0) {
      return NextResponse.json({ error: "exercises array is required and must not be empty" }, { status: 400 });
    }

    // Fetch existing exercise names for the target user
    const existingExercises = await prisma.progressionExercise.findMany({
      where: { userId: destUserId },
      select: { name: true },
    });
    const existingNames = new Set(existingExercises.map((e) => e.name.toLowerCase().trim()));

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const ex of exercises as ExerciseImport[]) {
      const rawName = String(ex.name || "").trim().slice(0, 200);
      if (rawName.length < 2) {
        errors.push(`Skipped entry with invalid name: "${ex.name}"`);
        continue;
      }

      const importedProgression = Array.isArray(ex.progression)
        ? ex.progression
            .map((value) => String(value || "").trim().slice(0, 200))
            .filter(Boolean)
        : [];

      const fallbackProgression = Array.isArray(ex.tiers)
        ? ex.tiers
            .map((tier) => String(tier.name || "").trim().slice(0, 200))
            .filter(Boolean)
        : [];

      const progression = importedProgression.length > 0 ? importedProgression : fallbackProgression;

      if (existingNames.has(rawName.toLowerCase())) {
        if (skipDuplicates) {
          skipped++;
          continue;
        }
        errors.push(`Duplicate exercise skipped: "${rawName}"`);
        skipped++;
        continue;
      }

      try {
        const newExercise = await prisma.progressionExercise.create({
          data: {
            name: rawName,
            wuxiaName: String(ex.wuxiaName || rawName).trim().slice(0, 200),
            difficulty: String(ex.difficulty || "").trim(),
            wuxiaDifficulty: String(ex.wuxiaDifficulty || "").trim(),
            type: String(ex.type || "").trim(),
            wuxiaType: String(ex.wuxiaType || "").trim(),
            story: String(ex.story || "").trim().slice(0, 5000),
            category: String(ex.category || "Other").trim(),
            equipmentType: String(ex.equipmentType || "").trim(),
            bodyweight: ex.bodyweight !== undefined ? Boolean(ex.bodyweight) : true,
            weighted: ex.weighted !== undefined ? Boolean(ex.weighted) : false,
            rings: ex.rings !== undefined ? Boolean(ex.rings) : false,
            primaryMuscles: String(ex.primaryMuscles || "Other").trim(),
            secondaryMuscles: String(ex.secondaryMuscles || "").trim(),
            tips: String(ex.tips || "[]").trim(),
            prerequisites: String(ex.prerequisites || "[]").trim(),
            cues: String(ex.cues || "[]").trim(),
            commonMistakes: String(ex.commonMistakes || "[]").trim(),
            breathing: String(ex.breathing || "").trim(),
            safetyConsiderations: String(ex.safetyConsiderations || "[]").trim(),
            competitionStandards: String(ex.competitionStandards || "{}").trim(),
            progression: JSON.stringify(progression),
            assignedDays: String(ex.assignedDays || "").trim(),
            userId: destUserId,
          },
        });

        existingNames.add(rawName.toLowerCase());

        // Import tiers
        if (Array.isArray(ex.tiers) && ex.tiers.length > 0) {
          await prisma.progressionTier.createMany({
            data: ex.tiers.map((t) => ({
              exerciseId: newExercise.id,
              level: Number(t.level) || 1,
              name: String(t.name || rawName).trim().slice(0, 200),
              wuxiaName: String(t.wuxiaName || "").trim(),
              difficulty: String(t.difficulty || "").trim(),
              wuxiaDifficulty: String(t.wuxiaDifficulty || "").trim(),
              wuxiaType: String(t.wuxiaType || "").trim(),
              description: String(t.description || "").trim(),
              targetHold: t.targetHold != null ? Number(t.targetHold) : null,
              targetReps: t.targetReps != null ? Number(t.targetReps) : null,
              targetRepsText: String(t.targetRepsText || "").trim(),
            })),
          });
        } else {
          // Create a default tier so the exercise works with the logging system
          await prisma.progressionTier.create({
            data: {
              exerciseId: newExercise.id,
              level: 1,
              name: rawName,
              wuxiaName: rawName,
            },
          });
        }

        // Import variations
        if (Array.isArray(ex.variations) && ex.variations.length > 0) {
          await prisma.progressionVariation.createMany({
            data: ex.variations.map((v) => ({
              exerciseId: newExercise.id,
              name: String(v.name || "").trim().slice(0, 200),
              wuxiaName: String(v.wuxiaName || "").trim(),
              difficulty: String(v.difficulty || "").trim(),
              wuxiaDifficulty: String(v.wuxiaDifficulty || "").trim(),
              wuxiaType: String(v.wuxiaType || "").trim(),
              description: String(v.description || "").trim(),
            })),
          });
        }

        // Import modifiers
        if (Array.isArray(ex.modifiers) && ex.modifiers.length > 0) {
          await prisma.progressionModifier.createMany({
            data: ex.modifiers.map((m) => ({
              exerciseId: newExercise.id,
              type: String(m.type || "custom").trim().slice(0, 100),
              available: m.available !== undefined ? Boolean(m.available) : false,
              difficultyMod: Number(m.difficultyMod) || 0,
              notes: String(m.notes || "").trim(),
              method: String(m.method || "").trim(),
              difficultyIncrease: String(m.difficultyIncrease || "").trim(),
            })),
          });
        }

        // Create UserProgressionLevel so the exercise appears in logs
        await prisma.userProgressionLevel.create({
          data: {
            userId: destUserId,
            exerciseId: newExercise.id,
            currentLevel: 1,
          },
        });

        created++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Failed to import "${rawName}": ${msg}`);
      }
    }

    return NextResponse.json({
      message: `Import complete: ${created} created, ${skipped} skipped${errors.length > 0 ? `, ${errors.length} errors` : ""}.`,
      created,
      skipped,
      errors,
    });
  } catch (error) {
    console.error("Exercise library import error:", error);
    return NextResponse.json({ error: "Failed to import exercise library" }, { status: 500 });
  }
});
