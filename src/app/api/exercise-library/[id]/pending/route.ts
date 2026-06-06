import { apiSuccess, ApiErrors } from "@/lib/api";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/prisma";
import {
  isPendingExerciseDescription,
  markExerciseAsDeleted,
  stripExerciseStatusMarkers,
} from "@/lib/pending-exercises";
import {
  findPendingExerciseById,
  updateExerciseStoryById,
} from "@/lib/repositories/exercise-library.repository";

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function parseProgressionValues(exercise: { progression: string; tiers: Array<{ name: string }> }): string[] {
  try {
    const parsed = JSON.parse(exercise.progression || "[]");
    if (Array.isArray(parsed)) {
      const values = parsed.map((entry) => String(entry || "").trim()).filter(Boolean);
      if (values.length > 0) return values;
    }
  } catch {
    // Fall back to tier names when progression JSON is malformed.
  }

  return exercise.tiers
    .map((tier) => normalizeText(tier.name))
    .filter(Boolean);
}

function hasCaseInsensitiveValue(values: string[], candidate: string): boolean {
  const normalizedCandidate = normalizeText(candidate).toLowerCase();
  if (!normalizedCandidate) return false;
  return values.some((value) => normalizeText(value).toLowerCase() === normalizedCandidate);
}

export const POST = withAuth(async (request, { params }) => {
  try {
    const id = params.id as string;
    const body = await request.json();
    const action = String(body?.action || "").trim().toLowerCase();

    if (action !== "append" && action !== "delete" && action !== "add-to-existing") {
      return ApiErrors.badRequest("Invalid action");
    }

    const existing = await findPendingExerciseById(id);

    if (!existing) {
      return ApiErrors.notFound("Exercise not found");
    }

    if (!isPendingExerciseDescription(existing.story)) {
      return ApiErrors.conflict("Exercise is not pending");
    }

    if (action === "append") {
      const updated = await updateExerciseStoryById(id, stripExerciseStatusMarkers(existing.story));

      return apiSuccess({ success: true, exercise: updated });
    }

    if (action === "add-to-existing") {
      const parentExerciseId = normalizeText(body?.parentExerciseId);
      if (!parentExerciseId) {
        return ApiErrors.badRequest("Parent exercise is required");
      }
      if (parentExerciseId === id) {
        return ApiErrors.badRequest("Parent exercise cannot be the pending exercise itself");
      }

      const [pendingExercise, parentExercise] = await Promise.all([
        prisma.progressionExercise.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            story: true,
            progression: true,
            equipmentType: true,
            tiers: { select: { name: true } },
            variations: { select: { name: true } },
            modifiers: { select: { type: true } },
          },
        }),
        prisma.progressionExercise.findUnique({
          where: { id: parentExerciseId },
          select: {
            id: true,
            name: true,
            story: true,
            equipmentType: true,
            tiers: { select: { id: true, level: true, name: true }, orderBy: { level: "asc" } },
            variations: { select: { name: true } },
            modifiers: { select: { type: true } },
          },
        }),
      ]);

      if (!pendingExercise) {
        return ApiErrors.notFound("Pending exercise not found");
      }
      if (!isPendingExerciseDescription(pendingExercise.story)) {
        return ApiErrors.conflict("Exercise is not pending");
      }
      if (!parentExercise) {
        return ApiErrors.notFound("Parent exercise not found");
      }

      const pendingProgressionValues = parseProgressionValues(pendingExercise);
      const pendingVariationValues = pendingExercise.variations
        .map((variation) => normalizeText(variation.name))
        .filter(Boolean);
      const pendingSetupValues = pendingExercise.modifiers
        .map((modifier) => normalizeText(modifier.type))
        .filter(Boolean);
      const pendingEquipmentValues = normalizeText(pendingExercise.equipmentType)
        .split(",")
        .map((entry) => normalizeText(entry))
        .filter(Boolean);

      const progressionName = normalizeText(body?.progressionName) || pendingProgressionValues[0] || "";
      const variantName = normalizeText(body?.variantName) || pendingVariationValues[0] || "";
      const setupOption = normalizeText(body?.setupOption) || pendingSetupValues[0] || "";
      const equipmentName = normalizeText(body?.equipmentName) || pendingEquipmentValues[0] || "";

      await prisma.$transaction(async (tx) => {
        const currentParent = await tx.progressionExercise.findUnique({
          where: { id: parentExerciseId },
          select: {
            id: true,
            equipmentType: true,
            tiers: { select: { level: true, name: true }, orderBy: { level: "asc" } },
            variations: { select: { name: true } },
            modifiers: { select: { type: true } },
          },
        });

        if (!currentParent) {
          throw new Error("Parent exercise not found during merge");
        }

        if (progressionName) {
          const progressionExists = hasCaseInsensitiveValue(
            currentParent.tiers.map((tier) => tier.name),
            progressionName,
          );
          if (!progressionExists) {
            const nextLevel = (currentParent.tiers[currentParent.tiers.length - 1]?.level ?? 0) + 1;
            await tx.progressionTier.create({
              data: {
                exerciseId: parentExerciseId,
                level: nextLevel,
                name: progressionName,
                wuxiaName: progressionName,
              },
            });
          }
        }

        if (variantName) {
          const variantExists = hasCaseInsensitiveValue(
            currentParent.variations.map((variation) => variation.name),
            variantName,
          );
          if (!variantExists) {
            await tx.progressionVariation.create({
              data: {
                exerciseId: parentExerciseId,
                name: variantName,
                wuxiaName: variantName,
              },
            });
          }
        }

        if (setupOption) {
          const setupExists = hasCaseInsensitiveValue(
            currentParent.modifiers.map((modifier) => modifier.type),
            setupOption,
          );
          if (!setupExists) {
            await tx.progressionModifier.create({
              data: {
                exerciseId: parentExerciseId,
                type: setupOption,
                available: true,
              },
            });
          }
        }

        if (equipmentName) {
          const currentEquipment = normalizeText(currentParent.equipmentType)
            .split(",")
            .map((entry) => normalizeText(entry))
            .filter(Boolean);
          if (!hasCaseInsensitiveValue(currentEquipment, equipmentName)) {
            const nextEquipment = [...currentEquipment, equipmentName].join(", ");
            await tx.progressionExercise.update({
              where: { id: parentExerciseId },
              data: { equipmentType: nextEquipment },
            });
          }
        }

        // Move all user progression rows/logs from the pending exercise into the selected parent
        // so Train/history no longer render the pending entry as a deleted exercise.
        const pendingUserProgressions = await tx.userProgressionLevel.findMany({
          where: { exerciseId: id },
          select: {
            id: true,
            userId: true,
            currentLevel: true,
          },
        });

        for (const pendingProgression of pendingUserProgressions) {
          const parentProgression = await tx.userProgressionLevel.findUnique({
            where: {
              userId_exerciseId: {
                userId: pendingProgression.userId,
                exerciseId: parentExerciseId,
              },
            },
            select: {
              id: true,
              currentLevel: true,
            },
          });

          let targetParentProgressionId = parentProgression?.id;
          if (!targetParentProgressionId) {
            const createdProgression = await tx.userProgressionLevel.create({
              data: {
                userId: pendingProgression.userId,
                exerciseId: parentExerciseId,
                currentLevel: pendingProgression.currentLevel,
              },
              select: { id: true },
            });
            targetParentProgressionId = createdProgression.id;
          } else if ((parentProgression?.currentLevel ?? 0) < (pendingProgression.currentLevel ?? 0)) {
            await tx.userProgressionLevel.update({
              where: { id: targetParentProgressionId },
              data: { currentLevel: pendingProgression.currentLevel },
            });
          }

          await tx.progressionLog.updateMany({
            where: { userProgressionId: pendingProgression.id },
            data: { userProgressionId: targetParentProgressionId },
          });
        }

        await tx.userProgressionLevel.deleteMany({ where: { exerciseId: id } });

        await tx.progressionExercise.update({
          where: { id },
          data: { story: markExerciseAsDeleted(pendingExercise.story) },
        });
      });

      return apiSuccess({
        success: true,
        parentExercise: {
          id: parentExercise.id,
          name: parentExercise.name,
        },
      });
    }

    const updated = await updateExerciseStoryById(id, markExerciseAsDeleted(existing.story));

    return apiSuccess({ success: true, exercise: updated });
  } catch (error) {
    console.error("Pending exercise action error:", error);
    return ApiErrors.internal("Failed to process pending exercise action");
  }
});
