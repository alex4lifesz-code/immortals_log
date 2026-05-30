// src/app/api/auth/me/route.ts — Get current authenticated user info

import { getAuthFromRequest } from "@/lib/auth";
import { apiSuccess, ApiErrors } from "@/lib/api";
import { findAuthUserProfileById } from "@/lib/repositories/user.repository";

export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return ApiErrors.unauthorized();
  }

  // Fetch fresh user data from DB to ensure it's up to date
  const user = await findAuthUserProfileById(auth.userId);

  if (!user) {
    return ApiErrors.notFound("User not found");
  }

  return apiSuccess({ user });
}
