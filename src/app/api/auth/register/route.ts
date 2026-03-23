import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createToken, setAuthCookie } from "@/lib/auth";
import { registerLimiter } from "@/lib/auth/rate-limiters";
import { getClientIdentifier } from "@/lib/rate-limit";
import { validatePassword, validateUsername } from "@/lib/validation";
import { CONFIG } from "@/lib/config";

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(req);
    const rateCheck = registerLimiter.check(clientId);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: "Too many registration attempts. Please try again later.",
          code: "RATE_LIMITED",
          retryAfter: rateCheck.resetAt.toISOString(),
        },
        { status: 429 }
      );
    }

    const { username, password, name } = await req.json();

    if (!username || !password || !name) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Validate types
    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      typeof name !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid field types" },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim();
    const trimmedName = name.trim().slice(0, 100);

    // Validate username
    const usernameValidation = validateUsername(trimmedUsername);
    if (!usernameValidation.valid) {
      return NextResponse.json(
        { error: usernameValidation.errors.join(". ") },
        { status: 400 }
      );
    }

    // Validate password with complexity requirements
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.errors.join(". ") },
        { status: 400 }
      );
    }

    // Validate display name
    if (trimmedName.length < 1 || trimmedName.length > 100) {
      return NextResponse.json(
        { error: "Display name must be between 1 and 100 characters" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { username: trimmedUsername },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Dao name already taken" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(
      password,
      CONFIG.auth.bcryptRounds
    );

    // Check if this is the first user — assign admin role
    const userCount = await prisma.user.count();
    const role = userCount === 0 ? "admin" : "user";

    const user = await prisma.user.create({
      data: {
        username: trimmedUsername,
        password: hashedPassword,
        name: trimmedName,
        role,
      },
    });

    // Auto-login after registration: generate JWT and set cookie
    const token = await createToken(
      { id: user.id, username: user.username, name: user.name, role: user.role },
      false
    );

    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });

    setAuthCookie(response, token, false);

    return response;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
