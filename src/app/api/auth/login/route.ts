import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { createToken, setAuthCookie } from "@/lib/auth";
import { loginLimiter } from "@/lib/auth/rate-limiters";
import { getClientIdentifier } from "@/lib/rate-limit";
import { apiSuccess, ApiErrors } from "@/lib/api";
import { findUserForLoginByUsernameInsensitive } from "@/lib/repositories/user.repository";

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(req);
    const rateCheck = loginLimiter.check(clientId);
    if (!rateCheck.allowed) {
      return ApiErrors.rateLimited(
        "Too many login attempts. Please try again later.",
        rateCheck.resetAt.toISOString()
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
      return ApiErrors.badRequest("Dao name and secret art are required");
    }

    const trimmedUsername = username.trim();
    const user = await findUserForLoginByUsernameInsensitive(trimmedUsername);
    if (!user) {
      return ApiErrors.notFound("Cultivator not found in the sect records");
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return ApiErrors.unauthorized("Incorrect secret art");
    }

    // Generate JWT and set cookie
    const token = await createToken(
      { id: user.id, username: user.username, name: user.name, role: user.role },
      !!rememberMe
    );

    const response = apiSuccess({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        onboardingCompleted: !!user.onboardingCompleted,
        onboardingSkipped: !!user.onboardingSkipped,
      },
    });

    setAuthCookie(response, token, !!rememberMe, req);

    // Reset rate limit on successful login
    loginLimiter.reset(clientId);

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return ApiErrors.internal("Authentication failed");
  }
}
