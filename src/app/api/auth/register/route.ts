import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createToken, setAuthCookie } from "@/lib/auth";
import { registerLimiter } from "@/lib/auth/rate-limiters";
import { getClientIdentifier } from "@/lib/rate-limit";
import { validatePassword, validateUsername } from "@/lib/validation";
import { CONFIG } from "@/lib/config";
import { generateUniqueImmortalFriendCode } from "@/lib/friend-code";
import { apiSuccess, ApiErrors } from "@/lib/api";
import { resolveSelfServeRegistrationRole } from "@/lib/auth/admin-bootstrap";

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(req);
    const rateCheck = registerLimiter.check(clientId);
    if (!rateCheck.allowed) {
      return ApiErrors.rateLimited(
        "Too many registration attempts. Please try again later.",
        rateCheck.resetAt.toISOString()
      );
    }

    const { username, password, name } = await req.json();

    if (!username || !password || !name) {
      return ApiErrors.badRequest("All fields are required");
    }

    // Validate types
    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      typeof name !== "string"
    ) {
      return ApiErrors.badRequest("Invalid field types");
    }

    const trimmedUsername = username.trim();
    const trimmedName = name.trim().slice(0, 100);

    // Validate username
    const usernameValidation = validateUsername(trimmedUsername);
    if (!usernameValidation.valid) {
      return ApiErrors.validationError(usernameValidation.errors.join(". "));
    }

    // Validate password with complexity requirements
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return ApiErrors.validationError(passwordValidation.errors.join(". "));
    }

    // Validate display name
    if (trimmedName.length < 1 || trimmedName.length > 100) {
      return ApiErrors.validationError("Display name must be between 1 and 100 characters");
    }

    const existingUsers = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "User"
      WHERE lower(username) = lower(${trimmedUsername})
      LIMIT 1
    `;
    const existing = existingUsers[0] ?? null;
    if (existing) {
      return ApiErrors.conflict("Dao name already taken");
    }

    const hashedPassword = await bcrypt.hash(
      password,
      CONFIG.auth.bcryptRounds
    );

    // If no admin exists yet, the first real self-serve account becomes admin.
    const users = await prisma.user.findMany({
      select: { role: true },
    });
    const role = resolveSelfServeRegistrationRole(users.map((entry) => entry.role));
    const friendCode = await generateUniqueImmortalFriendCode();

    const user = await prisma.user.create({
      data: {
        username: trimmedUsername,
        password: hashedPassword,
        name: trimmedName,
        role,
        friendCode,
      },
    });

    // Auto-login after registration: generate JWT and set cookie
    const token = await createToken(
      { id: user.id, username: user.username, name: user.name, role: user.role },
      false
    );

    const response = apiSuccess({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });

    setAuthCookie(response, token, false, req);

    return response;
  } catch (error) {
    console.error("Register error:", error);
    return ApiErrors.internal("Registration failed");
  }
}
