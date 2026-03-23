import type { ProgressionExercise, ProgressionTier, ProgressionLog, WeightStandardsMap } from "./types";
import type { UserPhysiqueSettings } from "@/lib/user-physique";
import { recordToTiers } from "@/lib/weight-standards";

export function parseTips(tips: string): string[] {
  if (!tips) return [];
  try { const arr = JSON.parse(tips); return Array.isArray(arr) ? arr : []; } catch { return []; }
}

export function getExerciseIcon(type: string): string {
  if (type === "Upper Heaven") return "☁️";
  if (type === "Lower Realms") return "🔥";
  if (type === "Heart Meridian") return "💚";
  if (type === "Unified Realm") return "⭐";
  return "🔱";
}

export function parseCategoryTags(category: string | null | undefined): string[] {
  if (!category) return [];
  return category
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function stripBwPercentHint(label: string): string {
  return label.replace(/\s*\([^)]*%?\s*bw[^)]*\)\s*/gi, " ").replace(/\s{2,}/g, " ").trim();
}

export function createReadyToLogQueueItemId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export const RESISTANCE_BAND_TOKEN = /^RB:\s*(\d+(?:\.\d+)?)\s*kg$/i;
const RESISTANCE_BAND_LEVEL_TOKEN = /^RBL:\s*(\d+)$/i;
export const RESISTANCE_BAND_OPTIONS = [2.5, 5, 7.5, 10, 12.5, 15, 20, 25, 30] as const;
const MAX_RESISTANCE_BAND_KG = Math.max(...RESISTANCE_BAND_OPTIONS);

export function formatResistanceBandLabel(kg: number): string {
  const normalized = Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace(/\.0$/, "");
  return `-${normalized}kg`;
}

export const MODIFIER_WEIGHT_TOKEN = /^MW:\s*(\d+(?:\.\d+)?)\s*kg$/i;
export const MODIFIER_WEIGHT_OPTIONS = [2.5, 5, 7.5, 10, 12.5, 15, 20, 25, 30, 35, 40, 45, 50] as const;

export function formatModifierWeightLabel(kg: number): string {
  const normalized = Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace(/\.0$/, "");
  return `+${normalized}kg`;
}

export function getBandDimOpacity(kg: number | null | undefined): number {
  if (typeof kg !== "number" || !Number.isFinite(kg) || kg <= 0) return 1;
  const normalized = Math.max(0, Math.min(1, kg / MAX_RESISTANCE_BAND_KG));
  return Math.max(0.08, 1 - normalized * 0.92);
}

export function getBandSoftDimOpacity(kg: number | null | undefined): number {
  if (typeof kg !== "number" || !Number.isFinite(kg) || kg <= 0) return 1;
  const normalized = Math.max(0, Math.min(1, kg / MAX_RESISTANCE_BAND_KG));
  return Math.max(0.78, 1 - normalized * 0.22);
}

export function getBandAdjustedGlowStyle(glowStyle: React.CSSProperties, kg: number | null | undefined): React.CSSProperties {
  if (typeof kg !== "number" || !Number.isFinite(kg) || kg <= 0) return glowStyle;
  const factor = getBandDimOpacity(kg);
  const boxShadow =
    typeof glowStyle.boxShadow === "string"
      ? glowStyle.boxShadow.replace(
          /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g,
          (_m: string, r: string, g: string, b: string, a: string) =>
            `rgba(${r}, ${g}, ${b}, ${(parseFloat(a) * factor).toFixed(3)})`
        )
      : glowStyle.boxShadow;
  if (factor <= 0.12) {
    return { ...glowStyle, boxShadow: "none" };
  }
  return { ...glowStyle, boxShadow };
}

export function parseModifierWithBand(modifier: string | null | undefined): {
  baseModifier: string | null;
  resistanceBandKg: number | null;
  modifierWeightKg: number | null;
  displayLevelOverride: number | null;
} {
  if (!modifier) return { baseModifier: null, resistanceBandKg: null, modifierWeightKg: null, displayLevelOverride: null };

  const parts = modifier
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  let resistanceBandKg: number | null = null;
  let modifierWeightKg: number | null = null;
  let displayLevelOverride: number | null = null;
  const baseParts: string[] = [];

  for (const part of parts) {
    const match = part.match(RESISTANCE_BAND_TOKEN);
    if (match) {
      const val = Number(match[1]);
      if (Number.isFinite(val) && val > 0) resistanceBandKg = val;
      continue;
    }
    const levelMatch = part.match(RESISTANCE_BAND_LEVEL_TOKEN);
    if (levelMatch) {
      const lvl = Number(levelMatch[1]);
      if (Number.isFinite(lvl) && lvl > 0) displayLevelOverride = Math.floor(lvl);
      continue;
    }
    const mwMatch = part.match(MODIFIER_WEIGHT_TOKEN);
    if (mwMatch) {
      const val = Number(mwMatch[1]);
      if (Number.isFinite(val) && val > 0) modifierWeightKg = val;
      continue;
    }
    baseParts.push(part);
  }

  return {
    baseModifier: baseParts.length > 0 ? baseParts.join(" | ") : null,
    resistanceBandKg,
    modifierWeightKg,
    displayLevelOverride,
  };
}

