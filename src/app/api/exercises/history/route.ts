import { apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";
import { canViewUserData } from "@/lib/friends";

function resolveLimit(raw: string | null): number {
  if (raw === null || raw === "") return 50;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 50;
  const intParsed = Math.trunc(parsed);
  if (intParsed < 1) return 1;
  if (intParsed > 200) return 200;
  return intParsed;
}

function decodeCursor(raw: string | null): { createdAt: Date; id: string } | null {
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

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id }), "utf8").toString("base64url");
}

function normalizeExerciseName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function canonicalExerciseName(value: string): string {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";

  const stopwords = new Set([
    "barbell",
    "dumbbell",
    "machine",
    "cable",
    "smith",
    "gym",
    "seated",
    "standing",
    "standard",
    "weighted",
  ]);

  const tokens = normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !stopwords.has(token));

  return tokens.join("");
}

export const GET = withAuth(async (req, { auth }) => {
  try {
    const { searchParams } = new URL(req.url);
    const exerciseId = searchParams.get("exerciseId");
    const limit = resolveLimit(searchParams.get("limit"));
    const cursor = decodeCursor(searchParams.get("cursor"));
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

    if (!exerciseId) {
      return ApiErrors.badRequest("Exercise ID is required");
    }

    const requestedExercise = await prisma.progressionExercise.findUnique({
      where: { id: exerciseId },
      select: { id: true, name: true },
    });

    const exerciseIdsForHistory = new Set<string>([exerciseId]);
    const normalizedRequestedName = normalizeExerciseName(requestedExercise?.name ?? "");
    const canonicalRequestedName = canonicalExerciseName(requestedExercise?.name ?? "");
    if (normalizedRequestedName.length > 0 || canonicalRequestedName.length > 0) {
      const userProgressions = await prisma.userProgressionLevel.findMany({
        where: { userId },
        select: {
          exerciseId: true,
          exercise: {
            select: { name: true },
          },
        },
      });

      for (const progression of userProgressions) {
        const normalizedCandidate = normalizeExerciseName(progression.exercise.name ?? "");
        const canonicalCandidate = canonicalExerciseName(progression.exercise.name ?? "");
        const exactNameMatch =
          normalizedRequestedName.length > 0
          && normalizedCandidate.length > 0
          && normalizedCandidate === normalizedRequestedName;
        const canonicalMatch =
          canonicalRequestedName.length > 0
          && canonicalCandidate.length > 0
          && (
            canonicalCandidate === canonicalRequestedName
            || canonicalCandidate.includes(canonicalRequestedName)
            || canonicalRequestedName.includes(canonicalCandidate)
          );

        if (exactNameMatch || canonicalMatch) {
          exerciseIdsForHistory.add(progression.exerciseId);
        }
      }
    }

    const page = await prisma.progressionLog.findMany({
      where: {
        userProgression: {
          userId,
          exerciseId: { in: [...exerciseIdsForHistory] },
        },
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                {
                  createdAt: cursor.createdAt,
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const hasMore = page.length > limit;
    const logs = hasMore ? page.slice(0, limit) : page;
    const last = logs[logs.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;

    const history = logs.map((log) => ({
      id: log.id,
      date: log.createdAt,
      level: log.level,
      weight1: log.weight1,
      reps1: log.reps1,
      weight2: log.weight2,
      reps2: log.reps2,
      weight3: log.weight3,
      reps3: log.reps3,
      holdTime: log.holdTime,
      modifier: log.modifier,
      variant: log.variant,
      notes: log.notes,
    }));

    return apiSuccess({ history, nextCursor, limit });
  } catch (error) {
    console.error("Exercise history fetch error:", error);
    return ApiErrors.internal("Failed to fetch exercise history");
  }
});
