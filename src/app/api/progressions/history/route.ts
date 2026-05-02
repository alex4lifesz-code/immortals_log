import { apiSuccess, ApiErrors } from "@/lib/api";
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

function extractDynamicSetRows(notes: string | null | undefined): { cleanedNotes: string | null; dynamicSetRows: Array<{ weight: string; reps: string }> } {
  const rawNotes = typeof notes === "string" ? notes.trim() : "";
  if (!rawNotes) {
    return { cleanedNotes: null, dynamicSetRows: [] };
  }

  const summaryMatch = rawNotes.match(/(?:^|\n\n?)(?:Extra sets:|Session sets:)\s*([\s\S]+)$/i);
  if (!summaryMatch) {
    return { cleanedNotes: rawNotes, dynamicSetRows: [] };
  }

  const dynamicSetRows = summaryMatch[1]
    .split(/\s+\|\s+/)
    .map((segment) => {
      const match = segment.trim().match(/^Set\s+\d+:\s*(.*?)\s*\/\s*(.*?)$/i);
      if (!match) return null;
      return {
        weight: match[1]?.trim() || "-",
        reps: (match[2] || "-").replace(/\s*reps?$/i, "").trim() || "-",
      };
    })
    .filter((row): row is { weight: string; reps: string } => Boolean(row));

  const cleanedNotes = rawNotes.replace(/(?:\n\n?)(?:Extra sets:|Session sets:)\s*[\s\S]+$/i, "").trim();
  return {
    cleanedNotes: cleanedNotes || null,
    dynamicSetRows,
  };
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
        return ApiErrors.forbidden("Not allowed to view this user's history");
      }
      userId = targetUserId;
    }

    const page = await prisma.progressionExercise.findMany({
      where: exerciseCursor
        ? {
            AND: [
              {
                OR: [
                  { userId },
                  { userProgress: { some: { userId } } },
                ],
              },
              {
                OR: [
                  { createdAt: { lt: exerciseCursor.createdAt } },
                  {
                    createdAt: exerciseCursor.createdAt,
                    id: { lt: exerciseCursor.id },
                  },
                ],
              },
            ],
          }
        : {
            OR: [
              { userId },
              { userProgress: { some: { userId } } },
            ],
          },
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
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: logLimit,
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: exerciseLimit + 1,
    });

    const hasMore = page.length > exerciseLimit;
    const exercises = (hasMore ? page.slice(0, exerciseLimit) : page).map((exercise) => ({
      ...exercise,
      userProgress: exercise.userProgress.map((progress) => ({
        ...progress,
        logs: progress.logs.map((log) => {
          const { cleanedNotes, dynamicSetRows } = extractDynamicSetRows(log.notes);
          return {
            ...log,
            notes: cleanedNotes,
            dynamicSetRows,
          };
        }),
      })),
    }));
    const last = exercises[exercises.length - 1];
    const nextCursor = hasMore && last ? encodeExerciseCursor(last.createdAt, last.id) : null;

    return apiSuccess({ exercises, logLimit, exerciseLimit, nextCursor, userId });
  } catch (error) {
    console.error("Progressions history fetch error:", error);
    return ApiErrors.internal("Failed to fetch progression history");
  }
});