export function buildModifierWithBand(
  baseModifier: string | null | undefined,
  resistanceBandKg: number | null | undefined,
  displayLevelOverride?: number | null,
  modifierWeightKg?: number | null,
): string | null {
  const parts: string[] = [];
  const base = baseModifier?.trim();
  if (base) parts.push(base);
  if (typeof resistanceBandKg === "number" && Number.isFinite(resistanceBandKg) && resistanceBandKg > 0) {
    parts.push(`RB:${resistanceBandKg}kg`);
    if (typeof displayLevelOverride === "number" && Number.isFinite(displayLevelOverride) && displayLevelOverride > 0) {
      parts.push(`RBL:${Math.floor(displayLevelOverride)}`);
    }
  }
  if (typeof modifierWeightKg === "number" && Number.isFinite(modifierWeightKg) && modifierWeightKg > 0) {
    parts.push(`MW:${modifierWeightKg}kg`);
  }
  return parts.length > 0 ? parts.join(" | ") : null;
}

export function getSelectedLevel(
  exercise: ProgressionExercise,
  defaults: Record<string, number>,
  autoLevels: Record<string, number>
): number {
  if (isGymCategoryExercise(exercise) && autoLevels[exercise.id]) return autoLevels[exercise.id];
  if (Object.prototype.hasOwnProperty.call(defaults, exercise.id)) return defaults[exercise.id];
  if (autoLevels[exercise.id]) return autoLevels[exercise.id];
  return exercise.userProgress[0]?.currentLevel ?? 1;
}

export function averageWeightsFromLog(log: ProgressionLog): number | null {
  const vals = [log.weight1, log.weight2, log.weight3].filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);
  if (vals.length === 0) return null;
  return vals.reduce((sum, v) => sum + v, 0) / vals.length;
}

export function getEffectiveWeight(avg: number, bandKg?: number | null, modifierWeightKg?: number | null): number {
  const bandOffset = typeof bandKg === "number" && Number.isFinite(bandKg) && bandKg > 0 ? bandKg : 0;
  const modifierOffset =
    typeof modifierWeightKg === "number" && Number.isFinite(modifierWeightKg) && modifierWeightKg > 0
      ? modifierWeightKg
      : 0;
  return Math.max(0, avg - bandOffset + modifierOffset);
}

function scaleTargets(seed: number[], count: number): number[] {
  if (count <= 1) return [seed[0]];
  if (count === seed.length) return [...seed];

  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const pos = (i * (seed.length - 1)) / (count - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) {
      out.push(seed[lo]);
      continue;
    }
    const t = pos - lo;
    out.push(seed[lo] + (seed[hi] - seed[lo]) * t);
  }
  return out;
}

function getGymTierTargets(gender: UserPhysiqueSettings["gender"], tierCount: number): number[] {
  const seeds: Record<UserPhysiqueSettings["gender"], number[]> = {
    male: [20, 35, 50, 65, 80, 95, 110, 125, 140, 160],
    female: [15, 25, 35, 45, 55, 65, 75, 85, 95, 110],
  };

  return scaleTargets(seeds[gender], tierCount);
}

export function isGymWeightTrackedExercise(exercise: ProgressionExercise): boolean {
  const equipment = (exercise.equipmentType || "").toLowerCase();
  const gymEquipmentHints = ["dumbbell", "barbell", "machine", "cable", "weights", "plate", "smith"];
  const looksGymByEquipment = gymEquipmentHints.some((hint) => equipment.includes(hint));
  const explicitlyWeighted = exercise.weighted === true;

  const logs = exercise.userProgress[0]?.logs ?? [];
  const hasExternalWeightHistory = logs.some((log) => {
    return [log.weight1, log.weight2, log.weight3].some((v) => typeof v === "number" && Number.isFinite(v) && v > 0);
  });

  return explicitlyWeighted || looksGymByEquipment || hasExternalWeightHistory;
}

