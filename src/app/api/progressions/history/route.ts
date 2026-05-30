import { apiSuccess, ApiErrors } from "@/lib/api";
import { withAuth } from "@/lib/auth/middleware";
import { canViewUserData } from "@/lib/friends";
import { ensureAppExerciseLibraryOwner } from "@/lib/exercise-library-owner";
import { getProgressionHistoryPage } from "@/lib/repositories/progression.repository";

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
  if (raw === null || raw === "") return 5000;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 5000;
  const intParsed = Math.trunc(parsed);
  if (intParsed < 1) return 1;
  if (intParsed > 5000) return 5000;
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
    const requestedExerciseId = (searchParams.get("exerciseId") || "").trim();
    const targetUserId = searchParams.get("targetUserId");
    const libraryOwnerId = await ensureAppExerciseLibraryOwner();
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

    const visibilityWhere = {
      OR: [
        { userId: libraryOwnerId },
        { userId },
        { userProgress: { some: { userId } } },
      ],
    };

    const whereClause = requestedExerciseId
      ? {
          AND: [
            visibilityWhere,
            { id: requestedExerciseId },
          ],
        }
      : exerciseCursor
        ? {
            AND: [
              visibilityWhere,
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
        : visibilityWhere;

    const page = await getProgressionHistoryPage({
      where: whereClause,
      userId,
      logLimit,
      take: requestedExerciseId ? 1 : exerciseLimit + 1,
    });

    const hasMore = !requestedExerciseId && page.length > exerciseLimit;
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