import { withAuth, withAdmin } from "@/lib/auth/middleware";
import { getAcceptedFriendIds, getVisibleSocialUserIds, normalizeScope } from "@/lib/friends";
import { apiSuccess, ApiErrors } from "@/lib/api";
import { buildDateFromDateKey } from "@/lib/constants";
import { buildAutoCheckInDates, mergeCheckinsWithWorkoutDates } from "@/lib/checkins-autoPresence";
import {
  deleteAllCheckins,
  deleteCheckinNotesByDate,
  deleteCheckinsByDate,
  getAllUserIdsForCheckins,
  getCheckinsAndWorkoutLogsForUsers,
  upsertCheckinsByDate,
} from "@/lib/repositories/checkin.repository";

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
        visibleUserIds = await getAllUserIdsForCheckins();
      }
    }

    const { checkins, workoutLogs } = await getCheckinsAndWorkoutLogsForUsers(visibleUserIds);

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

    const dateObj = buildDateFromDateKey(date);
    if (!dateObj || isNaN(dateObj.getTime())) {
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

    await upsertCheckinsByDate({
      date: dateObj,
      entries: entries as Record<string, { present?: boolean; weight?: number | string | null; comment?: string | null }>,
    });
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
      const dateObj = buildDateFromDateKey(date);
      if (!dateObj || isNaN(dateObj.getTime())) {
        return ApiErrors.badRequest("Invalid date");
      }
      // Also delete notes for this date
      await deleteCheckinNotesByDate(date);
      const result = await deleteCheckinsByDate(dateObj);
      return apiSuccess({
        message: `Removed ${result.count} check-in record(s) for ${date}`,
        count: result.count,
      });
    }

    const result = await deleteAllCheckins();
    return apiSuccess({
      message: `Removed ${result.count} check-in record(s)`,
      count: result.count,
    });
  } catch (error) {
    console.error("CheckIn delete error:", error);
    return ApiErrors.internal("Failed to remove check-in records");
  }
});
