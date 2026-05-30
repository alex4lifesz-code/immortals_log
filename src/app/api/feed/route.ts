import { apiSuccess, ApiErrors } from "@/lib/api";
import { withAuth } from "@/lib/auth/middleware";
import { getVisibleSocialUserIds, normalizeScope } from "@/lib/friends";
import {
  getAllUserIdsForFeed,
  getFeedExercisesForUsers,
  getFeedUsersByIds,
} from "@/lib/repositories/feed.repository";

// GET /api/feed — fetch recent activity from all users except current user
// Returns all users' recent progression logs for community newsfeed
export const GET = withAuth(async (_request, { auth }) => {
  try {
    const requestUrl = new URL(_request.url);
    const scope = normalizeScope(requestUrl.searchParams.get("scope"));
    let visibleUserIds = [auth.userId];
    try {
      visibleUserIds = await getVisibleSocialUserIds({
        viewerId: auth.userId,
        viewerRole: auth.role,
        scope,
      });
    } catch (visibilityError) {
      console.error("Feed visibility resolution error:", visibilityError);
      if (auth.role === "admin") {
        visibleUserIds = await getAllUserIdsForFeed();
      }
    }

    const exercises = await getFeedExercisesForUsers(visibleUserIds);

    const users = await getFeedUsersByIds(visibleUserIds);

    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    // Inject user data into userProgress
    const enrichedExercises = exercises.map(ex => ({
      ...ex,
      userProgress: (ex.userProgress || []).map(up => ({
        ...up,
        user: userMap[up.userId],
      })),
    }));

    return apiSuccess({ exercises: enrichedExercises });
  } catch (error) {
    console.error("Feed fetch error:", error);
    return ApiErrors.internal("Failed to fetch feed");
  }
});
