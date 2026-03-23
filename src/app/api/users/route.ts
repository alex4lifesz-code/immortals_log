import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";

export const GET = withAuth(async (_request, { auth }) => {
  try {
    // Only admins can list all users
    if (auth.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const [users, progressionLevels] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          username: true,
          name: true,
          createdAt: true,
          _count: {
            select: {
              checkIns: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.userProgressionLevel.findMany({
        select: {
          userId: true,
          _count: {
            select: {
              logs: true,
            },
          },
        },
      }),
    ]);

    const progressionLogCounts = new Map<string, number>();
    for (const level of progressionLevels) {
      progressionLogCounts.set(
        level.userId,
        (progressionLogCounts.get(level.userId) ?? 0) + level._count.logs
      );
    }

    const enrichedUsers = users.map((user) => {
      const progressionLogCount = progressionLogCounts.get(user.id) ?? 0;

      return {
        ...user,
        progressionLogCount,
        sessionCount: progressionLogCount,
      };
    });

    return NextResponse.json({ users: enrichedUsers });
  } catch (error) {
    console.error("Users fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
});