export function isLikelyCalisthenicsExercise(exercise: ProgressionExercise): boolean {
  const name = (exercise.name || "").toLowerCase().replace(/[-_]+/g, " ");
  const equipment = (exercise.equipmentType || "").toLowerCase();
  const tags = parseCategoryTags(exercise.category).map((tag) => tag.toLowerCase().replace(/[-_]+/g, " "));

  const calisthenicsNameHints = [
    "pull up", "chin up", "dip", "push up", "muscle up",
    "front lever", "back lever", "planche", "handstand",
    "l sit", "dragon flag", "human flag",
  ];
  const calisthenicsEquipmentHints = ["rings", "pull", "dip", "floor", "parallette", "bodyweight"];

  if (exercise.bodyweight || exercise.rings) return true;
  if (tags.some((tag) => tag.includes("calisthenics") || tag.includes("bodyweight"))) return true;
  if (calisthenicsNameHints.some((hint) => name.includes(hint))) return true;
  if (calisthenicsEquipmentHints.some((hint) => equipment.includes(hint))) return true;
  return false;
}

export function isGymCategoryExercise(exercise: ProgressionExercise): boolean {
  if (isLikelyCalisthenicsExercise(exercise)) return false;
  const tags = parseCategoryTags(exercise.category).map((tag) => tag.toLowerCase().trim());
  return tags.some((tag) => /\bgym\b/i.test(tag.replace(/[_-]+/g, " ")));
}

export function getExerciseCategoryLabel(exercise: ProgressionExercise | undefined): "GYM" | "Yoga" | "Cardio" | "Cali" {
  if (!exercise) return "Cali";
  const tags = parseCategoryTags(exercise.category).map((t) => t.toLowerCase().trim());
  if (isGymCategoryExercise(exercise)) return "GYM";
  if (tags.some((t) => t.includes("yoga") || t.includes("stretching"))) return "Yoga";
  if (tags.some((t) => t.includes("cardio"))) return "Cardio";
  return "Cali";
}

function parseTierWeightStandardKg(text: string, bodyWeightKg: number): number | null {
  if (!text) return null;

  const percentRange = text.match(/(\d+(?:\.\d+)?)\s*[-to]+\s*(\d+(?:\.\d+)?)\s*%\s*bw/i);
  if (percentRange) {
    const lowerPercent = Number(percentRange[1]);
    if (Number.isFinite(lowerPercent) && lowerPercent > 0) return (lowerPercent / 100) * bodyWeightKg;
  }

  const percentSingle = text.match(/(\d+(?:\.\d+)?)\s*%\s*bw/i);
  if (percentSingle) {
    const p = Number(percentSingle[1]);
    if (Number.isFinite(p) && p > 0) return (p / 100) * bodyWeightKg;
  }

  const kgRange = text.match(/(\d+(?:\.\d+)?)\s*[-to]+\s*(\d+(?:\.\d+)?)\s*kg/i);
  if (kgRange) {
    const lower = Number(kgRange[1]);
    if (Number.isFinite(lower) && lower > 0) return lower;
  }

  const kgSingle = text.match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (kgSingle) {
    const kg = Number(kgSingle[1]);
    if (Number.isFinite(kg) && kg > 0) return kg;
  }

  const lbRange = text.match(/(\d+(?:\.\d+)?)\s*[-to]+\s*(\d+(?:\.\d+)?)\s*lb/i);
  if (lbRange) {
    const lowerLb = Number(lbRange[1]);
    if (Number.isFinite(lowerLb) && lowerLb > 0) return lowerLb * 0.453592;
  }

  const lbSingle = text.match(/(\d+(?:\.\d+)?)\s*lb/i);
  if (lbSingle) {
    const lb = Number(lbSingle[1]);
    if (Number.isFinite(lb) && lb > 0) return lb * 0.453592;
  }

  return null;
}

export function getGymTierStandardKg(tier: ProgressionTier, bodyWeightKg: number): number | null {
  const candidates = [tier.targetRepsText || "", tier.description || "", tier.name || ""];
  for (const candidate of candidates) {
    const parsed = parseTierWeightStandardKg(candidate, bodyWeightKg);
    if (parsed != null) return parsed;
  }
  return null;
}

export function supportsResistanceBandAssistance(exercise: ProgressionExercise): boolean {
  if (isLikelyCalisthenicsExercise(exercise)) return true;

  const name = (exercise.name || "").toLowerCase();
  const equipment = (exercise.equipmentType || "").toLowerCase();
  const gymHints = ["dumbbell", "barbell", "machine", "cable", "plate", "smith"];

  return !gymHints.some((hint) => equipment.includes(hint) || name.includes(hint));
}

