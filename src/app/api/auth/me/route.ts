// src/app/api/auth/me/route.ts — Get current authenticated user info

import { getAuthFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, ApiErrors } from "@/lib/api";

export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return ApiErrors.unauthorized();
  }

  // Fetch fresh user data from DB to ensure it's up to date
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      onboardingCompleted: true,
      onboardingSkipped: true,
      onboardingStep: true,
    },
  });

  if (!user) {
    return ApiErrors.notFound("User not found");
  }

  return apiSuccess({ user });
}
