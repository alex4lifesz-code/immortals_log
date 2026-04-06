import { apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";
import { getVisibleSocialUserIds, normalizeScope } from "@/lib/friends";

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
        const allUsers = await prisma.user.findMany({ select: { id: true } });
        visibleUserIds = allUsers.map((user) => user.id);
      }
    }

    // Fetch all exercises with ALL users' progress (not just current user)
    const exercises = await prisma.progressionExercise.findMany({
      include: {
        tiers: { orderBy: { level: "asc" } },
        variations: true,
        modifiers: true,
        userProgress: {
          where: {
            userId: {
              in: visibleUserIds,
            },
          },
          include: {
            logs: {
              orderBy: { createdAt: "desc" },
              take: 10, // Limit to 10 most recent logs per user per exercise
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch all users for name mapping
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: visibleUserIds,
        },
      },
      select: {
        id: true,
        name: true,
        username: true,
      },
    });

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
