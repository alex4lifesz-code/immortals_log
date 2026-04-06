import { apiSuccess, ApiErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { withAuth } from "@/lib/auth/middleware";
import { validatePassword, validateUsername } from "@/lib/validation";
import { CONFIG } from "@/lib/config";
import { generateUniqueImmortalFriendCode } from "@/lib/friend-code";

export const GET = withAuth(async (_request, { auth }) => {
  try {
    // Only admins can list all users
    if (auth.role !== "admin") {
      return ApiErrors.forbidden("Admin access required");
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

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return ApiErrors.conflict("Dao name already taken");
    }

    const hashedPassword = await bcrypt.hash(password, CONFIG.auth.bcryptRounds);
    const friendCode = await generateUniqueImmortalFriendCode();

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        role: "user",
        friendCode,
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return apiSuccess({ user }, undefined, { status: 201 });
  } catch (error) {
    console.error("User create error:", error);
    return ApiErrors.internal("Failed to create user");
  }
});
