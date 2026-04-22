import { apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";
import { archiveUserAndDelete } from "@/lib/user-recycle-bin";
import { validatePassword } from "@/lib/validation";
import { CONFIG } from "@/lib/config";
import bcrypt from "bcryptjs";

export const PATCH = withAuth(async (req, { auth, params }) => {
  try {
    const id = params.id as string;

    const body = await req.json();
    const { name, password, role } = body ?? {};

    const isPasswordChange = typeof password === "string" && password.length > 0;
    const isNameChange = typeof name === "string" && name.trim().length > 0;
    const isRoleChange = typeof role === "string" && role.length > 0;

    if (!isPasswordChange && !isNameChange && !isRoleChange) {
      return ApiErrors.badRequest("Provide a display name, password, or role to update");
    }

    // Password updates can only be performed by admins
    if (isPasswordChange && auth.role !== "admin") {
      return ApiErrors.forbidden("Admin access required to change passwords");
    }

    // Role updates can only be performed by admins
    if (isRoleChange && auth.role !== "admin") {
      return ApiErrors.forbidden("Admin access required to change account type");
    }

    // Admins cannot demote themselves
    if (isRoleChange && auth.userId === id && role !== "admin") {
      return ApiErrors.forbidden("Admins cannot remove their own admin privileges");
    }

    // Display name updates: users can update their own; admins can update anyone
    if (isNameChange && auth.userId !== id && auth.role !== "admin") {
      return ApiErrors.forbidden("You can only update your own profile");
    }

    const normalizedRole = isRoleChange ? role.trim().toLowerCase() : null;
    if (isRoleChange && normalizedRole !== "admin" && normalizedRole !== "user") {
      return ApiErrors.badRequest("Role must be 'admin' or 'user'");
    }

    const targetUser = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!targetUser) {
      return ApiErrors.notFound("User not found");
    }

    // System accounts (e.g. Application Exercise Library owner) cannot be modified via this endpoint
    if (targetUser.role === "system") {
      return ApiErrors.forbidden("System accounts cannot be modified");
    }

    // Prevent demoting the last remaining admin
    if (isRoleChange && targetUser.role === "admin" && normalizedRole !== "admin") {
      const adminCount = await prisma.user.count({ where: { role: "admin" } });
      if (adminCount <= 1) {
        return ApiErrors.badRequest("Cannot demote the last remaining admin");
      }
    }

    const data: { name?: string; password?: string; role?: string } = {};

    if (isNameChange) {
      data.name = name.trim().slice(0, 100);
    }

    if (isPasswordChange) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return ApiErrors.validationError(passwordValidation.errors.join(". "));
      }
      data.password = await bcrypt.hash(password, CONFIG.auth.bcryptRounds);
    }

    if (isRoleChange && normalizedRole) {
      data.role = normalizedRole;
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, username: true, name: true, role: true },
    });

    return apiSuccess({ user, passwordChanged: isPasswordChange });
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
