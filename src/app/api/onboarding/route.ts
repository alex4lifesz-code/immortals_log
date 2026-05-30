// src/app/api/onboarding/route.ts — Onboarding status and step completion

import { NextRequest } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { apiSuccess, ApiErrors } from "@/lib/api";
import {
  findOnboardingStateByUserId,
  markOnboardingComplete,
  markOnboardingSkipped,
  updateOnboardingStep,
} from "@/lib/repositories/user.repository";

// GET: Fetch current onboarding status
export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return ApiErrors.unauthorized();

  const user = await findOnboardingStateByUserId(auth.userId);

  if (!user) return ApiErrors.notFound("User not found");

  return apiSuccess({
    onboardingCompleted: user.onboardingCompleted,
    onboardingSkipped: user.onboardingSkipped,
    onboardingStep: user.onboardingStep,
    profile: user.profile,
  });
}

// POST: Update onboarding step or complete/skip onboarding
export async function POST(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return ApiErrors.unauthorized();

  const body = await request.json();
  const { action, step } = body as { action: string; step?: number };

  if (action === "complete-step" && typeof step === "number") {
    if (step < 0 || step > 5) {
      return ApiErrors.badRequest("Invalid step number");
    }

    await updateOnboardingStep(auth.userId, step);

    return apiSuccess({ step });
  }

  if (action === "complete") {
    await markOnboardingComplete(auth.userId);

    return apiSuccess({ onboardingCompleted: true });
  }

  if (action === "skip") {
    await markOnboardingSkipped(auth.userId);

    return apiSuccess({ onboardingSkipped: true });
  }

  return ApiErrors.badRequest("Invalid action. Use 'complete-step', 'complete', or 'skip'.");
}