export function supportsBodyweightQuickFill(exercise: ProgressionExercise): boolean {
  return isLikelyCalisthenicsExercise(exercise);
}

export function getDefaultVariationOptions(exercise: ProgressionExercise): string[] {
  const text = `${exercise.name || ""} ${exercise.equipmentType || ""} ${exercise.category || ""}`.toLowerCase();
  const pullingHints = ["pull", "chin", "row", "pulldown", "lever", "curl", "deadlift", "muscle up"];
  const pressingHints = ["push", "press", "bench", "dip", "planche", "handstand"];
  const ringHints = ["ring", "rings"];
  const lowerBodyHints = ["squat", "lunge", "leg", "calf", "hinge"];

  const hasHint = (hints: string[]) => hints.some((hint) => text.includes(hint));
  const options = new Set<string>();
  const isLowerBody = hasHint(lowerBodyHints);

  if (isLowerBody) {
    options.add("Standard (shoulder-width stance)");
    options.add("Narrow stance");
    options.add("Wide stance");
    options.add("Negative reps (slow eccentric)");
    return Array.from(options);
  }

  options.add("Standard (shoulder-width grip)");
  options.add("Close grip (narrow hand spacing)");
  options.add("Wide grip (wide hand spacing)");

  if (hasHint(pullingHints)) {
    options.add("Supinated (underhand) grip");
  } else if (hasHint(pressingHints)) {
    options.add("Neutral grip");
  }

  if (hasHint(ringHints)) {
    options.add("False grip");
  }

  options.add("Negative reps (slow eccentric)");

  const compact = Array.from(options).slice(0, 6);
  return compact.length > 0 ? compact : ["Standard (shoulder-width grip)"];
}

export function getAutoGymLevelFromAverage(
  exercise: ProgressionExercise,
  physique: UserPhysiqueSettings,
  avgWeight: number | null,
  weightStandards?: WeightStandardsMap
): number | null {
  if (!isGymCategoryExercise(exercise)) return null;
  if (!isGymWeightTrackedExercise(exercise)) return null;
  if (!physique.bodyWeightKg || physique.bodyWeightKg <= 0) return null;
  if (!exercise.tiers || exercise.tiers.length === 0) return null;
  if (!avgWeight || avgWeight <= 0) return null;

  const sortedTiers = [...exercise.tiers].sort((a, b) => a.level - b.level);

  const dbStandards = weightStandards?.[exercise.id];
  if (dbStandards) {
    const genderKey = physique.gender === "female" ? "female" : "male";
    const record = genderKey === "female" ? dbStandards.female : dbStandards.male;
    if (record) {
      const tiers = recordToTiers(record);
      const bwPercent = (avgWeight / physique.bodyWeightKg) * 100;
      let picked = sortedTiers[0].level;
      for (let i = 0; i < sortedTiers.length && i < tiers.length; i++) {
        if (bwPercent >= tiers[i].minPercentage) picked = sortedTiers[i].level;
      }
      return picked;
    }
  }

  const explicitStandards = sortedTiers.map((tier) => getGymTierStandardKg(tier, physique.bodyWeightKg as number));
  const hasExplicitStandards = explicitStandards.some((v) => v != null);

  if (hasExplicitStandards) {
    let picked = sortedTiers[0].level;
    for (let i = 0; i < sortedTiers.length; i++) {
      const standardKg = explicitStandards[i];
      if (standardKg == null) continue;
      if (avgWeight >= standardKg) picked = sortedTiers[i].level;
    }
    return picked;
  }

  const bwPercent = (avgWeight / physique.bodyWeightKg) * 100;
  const targets = getGymTierTargets(physique.gender, sortedTiers.length);

  let picked = sortedTiers[0].level;
  for (let i = 0; i < sortedTiers.length; i++) {
    if (bwPercent >= targets[i]) picked = sortedTiers[i].level;
  }
  return picked;
}

export function getAutoGymLevelFromSet(
  exercise: ProgressionExercise,
  physique: UserPhysiqueSettings,
  setData: {
    weight1?: number | null;
    weight2?: number | null;
    weight3?: number | null;
  },
  modifier?: string | null,
  weightStandards?: WeightStandardsMap
): number | null {
  const { resistanceBandKg, modifierWeightKg } = parseModifierWithBand(modifier);
  const vals = [setData.weight1, setData.weight2, setData.weight3]
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0)
    .map((v) => getEffectiveWeight(v, resistanceBandKg, modifierWeightKg));
  const avg = vals.length > 0 ? vals.reduce((sum, v) => sum + v, 0) / vals.length : null;
  return getAutoGymLevelFromAverage(exercise, physique, avg, weightStandards);
}

