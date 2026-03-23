// ── Weight Standards Types & Defaults ──

export interface TierStandard {
  tier: number;
  name: string;
  minPercentage: number;
  maxPercentage: number;
  color: string;
}

export interface WeightStandardRecord {
  id: string;
  exerciseId: string;
  gender: "MALE" | "FEMALE";
  tier1Min: number;
  tier1Max: number;
  tier2Min: number;
  tier2Max: number;
  tier3Min: number;
  tier3Max: number;
  tier4Min: number;
  tier4Max: number;
  tier5Min: number;
  tier5Max: number;
  tier6Min: number;
  tier6Max: number;
  updatedAt: string;
  updatedBy: string | null;
}

export interface ExerciseWithStandards {
  id: string;
  name: string;
  category: string;
  exerciseType: string;
  maleStandard: WeightStandardRecord | null;
  femaleStandard: WeightStandardRecord | null;
}

export const TIER_NAMES = [
  "Untrained",
  "Beginner",
  "Novice",
  "Intermediate",
  "Advanced",
  "Elite",
] as const;

export const TIER_COLORS = [
  "#4ade80",
  "#fbbf24",
  "#f87171",
  "#a78bfa",
  "#f472b6",
  "#67e8f9",
] as const;

export const DEFAULT_MALE_STANDARDS: TierStandard[] = [
  { tier: 1, name: "Untrained", minPercentage: 0, maxPercentage: 50, color: "#4ade80" },
  { tier: 2, name: "Beginner", minPercentage: 50, maxPercentage: 75, color: "#fbbf24" },
  { tier: 3, name: "Novice", minPercentage: 75, maxPercentage: 100, color: "#f87171" },
  { tier: 4, name: "Intermediate", minPercentage: 100, maxPercentage: 125, color: "#a78bfa" },
  { tier: 5, name: "Advanced", minPercentage: 125, maxPercentage: 150, color: "#f472b6" },
  { tier: 6, name: "Elite", minPercentage: 150, maxPercentage: 999, color: "#67e8f9" },
];

export const DEFAULT_FEMALE_STANDARDS: TierStandard[] = [
  { tier: 1, name: "Untrained", minPercentage: 0, maxPercentage: 35, color: "#4ade80" },
  { tier: 2, name: "Beginner", minPercentage: 35, maxPercentage: 50, color: "#fbbf24" },
  { tier: 3, name: "Novice", minPercentage: 50, maxPercentage: 70, color: "#f87171" },
  { tier: 4, name: "Intermediate", minPercentage: 70, maxPercentage: 85, color: "#a78bfa" },
  { tier: 5, name: "Advanced", minPercentage: 85, maxPercentage: 100, color: "#f472b6" },
  { tier: 6, name: "Elite", minPercentage: 100, maxPercentage: 999, color: "#67e8f9" },
];

export function recordToTiers(record: WeightStandardRecord): TierStandard[] {
  return [
    { tier: 1, name: TIER_NAMES[0], minPercentage: record.tier1Min, maxPercentage: record.tier1Max, color: TIER_COLORS[0] },
    { tier: 2, name: TIER_NAMES[1], minPercentage: record.tier2Min, maxPercentage: record.tier2Max, color: TIER_COLORS[1] },
    { tier: 3, name: TIER_NAMES[2], minPercentage: record.tier3Min, maxPercentage: record.tier3Max, color: TIER_COLORS[2] },
    { tier: 4, name: TIER_NAMES[3], minPercentage: record.tier4Min, maxPercentage: record.tier4Max, color: TIER_COLORS[3] },
    { tier: 5, name: TIER_NAMES[4], minPercentage: record.tier5Min, maxPercentage: record.tier5Max, color: TIER_COLORS[4] },
    { tier: 6, name: TIER_NAMES[5], minPercentage: record.tier6Min, maxPercentage: record.tier6Max, color: TIER_COLORS[5] },
  ];
}

export function tiersToRecord(tiers: TierStandard[]): {
  tier1Min: number; tier1Max: number;
  tier2Min: number; tier2Max: number;
  tier3Min: number; tier3Max: number;
  tier4Min: number; tier4Max: number;
  tier5Min: number; tier5Max: number;
  tier6Min: number; tier6Max: number;
} {
  return {
    tier1Min: tiers[0].minPercentage, tier1Max: tiers[0].maxPercentage,
    tier2Min: tiers[1].minPercentage, tier2Max: tiers[1].maxPercentage,
    tier3Min: tiers[2].minPercentage, tier3Max: tiers[2].maxPercentage,
    tier4Min: tiers[3].minPercentage, tier4Max: tiers[3].maxPercentage,
    tier5Min: tiers[4].minPercentage, tier5Max: tiers[4].maxPercentage,
    tier6Min: tiers[5].minPercentage, tier6Max: tiers[5].maxPercentage,
  };
}

export function getStandardsForGender(
  maleStandard: WeightStandardRecord | null,
  femaleStandard: WeightStandardRecord | null,
  gender: "male" | "female"
): TierStandard[] {
  const record = gender === "male" ? maleStandard : femaleStandard;
  if (record) return recordToTiers(record);
  return gender === "male" ? DEFAULT_MALE_STANDARDS : DEFAULT_FEMALE_STANDARDS;
}

export function calculateTier(
  weightLifted: number,
  bodyweight: number,
  tiers: TierStandard[]
): { tier: TierStandard; percentage: number } | null {
  if (bodyweight <= 0 || weightLifted <= 0) return null;
  const percentage = (weightLifted / bodyweight) * 100;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (percentage >= tiers[i].minPercentage) {
      return { tier: tiers[i], percentage };
    }
  }
  return { tier: tiers[0], percentage };
}
