// src/app/api/onboarding/assessment/route.ts — Save assessment answers

import { NextRequest } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, ApiErrors } from "@/lib/api";

const VALID_BACKGROUNDS = ["new", "beginner", "intermediate", "advanced"];
const VALID_GOALS = ["strength", "skills", "consistency", "compete"];
const TIER_ORDER = ["mortal", "initiate", "disciple", "master", "grandmaster", "immortal"];

function recommendTier(
  background: string,
  benchmarks: Record<string, string>
): string {
  // Count how many benchmark exercises the user can do
  const canDo = Object.values(benchmarks).filter((v) => v === "yes").length;
  const learning = Object.values(benchmarks).filter((v) => v === "learning").length;

  if (background === "advanced" && canDo >= 4) return "master";
  if (background === "advanced" && canDo >= 2) return "disciple";
  if (background === "intermediate" && canDo >= 4) return "disciple";
  if (background === "intermediate" && canDo >= 2) return "initiate";
  if (background === "beginner" && canDo >= 3) return "initiate";
  if (canDo >= 1 || learning >= 3) return "initiate";
  return "mortal";
}

export async function POST(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return ApiErrors.unauthorized();

  const body = await request.json();
  const {
    fitnessBackground,
    primaryGoal,
    trainingDaysPerWeek,
    benchmarkAnswers,
    selectedTier,
  } = body as {
    fitnessBackground: string;
    primaryGoal: string;
    trainingDaysPerWeek: number;
    benchmarkAnswers: Record<string, string>;
    selectedTier?: string;
  };

  // Validate inputs
  if (!VALID_BACKGROUNDS.includes(fitnessBackground)) {
    return ApiErrors.badRequest("Invalid fitness background");
  }
  if (!VALID_GOALS.includes(primaryGoal)) {
    return ApiErrors.badRequest("Invalid primary goal");
  }
  if (typeof trainingDaysPerWeek !== "number" || trainingDaysPerWeek < 1 || trainingDaysPerWeek > 7) {
    return ApiErrors.badRequest("Invalid training days per week");
  }

  // Determine tier
  const recommended = recommendTier(fitnessBackground, benchmarkAnswers ?? {});
  const tier = selectedTier && TIER_ORDER.includes(selectedTier)
    ? selectedTier
    : recommended;

  // Upsert the user profile
  await prisma.userProfile.upsert({
    where: { userId: auth.userId },
    create: {
      userId: auth.userId,
      fitnessBackground,
      primaryGoal,
      trainingDaysPerWeek,
      assessmentAnswers: JSON.stringify(benchmarkAnswers ?? {}),
      recommendedTier: recommended,
      currentTier: tier,
    },
    update: {
      fitnessBackground,
      primaryGoal,
      trainingDaysPerWeek,
      assessmentAnswers: JSON.stringify(benchmarkAnswers ?? {}),
      recommendedTier: recommended,
      currentTier: tier,
    },
  });

  // Update onboarding step to 2 (past assessment)
  await prisma.user.update({
    where: { id: auth.userId },
    data: { onboardingStep: 2 },
  });

  return apiSuccess({ recommendedTier: recommended, currentTier: tier });
}
