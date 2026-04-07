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

export const GET = withAuth(async (req, { auth }) => {
  try {
    const { searchParams } = new URL(req.url);
    const exerciseId = searchParams.get("exerciseId");
    const progressionLevelRaw = searchParams.get("progressionLevel");
    const progressionLevel = progressionLevelRaw != null && progressionLevelRaw !== ""
      ? Number.parseInt(progressionLevelRaw, 10)
      : null;
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

    const page = await prisma.progressionLog.findMany({
      where: {
        userProgression: {
          userId,
          exerciseId,
        },
        ...(progressionLevel != null && Number.isFinite(progressionLevel) && progressionLevel > 0
          ? { level: progressionLevel }
          : {}),
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
