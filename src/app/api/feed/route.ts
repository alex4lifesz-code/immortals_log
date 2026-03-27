import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";

// GET /api/feed — fetch recent activity from all users except current user
// Returns all users' recent progression logs for community newsfeed
export const GET = withAuth(async (_request, { auth }) => {
  try {
    // Fetch all exercises with ALL users' progress (not just current user)
    const exercises = await prisma.progressionExercise.findMany({
      include: {
        tiers: { orderBy: { level: "asc" } },
        variations: true,
        modifiers: true,
        userProgress: {
          // Get progress from all users
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

    return NextResponse.json({ exercises: enrichedExercises });
  } catch (error) {
    console.error("Feed fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch feed" }, { status: 500 });
  }
});
