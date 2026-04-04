import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";
import { canViewUserData } from "@/lib/friends";

function resolveLogLimit(raw: string | null): number {
  if (raw === null || raw === "") return 200;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 200;
  const intParsed = Math.trunc(parsed);
  if (intParsed < 1) return 1;
  if (intParsed > 500) return 500;
  return intParsed;
}

function resolveExerciseLimit(raw: string | null): number {
  if (raw === null || raw === "") return 300;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 300;
  const intParsed = Math.trunc(parsed);
  if (intParsed < 1) return 1;
  if (intParsed > 500) return 500;
  return intParsed;
}

function decodeExerciseCursor(raw: string | null): { createdAt: Date; id: string } | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as { createdAt?: string; id?: string };
    if (!parsed || typeof parsed.id !== "string" || typeof parsed.createdAt !== "string") return null;
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

function encodeExerciseCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id }), "utf8").toString("base64url");
}

// GET /api/progressions/history?logLimit=<n> — fetch history-ready progression exercises with capped logs
export const GET = withAuth(async (request, { auth }) => {
  try {
    const { searchParams } = new URL(request.url);
    const logLimit = resolveLogLimit(searchParams.get("logLimit"));
    const exerciseLimit = resolveExerciseLimit(searchParams.get("exerciseLimit"));
    const exerciseCursor = decodeExerciseCursor(searchParams.get("cursor"));
    const targetUserId = searchParams.get("targetUserId");
    let userId = auth.userId;

    if (targetUserId) {
      const canViewTarget = await canViewUserData({
        viewerId: auth.userId,
        viewerRole: auth.role,
        targetUserId,
      });
      if (!canViewTarget) {
        return NextResponse.json({ error: "Not allowed to view this user's history" }, { status: 403 });
      }
      userId = targetUserId;
    }

    const page = await prisma.progressionExercise.findMany({
      where: exerciseCursor
        ? {
            OR: [
              { createdAt: { lt: exerciseCursor.createdAt } },
              {
                createdAt: exerciseCursor.createdAt,
                id: { lt: exerciseCursor.id },
              },
            ],
          }
        : undefined,
      select: {
        id: true,
        name: true,
        wuxiaName: true,
        difficulty: true,
        wuxiaDifficulty: true,
        type: true,
        wuxiaType: true,
        story: true,
        tips: true,
        category: true,
        equipmentType: true,
        bodyweight: true,
        weighted: true,
        rings: true,
        primaryMuscles: true,
        secondaryMuscles: true,
        assignedDays: true,
        createdAt: true,
        tiers: {
          select: {
            id: true,
            level: true,
            name: true,
            wuxiaName: true,
            difficulty: true,
            wuxiaDifficulty: true,
            wuxiaType: true,
            description: true,
            targetHold: true,
            targetReps: true,
            targetRepsText: true,
          },
          orderBy: { level: "asc" },
        },
        variations: {
          select: {
            id: true,
            name: true,
            wuxiaName: true,
            difficulty: true,
            description: true,
            wuxiaDifficulty: true,
            wuxiaType: true,
          },
        },
        modifiers: {
          select: {
            id: true,
            type: true,
            available: true,
            difficultyMod: true,
            notes: true,
          },
        },
        userProgress: {
          where: { userId },
          select: {
            id: true,
            currentLevel: true,
            logs: {
              select: {
                id: true,
                level: true,
                weight1: true,
                reps1: true,
                weight2: true,
                reps2: true,
                weight3: true,
                reps3: true,
                holdTime: true,
                holdTime2: true,
                holdTime3: true,
                reps: true,
                modifier: true,
                variant: true,
                notes: true,
                completed: true,
                createdAt: true,
              },
              orderBy: { createdAt: "desc" },
              take: logLimit,
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: exerciseLimit + 1,
    });

    const hasMore = page.length > exerciseLimit;
    const exercises = hasMore ? page.slice(0, exerciseLimit) : page;
    const last = exercises[exercises.length - 1];
    const nextCursor = hasMore && last ? encodeExerciseCursor(last.createdAt, last.id) : null;

    return NextResponse.json({ exercises, logLimit, exerciseLimit, nextCursor, userId });
  } catch (error) {
    console.error("Progressions history fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch progression history" }, { status: 500 });
  }
});