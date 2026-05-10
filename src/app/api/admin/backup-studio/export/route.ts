import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { ApiErrors } from "@/lib/api";
import { normalizeDateOnlyKey } from "@/lib/constants";
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
    const format = (searchParams.get("format") || "json").toLowerCase();

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
        date: normalizeDateOnlyKey(entry.date),
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
        setupOption: log.setupOption,
        notes: log.notes,
        completed: log.completed,
        createdAt: toIsoString(log.createdAt),
      })),
    };

    const slug = user.username.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "user";
    const baseName = `backup-studio-${slug}-${new Date().toISOString().slice(0, 10)}`;

    if (format === "xlsx") {
      const workbook = XLSX.utils.book_new();

      const summaryRows = [
        { metric: "Target user", value: user.name || user.username },
        { metric: "Username", value: user.username },
        { metric: "Exported at", value: payload.exportedAt },
        { metric: "Exercise count", value: payload.exerciseLibrary.length },
        { metric: "Training log count", value: payload.trainingLogs.length },
        { metric: "Check-in count", value: payload.checkins.length },
        { metric: "Check-in notes count", value: payload.checkInNotes.length },
      ];

      const userRows = [
        {
          id: payload.user.id,
          username: payload.user.username,
          name: payload.user.name,
          onboardingCompleted: payload.user.onboardingCompleted,
          onboardingSkipped: payload.user.onboardingSkipped,
          onboardingStep: payload.user.onboardingStep,
          createdAt: payload.user.createdAt,
        },
      ];

      const settingsRows = payload.settings
        ? [
            {
              dualPageView: payload.settings.dualPageView,
              panelPosition: payload.settings.panelPosition,
              combinedView: payload.settings.combinedView,
              pinnedNavItems: JSON.stringify(payload.settings.pinnedNavItems ?? []),
              hiddenNavItems: JSON.stringify(payload.settings.hiddenNavItems ?? []),
            },
          ]
        : [];

      const profileRows = payload.profile
        ? [
            {
              fitnessBackground: payload.profile.fitnessBackground,
              primaryGoal: payload.profile.primaryGoal,
              trainingDaysPerWeek: payload.profile.trainingDaysPerWeek,
              recommendedTier: payload.profile.recommendedTier,
              currentTier: payload.profile.currentTier,
              publicProfile: payload.profile.publicProfile,
              displayName: payload.profile.displayName,
              gettingStartedDismissed: payload.profile.gettingStartedDismissed,
              gettingStartedTasks: JSON.stringify(payload.profile.gettingStartedTasks ?? []),
              assessmentAnswers: JSON.stringify(payload.profile.assessmentAnswers ?? {}),
            },
          ]
        : [];

      const checkinRows = payload.checkins.map((entry) => ({
        date: entry.date,
        weight: entry.weight,
        present: entry.present,
        comment: entry.comment,
        createdAt: entry.createdAt,
      }));

      const noteRows = payload.checkInNotes.map((entry) => ({
        date: entry.date,
        pinned: entry.pinned,
        content: entry.content,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      }));

      const exerciseRows = payload.exerciseLibrary.map((entry) => ({
        sourceExerciseId: entry.sourceExerciseId,
        name: entry.name,
        category: entry.category,
        type: entry.type,
        equipmentType: entry.equipmentType,
        bodyweight: entry.bodyweight,
        weighted: entry.weighted,
        rings: entry.rings,
        primaryMuscles: entry.primaryMuscles,
        secondaryMuscles: entry.secondaryMuscles,
        progression: JSON.stringify(entry.progression ?? []),
        currentLevel: entry.currentLevel,
        tierCount: entry.tiers?.length ?? 0,
        variationCount: entry.variations?.length ?? 0,
        modifierCount: entry.modifiers?.length ?? 0,
      }));

      const trainingLogRows = payload.trainingLogs.map((entry) => ({
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName,
        level: entry.level,
        completed: entry.completed,
        variant: entry.variant,
        setupOption: entry.setupOption,
        modifier: entry.modifier,
        notes: entry.notes,
        weight1: entry.weight1,
        reps1: entry.reps1,
        weight2: entry.weight2,
        reps2: entry.reps2,
        weight3: entry.weight3,
        reps3: entry.reps3,
        holdTime: entry.holdTime,
        holdTime2: entry.holdTime2,
        holdTime3: entry.holdTime3,
        createdAt: entry.createdAt,
      }));

      const appendSheet = (sheetName: string, rows: Array<Record<string, unknown>>) => {
        const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ empty: "" }]);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      };

      appendSheet("Summary", summaryRows);
      appendSheet("User", userRows);
      appendSheet("Settings", settingsRows);
      appendSheet("Profile", profileRows);
      appendSheet("CheckIns", checkinRows);
      appendSheet("CheckInNotes", noteRows);
      appendSheet("ExerciseLibrary", exerciseRows);
      appendSheet("TrainingLogs", trainingLogRows);

      const xlsxBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

      return new NextResponse(xlsxBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
          "X-Backup-Exercises": String(payload.exerciseLibrary.length),
          "X-Backup-Training-Logs": String(payload.trainingLogs.length),
          "X-Backup-Checkins": String(payload.checkins.length),
          "X-Backup-Notes": String(payload.checkInNotes.length),
        },
      });
    }

    const fileName = `${baseName}.json`;

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
