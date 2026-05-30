import { apiSuccess, ApiErrors } from "@/lib/api";
import bcrypt from "bcryptjs";
import { withAuth } from "@/lib/auth/middleware";
import { validatePassword, validateUsername } from "@/lib/validation";
import { CONFIG } from "@/lib/config";
import { generateUniqueImmortalFriendCode } from "@/lib/friend-code";
import {
  createUser,
  findUserByUsername,
  getUsersWithProgressionCounts,
} from "@/lib/repositories/user.repository";

function parseJsonObject(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export const GET = withAuth(async (_request, { auth }) => {
  try {
    // Only admins can list all users
    if (auth.role !== "admin") {
      return ApiErrors.forbidden("Admin access required");
    }

    const { users, progressionLevels } = await getUsersWithProgressionCounts();

    const progressionLogCounts = new Map<string, number>();
    for (const level of progressionLevels) {
      progressionLogCounts.set(
        level.userId,
        (progressionLogCounts.get(level.userId) ?? 0) + level._count.logs
      );
    }

    const enrichedUsers = users.map((user) => {
      const progressionLogCount = progressionLogCounts.get(user.id) ?? 0;
      const appPrefs = parseJsonObject(user.settings?.pinnedNavItems);
      const activityLog = Array.isArray(appPrefs?.activityLog)
        ? appPrefs.activityLog.filter((entry): entry is { at: string; label: string; route: string } => {
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
            return typeof entry.at === "string" && typeof entry.label === "string" && typeof entry.route === "string";
          }).slice(0, 40)
        : [];
      const { settings, ...restUser } = user;

      return {
        ...restUser,
        progressionLogCount,
        sessionCount: progressionLogCount,
        lastActivityAt: typeof appPrefs?.lastActivityAt === "string" ? appPrefs.lastActivityAt : null,
        lastActivityLabel: typeof appPrefs?.lastActivityLabel === "string" ? appPrefs.lastActivityLabel : null,
        activityLog,
      };
    });

    return apiSuccess({ users: enrichedUsers });
  } catch (error) {
    console.error("Users fetch error:", error);
    return ApiErrors.internal("Failed to fetch users");
  }
});

export const POST = withAuth(async (request, { auth }) => {
  try {
    if (auth.role !== "admin") {
      return ApiErrors.forbidden("Admin access required");
    }

    const body = await request.json();
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 100) : "";

    if (!username || !password || !name) {
      return ApiErrors.badRequest("Username, password, and display name are required");
    }

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      return ApiErrors.validationError(usernameValidation.errors.join(". "));
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return ApiErrors.validationError(passwordValidation.errors.join(". "));
    }

    const existing = await findUserByUsername(username);
    if (existing) {
      return ApiErrors.conflict("Dao name already taken");
    }

    const hashedPassword = await bcrypt.hash(password, CONFIG.auth.bcryptRounds);
    const friendCode = await generateUniqueImmortalFriendCode();

    const user = await createUser({
      username,
      password: hashedPassword,
      name,
      role: "user",
      friendCode,
    });

    return apiSuccess({ user }, undefined, { status: 201 });
  } catch (error) {
    console.error("User create error:", error);
    return ApiErrors.internal("Failed to create user");
  }
});
