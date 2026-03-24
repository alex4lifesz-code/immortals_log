import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createToken, setAuthCookie } from "@/lib/auth";
import { loginLimiter } from "@/lib/auth/rate-limiters";
import { getClientIdentifier } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(req);
    const rateCheck = loginLimiter.check(clientId);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: "Too many login attempts. Please try again later.",
          code: "RATE_LIMITED",
          retryAfter: rateCheck.resetAt.toISOString(),
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { username, password, rememberMe } = body;

    if (
      !username ||
      !password ||
      typeof username !== "string" ||
      typeof password !== "string"
    ) {
      return NextResponse.json(
        { error: "Dao name and secret art are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username: username.trim() },
    });
    if (!user) {
      return NextResponse.json(
        { error: "Cultivator not found in the sect records" },
        { status: 404 }
      );
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Incorrect secret art" },
        { status: 401 }
      );
    }

    // Generate JWT and set cookie
    const token = await createToken(
      { id: user.id, username: user.username, name: user.name, role: user.role },
      !!rememberMe
    );

    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });

    setAuthCookie(response, token, !!rememberMe, req);

    // Reset rate limit on successful login
    loginLimiter.reset(clientId);

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
