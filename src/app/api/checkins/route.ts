import { prisma } from "@/lib/prisma";
import { withAuth, withAdmin } from "@/lib/auth/middleware";
import { getAcceptedFriendIds, getVisibleSocialUserIds, normalizeScope } from "@/lib/friends";
import { apiSuccess, ApiErrors } from "@/lib/api";

export const GET = withAuth(async (request, { auth }) => {
  try {
    const requestUrl = new URL(request.url);
    const scope = normalizeScope(
      requestUrl.searchParams.get("scope"),
      auth.role === "admin" ? "community" : "friends"
    );
    let visibleUserIds = [auth.userId];
    try {
      visibleUserIds = await getVisibleSocialUserIds({
        viewerId: auth.userId,
        viewerRole: auth.role,
        scope,
      });
    } catch (visibilityError) {
      console.error("CheckIn visibility resolution error:", visibilityError);
      if (auth.role === "admin") {
        const users = await prisma.user.findMany({ select: { id: true } });
        visibleUserIds = users.map((user) => user.id);
      }
    }

    const checkins = await prisma.checkIn.findMany({
      where: {
        userId: {
          in: visibleUserIds,
        },
      },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
    });

    if (auth.role === "admin") {
      return apiSuccess({ checkins });
    }

    let friendIds: string[] = [];
    try {
      friendIds = await getAcceptedFriendIds(auth.userId);
    } catch (friendError) {
      console.error("CheckIn friend lookup error:", friendError);
    }
    const friendSet = new Set(friendIds);

    const safeCheckins = checkins.map((checkin) => {
      if (checkin.userId === auth.userId || friendSet.has(checkin.userId)) {
        return checkin;
      }
      return { ...checkin, comment: null };
    });

    return apiSuccess({ checkins: safeCheckins });
  } catch (error) {
    console.error("CheckIn fetch error:", error);
    return ApiErrors.internal("Failed to fetch check-ins");
  }
});

export const POST = withAuth(async (request, { auth }) => {
  try {
    const { date, entries } = await request.json();

    if (!date || !entries || typeof entries !== "object" || Array.isArray(entries)) {
      return ApiErrors.badRequest("Date and entries object are required");
    }

    // Validate date format
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(date)) {
      return ApiErrors.badRequest("Invalid date format");
    }

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return ApiErrors.badRequest("Invalid date");
    }

    // Non-admin users can only modify their own entries
    if (auth.role !== "admin") {
      const entryUserIds = Object.keys(entries);
      const unauthorisedIds = entryUserIds.filter(id => id !== auth.userId);
      if (unauthorisedIds.length > 0) {
        return ApiErrors.forbidden("You can only modify your own check-in entries");
      }
    }

    // Upsert each entry with validation
    const operations = Object.entries(entries as Record<string, { present?: boolean; weight?: number; comment?: string }>).map(
      ([userId, data]) => {
        const weight = data.weight ? parseFloat(String(data.weight)) : null;
        const comment = data.comment ? String(data.comment).slice(0, 500) : null;
        return prisma.checkIn.upsert({
          where: {
            date_userId: { date: dateObj, userId },
          },
          create: {
            date: dateObj,
            userId,
            present: data.present || false,
            weight: weight !== null && !isNaN(weight) && weight >= 0 && weight <= 1000 ? weight : null,
            comment,
          },
          update: {
            present: data.present || false,
            weight: weight !== null && !isNaN(weight) && weight >= 0 && weight <= 1000 ? weight : null,
            comment,
          },
        });
      }
    );

    await Promise.all(operations);
    return apiSuccess({ saved: true });
  } catch (error) {
    console.error("CheckIn save error:", error);
    return ApiErrors.internal("Failed to save check-ins");
  }
});

export const DELETE = withAdmin(async (request) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { date } = body as { date?: string };

    if (date) {
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return ApiErrors.badRequest("Invalid date format");
      }
      const dateObj = new Date(date + "T00:00:00.000Z");
      if (isNaN(dateObj.getTime())) {
        return ApiErrors.badRequest("Invalid date");
      }
      // Also delete notes for this date
      await prisma.checkInNote.deleteMany({ where: { date } });
      const result = await prisma.checkIn.deleteMany({ where: { date: dateObj } });
      return apiSuccess({
        message: `Removed ${result.count} check-in record(s) for ${date}`,
        count: result.count,
      });
    }

    const result = await prisma.checkIn.deleteMany({});
    return apiSuccess({
      message: `Removed ${result.count} check-in record(s)`,
      count: result.count,
    });
  } catch (error) {
    console.error("CheckIn delete error:", error);
    return ApiErrors.internal("Failed to remove check-in records");
  }
});
