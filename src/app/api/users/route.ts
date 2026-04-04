import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { withAuth } from "@/lib/auth/middleware";
import { validatePassword, validateUsername } from "@/lib/validation";
import { CONFIG } from "@/lib/config";

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

export const POST = withAuth(async (request, { auth }) => {
  try {
    if (auth.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 100) : "";

    if (!username || !password || !name) {
      return NextResponse.json(
        { error: "Username, password, and display name are required" },
        { status: 400 }
      );
    }

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      return NextResponse.json(
        { error: usernameValidation.errors.join(". ") },
        { status: 400 }
      );
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.errors.join(". ") },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json(
        { error: "Dao name already taken" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, CONFIG.auth.bcryptRounds);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        role: "user",
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("User create error:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
});
