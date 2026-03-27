import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";
import { getVisibleSocialUserIds, normalizeScope } from "@/lib/friends";

// GET /api/users/public — fetch all users (public info only, no admin required)
// Authenticated users can see all user names for shared features like check-ins
export const GET = withAuth(async (request, { auth }) => {
  try {
    const requestUrl = new URL(request.url);
    const scope = normalizeScope(
      requestUrl.searchParams.get("scope"),
      auth.role === "admin" ? "community" : "friends"
    );
    const visibleUserIds = await getVisibleSocialUserIds({
      viewerId: auth.userId,
      viewerRole: auth.role,
      scope,
    });

    const users = await prisma.user.findMany({
      where: {
        id: {
          in: visibleUserIds,
        },
      },
      select: {
        id: true,
        username: true,
        name: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Public users fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
});
