import { prisma } from "@/lib/prisma";
import { withAuth, withAdmin } from "@/lib/auth/middleware";
import { getAcceptedFriendIds, getVisibleSocialUserIds, normalizeScope } from "@/lib/friends";
import { apiSuccess, ApiErrors } from "@/lib/api";
import { buildAutoCheckInDates, mergeCheckinsWithWorkoutDates } from "@/lib/checkins-autoPresence";

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

    const [checkins, workoutLogs] = await Promise.all([
      prisma.checkIn.findMany({
        where: {
          userId: {
            in: visibleUserIds,
          },
        },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { date: "desc" },
      }),
      prisma.progressionLog.findMany({
        where: {
          userProgression: {
            userId: {
              in: visibleUserIds,
            },
          },
        },
        select: {
          createdAt: true,
          userProgression: {
            select: {
              userId: true,
            },
          },
        },
      }),
    ]);

    const workoutDatesByUser = buildAutoCheckInDates(
      workoutLogs.map((log) => ({
        userId: log.userProgression.userId,
        createdAt: log.createdAt,
      }))
    );

    const mergedCheckins = mergeCheckinsWithWorkoutDates({ checkins, workoutDatesByUser });

    if (auth.role === "admin") {
      return apiSuccess({ checkins: mergedCheckins });
    }

    let friendIds: string[] = [];
    try {
      friendIds = await getAcceptedFriendIds(auth.userId);
    } catch (friendError) {
      console.error("CheckIn friend lookup error:", friendError);
    }
    const friendSet = new Set(friendIds);

    const safeCheckins = mergedCheckins.map((checkin) => {
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
    const operations = Object.entries(entries as Record<string, { present?: boolean; weight?: number | string | null; comment?: string | null }>).map(
      ([userId, data]) => {
        const parsedWeight =
          data.weight === undefined || data.weight === null || String(data.weight).trim() === ""
            ? null
            : parseFloat(String(data.weight));
        const weight = parsedWeight !== null && !Number.isNaN(parsedWeight) && parsedWeight >= 0 && parsedWeight <= 1000
          ? parsedWeight
          : null;
        const comment = data.comment == null ? null : String(data.comment).slice(0, 500);
        const presentUpdate = typeof data.present === "boolean" ? { present: data.present } : {};

        return prisma.checkIn.upsert({
          where: {
            date_userId: { date: dateObj, userId },
          },
          create: {
            date: dateObj,
            userId,
            present: typeof data.present === "boolean" ? data.present : false,
            weight,
            comment,
          },
          update: {
            ...presentUpdate,
            weight,
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
