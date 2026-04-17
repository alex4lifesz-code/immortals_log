import { NextResponse } from "next/server";
import { ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/auth/middleware";

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export const GET = withAdmin(async (request, { auth }) => {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("targetUserId") || auth.userId;

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        settings: true,
        profile: true,
      },
    });

    if (!user) {
      return ApiErrors.notFound("Target user not found");
    }

    const [checkins, checkInNotes, exercises, logs] = await Promise.all([
      prisma.checkIn.findMany({
        where: { userId: targetUserId },
        orderBy: { date: "asc" },
      }),
      prisma.checkInNote.findMany({
        where: { userId: targetUserId },
        orderBy: { date: "asc" },
      }),
      prisma.progressionExercise.findMany({
        where: {
          userProgress: {
            some: { userId: targetUserId },
          },
        },
        include: {
          tiers: { orderBy: { level: "asc" } },
          variations: true,
          modifiers: true,
          userProgress: {
            where: { userId: targetUserId },
            select: { currentLevel: true },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.progressionLog.findMany({
        where: {
          userProgression: {
            userId: targetUserId,
          },
        },
        include: {
          userProgression: {
            include: {
              exercise: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const payload = {
      version: 2,
      packageType: "backup-studio",
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        onboardingCompleted: user.onboardingCompleted,
        onboardingSkipped: user.onboardingSkipped,
        onboardingStep: user.onboardingStep,
        createdAt: toIsoString(user.createdAt),
      },
      settings: user.settings
        ? {
            dualPageView: user.settings.dualPageView,
            pinnedNavItems: user.settings.pinnedNavItems,
            hiddenNavItems: user.settings.hiddenNavItems,
            panelPosition: user.settings.panelPosition,
            combinedView: user.settings.combinedView,
          }
        : null,
      profile: user.profile
        ? {
            fitnessBackground: user.profile.fitnessBackground,
            primaryGoal: user.profile.primaryGoal,
            trainingDaysPerWeek: user.profile.trainingDaysPerWeek,
            assessmentAnswers: user.profile.assessmentAnswers,
            recommendedTier: user.profile.recommendedTier,
            currentTier: user.profile.currentTier,
            publicProfile: user.profile.publicProfile,
            displayName: user.profile.displayName,
            gettingStartedDismissed: user.profile.gettingStartedDismissed,
            gettingStartedTasks: user.profile.gettingStartedTasks,
          }
        : null,
      checkins: checkins.map((entry) => ({
        date: toIsoString(entry.date),
        weight: entry.weight,
        comment: entry.comment,
        present: entry.present,
        createdAt: toIsoString(entry.createdAt),
      })),
      checkInNotes: checkInNotes.map((entry) => ({
        date: entry.date,
        content: entry.content,
        pinned: entry.pinned,
        createdAt: toIsoString(entry.createdAt),
        updatedAt: toIsoString(entry.updatedAt),
      })),
      exerciseLibrary: exercises.map((exercise) => ({
        sourceExerciseId: exercise.id,
        name: exercise.name,
        wuxiaName: exercise.wuxiaName,
        difficulty: exercise.difficulty,
        wuxiaDifficulty: exercise.wuxiaDifficulty,
        type: exercise.type,
        wuxiaType: exercise.wuxiaType,
        story: exercise.story,
        category: exercise.category,
        equipmentType: exercise.equipmentType,
        bodyweight: exercise.bodyweight,
        weighted: exercise.weighted,
        rings: exercise.rings,
        primaryMuscles: exercise.primaryMuscles,
        secondaryMuscles: exercise.secondaryMuscles,
        tips: exercise.tips,
        prerequisites: exercise.prerequisites,
        cues: exercise.cues,
        commonMistakes: exercise.commonMistakes,
        breathing: exercise.breathing,
        safetyConsiderations: exercise.safetyConsiderations,
        competitionStandards: exercise.competitionStandards,
        progression: (() => {
          try {
            const parsed = JSON.parse(exercise.progression || "[]");
            if (Array.isArray(parsed)) {
              return parsed.map((value) => String(value || "").trim()).filter(Boolean);
            }
          } catch {
            // Fall back to tiers below.
          }
          return exercise.tiers.map((tier) => tier.name).filter(Boolean);
        })(),
        assignedDays: exercise.assignedDays,
        currentLevel: exercise.userProgress[0]?.currentLevel ?? 1,
        tiers: exercise.tiers.map((tier) => ({
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
        })),
        variations: exercise.variations.map((variation) => ({
          name: variation.name,
          wuxiaName: variation.wuxiaName,
          difficulty: variation.difficulty,
          wuxiaDifficulty: variation.wuxiaDifficulty,
          wuxiaType: variation.wuxiaType,
          description: variation.description,
        })),
        modifiers: exercise.modifiers.map((modifier) => ({
          type: modifier.type,
          available: modifier.available,
          difficultyMod: modifier.difficultyMod,
          notes: modifier.notes,
          method: modifier.method,
          difficultyIncrease: modifier.difficultyIncrease,
        })),
      })),
      trainingLogs: logs.map((log) => ({
        exerciseId: log.userProgression.exercise.id,
        exerciseName: log.userProgression.exercise.name,
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
        completed: log.completed,
        createdAt: toIsoString(log.createdAt),
      })),
    };

    const slug = user.username.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "user";
    const fileName = `backup-studio-${slug}-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "X-Backup-Exercises": String(payload.exerciseLibrary.length),
        "X-Backup-Training-Logs": String(payload.trainingLogs.length),
        "X-Backup-Checkins": String(payload.checkins.length),
        "X-Backup-Notes": String(payload.checkInNotes.length),
      },
    });
  } catch (error) {
    console.error("Backup Studio export error:", error);
    return ApiErrors.internal("Failed to export backup package");
  }
});
