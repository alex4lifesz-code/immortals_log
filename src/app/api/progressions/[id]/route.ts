import { apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { serializeDayAssignments } from "@/lib/constants";
import { withAuth } from "@/lib/auth/middleware";
import { canViewUserData } from "@/lib/friends";
import { resolveVietnameseValue } from "@/lib/auto-vietnamese";
import {
  deleteProgressionById,
  findProgressionById,
  findProgressionForUser,
} from "@/lib/repositories/progression.repository";

function normalizeAssignedDaysInput(input: unknown): string | null {
  if (Array.isArray(input)) {
    const validDays = input.filter((day: unknown) => typeof day === "number" && day >= 0 && day <= 6);
    return serializeDayAssignments(validDays);
  }
  if (typeof input === "string") {
    return input.trim().slice(0, 2000);
  }
  return null;
}

// GET /api/progressions/[id] — get a shared progression exercise with selected user's progress
export const GET = withAuth(async (request, { auth, params }) => {
  try {
    const id = params.id as string;
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("targetUserId");
    let userId = auth.userId;

    if (targetUserId) {
      const canViewTarget = await canViewUserData({
        viewerId: auth.userId,
        viewerRole: auth.role,
        targetUserId,
      });
      if (!canViewTarget) {
        return ApiErrors.forbidden("Not allowed to view this user's progression");
      }
      userId = targetUserId;
    }

    const exercise = await findProgressionForUser(id, userId);

    if (!exercise) {
      return ApiErrors.notFound("Exercise not found");
    }

    return apiSuccess({ exercise });
  } catch (error) {
    console.error("Progression fetch error:", error);
    return ApiErrors.internal("Failed to fetch progression");
  }
});

// DELETE /api/progressions/[id] — delete a single progression exercise
export const DELETE = withAuth(async (_request, { auth, params }) => {
  try {
    const id = params.id as string;

    const exercise = await findProgressionById(id);

    if (!exercise) {
      return ApiErrors.notFound("Exercise not found");
    }

    await deleteProgressionById(id);

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Progression delete error:", error);
    return ApiErrors.internal("Failed to delete progression");
  }
});

// PATCH /api/progressions/[id] — update fields on a progression exercise
export const PATCH = withAuth(async (request, { auth, params }) => {
  try {
    const id = params.id as string;
    const body = await request.json();

    const existing = await prisma.progressionExercise.findUnique({
      where: { id },
    });
    if (!existing) {
      return ApiErrors.notFound("Exercise not found");
    }

    const isOwner = existing.userId === auth.userId;
    const isOwnerOrAdmin = isOwner || auth.role === "admin";
    const requestedKeys = Object.keys(body).filter((key) => body[key] !== undefined);
    const onlyAssignedDaysRequested = requestedKeys.length > 0 && requestedKeys.every((key) => key === "assignedDays");

    // Shared library exercises are visible to everyone. Keep day allocations user-scoped
    // by forking the exercise for this user when they only update assigned days.
    // This intentionally treats admins like normal users for day allocation.
    if (!isOwner && onlyAssignedDaysRequested) {
      const normalizedAssignedDays = normalizeAssignedDaysInput(body.assignedDays);
      if (normalizedAssignedDays == null) {
        return ApiErrors.badRequest("Invalid assigned days payload");
      }

      const forkedExerciseId = await prisma.$transaction(async (tx) => {
        const source = await tx.progressionExercise.findUnique({
          where: { id },
          include: {
            tiers: { orderBy: { level: "asc" } },
            variations: true,
            modifiers: true,
            translation: true,
          },
        });

        if (!source) {
          throw new Error("Source exercise not found during fork");
        }

        const tierIds = source.tiers.map((tier) => tier.id);
        const variationIds = source.variations.map((variation) => variation.id);

        const [tierTranslations, variationTranslations] = await Promise.all([
          tierIds.length > 0
            ? tx.progressionTierTranslation.findMany({
                where: { id: { in: tierIds } },
                select: {
                  id: true,
                  englishName: true,
                  vietnameseName: true,
                  englishDescription: true,
                  vietnameseDescription: true,
                  englishDifficulty: true,
                  vietnameseDifficulty: true,
                },
              })
            : Promise.resolve([]),
          variationIds.length > 0
            ? tx.progressionVariationTranslation.findMany({
                where: { id: { in: variationIds } },
                select: {
                  id: true,
                  englishName: true,
                  vietnameseName: true,
                  englishDescription: true,
                  vietnameseDescription: true,
                  englishDifficulty: true,
                  vietnameseDifficulty: true,
                },
              })
            : Promise.resolve([]),
        ]);

        const tierTranslationById = new Map(tierTranslations.map((translation) => [translation.id, translation]));
        const variationTranslationById = new Map(variationTranslations.map((translation) => [translation.id, translation]));

        const forked = await tx.progressionExercise.create({
          data: {
            name: source.name,
            wuxiaName: source.wuxiaName,
            difficulty: source.difficulty,
            wuxiaDifficulty: source.wuxiaDifficulty,
            type: source.type,
            wuxiaType: source.wuxiaType,
            story: source.story,
            tips: source.tips,
            category: source.category,
            equipmentType: source.equipmentType,
            bodyweight: source.bodyweight,
            weighted: source.weighted,
            rings: source.rings,
            primaryMuscles: source.primaryMuscles,
            secondaryMuscles: source.secondaryMuscles,
            prerequisites: source.prerequisites,
            cues: source.cues,
            commonMistakes: source.commonMistakes,
            breathing: source.breathing,
            safetyConsiderations: source.safetyConsiderations,
            competitionStandards: source.competitionStandards,
            progression: source.progression,
            assignedDays: normalizedAssignedDays,
            userId: auth.userId,
          },
        });

        if (source.translation) {
          await tx.progressionExerciseTranslation.create({
            data: {
              id: forked.id,
              englishName: source.translation.englishName,
              vietnameseName: source.translation.vietnameseName,
              englishStory: source.translation.englishStory,
              vietnameseStory: source.translation.vietnameseStory,
              englishDifficulty: source.translation.englishDifficulty,
              vietnameseDifficulty: source.translation.vietnameseDifficulty,
              englishType: source.translation.englishType,
              vietnameseType: source.translation.vietnameseType,
            },
          });
        }

        if (source.tiers.length > 0) {
          for (const tier of source.tiers) {
            const createdTier = await tx.progressionTier.create({
              data: {
                exerciseId: forked.id,
                level: tier.level,
                name: tier.name,
                wuxiaName: tier.wuxiaName,
                difficulty: tier.difficulty,
                wuxiaDifficulty: tier.wuxiaDifficulty,
                wuxiaType: tier.wuxiaType,
                description: tier.description,
                targetHold: tier.targetHold,
                targetReps: tier.targetReps,
                targetRepsText: tier.targetRepsText,
              },
            });

            const tierTranslation = tierTranslationById.get(tier.id);
            if (tierTranslation) {
              await tx.progressionTierTranslation.create({
                data: {
                  id: createdTier.id,
                  englishName: tierTranslation.englishName,
                  vietnameseName: tierTranslation.vietnameseName,
                  englishDescription: tierTranslation.englishDescription,
                  vietnameseDescription: tierTranslation.vietnameseDescription,
                  englishDifficulty: tierTranslation.englishDifficulty,
                  vietnameseDifficulty: tierTranslation.vietnameseDifficulty,
                },
              });
            }
          }
        }

        if (source.variations.length > 0) {
          for (const variation of source.variations) {
            const createdVariation = await tx.progressionVariation.create({
              data: {
                exerciseId: forked.id,
                name: variation.name,
                wuxiaName: variation.wuxiaName,
                difficulty: variation.difficulty,
                wuxiaDifficulty: variation.wuxiaDifficulty,
                wuxiaType: variation.wuxiaType,
                description: variation.description,
              },
            });

            const variationTranslation = variationTranslationById.get(variation.id);
            if (variationTranslation) {
              await tx.progressionVariationTranslation.create({
                data: {
                  id: createdVariation.id,
                  englishName: variationTranslation.englishName,
                  vietnameseName: variationTranslation.vietnameseName,
                  englishDescription: variationTranslation.englishDescription,
                  vietnameseDescription: variationTranslation.vietnameseDescription,
                  englishDifficulty: variationTranslation.englishDifficulty,
                  vietnameseDifficulty: variationTranslation.vietnameseDifficulty,
                },
              });
            }
          }
        }

        if (source.modifiers.length > 0) {
          await tx.progressionModifier.createMany({
            data: source.modifiers.map((modifier) => ({
              exerciseId: forked.id,
              type: modifier.type,
              available: modifier.available,
              difficultyMod: modifier.difficultyMod,
              notes: modifier.notes,
              method: modifier.method,
              difficultyIncrease: modifier.difficultyIncrease,
            })),
          });
        }

        await tx.userProgressionLevel.updateMany({
          where: {
            userId: auth.userId,
            exerciseId: source.id,
          },
          data: {
            exerciseId: forked.id,
          },
        });

        return forked.id;
      });

      const forked = await prisma.progressionExercise.findUnique({
        where: { id: forkedExerciseId },
        include: {
          tiers: {
            orderBy: { level: "asc" },
          },
          variations: true,
          modifiers: true,
          userProgress: {
            where: { userId: auth.userId },
            include: { logs: { orderBy: { createdAt: "desc" } } },
          },
        },
      });

      if (!forked) {
        return ApiErrors.notFound("Exercise not found");
      }

      return apiSuccess({ exercise: forked });
    }

    if (!isOwnerOrAdmin) {
      return ApiErrors.forbidden("You can only update your own progression exercises");
    }

    const data: Record<string, unknown> = {};

    // Simple string fields
    const stringFields: [string, number][] = [
      ["name", 200], ["wuxiaName", 300], ["difficulty", 100], ["wuxiaDifficulty", 100],
      ["type", 100], ["wuxiaType", 100], ["story", 5000], ["category", 100],
      ["equipmentType", 100], ["primaryMuscles", 500], ["secondaryMuscles", 500],
      ["breathing", 1000],
    ];
    for (const [field, maxLen] of stringFields) {
      if (body[field] !== undefined) {
        data[field] = String(body[field] ?? "").trim().slice(0, maxLen);
      }
    }

    // Boolean fields
    for (const field of ["bodyweight", "weighted", "rings"]) {
      if (body[field] !== undefined) {
        data[field] = body[field] === true;
      }
    }

    // JSON-stored array/object fields
    const jsonFields = ["tips", "prerequisites", "cues", "commonMistakes", "safetyConsiderations", "competitionStandards"];
    for (const field of jsonFields) {
      if (body[field] !== undefined) {
        data[field] = JSON.stringify(body[field] ?? (field === "competitionStandards" ? {} : []));
      }
    }

    // AssignedDays
    if (body.assignedDays !== undefined) {
      const normalizedAssignedDays = normalizeAssignedDaysInput(body.assignedDays);
      if (normalizedAssignedDays == null) {
        return ApiErrors.badRequest("Invalid assigned days payload");
      }
      data.assignedDays = normalizedAssignedDays;
    }

    // Duplicate name check
    if (data.name) {
      const allProgs = await prisma.progressionExercise.findMany({
        select: { id: true, name: true },
      });
      const duplicate = allProgs.find(p => p.id !== id && p.name.toLowerCase() === String(data.name).toLowerCase());
      if (duplicate) {
        return ApiErrors.conflict(`A progression exercise named "${data.name}" already exists`);
      }
    }

    if (Object.keys(data).length === 0 && !body.tiers) {
      return ApiErrors.badRequest("No valid fields to update");
    }

    // Update tiers if provided
    if (body.tiers && Array.isArray(body.tiers)) {
      // Delete existing tiers and recreate
      await prisma.progressionTier.deleteMany({ where: { exerciseId: id } });
      for (const t of body.tiers) {
        const createdTier = await prisma.progressionTier.create({
          data: {
            exerciseId: id,
            level: Number(t.level),
            name: String(t.name || "").trim().slice(0, 200),
            wuxiaName: t.wuxiaName ? String(t.wuxiaName).trim().slice(0, 300) : "",
            difficulty: (t.difficulty || "").toString().trim().slice(0, 100),
            wuxiaDifficulty: (t.wuxiaDifficulty || t.difficulty || "").toString().trim().slice(0, 100),
            wuxiaType: (t.wuxiaType || "").toString().trim().slice(0, 100),
            description: (t.description || "").toString().trim().slice(0, 1000),
            targetHold: t.targetHold != null ? Number(t.targetHold) : null,
            targetReps: t.targetReps != null ? Number(t.targetReps) : null,
            targetRepsText: t.targetRepsText ? String(t.targetRepsText).trim().slice(0, 50) : "",
          },
        });

        await prisma.progressionTierTranslation.create({
          data: {
            id: createdTier.id,
            englishName: String(t.name || "").trim().slice(0, 200),
            vietnameseName: t.wuxiaName ? String(t.wuxiaName).trim().slice(0, 300) : String(t.name || "").trim().slice(0, 200),
            englishDescription: (t.description || "").toString().trim().slice(0, 1000),
            vietnameseDescription: (t.description || "").toString().trim().slice(0, 1000),
            englishDifficulty: (t.difficulty || "").toString().trim().slice(0, 100),
            vietnameseDifficulty: (t.wuxiaDifficulty || t.difficulty || "").toString().trim().slice(0, 100),
          },
        });
      }
    }

    // Update variations if provided
    if (body.variations && Array.isArray(body.variations)) {
      await prisma.progressionVariation.deleteMany({ where: { exerciseId: id } });
      for (const v of body.variations) {
        const createdVariation = await prisma.progressionVariation.create({
          data: {
            exerciseId: id,
            name: String(v.name || "").trim().slice(0, 200),
            wuxiaName: v.wuxiaName ? String(v.wuxiaName).trim().slice(0, 300) : "",
            difficulty: (v.difficulty || "").toString().trim().slice(0, 100),
            wuxiaDifficulty: (v.wuxiaDifficulty || v.difficulty || "").toString().trim().slice(0, 100),
            wuxiaType: (v.wuxiaType || "").toString().trim().slice(0, 100),
            description: (v.description || "").toString().trim().slice(0, 1000),
          },
        });

        await prisma.progressionVariationTranslation.create({
          data: {
            id: createdVariation.id,
            englishName: String(v.name || "").trim().slice(0, 200),
            vietnameseName: v.wuxiaName ? String(v.wuxiaName).trim().slice(0, 300) : String(v.name || "").trim().slice(0, 200),
            englishDescription: (v.description || "").toString().trim().slice(0, 1000),
            vietnameseDescription: (v.description || "").toString().trim().slice(0, 1000),
            englishDifficulty: (v.difficulty || "").toString().trim().slice(0, 100),
            vietnameseDifficulty: (v.wuxiaDifficulty || v.difficulty || "").toString().trim().slice(0, 100),
          },
        });
      }
    }

    // Update modifiers if provided
    if (body.modifiers && Array.isArray(body.modifiers)) {
      await prisma.progressionModifier.deleteMany({ where: { exerciseId: id } });
      for (const m of body.modifiers) {
        await prisma.progressionModifier.create({
          data: {
            exerciseId: id,
            type: String(m.type || "").trim().slice(0, 50),
            available: m.available === true,
            difficultyMod: m.difficultyMod != null ? Number(m.difficultyMod) : 0,
            notes: (m.notes || "").toString().trim().slice(0, 500),
            method: (m.method || "").toString().trim().slice(0, 500),
            difficultyIncrease: (m.difficultyIncrease || "").toString().trim().slice(0, 200),
          },
        });
      }
    }

    if (Object.keys(data).length > 0) {
      await prisma.progressionExercise.update({ where: { id }, data });

      await prisma.progressionExerciseTranslation.upsert({
        where: { id },
        create: {
          id,
          englishName: String(data.name ?? existing.name),
          vietnameseName: resolveVietnameseValue(
            String(data.name ?? existing.name),
            String(data.wuxiaName ?? (existing.wuxiaName || data.name || existing.name)),
          ),
          englishStory: String(data.story ?? existing.story),
          vietnameseStory: resolveVietnameseValue(String(data.story ?? existing.story), null),
          englishDifficulty: String(data.difficulty ?? existing.difficulty),
          vietnameseDifficulty: resolveVietnameseValue(
            String(data.difficulty ?? existing.difficulty),
            String(data.wuxiaDifficulty ?? (existing.wuxiaDifficulty || data.difficulty || existing.difficulty)),
          ),
          englishType: String(data.type ?? existing.type),
          vietnameseType: resolveVietnameseValue(
            String(data.type ?? existing.type),
            String(data.wuxiaType ?? (existing.wuxiaType || data.type || existing.type)),
          ),
        },
        update: {
          ...(data.name !== undefined ? { englishName: String(data.name) } : {}),
          ...(data.wuxiaName !== undefined
            ? {
                vietnameseName: resolveVietnameseValue(
                  String(data.name ?? existing.name),
                  String(data.wuxiaName || data.name || existing.name),
                ),
              }
            : {}),
          ...(data.story !== undefined
            ? {
                englishStory: String(data.story),
                vietnameseStory: resolveVietnameseValue(String(data.story), null),
              }
            : {}),
          ...(data.difficulty !== undefined ? { englishDifficulty: String(data.difficulty) } : {}),
          ...(data.wuxiaDifficulty !== undefined
            ? {
                vietnameseDifficulty: resolveVietnameseValue(
                  String(data.difficulty ?? existing.difficulty),
                  String(data.wuxiaDifficulty || data.difficulty || existing.difficulty),
                ),
              }
            : {}),
          ...(data.type !== undefined ? { englishType: String(data.type) } : {}),
          ...(data.wuxiaType !== undefined
            ? {
                vietnameseType: resolveVietnameseValue(
                  String(data.type ?? existing.type),
                  String(data.wuxiaType || data.type || existing.type),
                ),
              }
            : {}),
        },
      });
    } else {
      await prisma.progressionExercise.findUnique({ where: { id } });
    }

    const full = await prisma.progressionExercise.findUnique({
      where: { id },
      include: {
        tiers: {
          orderBy: { level: "asc" },
        },
        variations: true,
        modifiers: true,
        userProgress: {
          where: { userId: auth.userId },
          include: { logs: { orderBy: { createdAt: "desc" } } },
        },
      },
    });

    if (!full) {
      return ApiErrors.notFound("Exercise not found");
    }

    return apiSuccess({ exercise: full });
  } catch (error) {
    console.error("Progression update error:", error);
    return ApiErrors.internal("Failed to update progression exercise");
  }
});
