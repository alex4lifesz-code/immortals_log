import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildExerciseAnalytics, type AnalyticsLog, type ProgressionTierLite } from "@/lib/exercise-analytics";

function toLower(v: string | null | undefined): string {
  return (v || "").trim().toLowerCase();
}

function parseCsv(raw: string | null | undefined): string[] {
  return (raw || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const exercise = await prisma.exercise.findUnique({ where: { id } });
    if (!exercise) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
    }

    const progression = await prisma.progressionExercise.findFirst({
      where: {
        userId,
        OR: [
          { name: exercise.name },
          ...(exercise.wuxiaName ? [{ wuxiaName: exercise.wuxiaName }] : []),
        ],
      },
      include: {
        tiers: { orderBy: { level: "asc" } },
        userProgress: {
          where: { userId },
          include: {
            logs: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    if (!progression) {
      return NextResponse.json({
        exercise,
        progression: null,
        analytics: buildExerciseAnalytics({
          logs: [],
          tiers: [],
          currentLevel: 1,
        }),
        comparisons: {
          sameMuscle: [],
          similarDifficulty: [],
          trainingAllocation: { thisExercisePct: 0, userAverageSessionsPerExercise: 0 },
          synergyCandidates: [],
        },
      });
    }

    const userProgress = progression.userProgress[0];
    const logs: AnalyticsLog[] = (userProgress?.logs || []).map((log) => ({
      id: log.id,
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
      reps: log.reps,
      modifier: log.modifier,
      variant: log.variant,
      notes: log.notes,
      completed: log.completed,
      createdAt: log.createdAt.toISOString(),
    }));

    const tiers: ProgressionTierLite[] = progression.tiers.map((tier) => ({
      id: tier.id,
      level: tier.level,
      name: tier.name,
      wuxiaName: tier.wuxiaName,
      description: tier.description,
      targetHold: tier.targetHold,
      targetReps: tier.targetReps,
      targetRepsText: tier.targetRepsText,
    }));

    const analytics = buildExerciseAnalytics({
      logs,
      tiers,
      currentLevel: userProgress?.currentLevel || 1,
    });

    const allProgressions = await prisma.progressionExercise.findMany({
      where: { userId },
      include: {
        userProgress: {
          where: { userId },
          include: { logs: true },
        },
      },
    });

    const currentMuscles = new Set(parseCsv(progression.primaryMuscles));
    const thisSessions = analytics.summaries.totalSessions;

    const perExerciseStats = allProgressions.map((ex) => {
      const statLogs = ex.userProgress[0]?.logs || [];
      const totalSessions = statLogs.length;
      const avgLevel = totalSessions > 0
        ? statLogs.reduce((sum, l) => sum + l.level, 0) / totalSessions
        : 0;
      const completionCount = statLogs.filter((l) => l.completed).length;
      return {
        exerciseId: ex.id,
        name: ex.wuxiaName || ex.name,
        category: ex.category,
        difficulty: ex.difficulty || ex.wuxiaDifficulty,
        primaryMuscles: ex.primaryMuscles,
        sessions: totalSessions,
        avgLevel: Number(avgLevel.toFixed(2)),
        completions: completionCount,
      };
    });

    const sameMuscle = perExerciseStats
      .filter((s) => s.exerciseId !== progression.id)
      .filter((s) => parseCsv(s.primaryMuscles).some((m) => currentMuscles.has(m)))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 8);

    const similarDifficulty = perExerciseStats
      .filter((s) => s.exerciseId !== progression.id)
      .filter((s) => toLower(s.difficulty) === toLower(progression.difficulty || progression.wuxiaDifficulty))
      .sort((a, b) => b.avgLevel - a.avgLevel)
      .slice(0, 8);

    const totalSessionsAll = perExerciseStats.reduce((sum, s) => sum + s.sessions, 0);
    const userAverageSessionsPerExercise = perExerciseStats.length > 0 ? totalSessionsAll / perExerciseStats.length : 0;

    const recentLogs = logs.slice(-30);
    const recencyAnchor = recentLogs.length > 0 ? new Date(recentLogs[0].createdAt) : null;

    const synergyCandidates = perExerciseStats
      .filter((s) => s.exerciseId !== progression.id)
      .map((s) => {
        const otherProgression = allProgressions.find((p) => p.id === s.exerciseId);
        const otherLogs = otherProgression?.userProgress[0]?.logs || [];
        if (!recencyAnchor || otherLogs.length === 0) {
          return { exerciseId: s.exerciseId, name: s.name, score: 0 };
        }
        const nearCount = otherLogs.filter((l) => {
          const diff = Math.abs(l.createdAt.getTime() - recencyAnchor.getTime()) / (1000 * 60 * 60 * 24);
          return diff <= 2;
        }).length;
        return {
          exerciseId: s.exerciseId,
          name: s.name,
          score: nearCount,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    return NextResponse.json({
      exercise,
      progression: {
        id: progression.id,
        name: progression.name,
        wuxiaName: progression.wuxiaName,
        category: progression.category,
        equipmentType: progression.equipmentType,
        primaryMuscles: progression.primaryMuscles,
        secondaryMuscles: progression.secondaryMuscles,
        story: progression.story,
        tiers,
        currentLevel: userProgress?.currentLevel || 1,
      },
      analytics,
      comparisons: {
        sameMuscle,
        similarDifficulty,
        trainingAllocation: {
          thisExercisePct: totalSessionsAll > 0 ? Number(((thisSessions / totalSessionsAll) * 100).toFixed(2)) : 0,
          userAverageSessionsPerExercise: Number(userAverageSessionsPerExercise.toFixed(2)),
        },
        synergyCandidates,
      },
    });
  } catch (error) {
    console.error("Exercise analytics fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch exercise analytics" }, { status: 500 });
  }
}
