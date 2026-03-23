"use client";

import type { ProgressionExercise } from "@/app/dashboard/workout/types";
import { parseModifierWithBand, getEffectiveWeight } from "@/app/dashboard/workout/utils";
import { useAppContext } from "@/context/AppContext";

interface TierInfo {
  tier: number;
  name: string;
  minPercentage: number;
  maxPercentage: number;
  color: string;
}

export const TIER_STANDARDS: TierInfo[] = [
  { tier: 1, name: "Untrained", minPercentage: 0, maxPercentage: 50, color: "#4ade80" },
  { tier: 2, name: "Beginner", minPercentage: 50, maxPercentage: 75, color: "#fbbf24" },
  { tier: 3, name: "Novice", minPercentage: 75, maxPercentage: 100, color: "#f87171" },
  { tier: 4, name: "Intermediate", minPercentage: 100, maxPercentage: 125, color: "#a78bfa" },
  { tier: 5, name: "Advanced", minPercentage: 125, maxPercentage: 150, color: "#f472b6" },
  { tier: 6, name: "Elite", minPercentage: 150, maxPercentage: Infinity, color: "#67e8f9" },
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
  const DEFAULT_COLOR = TIER_STANDARDS[0].color;
  if (!userBodyweightKg || userBodyweightKg <= 0) {
    return { glowColor: DEFAULT_COLOR, tierName: TIER_STANDARDS[0].name };
  }

  const logs = exercise.userProgress?.[0]?.logs ?? [];
  if (logs.length === 0) {
    return { glowColor: DEFAULT_COLOR, tierName: TIER_STANDARDS[0].name };
  }

  const sorted = [...logs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const sessionDates = new Set<string>();
  const sessionLogs: typeof sorted = [];
  for (const log of sorted) {
    const dateKey = new Date(log.createdAt).toDateString();
    if (sessionDates.size < 3 || sessionDates.has(dateKey)) {
      sessionDates.add(dateKey);
      sessionLogs.push(log);
    }
    if (sessionDates.size >= 3 && !sessionDates.has(dateKey)) break;
  }

  const allWeights: number[] = [];
  for (const log of sessionLogs) {
    const { resistanceBandKg: bandKg, modifierWeightKg } = parseModifierWithBand(log.modifier);
    if (log.weight1 && log.weight1 > 0) allWeights.push(getEffectiveWeight(log.weight1, bandKg, modifierWeightKg));
    if (log.weight2 && log.weight2 > 0) allWeights.push(getEffectiveWeight(log.weight2, bandKg, modifierWeightKg));
    if (log.weight3 && log.weight3 > 0) allWeights.push(getEffectiveWeight(log.weight3, bandKg, modifierWeightKg));
  }

  if (allWeights.length === 0) {
    return { glowColor: DEFAULT_COLOR, tierName: TIER_STANDARDS[0].name };
  }

  const avgWeight = allWeights.reduce((s, w) => s + w, 0) / allWeights.length;
  const { currentTier } = calculateTier(avgWeight, userBodyweightKg);
  return { glowColor: currentTier.color, tierName: currentTier.name };
}

export function TierProgressBar({
  exercise,
  userBodyweightKg,
}: {
  exercise: ProgressionExercise;
  userBodyweightKg: number | null;
}) {
  const { isMobile } = useAppContext();

  const isWeightedExercise = exercise.weighted || false;
  const isBodyweightExercise = exercise.bodyweight || false;
  if (!isWeightedExercise && !isBodyweightExercise) return null;

  if (!userBodyweightKg || userBodyweightKg <= 0) {
    return (
      <div className={`border border-ink-light/20 bg-ink-mid/15 ${isMobile ? "rounded-xl px-3 py-2.5" : "rounded-lg px-2.5 py-2"}`}>
        <span className="text-[9px] text-mist-dark/70 uppercase tracking-wider font-medium">Your Tier</span>
        <p className={`${isMobile ? "text-[11px]" : "text-[10px]"} text-mist-dark mt-1`}>
          Set your bodyweight in Settings to see your tier.
        </p>
      </div>
    );
  }

  const logs = exercise.userProgress?.[0]?.logs ?? [];
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const sessionDates = new Set<string>();
  const sessionLogs: typeof sortedLogs = [];
  for (const log of sortedLogs) {
    const dateKey = new Date(log.createdAt).toDateString();
    if (sessionDates.size < 3 || sessionDates.has(dateKey)) {
      sessionDates.add(dateKey);
      sessionLogs.push(log);
    }
    if (sessionDates.size >= 3 && !sessionDates.has(dateKey)) break;
  }

  const allWeights: number[] = [];
  for (const log of sessionLogs) {
    const { resistanceBandKg: bandKg, modifierWeightKg } = parseModifierWithBand(log.modifier);
    if (log.weight1 && log.weight1 > 0) allWeights.push(getEffectiveWeight(log.weight1, bandKg, modifierWeightKg));
    if (log.weight2 && log.weight2 > 0) allWeights.push(getEffectiveWeight(log.weight2, bandKg, modifierWeightKg));
    if (log.weight3 && log.weight3 > 0) allWeights.push(getEffectiveWeight(log.weight3, bandKg, modifierWeightKg));
  }

  if (allWeights.length === 0) {
    return (
      <div className={`border border-ink-light/20 bg-ink-mid/15 ${isMobile ? "rounded-xl px-3 py-2.5" : "rounded-lg px-2.5 py-2"}`}>
        <span className="text-[9px] text-mist-dark/70 uppercase tracking-wider font-medium">Your Tier</span>
        <div className="flex gap-[3px] mt-1.5 mb-1.5">
          {TIER_STANDARDS.map((t) => (
            <div key={t.tier} className="flex-1 h-[6px] rounded-full bg-ink-light/25" />
          ))}
        </div>
        <p className={`${isMobile ? "text-[11px]" : "text-[10px]"} text-mist-dark`}>
          Log your first session to see your tier!
        </p>
      </div>
    );
  }

  const avgWeight = allWeights.reduce((s, w) => s + w, 0) / allWeights.length;
  const { currentTier, percentage, nextTierWeight } = calculateTier(avgWeight, userBodyweightKg);
  const sessionCount = sessionDates.size;
  const nextTierInfo = TIER_STANDARDS.find((t) => t.tier === currentTier.tier + 1);

  return (
    <div className={`border border-ink-light/20 bg-ink-mid/15 ${isMobile ? "rounded-xl px-3 py-2.5" : "rounded-lg px-2.5 py-2"}`}>
      <span className="text-[9px] text-mist-dark/70 uppercase tracking-wider font-medium">Your Tier</span>

      <div className="flex gap-[3px] mt-1.5 mb-1.5">
        {TIER_STANDARDS.map((t) => (
          <div
            key={t.tier}
            className="flex-1 h-[6px] rounded-full transition-all duration-300"
            style={{
              backgroundColor: t.tier <= currentTier.tier ? t.color : "rgba(255,255,255,0.08)",
              opacity: t.tier === currentTier.tier ? 1 : t.tier < currentTier.tier ? 0.7 : 0.4,
              boxShadow: t.tier === currentTier.tier ? `0 0 6px ${t.color}60` : "none",
            }}
            title={`Tier ${t.tier}: ${t.name}`}
          />
        ))}
      </div>

      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span
            className={`${isMobile ? "text-[12px]" : "text-[11px]"} font-semibold`}
            style={{ color: currentTier.color }}
          >
            Tier {currentTier.tier}: {currentTier.name}
          </span>
        </div>
        <div className={`${isMobile ? "text-[10px]" : "text-[9px]"} text-mist-dark`}>
          Avg: {avgWeight.toFixed(1)}kg ({percentage.toFixed(1)}% BW)
          {sessionCount < 3 && <span className="text-mist-dark/60"> (based on {sessionCount} session{sessionCount !== 1 ? "s" : ""})</span>}
          {nextTierWeight && nextTierInfo && (
            <span className="text-mist-light/70"> → {nextTierWeight.toFixed(1)}kg for {nextTierInfo.name}</span>
          )}
        </div>
      </div>
    </div>
  );
}