export function recentAverageWeightBandAdjusted(logs: ProgressionLog[], limit = 3): number | null {
  const sorted = [...logs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
  const vals = sorted
    .map((log) => {
      const avg = averageWeightsFromLog(log);
      if (avg == null) return null;
      const { resistanceBandKg, modifierWeightKg } = parseModifierWithBand(log.modifier);
      return getEffectiveWeight(avg, resistanceBandKg, modifierWeightKg);
    })
    .filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return vals.reduce((sum, v) => sum + v, 0) / vals.length;
}

export function getAutoGymLevel(exercise: ProgressionExercise, physique: UserPhysiqueSettings, weightStandards?: WeightStandardsMap): number | null {
  const logs = exercise.userProgress[0]?.logs ?? [];
  const avgWeight = recentAverageWeightBandAdjusted(logs, 3);
  return getAutoGymLevelFromAverage(exercise, physique, avgWeight, weightStandards);
}

export function getTierName(exercise: ProgressionExercise, level: number): string {
  const tier = exercise.tiers.find((t) => t.level === level);
  return tier ? tier.name : `Level ${level}`;
}

export function tierUsesHoldTarget(tier: ProgressionTier): boolean {
  if (tier.targetHold != null) return true;
  return /\btarget\s*:/i.test(tier.description || "");
}

export function tierUsesWeightTarget(tier: ProgressionTier): boolean {
  const hasRepsTarget =
    tier.targetReps != null ||
    (typeof tier.targetRepsText === "string" && tier.targetRepsText.trim().length > 0);
  if (hasRepsTarget) return true;
  return /\btarget\s*weight\s*:/i.test(tier.description || "");
}

export function hasHoldBasedTiers(exercise: ProgressionExercise): boolean {
  return exercise.tiers.some((t) => tierUsesHoldTarget(t));
}

export function getTierInputMode(exercise: ProgressionExercise, level: number): "weight" | "hold" {
  const tier = exercise.tiers.find((t) => t.level === level);
  if (tier) {
    if (tierUsesWeightTarget(tier)) return "weight";
    if (tierUsesHoldTarget(tier)) return "hold";
  }
  return hasHoldBasedTiers(exercise) ? "hold" : "weight";
}

export const DIFFICULTY_SCALE = [
  "Mortal",
  "Foundation Establishment",
  "Core Formation",
  "Nascent Soul",
  "Soul Splitting",
  "Tribulation Transcendence",
  "Immortal",
  "Heavenly Dao",
] as const;

export function getWeightedDifficulty(
  exercise: ProgressionExercise,
  level: number,
  variantName?: string | null,
  modifierType?: string | null,
): string {
  const sorted = [...exercise.tiers].sort((a, b) => a.level - b.level);
  const idx = sorted.findIndex((t) => t.level === level);
  const maxIdx = Math.max(sorted.length - 1, 1);

  let score = idx === -1 ? 0 : idx / maxIdx;

  if (variantName && exercise.variations) {
    const variation = exercise.variations.find(v => v.name === variantName);
    if (variation?.difficulty) {
      const varDiffKey = variation.wuxiaDifficulty || variation.difficulty;
      const diffIdx = DIFFICULTY_SCALE.indexOf(varDiffKey as typeof DIFFICULTY_SCALE[number]);
      if (diffIdx !== -1) {
        score += ((diffIdx / (DIFFICULTY_SCALE.length - 1)) - 0.5) * 0.30;
      }
    }
  }

  if (modifierType && exercise.modifiers) {
    const modifier = exercise.modifiers.find(m => m.type === modifierType);
    if (modifier) {
      score += Math.max(-1, Math.min(1, modifier.difficultyMod / 3)) * 0.15;
    }
  }

  score = Math.max(0, Math.min(1, score));
  const scaleIdx = Math.round(score * (DIFFICULTY_SCALE.length - 1));
  return DIFFICULTY_SCALE[scaleIdx];
}

export function getEquipmentTags(exercise: ProgressionExercise): string[] {
  const tags: string[] = [];
  if (exercise.bodyweight) tags.push("Bodyweight");
  if (exercise.weighted) tags.push("Weighted");
  if (exercise.rings) tags.push("Rings");
  if (tags.length === 0) tags.push(exercise.equipmentType);
  return tags;
}
