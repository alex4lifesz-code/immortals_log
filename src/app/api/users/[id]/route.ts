import { apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";
import { archiveUserAndDelete } from "@/lib/user-recycle-bin";

export const PATCH = withAuth(async (req, { auth, params }) => {
  try {
    const id = params.id as string;

    // Users can only update their own profile, unless admin
    if (auth.userId !== id && auth.role !== "admin") {
      return ApiErrors.forbidden("You can only update your own profile");
    }

    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return ApiErrors.badRequest("A valid display name is required");
    }

    const trimmedName = name.trim().slice(0, 100);

    const user = await prisma.user.update({
      where: { id },
      data: { name: trimmedName },
      select: { id: true, username: true, name: true },
    });

    return apiSuccess({ user });
  } catch (error) {
    console.error("User update error:", error);
    return ApiErrors.internal("Failed to update user");
  }
});

export const DELETE = withAuth(async (_req, { auth, params }) => {
  try {
    const id = params.id as string;

    // Only admin can delete users
    if (auth.role !== "admin") {
      return ApiErrors.forbidden("Admin access required");
    }

    // Admin cannot delete themselves
    if (auth.userId === id) {
      return ApiErrors.forbidden("Cannot delete your own account");
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return ApiErrors.notFound("User not found");
    }

    const archivedUser = await archiveUserAndDelete(id, auth.userId);

    return apiSuccess({
      success: true,
      archivedUser,
      message: `${targetUser.name} was moved to the recycle bin.`,
    });
  } catch (error) {
    console.error("User delete error:", error);
    return ApiErrors.internal("Failed to delete user");
  }
});
