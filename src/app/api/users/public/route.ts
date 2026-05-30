import { apiSuccess, ApiErrors } from "@/lib/api";
import { withAuth } from "@/lib/auth/middleware";
import { getVisibleSocialUserIds, normalizeScope } from "@/lib/friends";
import { findUsersPublicByIds } from "@/lib/repositories/user.repository";

// GET /api/users/public — fetch visible users (public info only)
// Non-admin users are restricted to friends scope; admins can request community scope.
export const GET = withAuth(async (request, { auth }) => {
  try {
    const requestUrl = new URL(request.url);
    const requestedScope = normalizeScope(
      requestUrl.searchParams.get("scope"),
      auth.role === "admin" ? "community" : "friends"
    );
    const scope = auth.role === "admin" ? requestedScope : "friends";
    const visibleUserIds = await getVisibleSocialUserIds({
      viewerId: auth.userId,
      viewerRole: auth.role,
      scope,
    });

    const usersRaw = await findUsersPublicByIds(visibleUserIds);

    const users = usersRaw.map((u) => {
      let cultivatorColor: string | undefined;
      try {
        const parsed = u.settings?.pinnedNavItems ? JSON.parse(u.settings.pinnedNavItems) : null;
        if (parsed && typeof parsed === "object" && typeof (parsed as { cultivatorColor?: unknown }).cultivatorColor === "string") {
          cultivatorColor = (parsed as { cultivatorColor: string }).cultivatorColor;
        }
      } catch {
        // Ignore malformed preference payloads
      }

      return {
        id: u.id,
        username: u.username,
        name: u.name,
        createdAt: u.createdAt,
        cultivatorColor,
      };
    });

    return apiSuccess({ users });
  } catch (error) {
    console.error("Public users fetch error:", error);
    return ApiErrors.internal("Failed to fetch users");
  }
});
