"use client";

import type { ProgressionExercise } from "@/app/dashboard/workout/types";

interface TierInfo {
  tier: number;
  name: string;
  minPercentage: number;
  maxPercentage: number;
  color: string;
}

export const TIER_STANDARDS: TierInfo[] = [
  { tier: 1, name: "Untrained", minPercentage: 0, maxPercentage: 50, color: "var(--difficulty-green)" },
  { tier: 2, name: "Beginner", minPercentage: 50, maxPercentage: 75, color: "var(--difficulty-amber)" },
  { tier: 3, name: "Novice", minPercentage: 75, maxPercentage: 100, color: "var(--difficulty-red)" },
  { tier: 4, name: "Intermediate", minPercentage: 100, maxPercentage: 125, color: "var(--difficulty-violet)" },
  { tier: 5, name: "Advanced", minPercentage: 125, maxPercentage: 150, color: "var(--difficulty-light-pink-glow)" },
  { tier: 6, name: "Elite", minPercentage: 150, maxPercentage: Infinity, color: "var(--difficulty-cyan)" },
];

export function calculateTier(avgWeight: number, userBodyweight: number) {
  const percentage = (avgWeight / userBodyweight) * 100;
  const currentTier = TIER_STANDARDS.find(
    (t) => percentage >= t.minPercentage && percentage < t.maxPercentage
  ) || TIER_STANDARDS[TIER_STANDARDS.length - 1];
  const nextTier = TIER_STANDARDS.find((t) => t.tier === currentTier.tier + 1);
  const nextTierWeight = nextTier ? (nextTier.minPercentage / 100) * userBodyweight : null;
  const tierRange = currentTier.maxPercentage - currentTier.minPercentage;
  const progressInTier = tierRange === Infinity ? 100 : ((percentage - currentTier.minPercentage) / tierRange) * 100;
  return { currentTier, percentage, nextTierWeight, progressInTier };
}

export function getTierGlowFromLogs(
  exercise: ProgressionExercise,
  userBodyweightKg: number | null,
): { glowColor: string; tierName: string } {
  void userBodyweightKg;
  const currentLevel = exercise.userProgress?.[0]?.currentLevel ?? 1;
  const currentTier = exercise.tiers.find((tier) => tier.level === currentLevel);
  return {
    glowColor: "var(--exercise-glow)",
    tierName: currentTier?.name?.trim() || "",
  };
}
