"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useMemo, useRef, startTransition } from "react";
import { createPortal } from "react-dom";
import PageLayout from "@/components/layout/PageLayout";
import GlowButton from "@/components/ui/GlowButton";
import GlowCard from "@/components/ui/GlowCard";
import { GlowModal } from "@/components/ui/GlowCard";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { getDifficultyColor, getTypeColor, DAY_ABBREVIATIONS, parseDayAssignments } from "@/lib/constants";

import { getDifficultyColorClass, getDifficultyGlowStyleScaled, getDifficultyStyle } from "@/lib/difficulty-styles";
import { getExerciseDisplayName, matchesLooseSearchInFields, getTypeDisplayName, getDifficultyDisplayName, getDifficultyColorKey, getTypeColorKey } from "@/lib/exercise-name";
import { useAppContext } from "@/context/AppContext";
import TechniqueManagementDrawer from "@/components/workout/TechniqueManagementDrawer";
import { MemoUnifiedTrainingLogTable } from "@/components/workout/UnifiedTrainingLogTable";
import { DEFAULT_USER_PHYSIQUE, loadUserPhysique, UserPhysiqueSettings } from "@/lib/user-physique";
import type { WeightStandardRecord } from "@/lib/weight-standards";
import { recordToTiers } from "@/lib/weight-standards";

type WeightStandardsMap = Record<string, { male: WeightStandardRecord | null; female: WeightStandardRecord | null }>;

// ── Types ──

interface ProgressionTier {
  id: string;
  level: number;
  name: string;
  wuxiaName: string;
  difficulty: string;
  wuxiaDifficulty: string;
  wuxiaType: string;
  description: string;
  targetHold: number | null;
  targetReps: number | null;
  targetRepsText?: string | null;
}

interface ProgressionVariation {
  id: string;
  name: string;
  wuxiaName: string;
  difficulty: string;
  description: string;
  wuxiaDifficulty: string;
  wuxiaType: string;
}

interface ProgressionModifier {
  id: string;
  type: string;
  available: boolean;
  difficultyMod: number;
  notes: string;
}

interface ProgressionLog {
  id: string;
  level: number;
  weight1: number | null;
  reps1: number | null;
  weight2: number | null;
  reps2: number | null;
  weight3: number | null;
  reps3: number | null;
  holdTime: number | null;
  holdTime2: number | null;
  holdTime3: number | null;
  reps: number | null;
  modifier: string | null;
  variant: string | null;
  notes: string | null;
  completed: boolean;
  createdAt: string;
}

interface UserProgress {
  id: string;
  currentLevel: number;
  logs: ProgressionLog[];
}

interface ProgressionExercise {
  id: string;
  name: string;
  wuxiaName: string;
  difficulty: string;
  wuxiaDifficulty: string;
  type: string;
  wuxiaType: string;
  story: string;
  tips: string;
  category: string;
  equipmentType: string;
  bodyweight: boolean;
  weighted: boolean;
  rings: boolean;
  primaryMuscles: string;
  secondaryMuscles: string;
  assignedDays: string;
  tiers: ProgressionTier[];
  variations: ProgressionVariation[];
  modifiers: ProgressionModifier[];
  userProgress: UserProgress[];
}

interface ReadyToLogQueueItem {
  id: string;
  exerciseId: string;
}

interface LogTableFilter {
  exerciseId: string;
  levelNameLevel: number | null;
}

function parseTips(tips: string): string[] {
  if (!tips) return [];
  try { const arr = JSON.parse(tips); return Array.isArray(arr) ? arr : []; } catch { return []; }
}

function getExerciseIcon(type: string): string {
  if (type === "Upper Heaven") return "☁️";
  if (type === "Lower Realms") return "🔥";
  if (type === "Heart Meridian") return "💚";
  if (type === "Unified Realm") return "⭐";
  return "🔱";
}

function parseCategoryTags(category: string | null | undefined): string[] {
  if (!category) return [];
  return category
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function stripBwPercentHint(label: string): string {
  // Remove notes like "(12-20% bw)" from displayed labels in log tables.
  return label.replace(/\s*\([^)]*%?\s*bw[^)]*\)\s*/gi, " ").replace(/\s{2,}/g, " ").trim();
}

function createReadyToLogQueueItemId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

const RESISTANCE_BAND_TOKEN = /^RB:\s*(\d+(?:\.\d+)?)\s*kg$/i;
const RESISTANCE_BAND_LEVEL_TOKEN = /^RBL:\s*(\d+)$/i;
const RESISTANCE_BAND_OPTIONS = [2.5, 5, 7.5, 10, 12.5, 15, 20, 25, 30] as const;
const MAX_RESISTANCE_BAND_KG = Math.max(...RESISTANCE_BAND_OPTIONS);

function formatResistanceBandLabel(kg: number): string {
  const normalized = Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace(/\.0$/, "");
  return `-${normalized}kg`;
}

const MODIFIER_WEIGHT_TOKEN = /^MW:\s*(\d+(?:\.\d+)?)\s*kg$/i;
const MODIFIER_WEIGHT_OPTIONS = [2.5, 5, 7.5, 10, 12.5, 15, 20, 25, 30, 35, 40, 45, 50] as const;

function formatModifierWeightLabel(kg: number): string {
  const normalized = Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace(/\.0$/, "");
  return `+${normalized}kg`;
}

function getBandDimOpacity(kg: number | null | undefined): number {
  if (typeof kg !== "number" || !Number.isFinite(kg) || kg <= 0) return 1;
  const normalized = Math.max(0, Math.min(1, kg / MAX_RESISTANCE_BAND_KG));
  return Math.max(0.08, 1 - normalized * 0.92);
}

function getBandSoftDimOpacity(kg: number | null | undefined): number {
  if (typeof kg !== "number" || !Number.isFinite(kg) || kg <= 0) return 1;
  const normalized = Math.max(0, Math.min(1, kg / MAX_RESISTANCE_BAND_KG));
  return Math.max(0.78, 1 - normalized * 0.22);
}

function getBandAdjustedGlowStyle(glowStyle: React.CSSProperties, kg: number | null | undefined): React.CSSProperties {
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
  // At very high assistance (e.g. 30kg), flatten glow so the dimming is obvious.
  if (factor <= 0.12) {
    return { ...glowStyle, boxShadow: "none" };
  }
  return { ...glowStyle, boxShadow };
}

function parseModifierWithBand(modifier: string | null | undefined): {
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

function buildModifierWithBand(
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

// ── Helpers ──

function getSelectedLevel(
  exercise: ProgressionExercise,
  defaults: Record<string, number>,
  autoLevels: Record<string, number>
): number {
  if (isGymCategoryExercise(exercise) && autoLevels[exercise.id]) return autoLevels[exercise.id];
  if (Object.prototype.hasOwnProperty.call(defaults, exercise.id)) return defaults[exercise.id];
  if (autoLevels[exercise.id]) return autoLevels[exercise.id];
  return exercise.userProgress[0]?.currentLevel ?? 1;
}

function averageWeightsFromLog(log: ProgressionLog): number | null {
  const vals = [log.weight1, log.weight2, log.weight3].filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);
  if (vals.length === 0) return null;
  return vals.reduce((sum, v) => sum + v, 0) / vals.length;
}

function getEffectiveWeight(avg: number, bandKg?: number | null, modifierWeightKg?: number | null): number {
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

function isGymWeightTrackedExercise(exercise: ProgressionExercise): boolean {
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

function isLikelyCalisthenicsExercise(exercise: ProgressionExercise): boolean {
  const name = (exercise.name || "").toLowerCase().replace(/[-_]+/g, " ");
  const equipment = (exercise.equipmentType || "").toLowerCase();
  const tags = parseCategoryTags(exercise.category).map((tag) => tag.toLowerCase().replace(/[-_]+/g, " "));

  const calisthenicsNameHints = [
    "pull up",
    "chin up",
    "dip",
    "push up",
    "muscle up",
    "front lever",
    "back lever",
    "planche",
    "handstand",
    "l sit",
    "dragon flag",
    "human flag",
  ];
  const calisthenicsEquipmentHints = ["rings", "pull", "dip", "floor", "parallette", "bodyweight"];

  if (exercise.bodyweight || exercise.rings) return true;
  if (tags.some((tag) => tag.includes("calisthenics") || tag.includes("bodyweight"))) return true;
  if (calisthenicsNameHints.some((hint) => name.includes(hint))) return true;
  if (calisthenicsEquipmentHints.some((hint) => equipment.includes(hint))) return true;
  return false;
}

function isGymCategoryExercise(exercise: ProgressionExercise): boolean {
  if (isLikelyCalisthenicsExercise(exercise)) return false;
  const tags = parseCategoryTags(exercise.category).map((tag) => tag.toLowerCase().trim());
  return tags.some((tag) => /\bgym\b/i.test(tag.replace(/[_-]+/g, " ")));
}

function getExerciseCategoryLabel(exercise: ProgressionExercise | undefined): "GYM" | "Cali" {
  if (!exercise) return "Cali";
  return isGymCategoryExercise(exercise) ? "GYM" : "Cali";
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

function getGymTierStandardKg(tier: ProgressionTier, bodyWeightKg: number): number | null {
  const candidates = [tier.targetRepsText || "", tier.description || "", tier.name || ""];
  for (const candidate of candidates) {
    const parsed = parseTierWeightStandardKg(candidate, bodyWeightKg);
    if (parsed != null) return parsed;
  }
  return null;
}

function supportsResistanceBandAssistance(exercise: ProgressionExercise): boolean {
  if (isLikelyCalisthenicsExercise(exercise)) return true;

  const name = (exercise.name || "").toLowerCase();
  const equipment = (exercise.equipmentType || "").toLowerCase();
  const gymHints = ["dumbbell", "barbell", "machine", "cable", "plate", "smith"];

  return !gymHints.some((hint) => equipment.includes(hint) || name.includes(hint));
}

function supportsBodyweightQuickFill(exercise: ProgressionExercise): boolean {
  return isLikelyCalisthenicsExercise(exercise);
}

function getDefaultVariationOptions(exercise: ProgressionExercise): string[] {
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


function getAutoGymLevelFromAverage(
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

  // Priority 1: Database-configured weight standards (admin-set BW% thresholds per exercise+gender)
  const dbStandards = weightStandards?.[exercise.id];
  if (dbStandards) {
    const genderKey = physique.gender === "female" ? "female" : "male";
    const record = genderKey === "female" ? dbStandards.female : dbStandards.male;
    if (record) {
      const tiers = recordToTiers(record);
      const bwPercent = (avgWeight / physique.bodyWeightKg) * 100;
      // Map DB tiers (up to 6) onto exercise tiers by index
      let picked = sortedTiers[0].level;
      for (let i = 0; i < sortedTiers.length && i < tiers.length; i++) {
        if (bwPercent >= tiers[i].minPercentage) picked = sortedTiers[i].level;
      }
      return picked;
    }
  }

  // Priority 2: Explicit standards parsed from tier text (e.g. "50% BW", "60kg")
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

  // Priority 3: Fallback hardcoded BW% seeds per gender
  const bwPercent = (avgWeight / physique.bodyWeightKg) * 100;
  const targets = getGymTierTargets(physique.gender, sortedTiers.length);

  let picked = sortedTiers[0].level;
  for (let i = 0; i < sortedTiers.length; i++) {
    if (bwPercent >= targets[i]) picked = sortedTiers[i].level;
  }
  return picked;
}

function getAutoGymLevelFromSet(
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

function recentAverageWeightBandAdjusted(logs: ProgressionLog[], limit = 3): number | null {
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

function getAutoGymLevel(exercise: ProgressionExercise, physique: UserPhysiqueSettings, weightStandards?: WeightStandardsMap): number | null {
  const logs = exercise.userProgress[0]?.logs ?? [];
  const avgWeight = recentAverageWeightBandAdjusted(logs, 3);
  return getAutoGymLevelFromAverage(exercise, physique, avgWeight, weightStandards);
}

function getTierName(exercise: ProgressionExercise, level: number): string {
  const tier = exercise.tiers.find((t) => t.level === level);
  return tier ? tier.name : `Level ${level}`;
}

function tierUsesHoldTarget(tier: ProgressionTier): boolean {
  if (tier.targetHold != null) return true;
  // Upload pipeline appends "Target: ..." when the source JSON used targetHoldTime.
  return /\btarget\s*:/i.test(tier.description || "");
}

function tierUsesWeightTarget(tier: ProgressionTier): boolean {
  const hasRepsTarget =
    tier.targetReps != null ||
    (typeof tier.targetRepsText === "string" && tier.targetRepsText.trim().length > 0);
  if (hasRepsTarget) return true;
  // Upload pipeline appends this marker when source JSON used targetWeight.
  return /\btarget\s*weight\s*:/i.test(tier.description || "");
}

function hasHoldBasedTiers(exercise: ProgressionExercise): boolean {
  return exercise.tiers.some((t) => tierUsesHoldTarget(t));
}

function getTierInputMode(exercise: ProgressionExercise, level: number): "weight" | "hold" {
  const tier = exercise.tiers.find((t) => t.level === level);
  if (tier) {
    if (tierUsesWeightTarget(tier)) return "weight";
    if (tierUsesHoldTarget(tier)) return "hold";
  }
  return hasHoldBasedTiers(exercise) ? "hold" : "weight";
}

const DIFFICULTY_SCALE = [
  "Mortal",
  "Foundation Establishment",
  "Core Formation",
  "Nascent Soul",
  "Soul Splitting",
  "Tribulation Transcendence",
  "Immortal",
  "Heavenly Dao",
] as const;

function getWeightedDifficulty(
  exercise: ProgressionExercise,
  level: number,
  variantName?: string | null,
  modifierType?: string | null,
): string {
  const sorted = [...exercise.tiers].sort((a, b) => a.level - b.level);
  const idx = sorted.findIndex((t) => t.level === level);
  const maxIdx = Math.max(sorted.length - 1, 1);

  // Base score from tier level position (0.0 → 1.0)
  let score = idx === -1 ? 0 : idx / maxIdx;

  // Variation shift: map variation difficulty to scale, shift ±0.15
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

  // Modifier shift: map difficultyMod to ±0.15
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

function getEquipmentTags(exercise: ProgressionExercise): string[] {
  const tags: string[] = [];
  if (exercise.bodyweight) tags.push("Bodyweight");
  if (exercise.weighted) tags.push("Weighted");
  if (exercise.rings) tags.push("Rings");
  if (tags.length === 0) tags.push(exercise.equipmentType);
  return tags;
}

// ── Equipment Badge ──

function EquipmentBadges({ exercise }: { exercise: ProgressionExercise }) {
  const badges: { label: string; color: string }[] = [];
  if (exercise.bodyweight) badges.push({ label: "BW", color: "text-jade-glow border-jade/40" });
  if (exercise.weighted) badges.push({ label: "W", color: "text-gold border-gold-dim/40" });
  if (exercise.rings) badges.push({ label: "R", color: "text-crimson-light border-crimson/40" });
  if (badges.length === 0) badges.push({ label: exercise.equipmentType, color: "text-mist-light border-ink-light" });

  return (
    <div className="flex gap-0.5">
      {badges.map((b) => (
        <span key={b.label} className={`text-[9px] px-1 py-0 border rounded ${b.color}`}>
          {b.label}
        </span>
      ))}
    </div>
  );
}

// ── Level Status Icon ──

function LevelStatus({ tierLevel, currentLevel, logs }: { tierLevel: number; currentLevel: number; logs: ProgressionLog[] }) {
  const completedLogs = logs.filter((l) => l.level === tierLevel && l.completed);
  if (completedLogs.length > 0) return <span className="text-jade-glow text-xs">✦</span>;
  if (tierLevel === currentLevel) return <span className="text-gold text-xs animate-pulse">◆</span>;
  if (tierLevel < currentLevel) return <span className="text-jade/60 text-xs">✓</span>;
  return <span className="text-mist-dark text-xs">○</span>;
}

// ── Detail View Modal ──

function ExerciseDetailModal({
  exercise,
  isOpen,
  onClose,
}: {
  exercise: ProgressionExercise | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { settings } = useDisplaySettings();

  if (!exercise) return null;

  const isFantasy = settings.terminologyMode === "fantasy";
  const progress = exercise.userProgress[0];
  const currentLevel = progress?.currentLevel ?? 1;
  const logs = progress?.logs ?? [];
  const totalTiers = exercise.tiers.length;
  const completedTiers = exercise.tiers.filter((t) =>
    logs.some((l) => l.level === t.level && l.completed)
  ).length;
  const progressPercent = totalTiers > 0 ? Math.round((Math.min(currentLevel - 1, totalTiers) / totalTiers) * 100) : 0;

  const modalDiffKey = getWeightedDifficulty(exercise, currentLevel);
  const modalDiffDisplay = getDifficultyDisplayName(exercise, settings.terminologyMode) || modalDiffKey;
  const diffColorClass = getDifficultyColorClass(modalDiffKey);
  const primaryMuscles = exercise.primaryMuscles.split(",").map((m) => m.trim()).filter(Boolean);
  const secondaryMuscles = exercise.secondaryMuscles.split(",").map((m) => m.trim()).filter(Boolean);
  const categoryTags = parseCategoryTags(exercise.category);
  const completionRate = totalTiers > 0 ? Math.round((completedTiers / totalTiers) * 100) : 0;

  return (
    <GlowModal
      isOpen={isOpen}
      onClose={onClose}
      title={getExerciseDisplayName(exercise, settings.terminologyMode)}
      panelClassName="!max-w-3xl"
    >
      <div className="space-y-4">
        <section className="rounded-xl border border-jade/25 bg-gradient-to-br from-ink-mid/70 to-ink-dark/80 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl">{getExerciseIcon(getTypeColorKey(exercise))}</span>
                <h3 className="text-sm text-cloud-white font-semibold truncate">{getExerciseDisplayName(exercise, settings.terminologyMode)}</h3>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${diffColorClass} bg-ink-dark/50 border border-current/30`}>
                  {modalDiffDisplay}
                </span>
                {exercise.type && (
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getTypeColor(getTypeColorKey(exercise))} bg-ink-dark/40 border border-current/15`}>
                    {getTypeDisplayName(exercise, settings.terminologyMode)}
                  </span>
                )}
                <EquipmentBadges exercise={exercise} />
              </div>
              {isFantasy && exercise.name && exercise.name !== exercise.wuxiaName && (
                <p className="text-[11px] text-mist-mid">{exercise.name}</p>
              )}
              {exercise.story && (
                <p className="text-[11px] text-mist-light/90 leading-relaxed">{exercise.story}</p>
              )}
            </div>
            <div className="shrink-0 min-w-[98px] rounded-lg border border-jade/30 bg-ink-dark/60 px-2 py-1.5 text-center">
              <p className="text-[9px] text-mist-dark uppercase tracking-wider">Completed</p>
              <p className="text-sm text-jade-light font-semibold">{completedTiers}/{totalTiers}</p>
              <p className="text-[10px] text-mist-mid">{completionRate}%</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-ink-light/40 bg-ink-dark/40 p-2.5 space-y-2">
            <p className="text-[10px] text-mist-light uppercase tracking-wider">Muscle Focus</p>
            <div className="flex flex-wrap gap-1">
              {primaryMuscles.map((m) => (
                <span key={`p-${m}`} className="text-[10px] px-2 py-0.5 rounded bg-jade-deep/35 text-jade-light border border-jade/25">{m}</span>
              ))}
              {secondaryMuscles.map((m) => (
                <span key={`s-${m}`} className="text-[10px] px-2 py-0.5 rounded bg-ink-mid/55 text-mist-light border border-ink-light/35">{m}</span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-ink-light/40 bg-ink-dark/40 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-mist-light uppercase tracking-wider">Progress</p>
              <p className="text-[10px] text-mist-mid">Lv.{currentLevel}</p>
            </div>
            <div className="h-1.5 bg-ink-mid rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-jade-deep to-jade-glow transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {categoryTags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {categoryTags.map((tag) => (
                  <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded border border-gold-dim/25 text-gold/90 bg-gold-dim/10">{tag}</span>
                ))}
              </div>
            )}
          </div>
        </section>

        <section>
          <h4 className="text-[10px] text-mist-light uppercase tracking-wider mb-1.5">Progression Tiers</h4>
          <div className="space-y-1.5">
            {exercise.tiers.map((tier) => {
              const isCompleted = logs.some((l) => l.level === tier.level && l.completed);
              const isCurrent = tier.level === currentLevel;
              const weightFromDescription = (tier.description || "").match(/target\s*weight\s*:\s*([^\)]+)/i)?.[1]?.trim();
              const targetRepsLabel = tier.targetReps != null
                ? String(tier.targetReps)
                : (typeof tier.targetRepsText === "string" ? tier.targetRepsText.trim() : "");

              return (
                <div
                  key={tier.id}
                  className={`rounded-lg border px-2.5 py-2 transition-colors ${
                    isCurrent
                      ? "bg-ink-mid/30 border-gold/35"
                      : isCompleted
                        ? "bg-jade-deep/10 border-jade/20"
                        : "bg-ink-dark/35 border-ink-light/30"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="pt-px">
                      <LevelStatus tierLevel={tier.level} currentLevel={currentLevel} logs={logs} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-mist-dark font-mono">Lv.{tier.level}</span>
                        <span className={`text-xs font-medium ${isCompleted ? "text-jade-light" : isCurrent ? "text-gold" : "text-cloud-white"}`}>
                          {getExerciseDisplayName(exercise, settings.terminologyMode)}
                        </span>
                        {(tier.difficulty || tier.wuxiaDifficulty) && (
                          <span className={`text-[9px] px-1.5 py-0 rounded-full ${getDifficultyColor(getDifficultyColorKey(tier))} bg-ink-dark/40 border border-current/15`}>
                            {getDifficultyDisplayName(tier, settings.terminologyMode)}
                          </span>
                        )}
                      </div>
                      {isFantasy && tier.wuxiaName && tier.name !== tier.wuxiaName && (
                        <p className="text-[10px] text-mist-dark">{tier.name}</p>
                      )}
                      {tier.description && <p className="text-[10px] text-mist-mid leading-snug mt-0.5">{tier.description}</p>}
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {tier.targetHold != null && (
                          <span className="text-[9px] text-mountain-blue-glow bg-mountain-blue/10 border border-mountain-blue/25 rounded px-1.5 py-0.5">Hold {tier.targetHold}s</span>
                        )}
                        {targetRepsLabel && (
                          <span className="text-[9px] text-jade-light bg-jade-deep/20 border border-jade/25 rounded px-1.5 py-0.5">Reps {targetRepsLabel}</span>
                        )}
                        {weightFromDescription && (
                          <span className="text-[9px] text-gold bg-gold-dim/10 border border-gold-dim/30 rounded px-1.5 py-0.5">Weight {weightFromDescription}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Variations */}
        {exercise.variations.length > 0 && (
          <section className="pt-2 border-t border-ink-light/40">
            <h4 className="text-[10px] text-mist-light uppercase tracking-wider mb-1.5">Variations</h4>
            <div className="grid grid-cols-1 gap-1.5">
              {exercise.variations.map((v) => (
                <div key={v.id} className="text-[11px] flex items-center gap-1.5 rounded-md border border-ink-light/30 bg-ink-dark/35 px-2 py-1.5">
                  <span className="text-mountain-blue-glow shrink-0">◇</span>
                  <span className="text-cloud-white flex-1 min-w-0 truncate">{getExerciseDisplayName(v, settings.terminologyMode)}</span>
                  {v.difficulty && (
                    <span className={`text-[9px] px-1.5 py-0 rounded-full ${getDifficultyColor(getDifficultyColorKey(v))} bg-ink-dark/40 border border-current/15`}>
                      {getDifficultyDisplayName(v, settings.terminologyMode)}
                    </span>
                  )}
                  {isFantasy && v.wuxiaName && v.name !== v.wuxiaName && (
                    <span className="text-mist-dark text-[10px]">({v.name})</span>
                  )}
                  {v.description && <span className="text-mist-dark text-[10px]">- {v.description}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Modifiers */}
        {exercise.modifiers.length > 0 && (
          <section className="pt-2 border-t border-ink-light/40">
            <h4 className="text-[10px] text-mist-light uppercase tracking-wider mb-1.5">Modifiers</h4>
            <div className="space-y-1">
              {exercise.modifiers.map((m) => (
                <div key={m.id} className="text-[11px] flex items-center gap-1.5 rounded-md border border-ink-light/30 bg-ink-dark/35 px-2 py-1.5">
                  <span className={m.available ? "text-jade-glow" : "text-mist-dark"}>{m.available ? "●" : "○"}</span>
                  <span className="text-cloud-white capitalize flex-1 min-w-0">{m.type}</span>
                  {m.difficultyMod !== 0 && <span className="text-gold text-[9px] font-mono">{m.difficultyMod > 0 ? "+" : ""}{m.difficultyMod}</span>}
                  {m.notes && <span className="text-mist-dark text-[10px]">({m.notes})</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tips */}
        {parseTips(exercise.tips).length > 0 && (
          <section className="pt-2 border-t border-ink-light/40">
            <h4 className="text-[10px] text-mist-light uppercase tracking-wider mb-1.5">Cultivation Tips</h4>
            <ul className="space-y-0.5">
              {parseTips(exercise.tips).map((tip, i) => (
                <li key={i} className="text-[11px] text-mist-mid flex gap-1.5">
                  <span className="text-jade-glow shrink-0">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </GlowModal>
  );
}

// ── Tier Progress Bar (bodyweight-percentage based) ──

interface TierInfo {
  tier: number;
  name: string;
  minPercentage: number;
  maxPercentage: number;
  color: string;
}

const TIER_STANDARDS: TierInfo[] = [
  { tier: 1, name: "Untrained", minPercentage: 0, maxPercentage: 50, color: "#4ade80" },
  { tier: 2, name: "Beginner", minPercentage: 50, maxPercentage: 75, color: "#fbbf24" },
  { tier: 3, name: "Novice", minPercentage: 75, maxPercentage: 100, color: "#f87171" },
  { tier: 4, name: "Intermediate", minPercentage: 100, maxPercentage: 125, color: "#a78bfa" },
  { tier: 5, name: "Advanced", minPercentage: 125, maxPercentage: 150, color: "#f472b6" },
  { tier: 6, name: "Elite", minPercentage: 150, maxPercentage: Infinity, color: "#67e8f9" },
];

function calculateTier(avgWeight: number, userBodyweight: number) {
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

/** Compute the tier glow color from an exercise's logged weights and user bodyweight. */
function getTierGlowFromLogs(
  exercise: ProgressionExercise,
  userBodyweightKg: number | null,
): { glowColor: string; tierName: string } {
  const DEFAULT_COLOR = TIER_STANDARDS[0].color; // Untrained grey
  if (!userBodyweightKg || userBodyweightKg <= 0) {
    return { glowColor: DEFAULT_COLOR, tierName: TIER_STANDARDS[0].name };
  }

  const logs = exercise.userProgress?.[0]?.logs ?? [];
  if (logs.length === 0) {
    return { glowColor: DEFAULT_COLOR, tierName: TIER_STANDARDS[0].name };
  }

  // Sort descending by date
  const sorted = [...logs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  // Group by session date, take last 3 sessions
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

function TierProgressBar({
  exercise,
  userBodyweightKg,
}: {
  exercise: ProgressionExercise;
  userBodyweightKg: number | null;
}) {
  const { isMobile } = useAppContext();

  // Only show for weighted exercises (not timed / pure bodyweight without weight)
  const isWeightedExercise = exercise.weighted || false;
  const isBodyweightExercise = exercise.bodyweight || false;
  if (!isWeightedExercise && !isBodyweightExercise) return null;

  // Show message if no bodyweight set
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

  // Get average weight from last 3 sessions
  const logs = exercise.userProgress?.[0]?.logs ?? [];
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Group by session date (unique dates), take last 3 sessions
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

  // Collect all weights from those sessions (subtract band assistance)
  const allWeights: number[] = [];
  for (const log of sessionLogs) {
    const { resistanceBandKg: bandKg, modifierWeightKg } = parseModifierWithBand(log.modifier);
    if (log.weight1 && log.weight1 > 0) allWeights.push(getEffectiveWeight(log.weight1, bandKg, modifierWeightKg));
    if (log.weight2 && log.weight2 > 0) allWeights.push(getEffectiveWeight(log.weight2, bandKg, modifierWeightKg));
    if (log.weight3 && log.weight3 > 0) allWeights.push(getEffectiveWeight(log.weight3, bandKg, modifierWeightKg));
  }

  // No data state
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

      {/* Segmented progress bar */}
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

      {/* Tier info */}
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

// ── Inline Log Form (appears above table for selected exercises) ──

function InlineLogForm({
  queueItemId,
  exercise,
  selectedLevel,
  onSubmit,
  onChangeLevel,
  onDismiss,
  onViewDetail: _onViewDetail,
  onExit,
  draftStorageKey,
  physique,
  userId,
}: {
  queueItemId: string;
  exercise: ProgressionExercise;
  selectedLevel: number;
  onSubmit: (queueItemId: string, exerciseId: string, level: number, data: {
    weight1?: number; reps1?: number;
    weight2?: number; reps2?: number;
    weight3?: number; reps3?: number;
    holdTime?: number; holdTime2?: number; holdTime3?: number; modifier?: string; resistanceBandKg?: number; variant?: string; notes?: string;
  }) => Promise<void>;
  onChangeLevel: (exerciseId: string, level: number) => void;
  onDismiss: (queueItemId: string) => void;
  onViewDetail: (exerciseId: string) => void;
  onExit?: () => void;
  draftStorageKey?: string | null;
  physique: UserPhysiqueSettings;
  userId: string | null;
}) {
  const [w1, setW1] = useState("");
  const [r1, setR1] = useState("");
  const [w2, setW2] = useState("");
  const [r2, setR2] = useState("");
  const [w3, setW3] = useState("");
  const [r3, setR3] = useState("");
  const [hold, setHold] = useState("");
  const [hold2, setHold2] = useState("");
  const [hold3, setHold3] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedModifierKg, setSelectedModifierKg] = useState("");
  const [selectedResistanceBand, setSelectedResistanceBand] = useState("");
  const [selectedVariation, setSelectedVariation] = useState("");
  // Track which config fields were auto-populated from last session (for asterisk indicator)
  const [autoPopulated, setAutoPopulated] = useState<{ modifierKg: boolean; band: boolean; variation: boolean }>({ modifierKg: false, band: false, variation: false });
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shakeError, setShakeError] = useState(false);
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");
  const [inputMode, setInputMode] = useState<"weight" | "hold">(() => getTierInputMode(exercise, selectedLevel));
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
  const [timerElapsedMs, setTimerElapsedMs] = useState(0);
  const [timerTick, setTimerTick] = useState(0);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [timerTarget, setTimerTarget] = useState<"hold" | "hold2" | "hold3">("hold");
  const [timerReps, setTimerReps] = useState("");
  const [activeMobileSet, setActiveMobileSet] = useState<1 | 2 | 3>(1);
  const [draftReady, setDraftReady] = useState(false);
  const [latestCheckInWeightKg, setLatestCheckInWeightKg] = useState<number | null>(null);
  const prevDraftKeyRef = useRef<string | null>(null);
  const showHold = inputMode === "hold";
  const { settings } = useDisplaySettings();
  const { isMobile } = useAppContext();

  const mode = settings.progressionCardMode ?? "name-illumination-realm-path";
  const cardStyle = settings.progressionCardStyle ?? "default";
  const isCompact = settings.progressionCardCompact ?? false;
  const glowIntensity = settings.glowIntensityProgressionCards ?? 100;
  const loreVisible = settings.progressionCardLoreVisible ?? true;

  const _showIllumination = mode !== "name-only";
  const _showRealm = mode === "name-illumination-realm" || mode === "name-illumination-realm-path";
  const showPath = mode === "name-illumination-realm-path";
  const isScrollStyle = cardStyle === "scroll-card";

  const _diffColorClass = getDifficultyColorClass(getWeightedDifficulty(exercise, selectedLevel, selectedVariation || undefined, undefined));
  const _glowStyle = getDifficultyGlowStyleScaled(getWeightedDifficulty(exercise, selectedLevel, selectedVariation || undefined, undefined), glowIntensity);
  const currentDifficulty = getWeightedDifficulty(exercise, selectedLevel, selectedVariation || undefined, undefined);
  const currentDifficultyDisplay = getDifficultyDisplayName(
    { difficulty: currentDifficulty, wuxiaDifficulty: currentDifficulty },
    settings.terminologyMode
  ) || currentDifficulty;
  const displayName = getExerciseDisplayName(exercise, settings.terminologyMode);
  const typeKey = getTypeColorKey(exercise);
  const typeEmoji = typeKey === "Upper Heaven" ? "☁️"
    : typeKey === "Lower Realms" ? "🔥"
    : typeKey === "Heart Meridian" ? "💚"
    : "⭐";
  const isGymExercise = isGymCategoryExercise(exercise);
  const showResistanceBand = supportsResistanceBandAssistance(exercise);
  const showAddedWeight = supportsResistanceBandAssistance(exercise);
  const showBodyweightQuickFill = supportsBodyweightQuickFill(exercise);
  const canUseBwQuickFill = !showHold && showBodyweightQuickFill;
  const availableVariationOptions = useMemo(() => {
    const options = new Set<string>();

    for (const variation of exercise.variations ?? []) {
      const name = String(variation.name || "").trim();
      if (name) options.add(name);
    }

    const logs = exercise.userProgress?.flatMap((up) => up.logs) ?? [];
    for (const log of logs) {
      const variant = String(log.variant || "").trim();
      if (variant) options.add(variant);
    }

    const current = String(selectedVariation || "").trim();
    if (current) options.add(current);

    for (const fallbackOption of getDefaultVariationOptions(exercise)) {
      const value = String(fallbackOption || "").trim();
      if (value) options.add(value);
    }

    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [exercise, exercise.variations, exercise.userProgress, selectedVariation]);

  const handleBackNavigation = useCallback(() => {
    if (onExit) {
      onExit();
      return;
    }
    onDismiss(queueItemId);
  }, [onDismiss, onExit, queueItemId]);

  const resetEntryFields = () => {
    setW1("");
    setR1("");
    setW2("");
    setR2("");
    setW3("");
    setR3("");
    setHold("");
    setHold2("");
    setHold3("");
    resetTimer();
    setActiveMobileSet(1);
  };

  const mobileWeightSets = [
    { id: 1 as const, title: "Set 1", primaryLabel: `Weight (${weightUnit})`, primaryValue: w1, setPrimary: setW1, secondaryLabel: "Reps", secondaryValue: r1, setSecondary: setR1 },
    { id: 2 as const, title: "Set 2", primaryLabel: `Weight (${weightUnit})`, primaryValue: w2, setPrimary: setW2, secondaryLabel: "Reps", secondaryValue: r2, setSecondary: setR2 },
    { id: 3 as const, title: "Set 3", primaryLabel: `Weight (${weightUnit})`, primaryValue: w3, setPrimary: setW3, secondaryLabel: "Reps", secondaryValue: r3, setSecondary: setR3 },
  ];

  const mobileHoldSets = [
    { id: 1 as const, title: "Set 1", primaryLabel: "Hold time (sec)", primaryValue: hold, setPrimary: setHold, secondaryLabel: "Work reps", secondaryValue: r1, setSecondary: setR1, timerKey: "hold" as const },
    { id: 2 as const, title: "Set 2", primaryLabel: "Hold time (sec)", primaryValue: hold2, setPrimary: setHold2, secondaryLabel: "Work reps", secondaryValue: r2, setSecondary: setR2, timerKey: "hold2" as const },
    { id: 3 as const, title: "Set 3", primaryLabel: "Hold time (sec)", primaryValue: hold3, setPrimary: setHold3, secondaryLabel: "Work reps", secondaryValue: r3, setSecondary: setR3, timerKey: "hold3" as const },
  ];

  const mobileSetConfigs = showHold ? mobileHoldSets : mobileWeightSets;

  const getMobileSetSummary = (setId: 1 | 2 | 3) => {
    if (showHold) {
      const holdValue = setId === 1 ? hold : setId === 2 ? hold2 : hold3;
      const repsValue = setId === 1 ? r1 : setId === 2 ? r2 : r3;
      return `${holdValue || "-"}s • ${repsValue || "-"} reps`;
    }

    const weightValue = setId === 1 ? w1 : setId === 2 ? w2 : w3;
    const repsValue = setId === 1 ? r1 : setId === 2 ? r2 : r3;
    return `${weightValue || "-"} ${weightUnit} • ${repsValue || "-"} reps`;
  };

  const mobilePanelBorder = `${getTierGlowFromLogs(exercise, physique.bodyWeightKg).glowColor}30`;
  const popupLoggerStyle = settings.popupLoggerStyle ?? "classic";
  const useSetPanelLayout = popupLoggerStyle === "classic";
  const useMinimalLayout = popupLoggerStyle === "minimal";
  const setInputClass = `w-full border bg-ink-dark text-cloud-white outline-none transition-all duration-200 placeholder:text-mist-dark/35 hover:border-jade-glow/40 hover:bg-ink-dark/80 focus:bg-ink-mid/40 focus:border-jade-glow/60 focus:shadow-[0_0_8px_rgba(58,143,143,0.2)] ${isMobile ? "rounded-xl px-3 py-3 text-sm" : "rounded-lg px-2.5 py-2 text-xs"}`;

  useEffect(() => {
    setInputMode(getTierInputMode(exercise, selectedLevel));
    setTimerRunning(false);
    setTimerStartedAt(null);
    setTimerElapsedMs(0);
    setTimerTick(0);
    setActiveMobileSet(1);
  }, [exercise, exercise.id, selectedLevel]);

  useEffect(() => {
    if (!canUseBwQuickFill || !userId) {
      setLatestCheckInWeightKg(null);
      return;
    }

    let cancelled = false;
    fetch(`/api/checkins/latest-weight?userId=${encodeURIComponent(userId)}`)
      .then(async (res) => {
        if (!res.ok) return null;
        const json = await res.json() as { weight?: number | null };
        const parsed = typeof json.weight === "number" && Number.isFinite(json.weight) && json.weight > 0
          ? json.weight
          : null;
        if (!cancelled) setLatestCheckInWeightKg(parsed);
      })
      .catch(() => {
        if (!cancelled) setLatestCheckInWeightKg(null);
      });

    return () => {
      cancelled = true;
    };
  }, [canUseBwQuickFill, userId, exercise.id]);

  useEffect(() => {
    const draftKey = draftStorageKey ?? null;
    if (!draftKey) {
      setDraftReady(true);
      prevDraftKeyRef.current = null;
      return;
    }

    if (prevDraftKeyRef.current === draftKey && draftReady) return;

    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as Record<string, unknown>;
        setW1(typeof draft.w1 === "string" ? draft.w1 : "");
        setR1(typeof draft.r1 === "string" ? draft.r1 : "");
        setW2(typeof draft.w2 === "string" ? draft.w2 : "");
        setR2(typeof draft.r2 === "string" ? draft.r2 : "");
        setW3(typeof draft.w3 === "string" ? draft.w3 : "");
        setR3(typeof draft.r3 === "string" ? draft.r3 : "");
        setHold(typeof draft.hold === "string" ? draft.hold : "");
        setHold2(typeof draft.hold2 === "string" ? draft.hold2 : "");
        setHold3(typeof draft.hold3 === "string" ? draft.hold3 : "");
        setNotes(typeof draft.notes === "string" ? draft.notes : "");
        setSelectedModifierKg(typeof draft.selectedModifierKg === "string" ? draft.selectedModifierKg : "");
        setSelectedResistanceBand(typeof draft.selectedResistanceBand === "string" ? draft.selectedResistanceBand : "");
        setSelectedVariation(typeof draft.selectedVariation === "string" ? draft.selectedVariation : "");
        setWeightUnit(draft.weightUnit === "lbs" ? "lbs" : "kg");
        setInputMode(draft.inputMode === "hold" ? "hold" : "weight");
        setActiveMobileSet(draft.activeMobileSet === 2 || draft.activeMobileSet === 3 ? draft.activeMobileSet : 1);
      }
    } catch {
      // Ignore draft parse/storage errors.
    }

    prevDraftKeyRef.current = draftKey;
    setDraftReady(true);
  }, [draftStorageKey, draftReady]);

  // Pre-fill modifier, band, and variation from latest log when no draft values exist
  useEffect(() => {
    if (!draftReady) return;

    // Only pre-fill if all config fields are currently empty (not overriding draft data)
    if (selectedModifierKg || selectedResistanceBand || selectedVariation) return;

    // Find the most recent log for this exercise
    const logs = exercise.userProgress?.flatMap((up) => up.logs) ?? [];
    if (logs.length === 0) return;

    const sortedLogs = [...logs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const latestLog = sortedLogs[0];
    if (!latestLog) return;

    const { resistanceBandKg, modifierWeightKg } = parseModifierWithBand(latestLog.modifier);
    const autoFlags = { modifierKg: false, band: false, variation: false };
    if (modifierWeightKg != null) { setSelectedModifierKg(String(modifierWeightKg)); autoFlags.modifierKg = true; }
    if (resistanceBandKg != null) { setSelectedResistanceBand(String(resistanceBandKg)); autoFlags.band = true; }
    if (latestLog.variant) { setSelectedVariation(latestLog.variant); autoFlags.variation = true; }
    if (autoFlags.modifierKg || autoFlags.band || autoFlags.variation) {
      setAutoPopulated(autoFlags);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftReady, exercise.id]);

  useEffect(() => {
    if (!draftStorageKey || !draftReady) return;

    try {
      sessionStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          w1,
          r1,
          w2,
          r2,
          w3,
          r3,
          hold,
          hold2,
          hold3,
          notes,
          selectedModifierKg,
          selectedResistanceBand,
          selectedVariation,
          weightUnit,
          inputMode,
          activeMobileSet,
        })
      );
    } catch {
      // Ignore draft persistence failures.
    }
  }, [
    draftStorageKey,
    draftReady,
    w1,
    r1,
    w2,
    r2,
    w3,
    r3,
    hold,
    hold2,
    hold3,
    notes,
    selectedModifierKg,
    selectedResistanceBand,
    selectedVariation,
    weightUnit,
    inputMode,
    activeMobileSet,
  ]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => setTimerTick(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      handleBackNavigation();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleBackNavigation]);

  useEffect(() => {
    const onPopState = () => {
      handleBackNavigation();
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [handleBackNavigation]);

  const liveTimerMs = timerElapsedMs + (timerRunning && timerStartedAt ? (timerTick - timerStartedAt) : 0);
  const liveTimerSeconds = Math.max(0, Math.round(liveTimerMs / 1000));
  const timerMinutes = Math.floor(liveTimerSeconds / 60).toString().padStart(2, "0");
  const timerSeconds = (liveTimerSeconds % 60).toString().padStart(2, "0");
  const timerMillis = Math.max(0, Math.floor(liveTimerMs % 1000)).toString().padStart(3, "0");

  const resetTimer = () => {
    setTimerRunning(false);
    setTimerStartedAt(null);
    setTimerElapsedMs(0);
    setTimerTick(0);
  };

  const getNextTimerTarget = (): "hold" | "hold2" | "hold3" => {
    if (!hold) return "hold";
    if (!hold2) return "hold2";
    return "hold3";
  };

  const closeTimerModal = () => {
    resetTimer();
    setShowTimerModal(false);
    setTimerTarget(getNextTimerTarget());
    setTimerReps("");
  };

  const handleTimerButton = () => {
    if (!timerRunning) {
      setTimerStartedAt(Date.now());
      setTimerTick(Date.now());
      setTimerRunning(true);
      return;
    }

    const now = Date.now();
    const totalMs = timerElapsedMs + (timerStartedAt ? now - timerStartedAt : 0);
    const seconds = Math.max(1, Math.round(totalMs / 1000));
    setTimerElapsedMs(totalMs);
    setTimerStartedAt(null);
    setTimerRunning(false);

    // Stopping auto-writes to selected target, then advances target without closing.
    if (timerTarget === "hold") {
      setHold(String(seconds));
      if (timerReps.trim()) setR1(timerReps.trim());
      setTimerTarget("hold2");
    } else if (timerTarget === "hold2") {
      setHold2(String(seconds));
      if (timerReps.trim()) setR2(timerReps.trim());
      setTimerTarget("hold3");
    } else {
      setHold3(String(seconds));
      if (timerReps.trim()) setR3(timerReps.trim());
      setTimerTarget("hold3");
    }

    resetTimer();
    setTimerReps("");
    if (shakeError) setShakeError(false);
  };

  const handleSubmit = async () => {
    const primaryMissing = showHold ? (!hold && !r1) : (!w1 && !r1);
    if (primaryMissing) {
      setShakeError(true);
      return;
    }
    const hasData = w1 || r1 || w2 || r2 || w3 || r3 || hold || hold2 || hold3 || notes || selectedModifierKg || selectedResistanceBand || selectedVariation;
    if (!hasData) return;
    setSubmitting(true);
    setSaved(false);
    try {
      const toKg = (v: string): number => {
        const n = parseFloat(v);
        return weightUnit === "lbs" ? Math.round(n * 453.592) / 1000 : n;
      };
      const resistanceBandKg = selectedResistanceBand ? parseFloat(selectedResistanceBand) : undefined;
      const modifierWeightKg = selectedModifierKg ? parseFloat(selectedModifierKg) : undefined;
      await onSubmit(queueItemId, exercise.id, selectedLevel, {
        weight1: w1 ? toKg(w1) : undefined,
        reps1: r1 ? parseInt(r1) : undefined,
        weight2: w2 ? toKg(w2) : undefined,
        reps2: r2 ? parseInt(r2) : undefined,
        weight3: w3 ? toKg(w3) : undefined,
        reps3: r3 ? parseInt(r3) : undefined,
        holdTime: hold ? parseInt(hold) : undefined,
        holdTime2: hold2 ? parseInt(hold2) : undefined,
        holdTime3: hold3 ? parseInt(hold3) : undefined,
        modifier: buildModifierWithBand(null, resistanceBandKg, selectedLevel, modifierWeightKg) ?? undefined,
        resistanceBandKg: resistanceBandKg ?? undefined,
        variant: selectedVariation || undefined,
        notes: notes || undefined,
      });
      resetEntryFields();
      setNotes("");
      setSelectedModifierKg("");
      setSelectedResistanceBand("");
      setSelectedVariation("");
      if (draftStorageKey) {
        try {
          sessionStorage.removeItem(draftStorageKey);
        } catch {
          // Ignore draft cleanup failures.
        }
      }

      if (onExit) {
        onExit();
      } else {
        onDismiss(queueItemId);
      }

      setSaved(true);
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const _tierName = getTierName(exercise, selectedLevel);
  const tierGlow = getTierGlowFromLogs(exercise, physique.bodyWeightKg);
  const diffStyle = { glowColor: tierGlow.glowColor };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className={`relative overflow-hidden border-2 rounded-2xl rounded-tr-[26px] rounded-bl-[26px] ${isCompact ? 'p-2' : 'p-3'}`}
        style={{
          background: 'var(--ink-deep)',
          borderColor: `${diffStyle.glowColor}d0`,
          boxShadow: `0 0 20px ${diffStyle.glowColor}88, 0 0 40px ${diffStyle.glowColor}50, 0 0 70px ${diffStyle.glowColor}22, inset 0 0 16px ${diffStyle.glowColor}25, inset 0 0 0 1px ${diffStyle.glowColor}35, inset 0 1px 0 rgba(255,255,255,0.07)`,
        }}
      >
        {/* Tier accent stripe */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{ background: `linear-gradient(to bottom, ${diffStyle.glowColor}, ${diffStyle.glowColor}40)` }}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-2.5 pl-2">
          <div className="flex items-center gap-2 min-w-0">
            {isScrollStyle && (
              <span className="text-sm opacity-80 shrink-0">{typeEmoji}</span>
            )}
            <h4
              className={`${isCompact ? 'text-xs' : 'text-sm'} font-semibold truncate`}
              style={{ color: diffStyle.glowColor }}
            >
              {displayName}
            </h4>
            <span
              className="text-[9px] font-bold px-1.5 py-[1px] rounded shrink-0"
              style={{
                color: diffStyle.glowColor,
                background: `${diffStyle.glowColor}15`,
                border: `1px solid ${diffStyle.glowColor}30`,
              }}
            >
              {tierGlow.tierName}
            </span>
            {showPath && exercise.type && (
              <span className={`text-[9px] font-medium px-1.5 py-0 rounded-full ${getTypeColor(typeKey)} bg-ink-dark/40 border border-current/15 shrink-0`}>
                {getTypeDisplayName(exercise, settings.terminologyMode)}
              </span>
            )}
            {showPath && <EquipmentBadges exercise={exercise} />}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleBackNavigation}
              className="text-mist-dark/60 hover:text-crimson-light transition-colors text-sm px-1.5 py-0.5 rounded hover:bg-crimson-deep/10"
              title="Back"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Lore text */}
        {loreVisible && showPath && exercise.story && !isCompact && (
          <p className="text-[10px] text-mist-mid/70 leading-relaxed line-clamp-2 mb-2.5 pl-2">
            {exercise.story}
          </p>
        )}

        {useSetPanelLayout ? (
          <div className={`pl-2 ${isMobile ? "space-y-3" : "space-y-2"}`}>
            <div className="grid gap-2">
              {/* Category & Type info */}
              <div className={`flex items-center gap-2 border border-ink-light/20 bg-ink-mid/15 ${isMobile ? "rounded-xl px-3 py-2" : "rounded-lg px-2.5 py-1.5"}`}>
                <span className={`${isMobile ? "text-[11px]" : "text-[10px]"} text-mist-light`}>
                  {parseCategoryTags(exercise.category)[0] || "Exercise"} • {exercise.weighted ? "Weighted" : exercise.bodyweight ? "Bodyweight" : "Timed"}
                </span>
              </div>

              {/* Tier Progress Bar */}
              {!showHold && (
                <TierProgressBar
                  exercise={exercise}
                  userBodyweightKg={physique.bodyWeightKg}
                />
              )}

              <div className={`grid gap-2 ${showHold ? "grid-cols-1" : "grid-cols-2"}`}>
                {!showHold && (
                  <div className={`flex overflow-hidden border border-ink-light/30 ${isMobile ? "rounded-xl" : "rounded-lg"}`}>
                    <button
                      onClick={() => setWeightUnit("kg")}
                      className={`flex-1 font-semibold transition-all duration-200 border-r border-ink-light/30 ${isMobile ? "px-3 py-2.5 text-[11px]" : "px-2.5 py-2 text-[10px]"} ${
                        weightUnit === "kg"
                          ? "bg-jade-deep/70 text-cloud-white border-jade-glow/50 shadow-[inset_0_0_0_1px_rgba(58,143,143,0.45),0_0_10px_rgba(58,143,143,0.2)]"
                          : "bg-ink-mid/55 text-mist-light/85 hover:bg-ink-mid/80 hover:text-cloud-white"
                      }`}
                    >
                      KG
                    </button>
                    <button
                      onClick={() => setWeightUnit("lbs")}
                      className={`flex-1 font-semibold transition-all duration-200 ${isMobile ? "px-3 py-2.5 text-[11px]" : "px-2.5 py-2 text-[10px]"} ${
                        weightUnit === "lbs"
                          ? "bg-jade-deep/70 text-cloud-white border-jade-glow/50 shadow-[inset_0_0_0_1px_rgba(58,143,143,0.45),0_0_10px_rgba(58,143,143,0.2)]"
                          : "bg-ink-mid/55 text-mist-light/85 hover:bg-ink-mid/80 hover:text-cloud-white"
                      }`}
                    >
                      LBS
                    </button>
                  </div>
                )}

                <div className={`flex overflow-hidden border border-ink-light/30 ${isMobile ? "rounded-xl" : "rounded-lg"}`}>
                  <button
                    onClick={() => { setInputMode("weight"); resetEntryFields(); }}
                    className={`flex-1 font-semibold transition-all duration-200 border-r ${isMobile ? "px-3 py-2.5 text-[11px]" : "px-2.5 py-2 text-[10px]"} ${
                      inputMode === "weight"
                        ? "bg-jade-deep/55 text-cloud-white border-jade/40 shadow-[inset_0_0_0_1px_rgba(58,143,143,0.25)]"
                        : "bg-ink-mid/60 text-mist-light border-ink-light/30 hover:bg-ink-mid/80 hover:text-cloud-white"
                    }`}
                  >
                    Weight
                  </button>
                  <button
                    onClick={() => { setInputMode("hold"); resetEntryFields(); }}
                    className={`flex-1 font-semibold transition-all duration-200 ${isMobile ? "px-3 py-2.5 text-[11px]" : "px-2.5 py-2 text-[10px]"} ${
                      inputMode === "hold"
                        ? "bg-mountain-blue/30 text-cloud-white shadow-[inset_0_0_0_1px_rgba(94,184,232,0.35)]"
                        : "bg-ink-mid/60 text-mist-light hover:bg-ink-mid/80 hover:text-cloud-white"
                    }`}
                  >
                    Hold
                  </button>
                </div>
              </div>

            </div>

            {(showAddedWeight || showResistanceBand || availableVariationOptions.length > 0) && (
              <div className="grid gap-2">
                {showAddedWeight && (
                  <label className="block space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-dark">
                      Added Weight{autoPopulated.modifierKg && <span className="text-amber-400/70 ml-0.5" title="Pre-filled from last session">*</span>}
                    </span>
                    <select
                      value={selectedModifierKg}
                      onChange={(e) => { setSelectedModifierKg(e.target.value); setAutoPopulated(prev => ({ ...prev, modifierKg: false })); }}
                      className={`w-full border border-ink-light/20 bg-ink-dark text-amber-400 outline-none focus:border-amber-400/40 transition-colors cursor-pointer ${isMobile ? "rounded-xl px-3 py-3 text-sm" : "rounded-lg px-2.5 py-2 text-xs"}`}
                    >
                      <option value="">No added weight</option>
                      {MODIFIER_WEIGHT_OPTIONS.map((kg) => (
                        <option key={kg} value={String(kg)}>
                          {formatModifierWeightLabel(kg)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {showResistanceBand && (
                  <label className="block space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-dark">
                      Resistance band{autoPopulated.band && <span className="text-sky-300/70 ml-0.5" title="Pre-filled from last session">*</span>}
                    </span>
                    <select
                      value={selectedResistanceBand}
                      onChange={(e) => { setSelectedResistanceBand(e.target.value); setAutoPopulated(prev => ({ ...prev, band: false })); }}
                      className={`w-full border border-ink-light/20 bg-ink-dark text-sky-300 outline-none focus:border-sky-300/40 transition-colors cursor-pointer ${isMobile ? "rounded-xl px-3 py-3 text-sm" : "rounded-lg px-2.5 py-2 text-xs"}`}
                    >
                      <option value="">No resistance band</option>
                      {RESISTANCE_BAND_OPTIONS.map((kg) => (
                        <option key={kg} value={String(kg)}>
                          Resistance band {formatResistanceBandLabel(kg)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {availableVariationOptions.length > 0 && (
                  <label className="block space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-dark">
                      Variation{autoPopulated.variation && <span className="text-crimson-light/70 ml-0.5" title="Pre-filled from last session">*</span>}
                    </span>
                    <select
                      value={selectedVariation}
                      onChange={(e) => { setSelectedVariation(e.target.value); setAutoPopulated(prev => ({ ...prev, variation: false })); }}
                      className={`w-full border border-ink-light/20 bg-ink-dark text-crimson-light outline-none focus:border-crimson/40 transition-colors cursor-pointer ${isMobile ? "rounded-xl px-3 py-3 text-sm" : "rounded-lg px-2.5 py-2 text-xs"}`}
                    >
                      <option value="">No variation</option>
                      {availableVariationOptions.map((variationName) => (
                        <option key={variationName} value={variationName}>
                          {variationName}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}

            <div
              className={isMobile ? "space-y-2" : "grid gap-2"}
              style={isMobile ? undefined : { gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
            >
              {mobileSetConfigs.map((setConfig) => {
                const isOpen = isMobile ? activeMobileSet === setConfig.id : true;
                return (
                  <div
                    key={setConfig.id}
                    className={`overflow-hidden border bg-ink-dark/55 ${isMobile ? "rounded-2xl" : "rounded-xl"}`}
                    style={{
                      borderColor: isOpen ? `${diffStyle.glowColor}55` : mobilePanelBorder,
                      boxShadow: isOpen ? `0 0 18px ${diffStyle.glowColor}22` : "none",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (isMobile) setActiveMobileSet(setConfig.id);
                      }}
                      className={`flex w-full items-center justify-between gap-3 text-left ${isMobile ? "px-3 py-3" : "px-2.5 py-2"}`}
                    >
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mist-dark">{setConfig.title}</div>
                        <div className={`mt-1 font-medium text-cloud-white ${isMobile ? "text-sm" : "text-xs"}`}>{getMobileSetSummary(setConfig.id)}</div>
                      </div>
                      {isMobile && (
                        <span className="text-lg leading-none" style={{ color: diffStyle.glowColor }}>
                          {isOpen ? "−" : "+"}
                        </span>
                      )}
                    </button>

                    {isOpen && (
                      <div className={`border-t ${isMobile ? "space-y-3 px-3 py-3" : "space-y-2 px-2.5 py-2"}`} style={{ borderColor: `${diffStyle.glowColor}22` }}>
                        {showHold && "timerKey" in setConfig && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowTimerModal(true);
                              setTimerTarget(setConfig.timerKey as "hold" | "hold2" | "hold3");
                              setTimerReps("");
                              resetTimer();
                            }}
                            className={`w-full border font-bold text-cloud-white transition-all ${isMobile ? "rounded-xl px-3 py-2.5 text-[11px]" : "rounded-lg px-2.5 py-2 text-[10px]"}`}
                            style={{
                              background: "rgba(94,184,232,0.18)",
                              borderColor: "rgba(94,184,232,0.55)",
                              boxShadow: `0 0 10px ${diffStyle.glowColor}33`,
                            }}
                          >
                            Use Timer for {setConfig.title.replace("Set", "T")}
                          </button>
                        )}

                        <div className={`grid grid-cols-2 ${isMobile ? "gap-2" : "gap-1.5"}`}>
                          <label className="block space-y-1">
                            <div className="flex items-center justify-between min-h-[18px]">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-dark">{setConfig.primaryLabel}</span>
                              {canUseBwQuickFill && latestCheckInWeightKg != null && (
                                <button
                                  type="button"
                                  onClick={() => setConfig.setPrimary(String(latestCheckInWeightKg))}
                                  className="text-[9px] font-bold px-2 py-1 rounded-md border border-jade-glow/55 bg-jade-deep/35 text-jade-light hover:bg-jade-deep/60 hover:-translate-y-[1px] hover:shadow-[0_0_10px_rgba(58,143,143,0.45)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jade-glow/70 transition-all duration-150"
                                  title={`Apply last check-in weight (${latestCheckInWeightKg}kg)`}
                                >
                                  BW
                                </button>
                              )}
                            </div>
                            <input
                              type="number"
                              min="0"
                              step={showHold ? undefined : "0.5"}
                              max={showHold ? undefined : undefined}
                              value={setConfig.primaryValue}
                              onChange={(e) => {
                                setConfig.setPrimary(e.target.value);
                                if (shakeError && setConfig.id === 1) setShakeError(false);
                              }}
                              placeholder={showHold ? "sec" : "0.0"}
                              className={`${setInputClass}${shakeError && setConfig.id === 1 ? ' animate-shake' : ''}`}
                              style={{
                                borderColor: shakeError && setConfig.id === 1
                                  ? "rgba(220,50,50,0.7)"
                                  : showHold
                                    ? "rgba(94,184,232,0.45)"
                                    : `${diffStyle.glowColor}55`,
                              }}
                            />
                          </label>

                          <label className="block space-y-1">
                            <div className="flex items-center justify-between min-h-[18px]">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-dark">{setConfig.secondaryLabel}</span>
                              <span className="invisible text-[9px] font-bold px-2 py-1">BW</span>
                            </div>
                            <input
                              type="number"
                              min="0"
                              max="500"
                              value={setConfig.secondaryValue}
                              onChange={(e) => {
                                setConfig.setSecondary(e.target.value);
                                if (shakeError && setConfig.id === 1) setShakeError(false);
                              }}
                              placeholder="reps"
                              className={`${setInputClass}${shakeError && setConfig.id === 1 ? ' animate-shake' : ''}`}
                              style={{ borderColor: shakeError && setConfig.id === 1 ? "rgba(220,50,50,0.7)" : "rgba(196,168,74,0.35)" }}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <label className="block space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-dark">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Session notes, cues, or pain markers..."
                rows={isMobile ? 3 : 2}
                className={`w-full border border-ink-light/20 bg-ink-dark text-cloud-white outline-none transition-all duration-200 placeholder:text-mist-dark/40 focus:border-mist-mid/30 focus:bg-ink-mid/30 ${isMobile ? "rounded-xl px-3 py-3 text-sm" : "rounded-lg px-2.5 py-2 text-xs"}`}
              />
            </label>

            <div className="flex flex-col gap-2 pt-1">
              {saved && (
                <motion.span
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="self-end text-xs font-medium"
                  style={{ color: diffStyle.glowColor }}
                >
                  ✦ Saved
                </motion.span>
              )}

              <div className={`grid gap-2 ${showHold ? "grid-cols-2" : "grid-cols-1"}`}>
                {showHold && (
                  <button
                    type="button"
                    onClick={() => { setShowTimerModal(true); setTimerTarget(getNextTimerTarget()); setTimerReps(""); resetTimer(); }}
                    className={`border font-bold text-cloud-white transition-all ${isMobile ? "rounded-xl px-3 py-3 text-[11px]" : "rounded-lg px-2.5 py-2 text-[10px]"}`}
                    style={{
                      background: "rgba(94,184,232,0.22)",
                      borderColor: "rgba(94,184,232,0.6)",
                      boxShadow: `0 0 12px ${diffStyle.glowColor}44`,
                    }}
                    title="Open compact hold timer"
                  >
                    Start Timer
                  </button>
                )}

                <motion.button
                  onClick={handleSubmit}
                  disabled={submitting}
                  animate={saved ? { scale: [1, 1.02, 1] } : { scale: 1 }}
                  whileTap={!submitting ? { scale: 0.98 } : {}}
                  transition={{ duration: 0.3 }}
                  className={`w-full font-semibold disabled:opacity-40 cursor-pointer ${isMobile ? "rounded-xl px-4 py-3 text-sm" : "rounded-lg px-3 py-2 text-xs"}`}
                  style={{
                    background: saved ? `${diffStyle.glowColor}30` : `${diffStyle.glowColor}18`,
                    border: `1px solid ${saved ? `${diffStyle.glowColor}60` : `${diffStyle.glowColor}35`}`,
                    color: diffStyle.glowColor,
                    transition: 'background 0.3s, border-color 0.3s',
                  }}
                >
                  {submitting ? "Saving…" : saved ? "✦ Logged!" : "Log Training Data"}
                </motion.button>
              </div>
            </div>
          </div>
        ) : useMinimalLayout ? (
          /* ── Minimal Layout: Vertical stacked sets ── */
          <div className="pl-2 space-y-2">
            {/* Category & Type info */}
            <div className="flex items-center gap-2 border border-ink-light/20 bg-ink-mid/15 rounded-lg px-2.5 py-1.5">
              <span className="text-[10px] text-mist-light">
                {parseCategoryTags(exercise.category)[0] || "Exercise"} • {exercise.weighted ? "Weighted" : exercise.bodyweight ? "Bodyweight" : "Timed"}
              </span>
            </div>

            {/* Tier Progress Bar */}
            {!showHold && (
              <TierProgressBar
                exercise={exercise}
                userBodyweightKg={physique.bodyWeightKg}
              />
            )}

            {/* Mode + Unit toggle */}
            <div className="flex gap-2">
              {!showHold && (
                <div className="flex rounded-lg overflow-hidden border border-ink-light/30 flex-1">
                  <button onClick={() => setWeightUnit("kg")} className={`flex-1 py-1.5 text-[10px] font-semibold transition-all ${weightUnit === "kg" ? "bg-jade-deep/70 text-cloud-white" : "bg-ink-mid/55 text-mist-light"}`}>KG</button>
                  <button onClick={() => setWeightUnit("lbs")} className={`flex-1 py-1.5 text-[10px] font-semibold transition-all border-l border-ink-light/30 ${weightUnit === "lbs" ? "bg-jade-deep/70 text-cloud-white" : "bg-ink-mid/55 text-mist-light"}`}>LBS</button>
                </div>
              )}
              <div className="flex rounded-lg overflow-hidden border border-ink-light/30 flex-1">
                <button onClick={() => { setInputMode("weight"); resetEntryFields(); }} className={`flex-1 py-1.5 text-[10px] font-semibold transition-all ${inputMode === "weight" ? "bg-jade-deep/55 text-cloud-white" : "bg-ink-mid/60 text-mist-light"}`}>Weight</button>
                <button onClick={() => { setInputMode("hold"); resetEntryFields(); }} className={`flex-1 py-1.5 text-[10px] font-semibold transition-all border-l border-ink-light/30 ${inputMode === "hold" ? "bg-mountain-blue/30 text-cloud-white" : "bg-ink-mid/60 text-mist-light"}`}>Hold</button>
              </div>
            </div>

            {/* Stacked sets — each row: set label + value + reps */}
            {[
              { id: 1, vLabel: showHold ? "T1" : "W1", rLabel: "R1", vGet: showHold ? hold : w1, vSet: showHold ? setHold : setW1, rGet: r1, rSet: setR1 },
              { id: 2, vLabel: showHold ? "T2" : "W2", rLabel: "R2", vGet: showHold ? hold2 : w2, vSet: showHold ? setHold2 : setW2, rGet: r2, rSet: setR2 },
              { id: 3, vLabel: showHold ? "T3" : "W3", rLabel: "R3", vGet: showHold ? hold3 : w3, vSet: showHold ? setHold3 : setW3, rGet: r3, rSet: setR3 },
            ].map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <span className="text-[10px] font-bold w-5 text-right" style={{ color: diffStyle.glowColor }}>{s.vLabel}</span>
                <input
                  type="number" min="0" step={showHold ? undefined : "0.5"}
                  value={s.vGet} onChange={(e) => { s.vSet(e.target.value); if (shakeError && s.id === 1) setShakeError(false); }}
                  placeholder={showHold ? "sec" : "0.0"}
                  className={`flex-1 rounded-lg px-2 py-2 text-xs text-center outline-none bg-ink-dark border text-cloud-white placeholder:text-mist-dark/30 focus:bg-ink-mid/40${shakeError && s.id === 1 ? " animate-shake" : ""}`}
                  style={{ borderColor: shakeError && s.id === 1 ? "rgba(220,50,50,0.7)" : showHold ? "rgba(94,184,232,0.3)" : `${diffStyle.glowColor}40` }}
                />
                {canUseBwQuickFill && latestCheckInWeightKg != null && (
                  <button
                    type="button"
                    onClick={() => s.vSet(String(latestCheckInWeightKg))}
                    className="text-[9px] font-bold px-2 py-1 rounded-md border border-jade-glow/55 bg-jade-deep/35 text-jade-light hover:bg-jade-deep/60 hover:-translate-y-[1px] hover:shadow-[0_0_10px_rgba(58,143,143,0.45)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jade-glow/70 transition-all duration-150 shrink-0"
                    title={`Apply last check-in weight (${latestCheckInWeightKg}kg)`}
                  >
                    BW
                  </button>
                )}
                <span className="text-[10px] font-bold w-5 text-right text-gold/80">{s.rLabel}</span>
                <input
                  type="number" min="0" max="500"
                  value={s.rGet} onChange={(e) => { s.rSet(e.target.value); if (shakeError && s.id === 1) setShakeError(false); }}
                  placeholder="—"
                  className={`w-16 rounded-lg px-2 py-2 text-xs text-center outline-none bg-ink-dark border text-cloud-white placeholder:text-mist-dark/30 focus:border-gold/50 focus:bg-ink-mid/40${shakeError && s.id === 1 ? " animate-shake" : ""}`}
                  style={{ borderColor: shakeError && s.id === 1 ? "rgba(220,50,50,0.7)" : "rgba(196,168,74,0.2)" }}
                />
              </div>
            ))}

            {/* Quick modifier/variant selectors (collapsed) */}
            {(showAddedWeight || showResistanceBand || availableVariationOptions.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {showAddedWeight && (
                  <select value={selectedModifierKg} onChange={(e) => setSelectedModifierKg(e.target.value)} className="bg-ink-dark border border-ink-light/20 rounded-lg px-2 py-1.5 text-[10px] text-amber-400 outline-none cursor-pointer">
                    <option value="">+Wt: none</option>
                    {MODIFIER_WEIGHT_OPTIONS.map((kg) => <option key={kg} value={String(kg)}>{formatModifierWeightLabel(kg)}</option>)}
                  </select>
                )}
                {showResistanceBand && (
                  <select value={selectedResistanceBand} onChange={(e) => setSelectedResistanceBand(e.target.value)} className="bg-ink-dark border border-ink-light/20 rounded-lg px-2 py-1.5 text-[10px] text-sky-300 outline-none cursor-pointer">
                    <option value="">Band: none</option>
                    {RESISTANCE_BAND_OPTIONS.map((kg) => <option key={kg} value={String(kg)}>{kg}kg</option>)}
                  </select>
                )}
                {availableVariationOptions.length > 0 && (
                  <select value={selectedVariation} onChange={(e) => setSelectedVariation(e.target.value)} className="bg-ink-dark border border-ink-light/20 rounded-lg px-2 py-1.5 text-[10px] text-crimson-light outline-none cursor-pointer">
                    <option value="">Var: none</option>
                    {availableVariationOptions.map((variationName) => <option key={variationName} value={variationName}>{variationName}</option>)}
                  </select>
                )}
              </div>
            )}

            {/* Notes */}
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes..."
              className="w-full rounded-lg px-2.5 py-2 text-xs outline-none bg-ink-dark border border-ink-light/20 text-cloud-white placeholder:text-mist-dark/40 focus:border-mist-mid/30" />

            {/* Actions */}
            <div className="flex gap-2">
              {showHold && (
                <button type="button" onClick={() => { setShowTimerModal(true); setTimerTarget(getNextTimerTarget()); setTimerReps(""); resetTimer(); }}
                  className="flex-1 py-2 rounded-lg border text-[10px] font-bold text-cloud-white transition-all"
                  style={{ background: "rgba(94,184,232,0.22)", borderColor: "rgba(94,184,232,0.6)" }}>
                  Timer
                </button>
              )}
              <motion.button onClick={handleSubmit} disabled={submitting}
                whileTap={!submitting ? { scale: 0.97 } : {}}
                className="flex-1 py-2 rounded-lg text-xs font-semibold disabled:opacity-40 cursor-pointer"
                style={{ background: `${diffStyle.glowColor}18`, border: `1px solid ${diffStyle.glowColor}35`, color: diffStyle.glowColor }}>
                {submitting ? "Saving…" : saved ? "✦ Logged!" : "Log Set"}
              </motion.button>
            </div>
          </div>
        ) : (
          <>
            {/* Controls row: Category info + Modifiers */}
            <div className="flex items-center gap-2 mb-2.5 pl-2 flex-wrap">
              <div className="flex items-center gap-2 border border-ink-light/20 bg-ink-mid/15 rounded-lg px-2.5 py-1.5">
                <span className="text-[10px] text-mist-light">
                  {parseCategoryTags(exercise.category)[0] || "Exercise"} • {exercise.weighted ? "Weighted" : exercise.bodyweight ? "Bodyweight" : "Timed"}
                </span>
              </div>
              <div className="flex-1" />

              {!showHold && (
                <div className="flex rounded-md overflow-hidden border border-ink-light/30">
                  <button
                    onClick={() => setWeightUnit("kg")}
                    className={`px-2 py-1 text-[10px] font-semibold transition-all duration-200 border-r border-ink-light/30 ${
                      weightUnit === "kg"
                        ? "bg-jade-deep/70 text-cloud-white border-jade-glow/50 shadow-[inset_0_0_0_1px_rgba(58,143,143,0.45),0_0_10px_rgba(58,143,143,0.2)]"
                        : "bg-ink-mid/55 text-mist-light/85 hover:bg-ink-mid/80 hover:text-cloud-white"
                    }`}
                  >
                    kg
                  </button>
                  <button
                    onClick={() => setWeightUnit("lbs")}
                    className={`px-2 py-1 text-[10px] font-semibold transition-all duration-200 ${
                      weightUnit === "lbs"
                        ? "bg-jade-deep/70 text-cloud-white border-jade-glow/50 shadow-[inset_0_0_0_1px_rgba(58,143,143,0.45),0_0_10px_rgba(58,143,143,0.2)]"
                        : "bg-ink-mid/55 text-mist-light/85 hover:bg-ink-mid/80 hover:text-cloud-white"
                    }`}
                  >
                    lbs
                  </button>
                </div>
              )}

              <div className="flex rounded-md overflow-hidden border border-ink-light/30">
                <button
                  onClick={() => { setInputMode("weight"); resetEntryFields(); }}
                  className={`px-2.5 py-1 text-[10px] font-semibold transition-all duration-200 border-r ${
                    inputMode === "weight"
                      ? "bg-jade-deep/55 text-cloud-white border-jade/40 shadow-[inset_0_0_0_1px_rgba(58,143,143,0.25)]"
                      : "bg-ink-mid/60 text-mist-light border-ink-light/30 hover:bg-ink-mid/80 hover:text-cloud-white"
                  }`}
                >
                  Weight
                </button>
                <button
                  onClick={() => { setInputMode("hold"); resetEntryFields(); }}
                  className={`px-2.5 py-1 text-[10px] font-semibold transition-all duration-200 ${
                    inputMode === "hold"
                      ? "bg-mountain-blue/30 text-cloud-white shadow-[inset_0_0_0_1px_rgba(94,184,232,0.35)]"
                      : "bg-ink-mid/60 text-mist-light hover:bg-ink-mid/80 hover:text-cloud-white"
                  }`}
                >
                  Hold
                </button>
              </div>

            </div>

            {/* Tier Progress Bar */}
            {!showHold && (
              <div className="pl-2 mb-2.5">
                <TierProgressBar
                  exercise={exercise}
                  userBodyweightKg={physique.bodyWeightKg}
                />
              </div>
            )}

            {(showAddedWeight || showResistanceBand || availableVariationOptions.length > 0) && (
              <div className="flex items-center gap-2 mb-2.5 pl-2 flex-wrap">
                {showAddedWeight && (
                  <div className="relative">
                    <select
                      value={selectedModifierKg}
                      onChange={(e) => { setSelectedModifierKg(e.target.value); setAutoPopulated(prev => ({ ...prev, modifierKg: false })); }}
                      className="bg-ink-dark border border-ink-light/20 rounded px-2 py-1 text-xs text-amber-400 outline-none focus:border-amber-400/40 transition-colors cursor-pointer"
                    >
                      <option value="">No added weight</option>
                      {MODIFIER_WEIGHT_OPTIONS.map((kg) => (
                        <option key={kg} value={String(kg)}>
                          {formatModifierWeightLabel(kg)}
                        </option>
                      ))}
                    </select>
                    {autoPopulated.modifierKg && <span className="absolute -top-1.5 -right-1 text-[10px] text-amber-400/70" title="Pre-filled from last session">*</span>}
                  </div>
                )}
                {showResistanceBand && (
                  <div className="relative">
                    <select
                      value={selectedResistanceBand}
                      onChange={(e) => { setSelectedResistanceBand(e.target.value); setAutoPopulated(prev => ({ ...prev, band: false })); }}
                      className="bg-ink-dark border border-ink-light/20 rounded px-2 py-1 text-xs text-sky-300 outline-none focus:border-sky-300/40 transition-colors cursor-pointer"
                    >
                      <option value="">No resistance band</option>
                      {RESISTANCE_BAND_OPTIONS.map((kg) => (
                        <option key={kg} value={String(kg)}>
                          Resistance band {formatResistanceBandLabel(kg)}
                        </option>
                      ))}
                    </select>
                    {autoPopulated.band && <span className="absolute -top-1.5 -right-1 text-[10px] text-sky-300/70" title="Pre-filled from last session">*</span>}
                  </div>
                )}
                {availableVariationOptions.length > 0 && (
                  <div className="relative">
                    <select
                      value={selectedVariation}
                      onChange={(e) => { setSelectedVariation(e.target.value); setAutoPopulated(prev => ({ ...prev, variation: false })); }}
                      className="bg-ink-dark border border-ink-light/20 rounded px-2 py-1 text-xs text-crimson-light outline-none focus:border-crimson/40 transition-colors cursor-pointer"
                    >
                      <option value="">No variation</option>
                      {availableVariationOptions.map((variationName) => (
                        <option key={variationName} value={variationName}>
                          {variationName}
                      </option>
                    ))}
                  </select>
                    {autoPopulated.variation && <span className="absolute -top-1.5 -right-1 text-[10px] text-crimson-light/70" title="Pre-filled from last session">*</span>}
                  </div>
                )}
              </div>
            )}

            <div className="pl-2">
              <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(6, 1fr) 1.5fr" }}>
                {!showHold ? (
                  <>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: diffStyle.glowColor, opacity: 0.95 }}>W1</div>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: 'var(--col-reps)', opacity: 0.95 }}>R1</div>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: diffStyle.glowColor, opacity: 0.95 }}>W2</div>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: 'var(--col-reps)', opacity: 0.95 }}>R2</div>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: diffStyle.glowColor, opacity: 0.95 }}>W3</div>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: 'var(--col-reps)', opacity: 0.95 }}>R3</div>
                  </>
                ) : (
                  <>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: diffStyle.glowColor, opacity: 0.95 }}>T1</div>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: 'var(--col-reps)', opacity: 0.95 }}>W1</div>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: diffStyle.glowColor, opacity: 0.95 }}>T2</div>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: 'var(--col-reps)', opacity: 0.95 }}>W2</div>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: diffStyle.glowColor, opacity: 0.95 }}>T3</div>
                    <div className="text-[9px] text-center uppercase tracking-widest font-bold pb-0.5" style={{ color: 'var(--col-reps)', opacity: 0.95 }}>W3</div>
                  </>
                )}
                <div className="text-[9px] text-center uppercase tracking-widest font-semibold text-mist-dark/50 pb-0.5">Notes</div>

                {/* BW auto-fill row for bodyweight exercises */}
                {canUseBwQuickFill && latestCheckInWeightKg != null && (
                  <>
                    <button type="button" onClick={() => setW1(String(latestCheckInWeightKg))}
                      className="text-[9px] font-bold px-1 py-0.5 rounded-md border border-jade-glow/55 bg-jade-deep/35 text-jade-light hover:bg-jade-deep/60 hover:-translate-y-[1px] hover:shadow-[0_0_10px_rgba(58,143,143,0.45)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jade-glow/70 transition-all duration-150"
                      title={`Apply last check-in weight (${latestCheckInWeightKg}kg)`}>BW</button>
                    <div />
                    <button type="button" onClick={() => setW2(String(latestCheckInWeightKg))}
                      className="text-[9px] font-bold px-1 py-0.5 rounded-md border border-jade-glow/55 bg-jade-deep/35 text-jade-light hover:bg-jade-deep/60 hover:-translate-y-[1px] hover:shadow-[0_0_10px_rgba(58,143,143,0.45)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jade-glow/70 transition-all duration-150"
                      title={`Apply last check-in weight (${latestCheckInWeightKg}kg)`}>BW</button>
                    <div />
                    <button type="button" onClick={() => setW3(String(latestCheckInWeightKg))}
                      className="text-[9px] font-bold px-1 py-0.5 rounded-md border border-jade-glow/55 bg-jade-deep/35 text-jade-light hover:bg-jade-deep/60 hover:-translate-y-[1px] hover:shadow-[0_0_10px_rgba(58,143,143,0.45)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jade-glow/70 transition-all duration-150"
                      title={`Apply last check-in weight (${latestCheckInWeightKg}kg)`}>BW</button>
                    <div />
                    <div />
                  </>
                )}

                {!showHold ? (
                  <>
                    <input type="number" min="0" step="0.5" value={w1} onChange={(e) => { setW1(e.target.value); if (shakeError) setShakeError(false); }} placeholder="—"
                      className={`w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-colors duration-200 bg-ink-dark border border-ink-light/30 text-cloud-white placeholder:text-mist-dark/30 focus:bg-ink-mid/40${shakeError ? ' animate-shake' : ''}`}
                      style={{ borderColor: shakeError ? 'rgba(220,50,50,0.7)' : `${diffStyle.glowColor}40` }} />
                    <input type="number" min="0" max="500" value={r1} onChange={(e) => { setR1(e.target.value); if (shakeError) setShakeError(false); }} placeholder="—"
                      className={`w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-colors duration-200 bg-ink-dark border border-ink-light/30 text-cloud-white placeholder:text-mist-dark/30 focus:border-gold/50 focus:bg-ink-mid/40${shakeError ? ' animate-shake' : ''}`}
                      style={{ borderColor: shakeError ? 'rgba(220,50,50,0.7)' : 'rgba(196,168,74,0.15)' }} />
                    <input type="number" min="0" step="0.5" value={w2} onChange={(e) => setW2(e.target.value)} placeholder="—"
                      className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-ink-light/30 text-cloud-white placeholder:text-mist-dark/30 focus:bg-ink-mid/40"
                      style={{ borderColor: `${diffStyle.glowColor}40` }} />
                    <input type="number" min="0" max="500" value={r2} onChange={(e) => setR2(e.target.value)} placeholder="—"
                      className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-ink-light/30 text-cloud-white placeholder:text-mist-dark/30 focus:border-gold/50 focus:bg-ink-mid/40"
                      style={{ borderColor: 'rgba(196,168,74,0.15)' }} />
                    <input type="number" min="0" step="0.5" value={w3} onChange={(e) => setW3(e.target.value)} placeholder="—"
                      className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-ink-light/30 text-cloud-white placeholder:text-mist-dark/30 focus:bg-ink-mid/40"
                      style={{ borderColor: `${diffStyle.glowColor}40` }} />
                    <input type="number" min="0" max="500" value={r3} onChange={(e) => setR3(e.target.value)} placeholder="—"
                      className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-ink-light/30 text-cloud-white placeholder:text-mist-dark/30 focus:border-gold/50 focus:bg-ink-mid/40"
                      style={{ borderColor: 'rgba(196,168,74,0.15)' }} />
                  </>
                ) : (
                  <>
                    <input type="number" min="0" value={hold} onChange={(e) => { setHold(e.target.value); if (shakeError) setShakeError(false); }} placeholder="s"
                      className={`w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-colors duration-200 bg-ink-dark border border-mountain-blue/20 text-cloud-white placeholder:text-mist-dark/30 focus:border-mountain-blue-glow/50 focus:bg-ink-mid/40${shakeError ? ' animate-shake' : ''}`}
                      style={shakeError ? { borderColor: 'rgba(220,50,50,0.7)' } : undefined} />
                    <input type="number" min="0" max="500" value={r1} onChange={(e) => { setR1(e.target.value); if (shakeError) setShakeError(false); }} placeholder="—"
                      className={`w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-colors duration-200 bg-ink-dark border border-ink-light/30 text-cloud-white placeholder:text-mist-dark/30 focus:border-gold/50 focus:bg-ink-mid/40${shakeError ? ' animate-shake' : ''}`}
                      style={{ borderColor: shakeError ? 'rgba(220,50,50,0.7)' : 'rgba(196,168,74,0.15)' }} />
                    <input type="number" min="0" value={hold2} onChange={(e) => setHold2(e.target.value)} placeholder="s"
                      className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-mountain-blue/20 text-cloud-white placeholder:text-mist-dark/30 focus:border-mountain-blue-glow/50 focus:bg-ink-mid/40" />
                    <input type="number" min="0" max="500" value={r2} onChange={(e) => setR2(e.target.value)} placeholder="—"
                      className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-ink-light/30 text-cloud-white placeholder:text-mist-dark/30 focus:border-gold/50 focus:bg-ink-mid/40"
                      style={{ borderColor: 'rgba(196,168,74,0.15)' }} />
                    <input type="number" min="0" value={hold3} onChange={(e) => setHold3(e.target.value)} placeholder="s"
                      className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-mountain-blue/20 text-cloud-white placeholder:text-mist-dark/30 focus:border-mountain-blue-glow/50 focus:bg-ink-mid/40" />
                    <input type="number" min="0" max="500" value={r3} onChange={(e) => setR3(e.target.value)} placeholder="—"
                      className="w-full rounded-md px-1 py-1.5 text-center text-xs outline-none transition-all duration-200 bg-ink-dark border border-ink-light/30 text-cloud-white placeholder:text-mist-dark/30 focus:border-gold/50 focus:bg-ink-mid/40"
                      style={{ borderColor: 'rgba(196,168,74,0.15)' }} />
                  </>
                )}
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes..."
                  className="w-full rounded-md px-1.5 py-1.5 text-xs outline-none transition-all duration-200 bg-ink-dark border border-ink-light/20 text-cloud-white placeholder:text-mist-dark/40 focus:border-mist-mid/30 focus:bg-ink-mid/30" />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-end gap-2 pl-2">
              {saved && (
                <motion.span
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xs font-medium"
                  style={{ color: diffStyle.glowColor }}
                >
                  ✦ Saved
                </motion.span>
              )}
              {showHold && (
                <button
                  type="button"
                  onClick={() => { setShowTimerModal(true); setTimerTarget(getNextTimerTarget()); setTimerReps(""); resetTimer(); }}
                  className="px-3 py-1.5 text-[10px] font-bold rounded-md border text-cloud-white bg-mountain-blue/35 hover:bg-mountain-blue/45 border-mountain-blue-glow/70 shadow-[0_0_10px_rgba(94,184,232,0.45)] hover:shadow-[0_0_16px_rgba(94,184,232,0.6)] transition-all"
                  style={{ boxShadow: `0 0 10px ${diffStyle.glowColor}66, inset 0 0 0 1px ${diffStyle.glowColor}40` }}
                  title="Open compact hold timer"
                >
                  Start Timer
                </button>
              )}
              <motion.button
                onClick={handleSubmit}
                disabled={submitting}
                animate={saved ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                whileHover={!submitting ? { scale: 1.06, boxShadow: `0 0 10px ${diffStyle.glowColor}50` } : {}}
                whileTap={!submitting ? { scale: 0.96 } : {}}
                transition={{ duration: 0.3 }}
                className="px-4 py-1.5 rounded-md text-xs font-semibold disabled:opacity-40 cursor-pointer"
                style={{
                  background: saved ? `${diffStyle.glowColor}30` : `${diffStyle.glowColor}18`,
                  border: `1px solid ${saved ? `${diffStyle.glowColor}60` : `${diffStyle.glowColor}35`}`,
                  color: diffStyle.glowColor,
                  transition: 'background 0.3s, border-color 0.3s',
                }}
              >
                {submitting ? "Saving…" : saved ? "✦ Logged!" : "Log Set"}
              </motion.button>
            </div>
          </>
        )}

        {showTimerModal && showHold && (
          <div className="absolute inset-0 z-30 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-[2px] p-2" onClick={closeTimerModal}>
            <div
              className="w-full max-w-[300px] rounded-lg border bg-ink-deep/95 p-3"
              style={{
                borderColor: `${diffStyle.glowColor}80`,
                boxShadow: `0 0 20px ${diffStyle.glowColor}40, 0 16px 30px rgba(0,0,0,0.55), inset 0 0 0 1px ${diffStyle.glowColor}20`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: diffStyle.glowColor }}>Hold Timer</p>
                <button
                  type="button"
                  onClick={closeTimerModal}
                  className="text-mist-dark hover:text-mist-light text-xs px-1"
                  title="Close timer"
                >
                  ✕
                </button>
              </div>

              <div className="flex rounded-md border overflow-hidden mb-2" style={{ borderColor: `${diffStyle.glowColor}55` }}>
                {([
                  { key: "hold", label: "T1", rep: "R1" },
                  { key: "hold2", label: "T2", rep: "R2" },
                  { key: "hold3", label: "T3", rep: "R3" },
                ] as const).map((slot, idx) => (
                  <button
                    key={slot.key}
                    type="button"
                    onClick={() => setTimerTarget(slot.key)}
                    className={`flex-1 py-1 text-[10px] font-semibold text-center ${idx > 0 ? "border-l border-ink-light/30" : ""}`}
                    style={slot.key === timerTarget ? {
                      background: `${diffStyle.glowColor}2e`,
                      color: diffStyle.glowColor,
                    } : { color: "var(--mist-dark)" }}
                  >
                    <div>{slot.label}</div>
                    <div className="text-[9px] opacity-80">
                      {slot.key === "hold"
                        ? `${hold || "-"}s${r1 ? ` • ${r1}r` : ""}`
                        : slot.key === "hold2"
                          ? `${hold2 || "-"}s${r2 ? ` • ${r2}r` : ""}`
                          : `${hold3 || "-"}s${r3 ? ` • ${r3}r` : ""}`}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mb-2">
                <span className="block text-center sm:text-left text-[12px] font-mono font-semibold mb-2" style={{ color: diffStyle.glowColor }}>{timerMinutes}:{timerSeconds}.{timerMillis}</span>
              </div>

              <div className="mb-3">
                <label className="text-[10px] text-mist-dark block mb-1">
                  Reps for {timerTarget === "hold" ? "R1" : timerTarget === "hold2" ? "R2" : "R3"} (optional)
                </label>
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={timerReps}
                  onChange={(e) => setTimerReps(e.target.value)}
                  placeholder="—"
                  className="w-full rounded border border-ink-light/30 bg-ink-dark px-2 py-1 text-xs text-gold outline-none focus:border-gold/50"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetTimer}
                  className="flex-1 py-1 rounded border border-ink-light/30 text-[10px] text-mist-dark hover:text-mist-light"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleTimerButton}
                  className={`flex-1 py-1 rounded border text-[10px] font-semibold transition-all ${timerRunning ? "text-crimson-light border-crimson/50 bg-crimson-deep/20 shadow-[0_0_8px_rgba(197,70,70,0.35)]" : ""}`}
                  style={!timerRunning ? {
                    borderColor: `${diffStyle.glowColor}88`,
                    background: `${diffStyle.glowColor}26`,
                    color: diffStyle.glowColor,
                  } : undefined}
                >
                  {timerRunning ? "Stop Timer" : "Start Timer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Sidebar with exercise list, search, filters ──

function ProgressionSidebar({
  exercises,
  selectedIds,
  onToggleExercise,
  onAddExercise,
  onSelectWithLevel,
  selectedTierIds,
  searchTerm,
  onSearch,
  filterCategory,
  setFilterCategory,
  filterType,
  setFilterType,
  filterEquipment,
  setFilterEquipment,
  categories,
  types,
  equipmentTypes,
  levelDefaults,
  autoLevelByExerciseId,
  selectedDayFilter,
  setSelectedDayFilter,
  onDrawerOpen,
  userBodyweightKg,
}: {
  exercises: ProgressionExercise[];
  selectedIds: Set<string>;
  onToggleExercise: (id: string) => void;
  onAddExercise: (id: string) => void;
  onSelectWithLevel: (exerciseId: string, level: number, tierId?: string) => void;
  selectedTierIds: Record<string, string>;
  searchTerm: string;
  onSearch: (term: string) => void;
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  filterEquipment: string;
  setFilterEquipment: (v: string) => void;
  categories: string[];
  types: string[];
  equipmentTypes: string[];
  levelDefaults: Record<string, number>;
  autoLevelByExerciseId: Record<string, number>;
  selectedDayFilter: number | null;
  setSelectedDayFilter: (v: number | null) => void;
  onDrawerOpen: () => void;
  userBodyweightKg: number | null;
}) {
  const { isMobile } = useAppContext();
  const { settings } = useDisplaySettings();
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved = localStorage.getItem("cultivateos-progression-sidebar-compact");
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });

  // Persist compact state
  useEffect(() => {
    try { localStorage.setItem("cultivateos-progression-sidebar-compact", String(isCompact)); } catch {}
  }, [isCompact]);

  // Suppress initial mount animations to prevent sidebar expand animation on refresh
  const sidebarMountedRef = useRef(false);
  useEffect(() => {
    // Delay marking as mounted so first render has no animations
    const id = requestAnimationFrame(() => { sidebarMountedRef.current = true; });
    return () => cancelAnimationFrame(id);
  }, []);

  const [sortMode, setSortMode] = useState<string>(() => {
    if (typeof window === "undefined") return "a-z";
    try { return localStorage.getItem("cultivateos-progression-sidebar-sort") || "a-z"; } catch { return "a-z"; }
  });

  useEffect(() => {
    try { localStorage.setItem("cultivateos-progression-sidebar-sort", sortMode); } catch {}
  }, [sortMode]);

  const displayMode = settings.progressionSidebarMode ?? "name-illumination-realm";
  const cardStyle = settings.progressionSidebarStyle ?? "default";
  const glowIntensity = settings.glowIntensityProgressionSidebar ?? 100;
  const loreVisible = settings.progressionSidebarLoreVisible ?? true;

  const hiddenSidebarExerciseNames = new Set([
    "dumbbell bicep curl",
    "leg curl",
    "leg extension",
    "seated cable row",
  ]);

  const showIllumination = displayMode !== "name-only";
  const useThemeColor = settings.progressionSidebarUseThemeColor ?? false;
  const showRealm = displayMode === "name-illumination-realm" || displayMode === "name-illumination-realm-path";
  const showPath = displayMode === "name-illumination-realm-path";
  const isScrollStyle = cardStyle === "scroll-card";

  // Compute technique counts per day
  const dayCounts = useMemo(() => {
    const counts: number[] = [0, 0, 0, 0, 0, 0, 0];
    for (const ex of exercises) {
      const days = parseDayAssignments(ex.assignedDays || "");
      for (const d of days) {
        if (d >= 0 && d <= 6) counts[d]++;
      }
    }
    return counts;
  }, [exercises]);

  const [disciplineFilter, setDisciplineFilter] = useState<"all" | "gym" | "calisthenics" | "recent">("all");

  // Apply filters
  const filtered = exercises.filter((e) => {
    if (hiddenSidebarExerciseNames.has(String(e.name || "").trim().toLowerCase())) {
      return false;
    }

    if (disciplineFilter === "gym" && !isGymCategoryExercise(e)) return false;
    if (disciplineFilter === "calisthenics" && isGymCategoryExercise(e)) return false;
    if (disciplineFilter === "recent" && (e.userProgress[0]?.logs?.length ?? 0) === 0) return false;

    // Day filter
    if (selectedDayFilter !== null) {
      if (!e.assignedDays || e.assignedDays.trim() === "") return false;
      const assignedDays = e.assignedDays.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
      if (!assignedDays.includes(selectedDayFilter)) return false;
    }
    if (filterCategory) {
      const tags = parseCategoryTags(e.category);
      if (!tags.includes(filterCategory)) return false;
    }
    if (filterType && e.type !== filterType) return false;
    if (filterEquipment) {
      const tags = getEquipmentTags(e);
      if (!tags.includes(filterEquipment)) return false;
    }
    if (searchTerm) {
      return matchesLooseSearchInFields(searchTerm, [
        e.name,
        e.wuxiaName,
        e.primaryMuscles,
        e.secondaryMuscles,
        e.category,
      ]);
    }
    return true;
  });

  // Apply sort
  const sorted = [...filtered].sort((a, b) => {
    const nameA = getExerciseDisplayName(a, settings.terminologyMode);
    const nameB = getExerciseDisplayName(b, settings.terminologyMode);
    switch (sortMode) {
      case "a-z":
        return nameA.localeCompare(nameB);
      case "z-a":
        return nameB.localeCompare(nameA);
      case "recent": {
        const aLatest = a.userProgress[0]?.logs?.reduce((max, l) => {
          const t = new Date(l.createdAt).getTime();
          return t > max ? t : max;
        }, 0) ?? 0;
        const bLatest = b.userProgress[0]?.logs?.reduce((max, l) => {
          const t = new Date(l.createdAt).getTime();
          return t > max ? t : max;
        }, 0) ?? 0;
        return bLatest - aLatest;
      }
      case "most-logged": {
        const aCount = a.userProgress[0]?.logs?.length ?? 0;
        const bCount = b.userProgress[0]?.logs?.length ?? 0;
        return bCount - aCount;
      }
      case "selected": {
        const aS = selectedIds.has(a.id) ? 0 : 1;
        const bS = selectedIds.has(b.id) ? 0 : 1;
        if (aS !== bS) return aS - bS;
        return nameA.localeCompare(nameB);
      }
      default:
        return 0;
    }
  });

  const [showFilters, setShowFilters] = useState(false);

  const activeFiltersCount = (filterCategory ? 1 : 0) + (filterType ? 1 : 0) + (filterEquipment ? 1 : 0);
  const searchQuery = searchTerm.trim();
  const isSearchActive = searchQuery.length > 0;

  // Group search results by category when searching
  const searchGroupedByCategory = useMemo(() => {
    if (!isSearchActive) return null;
    const groups: { category: string; exercises: typeof sorted }[] = [];
    const categoryMap = new Map<string, typeof sorted>();
    for (const ex of sorted) {
      const cats = parseCategoryTags(ex.category);
      const categoryKey = cats.length > 0 ? cats[0] : "Uncategorised";
      if (!categoryMap.has(categoryKey)) categoryMap.set(categoryKey, []);
      categoryMap.get(categoryKey)!.push(ex);
    }
    for (const [category, exercises] of categoryMap) {
      groups.push({ category, exercises });
    }
    return groups;
  }, [isSearchActive, sorted]);

  const sortOptions = [
    { key: "a-z", label: "A–Z", icon: "↕" },
    { key: "z-a", label: "Z–A", icon: "↕" },
    { key: "recent", label: "Recent", icon: "◷" },
    { key: "most-logged", label: "Most Logged", icon: "▤" },
    { key: "selected", label: "Selected", icon: "✦" },
  ] as const;

  const compactEnabled = !isMobile && isCompact;
  const chipTextClass = isMobile ? "text-xs" : "text-[10px]";
  const labelTextClass = isMobile ? "text-[10px]" : "text-[9px]";

  return (
    <div className="h-full flex flex-col">
      {/* ── Toolbar ── */}
      <div className="px-3 pt-3 pb-2.5 shrink-0 space-y-2.5">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-mist-dark pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search exercises..."
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
            className={`w-full bg-ink-dark/80 border border-ink-light/50 rounded-lg pl-8 pr-8 ${isMobile ? "py-2.5 text-sm" : "py-1.5 text-[11px]"} text-cloud-white placeholder:text-mist-dark/70 outline-none transition-all duration-200 focus:border-jade-glow/60 focus:bg-ink-dark`}
          />
          {searchTerm && (
            <button
              onClick={() => onSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mist-dark hover:text-cloud-white transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Day Filter — All + Sun-Sat buttons */}
        <div className="space-y-1">
          <div className="flex gap-1">
            <button
              onClick={() => setSelectedDayFilter(null)}
              className={`
                flex-1 ${isMobile ? "py-2 text-xs" : "py-1 text-[10px]"} font-semibold rounded-md transition-all duration-200 border
                ${selectedDayFilter === null
                  ? 'bg-jade-deep/60 text-jade-glow border-jade-glow/40 shadow-[inset_0_0_12px_rgba(58,143,143,0.15)]'
                  : 'bg-ink-dark/60 text-mist-dark border-ink-light/40 hover:text-mist-light hover:bg-ink-mid/40'
                }
              `}
            >
              All
              <span className="ml-1 text-[9px] opacity-70">({exercises.length})</span>
            </button>
            {selectedDayFilter !== null && (
              <GlowButton
                onClick={(e) => { e.stopPropagation(); onDrawerOpen(); }}
                variant="jade"
                size="sm"
                glow
                className={`${isMobile ? "!py-2 !text-xs" : "!py-1 !text-[10px]"} shrink-0`}
              >
                ⚙ Manage
              </GlowButton>
            )}
          </div>
          <div className="flex rounded-md overflow-hidden border border-ink-light/40">
            {DAY_ABBREVIATIONS.map((day, index) => {
              const count = dayCounts[index];
              const hasExercises = count > 0;
              const isSelected = selectedDayFilter === index;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDayFilter(index)}
                  className={`
                    flex-1 ${isMobile ? "py-2 text-xs" : "py-1 text-[10px]"} font-semibold transition-all duration-200 relative flex flex-col items-center gap-0.5
                    ${index > 0 ? 'border-l border-ink-light/30' : ''}
                    ${isSelected
                      ? 'bg-jade-deep/60 text-jade-glow shadow-[inset_0_0_12px_rgba(58,143,143,0.15)]'
                      : hasExercises
                        ? 'bg-ink-dark/60 text-jade-light/80 hover:text-jade-light hover:bg-ink-mid/40'
                        : 'bg-ink-dark/60 text-mist-dark hover:text-mist-light hover:bg-ink-mid/40'
                    }
                  `}
                >
                  <span>{day}</span>
                  {hasExercises && (
                    <span className={`text-[7px] leading-none rounded-full min-w-[12px] px-0.5 py-[1px] font-bold ${
                      isSelected
                        ? 'bg-jade-glow/30 text-jade-light'
                        : 'bg-ink-light/60 text-mist-light'
                    }`}>
                      {count}
                    </span>
                  )}
                  {isSelected && (
                    <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-jade-glow rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action bar: icons row */}
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <button
              onClick={() => setDisciplineFilter((prev) => (prev === "gym" ? "all" : "gym"))}
              className={`${isMobile ? "px-2.5 h-9 text-xs" : "px-2 h-7 text-[10px]"} rounded-md flex items-center justify-center border font-semibold transition-all duration-150 ${
                disciplineFilter === "gym"
                  ? "bg-jade-deep/30 border-jade-glow/45 text-jade-light shadow-[0_0_8px_rgba(58,143,143,0.16)]"
                  : "border-ink-light/40 text-mist-dark hover:text-mist-light hover:border-ink-light/60"
              }`}
              title="Toggle Gym filter"
            >
              Gym
            </button>
            <button
              onClick={() => setDisciplineFilter((prev) => (prev === "calisthenics" ? "all" : "calisthenics"))}
              className={`${isMobile ? "px-2.5 h-9 text-xs" : "px-2 h-7 text-[10px]"} rounded-md flex items-center justify-center border font-semibold transition-all duration-150 ${
                disciplineFilter === "calisthenics"
                  ? "bg-jade-deep/30 border-jade-glow/45 text-jade-light shadow-[0_0_8px_rgba(58,143,143,0.16)]"
                  : "border-ink-light/40 text-mist-dark hover:text-mist-light hover:border-ink-light/60"
              }`}
              title="Toggle Calisthenics filter"
            >
              Cali
            </button>
            <button
              onClick={() => setDisciplineFilter((prev) => (prev === "recent" ? "all" : "recent"))}
              className={`${isMobile ? "px-2.5 h-9 text-xs" : "px-2 h-7 text-[10px]"} rounded-md flex items-center justify-center border font-semibold transition-all duration-150 ${
                disciplineFilter === "recent"
                  ? "bg-jade-deep/30 border-jade-glow/45 text-jade-light shadow-[0_0_8px_rgba(58,143,143,0.16)]"
                  : "border-ink-light/40 text-mist-dark hover:text-mist-light hover:border-ink-light/60"
              }`}
              title="Show exercises with training logs"
            >
              Recent
            </button>
          </div>
          <div className="flex-1" />

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`${isMobile ? "w-9 h-9" : "w-7 h-7"} rounded-md flex items-center justify-center border transition-all duration-150 ${
              showFilters
                ? 'bg-jade-deep/25 border-jade/40 text-jade-glow'
                : 'border-ink-light/40 text-mist-dark hover:text-mist-light hover:border-ink-light/60'
            }`}
            title={showFilters ? "Hide filters" : "Show filters"}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          </button>
          <button
            onClick={() => setIsCompact(!isCompact)}
            disabled={isMobile}
            className={`${isMobile ? "w-9 h-9" : "w-7 h-7"} rounded-md flex items-center justify-center border transition-all duration-150 ${
              compactEnabled
                ? 'bg-jade-deep/25 border-jade/40 text-jade-glow'
                : `border-ink-light/40 text-mist-dark ${isMobile ? "opacity-40 cursor-not-allowed" : "hover:text-mist-light hover:border-ink-light/60"}`
            }`}
            title={isMobile ? "Compact mode is disabled on mobile" : (compactEnabled ? "Expanded view" : "Compact view")}
          >
            {compactEnabled ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Collapsible Filters + Sort ── */}
      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden shrink-0"
          >
            <div className="px-3 pb-2 space-y-2">
              {/* Category */}
              {categories.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`${labelTextClass} text-mist-dark/80 uppercase tracking-widest font-medium`}>Category</span>
                    {filterCategory && (
                      <button onClick={() => setFilterCategory("")} className={`${labelTextClass} text-jade-glow/70 hover:text-jade-glow transition-colors`}>clear</button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setFilterCategory("")}
                      className={`${chipTextClass} px-2 py-1 rounded-md transition-all duration-150 border ${
                        !filterCategory
                          ? "bg-jade-deep/40 text-jade-glow border-jade/40 shadow-[0_0_6px_rgba(58,143,143,0.15)]"
                          : "bg-transparent text-mist-dark border-ink-light/30 hover:text-mist-light hover:border-ink-light/50"
                      }`}
                    >
                      All
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setFilterCategory(filterCategory === cat ? "" : cat)}
                        className={`${chipTextClass} px-2 py-1 rounded-md transition-all duration-150 border ${
                          filterCategory === cat
                            ? "bg-jade-deep/40 text-jade-glow border-jade/40 shadow-[0_0_6px_rgba(58,143,143,0.15)]"
                            : "bg-transparent text-mist-dark border-ink-light/30 hover:text-mist-light hover:border-ink-light/50"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Equipment */}
              {types.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`${labelTextClass} text-mist-dark/80 uppercase tracking-widest font-medium`}>Type</span>
                    {filterType && (
                      <button onClick={() => setFilterType("")} className={`${labelTextClass} text-jade-glow/70 hover:text-jade-glow transition-colors`}>clear</button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setFilterType("")}
                      className={`${chipTextClass} px-2 py-1 rounded-md transition-all duration-150 border ${
                        !filterType
                          ? "bg-jade-deep/40 text-jade-glow border-jade/40 shadow-[0_0_6px_rgba(58,143,143,0.15)]"
                          : "bg-transparent text-mist-dark border-ink-light/30 hover:text-mist-light hover:border-ink-light/50"
                      }`}
                    >
                      All
                    </button>
                    {types.map((t) => (
                      <button
                        key={t}
                        onClick={() => setFilterType(filterType === t ? "" : t)}
                        className={`${chipTextClass} px-2 py-1 rounded-md transition-all duration-150 border ${
                          filterType === t
                            ? "bg-jade-deep/40 text-jade-glow border-jade/40 shadow-[0_0_6px_rgba(58,143,143,0.15)]"
                            : "bg-transparent text-mist-dark border-ink-light/30 hover:text-mist-light hover:border-ink-light/50"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Equipment */}
              {equipmentTypes.length > 1 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`${labelTextClass} text-mist-dark/80 uppercase tracking-widest font-medium`}>Equipment</span>
                    {filterEquipment && (
                      <button onClick={() => setFilterEquipment("")} className={`${labelTextClass} text-jade-glow/70 hover:text-jade-glow transition-colors`}>clear</button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {equipmentTypes.map((eq) => (
                      <button
                        key={eq}
                        onClick={() => setFilterEquipment(filterEquipment === eq ? "" : eq)}
                        className={`${chipTextClass} px-2 py-1 rounded-md transition-all duration-150 border ${
                          filterEquipment === eq
                            ? "bg-jade-deep/40 text-jade-glow border-jade/40 shadow-[0_0_6px_rgba(58,143,143,0.15)]"
                            : "bg-transparent text-mist-dark border-ink-light/30 hover:text-mist-light hover:border-ink-light/50"
                        }`}
                      >
                        {eq}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sort */}
              <div>
                <span className={`${labelTextClass} text-mist-dark/80 uppercase tracking-widest font-medium block mb-1`}>Sort By</span>
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value)}
                  className={`w-full bg-ink-dark/80 border border-ink-light/40 rounded-md px-2 ${isMobile ? "py-2 text-sm" : "py-1 text-[11px]"} text-cloud-white outline-none transition-all duration-150 focus:border-jade-glow/50 appearance-none cursor-pointer`}
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 6px center', backgroundRepeat: 'no-repeat', backgroundSize: '16px', paddingRight: '28px' }}
                >
                  {sortOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.icon} {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Divider with stats ── */}
      <div className="px-3 py-1.5 border-y border-ink-light/20 bg-ink-dark/30 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-mist-light/90 font-medium">
              {sorted.length} exercise{sorted.length !== 1 ? "s" : ""}
            </span>
            {activeFiltersCount > 0 && (
              <span className="text-[9px] text-jade-glow/80 bg-jade-deep/20 px-1.5 py-0 rounded-full border border-jade/20">
                {activeFiltersCount} filter{activeFiltersCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {selectedIds.size > 0 && (
            <button
              onClick={() => {
                for (const id of [...selectedIds]) onToggleExercise(id);
              }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-crimson/40 bg-crimson-deep/20 text-crimson-light hover:bg-crimson-deep/35 hover:border-crimson/60 transition-all duration-150 text-[10px] font-semibold"
              title="Unselect all"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              {selectedIds.size} selected
            </button>
          )}
        </div>
      </div>

      {/* ── Exercise list ── */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5 scrollbar-thin">
        {sorted.length === 0 ? (
          selectedDayFilter !== null && exercises.length > 0 ? (
            /* Empty day — prompt to use Manage drawer */
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="text-4xl opacity-40">📋</div>
              <p className="text-xs text-mist-dark text-center">
                No exercises assigned to <span className="text-mist-light font-medium">{DAY_ABBREVIATIONS[selectedDayFilter]}</span>
              </p>
              <GlowButton
                onClick={(e) => { e.stopPropagation(); onDrawerOpen(); }}
                variant="jade"
                size="sm"
                glow
                className="!text-[11px]"
              >
                ⚙ Manage Techniques
              </GlowButton>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="text-2xl opacity-30 mb-2">{exercises.length === 0 ? "📂" : "🔍"}</div>
              <p className="text-[11px] text-mist-dark">
                {exercises.length === 0
                  ? "Upload a JSON file to add exercises"
                  : isSearchActive
                    ? `No exercises found for "${searchQuery}"`
                    : "No exercises match current filters"
                }
              </p>
              {isSearchActive ? (
                <button
                  onClick={() => onSearch("")}
                  className="mt-2 text-[10px] text-jade-glow/70 hover:text-jade-glow transition-colors"
                >
                  Clear search
                </button>
              ) : activeFiltersCount > 0 && (
                <button
                  onClick={() => { setFilterCategory(""); setFilterType(""); setFilterEquipment(""); }}
                  className="mt-2 text-[10px] text-jade-glow/70 hover:text-jade-glow transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )
        ) : (
          <div className={`${compactEnabled ? 'space-y-px' : 'space-y-1.5'}`}>
            {(() => {
              // When searching, use category-grouped order; otherwise use normal sorted order
              const renderList = isSearchActive && searchGroupedByCategory
                ? searchGroupedByCategory.flatMap(g => g.exercises)
                : sorted;
              let lastCategoryKey = '';
              const elements: React.ReactNode[] = [];
              renderList.forEach((exercise) => {
                // Inject category header when searching and category changes
                if (isSearchActive) {
                  const primaryCategory = parseCategoryTags(exercise.category)[0] || 'Uncategorised';
                  if (primaryCategory !== lastCategoryKey) {
                    lastCategoryKey = primaryCategory;
                    const groupCount = searchGroupedByCategory?.find(g => g.category === primaryCategory)?.exercises.length ?? 0;
                    elements.push(
                      <div key={`cat-${primaryCategory}`} className="sticky top-0 z-10 px-1.5 py-1 mt-2 first:mt-0 mb-0.5 bg-ink-dark/90 backdrop-blur-sm border-b border-ink-light/20">
                        <span className="text-[10px] font-semibold text-mist-light/70 uppercase tracking-wider">{primaryCategory}</span>
                        <span className="ml-1.5 text-[9px] text-mist-dark/60">({groupCount})</span>
                      </div>
                    );
                  }
                }

              const isActive = selectedIds.has(exercise.id);
              const currentLevel = exercise.userProgress[0]?.currentLevel ?? 1;
              const effectiveLevel = levelDefaults[exercise.id] || autoLevelByExerciseId[exercise.id] || currentLevel;
              const typeColor = getTypeColor(getTypeColorKey(exercise));
              const displayName = getExerciseDisplayName(exercise, settings.terminologyMode);
              const sidebarTierInfo = getTierGlowFromLogs(exercise, userBodyweightKg);
              const levelDifficultyDisplay = sidebarTierInfo.tierName;
              const levelDiffColor = '';
              const glowStyle = {};
              const logCount = exercise.userProgress[0]?.logs?.length ?? 0;
              const isSearchMatch = isSearchActive && matchesLooseSearchInFields(searchQuery, [
                exercise.name,
                exercise.wuxiaName,
              ]);

              // Shared select/add button
              const _selectButton = (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleExercise(exercise.id); }}
                  className={`shrink-0 w-5 h-5 rounded flex items-center justify-center border transition-all duration-150 ${
                    isActive
                      ? 'bg-jade-glow/20 border-jade/50 text-jade-glow hover:bg-crimson-deep/20 hover:border-crimson/40 hover:text-crimson-light'
                      : 'border-ink-light/40 text-mist-dark hover:bg-jade-deep/20 hover:border-jade/40 hover:text-jade-glow'
                  }`}
                  title={isActive ? "Remove from training" : "Add to training"}
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    {isActive
                      ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      : <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    }
                  </svg>
                </button>
              );

              // Row click handler: toggle selection (add to queue or remove)
              const handleRowClick = () => {
                if (isActive) {
                  onToggleExercise(exercise.id);
                  return;
                }
                onAddExercise(exercise.id);
              };

              /* ═══ Compact mode ═══ */
              if (compactEnabled) {
                elements.push(
                  <div key={exercise.id}>
                    <div
                      className={`
                        relative flex items-center gap-1.5 px-2.5 py-[5px] rounded-md cursor-pointer transition-all duration-150
                        group border
                        ${isActive
                          ? 'bg-jade-deep/28 border-jade-glow/55 shadow-[0_0_10px_rgba(58,143,143,0.2)]'
                          : isSearchMatch
                            ? 'bg-jade-deep/10 border-jade-glow/45 shadow-[0_0_10px_rgba(58,143,143,0.16)] hover:bg-jade-deep/18 hover:shadow-[0_0_14px_rgba(58,143,143,0.22)]'
                            : 'bg-ink-dark/40 border-ink-light/50 hover:bg-ink-mid/30 hover:border-jade-glow/30 hover:shadow-[0_2px_10px_rgba(0,0,0,0.25)] hover:-translate-y-[1px]'
                        }
                      `}
                      style={showIllumination && isActive ? glowStyle as React.CSSProperties : undefined}
                      onClick={handleRowClick}
                    >
                      {/* Selection indicator */}
                      <div className={`w-1 h-4 rounded-full shrink-0 transition-all duration-200 ${isActive ? 'bg-jade-glow' : 'bg-transparent group-hover:bg-jade-glow/40'}`} />
                      <span className={`text-[11px] truncate flex-1 transition-colors duration-150 ${isActive ? 'text-cloud-white' : 'text-mist-light group-hover:text-cloud-white/90'}`} style={showIllumination && !useThemeColor ? { color: sidebarTierInfo.glowColor } : undefined} title={displayName}>
                        {displayName}
                      </span>
                      {logCount > 0 && (
                        <span className="text-[8px] text-mist-dark/70 font-mono shrink-0">{logCount}</span>
                      )}
                      <span className={`shrink-0 text-[8px] font-medium px-1 py-0 rounded ${useThemeColor ? 'text-jade-glow' : ''}`} style={!useThemeColor ? { color: sidebarTierInfo.glowColor } : undefined}>
                        {levelDifficultyDisplay}
                      </span>
                    </div>
                  </div>
                );
                return;
              }

              /* ═══ Scroll-Card Style (expanded) ═══ */
              if (isScrollStyle) {
                elements.push(
                  <motion.div
                    key={exercise.id}
                    initial={sidebarMountedRef.current ? { opacity: 0, y: 4 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div
                      className={`
                        relative p-2.5 rounded-lg border cursor-pointer transition-all duration-200 group
                        ${isActive
                          ? 'bg-jade-deep/24 border-jade-glow/55 shadow-[0_0_14px_rgba(58,143,143,0.2)]'
                          : isSearchMatch
                            ? 'bg-jade-deep/10 border-jade-glow/45 shadow-[0_0_10px_rgba(58,143,143,0.16)] hover:bg-jade-deep/18 hover:shadow-[0_0_16px_rgba(58,143,143,0.24)]'
                            : 'bg-ink-dark/45 border-ink-light/50 hover:border-jade-glow/30 hover:bg-ink-mid/25 hover:shadow-[0_3px_12px_rgba(0,0,0,0.3)] hover:-translate-y-[1px]'
                        }
                      `}
                      style={showIllumination && glowIntensity > 0 ? glowStyle as React.CSSProperties : undefined}
                      onClick={handleRowClick}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className={`w-1 h-4 rounded-full shrink-0 transition-all duration-200 ${isActive ? 'bg-jade-glow' : 'bg-transparent group-hover:bg-jade-glow/40'}`} />
                            <h3 className={`text-[11px] font-semibold ${showIllumination && !useThemeColor ? '' : showIllumination && useThemeColor ? 'text-jade-glow' : 'text-cloud-white'} truncate flex-1`} style={showIllumination && !useThemeColor ? { color: sidebarTierInfo.glowColor } : undefined} title={displayName}>
                              {displayName}
                            </h3>
                            {logCount > 0 && (
                              <span className="text-[8px] text-mist-dark/70 font-mono shrink-0">{logCount}</span>
                            )}
                          </div>

                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded bg-ink-dark/55 border border-current/20 ${useThemeColor ? 'text-jade-glow' : ''}`} style={!useThemeColor ? { color: sidebarTierInfo.glowColor } : undefined}>
                              {levelDifficultyDisplay}
                            </span>
                            {showPath && (
                              <span className={`text-[8px] px-1.5 py-0.5 rounded ${typeColor} bg-ink-dark/40 border border-current/15 opacity-75`}>
                                {getTypeDisplayName(exercise, settings.terminologyMode)}
                              </span>
                            )}
                            <EquipmentBadges exercise={exercise} />
                            {showRealm && exercise.category && (
                              <span className="text-[8px] text-mist-dark/70">{exercise.category}</span>
                            )}
                          </div>

                          {loreVisible && showPath && exercise.story && (
                            <p className="mt-1.5 pt-1 border-t border-ink-light/20 text-[9px] text-mist-mid/70 leading-relaxed line-clamp-1">
                              {exercise.story}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
                return;
              }

              /* ═══ Default Style (expanded) ═══ */
              elements.push(
                <motion.div
                  key={exercise.id}
                  initial={sidebarMountedRef.current ? { opacity: 0, y: 4 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div
                    className={`
                      relative p-2.5 rounded-lg border cursor-pointer transition-all duration-200 group
                      ${isActive
                        ? 'bg-jade-deep/24 border-jade-glow/55 shadow-[0_0_12px_rgba(58,143,143,0.2)]'
                        : isSearchMatch
                          ? 'bg-jade-deep/10 border-jade-glow/45 shadow-[0_0_10px_rgba(58,143,143,0.16)] hover:bg-jade-deep/18 hover:shadow-[0_0_16px_rgba(58,143,143,0.24)]'
                          : 'bg-ink-dark/45 border-ink-light/50 hover:border-jade-glow/30 hover:bg-ink-mid/25 hover:shadow-[0_3px_12px_rgba(0,0,0,0.3)] hover:-translate-y-[1px]'
                      }
                    `}
                    style={showIllumination ? glowStyle as React.CSSProperties : undefined}
                    onClick={handleRowClick}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1 h-4 rounded-full shrink-0 transition-all duration-200 ${isActive ? 'bg-jade-glow' : 'bg-transparent group-hover:bg-jade-glow/40'}`} />
                      <div className={`text-[11px] font-semibold ${useThemeColor && showIllumination ? 'text-jade-glow' : isActive ? 'text-cloud-white' : 'text-mist-light group-hover:text-cloud-white/90'} transition-colors duration-150 truncate flex-1`} style={showIllumination && !useThemeColor ? { color: sidebarTierInfo.glowColor } : undefined} title={displayName}>
                        {displayName}
                      </div>
                      {logCount > 0 && (
                        <span className="text-[8px] text-mist-dark/70 font-mono shrink-0">{logCount}</span>
                      )}
                      <span className={`shrink-0 text-[8px] font-medium px-1.5 py-0 rounded bg-ink-dark/30 border border-current/15 ${useThemeColor ? 'text-jade-glow' : ''}`} style={!useThemeColor ? { color: sidebarTierInfo.glowColor } : undefined}>
                        {levelDifficultyDisplay}
                      </span>
                    </div>
                    {(showRealm || showPath) && (
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {showPath && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] ${typeColor} opacity-75 bg-ink-dark/35 border border-current/15`}>
                            {getTypeDisplayName(exercise, settings.terminologyMode)}
                          </span>
                        )}
                        <EquipmentBadges exercise={exercise} />
                        {showRealm && exercise.category && (
                          <span className="text-[8px] text-mist-dark/70">{exercise.category}</span>
                        )}
                      </div>
                    )}
                    {loreVisible && showPath && exercise.story && (
                      <p className="text-[9px] text-mist-mid/70 leading-relaxed line-clamp-1 mt-1.5 pt-1 border-t border-ink-light/20">
                        {exercise.story}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
              });
              return elements;
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Cultivation Color Guide ──

const GUIDE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Mortal": { bg: "bg-green-500/15", text: "text-green-400", border: "border-green-500/30" },
  "Foundation Establishment": { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30" },
  "Core Formation": { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30" },
  "Nascent Soul": { bg: "bg-violet-500/15", text: "text-violet-400", border: "border-violet-500/30" },
  "Soul Splitting": { bg: "bg-pink-500/15", text: "text-pink-400", border: "border-pink-500/30" },
  "Tribulation Transcendence": { bg: "bg-yellow-400/15", text: "text-yellow-300", border: "border-yellow-400/30" },
  "Immortal": { bg: "bg-pink-300/15", text: "text-pink-300", border: "border-pink-300/30" },
  "Heavenly Dao": { bg: "bg-cyan-300/15", text: "text-cyan-300", border: "border-cyan-300/30" },
};

function CultivationColorGuide({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <GlowModal isOpen={isOpen} onClose={onClose} title="Cultivation Color System">
      <div className="space-y-5 text-xs">
        {/* Intro */}
        <p className="text-mist-mid leading-relaxed text-sm">
          Each training log entry glows with a colour representing its <span className="text-cloud-white font-medium">cultivation rank</span> — computed from three weighted factors.
        </p>

        {/* Color Scale */}
        <div>
          <h4 className="text-[11px] text-mist-light uppercase tracking-wider font-semibold mb-2">The Eight Ranks</h4>
          <div className="flex rounded-lg overflow-hidden border border-ink-light">
            {DIFFICULTY_SCALE.map((d) => {
              const c = GUIDE_COLORS[d];
              return (
                <div key={d} className={`flex-1 py-2 px-0.5 text-center ${c.bg}`}>
                  <div className={`text-[9px] font-bold ${c.text} leading-tight`}>
                    {d.split(" ").map((w, i) => <span key={i} className="block">{w}</span>)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1 px-1">
            <span className="text-[9px] text-green-400/70">← Easiest</span>
            <span className="text-[9px] text-cyan-300/70">Hardest →</span>
          </div>
        </div>

        {/* Scoring Breakdown */}
        <div>
          <h4 className="text-[11px] text-mist-light uppercase tracking-wider font-semibold mb-2">How Colour Is Determined</h4>
          <p className="text-mist-mid mb-3 leading-relaxed">
            A weighted score from <span className="text-cloud-white">0.0</span> to <span className="text-cloud-white">1.0</span> is computed, then mapped to the rank scale above.
          </p>

          <div className="space-y-2.5">
            {/* Level Factor */}
            <div className="rounded-lg border border-ink-light p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-cloud-white font-semibold flex items-center gap-1.5">
                  <span className="text-sm">📊</span> Tier Level
                </span>
                <span className="text-jade-glow font-bold text-[11px] bg-jade-deep/20 px-2 py-0.5 rounded-full">Base Score</span>
              </div>
              <p className="text-mist-mid leading-relaxed">
                Your tier position within the exercise determines the <span className="text-cloud-white">base colour</span>.
                The lowest tier = <span className="text-green-400">0.0</span> (Mortal), the highest = <span className="text-cyan-300">1.0</span> (Heavenly Dao).
                Tiers in between are spaced evenly across the scale.
              </p>
              <div className="flex items-center gap-2 bg-ink-mid/30 rounded px-2 py-1.5">
                <span className="text-mist-dark text-[10px] font-mono">score = tierIndex / (totalTiers − 1)</span>
              </div>
            </div>

            {/* Variation Factor */}
            <div className="rounded-lg border border-ink-light p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-cloud-white font-semibold flex items-center gap-1.5">
                  <span className="text-sm">🔀</span> Variation
                </span>
                <span className="text-purple-400 font-bold text-[11px] bg-purple-500/15 px-2 py-0.5 rounded-full">±0.15 shift</span>
              </div>
              <p className="text-mist-mid leading-relaxed">
                Selecting a variation shifts the score based on its <span className="text-purple-400">difficulty rank</span>.
                A <span className="text-green-400">Mortal</span>-difficulty variation shifts down (−0.15), while a <span className="text-cyan-300">Heavenly Dao</span>-grade one shifts up (+0.15).
              </p>
              <div className="flex items-center gap-2 bg-ink-mid/30 rounded px-2 py-1.5">
                <span className="text-mist-dark text-[10px] font-mono">shift = (variationRank / 6 − 0.5) × 0.30</span>
              </div>
            </div>

            {/* Modifier Factor */}
            <div className="rounded-lg border border-ink-light p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-cloud-white font-semibold flex items-center gap-1.5">
                  <span className="text-sm">⚡</span> Modifier
                </span>
                <span className="text-amber-400 font-bold text-[11px] bg-amber-500/15 px-2 py-0.5 rounded-full">±0.15 shift</span>
              </div>
              <p className="text-mist-mid leading-relaxed">
                Modifiers with a positive <span className="text-amber-400">difficulty mod</span> push the score upward, while negative ones pull it down.
                The shift is proportional to the modifier value (capped at ±3).
              </p>
              <div className="flex items-center gap-2 bg-ink-mid/30 rounded px-2 py-1.5">
                <span className="text-mist-dark text-[10px] font-mono">shift = clamp(diffMod / 3, −1, 1) × 0.15</span>
              </div>
            </div>
          </div>
        </div>

        {/* Final Formula */}
        <div className="rounded-lg border border-jade-glow/30 bg-jade-deep/10 p-3 space-y-2">
          <h4 className="text-[11px] text-jade-glow uppercase tracking-wider font-semibold">Final Computation</h4>
          <div className="bg-ink-mid/40 rounded px-3 py-2 text-center">
            <span className="text-[11px] font-mono text-cloud-white">
              finalScore = <span className="text-jade-glow">base</span> + <span className="text-purple-400">variationShift</span> + <span className="text-amber-400">modifierShift</span>
            </span>
          </div>
          <p className="text-mist-mid leading-relaxed">
            The result is clamped to <span className="text-cloud-white">0.0 – 1.0</span> and mapped to the nearest cultivation rank.
            Without a variation or modifier, the colour is determined purely by tier level.
          </p>
        </div>

        {/* Examples */}
        <div>
          <h4 className="text-[11px] text-mist-light uppercase tracking-wider font-semibold mb-2">Examples</h4>
          <div className="space-y-1.5">
            {([
              { desc: "Lowest tier, no modifiers", score: "0.00", rank: "Mortal" },
              { desc: "Mid tier, no modifiers", score: "0.50", rank: "Nascent Soul" },
              { desc: "Mid tier + hard variation", score: "0.65", rank: "Soul Splitting" },
              { desc: "Mid tier + hard variation + weighted (+2)", score: "0.75", rank: "Tribulation Transcendence" },
              { desc: "Highest tier, no modifiers", score: "1.00", rank: "Heavenly Dao" },
            ] as const).map((ex) => {
              const c = GUIDE_COLORS[ex.rank];
              return (
                <div key={ex.desc} className="flex items-center gap-2 text-[11px]">
                  <span className={`w-2 h-2 rounded-full ${c.bg} border ${c.border} shrink-0`} />
                  <span className="text-mist-mid flex-1">{ex.desc}</span>
                  <span className="text-mist-dark font-mono">{ex.score}</span>
                  <span className={`${c.text} font-semibold text-[10px] min-w-[80px] text-right`}>{ex.rank}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </GlowModal>
  );
}

// ── Empty State ──

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="text-6xl mb-6 opacity-40">🏛️</div>
      <h2 className="text-xl text-cloud-white mb-2">No Progressions Yet</h2>
      <p className="text-sm text-mist-mid max-w-md mb-6">
        Upload a JSON file in the <span className="text-jade-glow font-medium">Technique Scroll</span> page to populate your progression exercises.
      </p>
    </motion.div>
  );
}

// ── Main Page ──

export default function ProgressionPage() {
  const { settings } = useDisplaySettings();
  const { user } = useAuth();
  const { isMobile } = useAppContext();
  const [exercises, setExercises] = useState<ProgressionExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterEquipment, setFilterEquipment] = useState("");
  const [detailExercise, setDetailExercise] = useState<ProgressionExercise | null>(null);
  const [levelDefaults, setLevelDefaults] = useState<Record<string, number>>({});
  const [selectedTierIds, setSelectedTierIds] = useState<Record<string, string>>({});
  const [readyToLogQueueItems, setReadyToLogQueueItems] = useState<ReadyToLogQueueItem[]>([]);
  const [readyToLogQueueHydrated, setReadyToLogQueueHydrated] = useState(false);
  const [activeQueueItemId, setActiveQueueItemId] = useState<string | null>(null);
  const [selectedLogFilter, setSelectedLogFilter] = useState<LogTableFilter | null>(null);
  const [showColorGuide, setShowColorGuide] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | null>(null);
  const [_exerciseOrder, setExerciseOrder] = useState<string[]>([]);
  const [physique, setPhysique] = useState<UserPhysiqueSettings>(DEFAULT_USER_PHYSIQUE);
  const filterHistoryArmedRef = useRef(false);
  const loggerHistoryArmedRef = useRef(false);

  const userId = user?.id;
  const readyToLogQueueStorageKey = userId ? `training-ready-queue:${userId}` : null;
  const getDraftStorageKey = useCallback((exerciseId: string) => {
    if (!userId) return null;
    return `training-log-draft:${userId}:${exerciseId}`;
  }, [userId]);

  const clearExerciseDraft = useCallback((exerciseId: string) => {
    const draftKey = getDraftStorageKey(exerciseId);
    if (!draftKey) return;

    try {
      sessionStorage.removeItem(draftKey);
    } catch {
      // Ignore draft cleanup failures.
    }
  }, [getDraftStorageKey]);

  // Read draft data from sessionStorage and produce a comprehensive summary for queue display
  const getDraftSummary = useCallback((exerciseId: string): string | null => {
    const draftKey = getDraftStorageKey(exerciseId);
    if (!draftKey) return null;

    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!raw) return null;
      const draft = JSON.parse(raw) as Record<string, string>;

      const setParts: string[] = [];
      const unit = draft.weightUnit === "lbs" ? "lbs" : "kg";
      const isHold = draft.inputMode === "hold";

      if (isHold) {
        const sets = [
          { hold: draft.hold, reps: draft.r1 },
          { hold: draft.hold2, reps: draft.r2 },
          { hold: draft.hold3, reps: draft.r3 },
        ];
        sets.forEach((s, i) => {
          if (s.hold || s.reps) {
            const holdPart = s.hold ? `${s.hold}s` : "";
            const repsPart = s.reps ? `${s.reps}r` : "";
            const combined = [holdPart, repsPart].filter(Boolean).join(" · ");
            setParts.push(`S${i + 1}: ${combined}`);
          }
        });
      } else {
        const sets = [
          { w: draft.w1, r: draft.r1 },
          { w: draft.w2, r: draft.r2 },
          { w: draft.w3, r: draft.r3 },
        ];
        sets.forEach((s, i) => {
          if (s.w || s.r) {
            const wPart = s.w ? `${s.w}${unit}` : "";
            const rPart = s.r ? `×${s.r}` : "";
            setParts.push(`S${i + 1}: ${wPart}${rPart}`);
          }
        });
      }

      const configParts: string[] = [];
      if (draft.selectedModifierKg) configParts.push(`+${parseFloat(draft.selectedModifierKg)}kg`);
      if (draft.selectedResistanceBand) configParts.push(`Band: ${formatResistanceBandLabel(parseFloat(draft.selectedResistanceBand))}`);
      if (draft.selectedVariation) configParts.push(`Var: ${draft.selectedVariation}`);

      const allParts: string[] = [];
      if (setParts.length > 0) allParts.push(setParts.join(" | "));
      if (configParts.length > 0) allParts.push(configParts.join(", "));
      if (draft.notes) allParts.push("📝");

      return allParts.length > 0 ? allParts.join(" · ") : null;
    } catch {
      return null;
    }
  }, [getDraftStorageKey]);

  // Track draft summaries for queue display, refresh when popup closes
  const [draftSummaryTick, setDraftSummaryTick] = useState(0);
  const draftSummaries = useMemo(() => {
    // draftSummaryTick forces recalculation when logger closes
    void draftSummaryTick;
    const summaries: Record<string, string | null> = {};
    for (const item of readyToLogQueueItems) {
      summaries[item.exerciseId] = getDraftSummary(item.exerciseId);
    }
    return summaries;
  }, [readyToLogQueueItems, getDraftSummary, draftSummaryTick]);

  // Refresh draft summaries when the logger popup closes
  useEffect(() => {
    if (!activeQueueItemId) {
      setDraftSummaryTick((t) => t + 1);
    }
  }, [activeQueueItemId]);

  // ── User physique settings (used for gym auto-tiering) ──
  useEffect(() => {
    if (!userId) {
      setPhysique(DEFAULT_USER_PHYSIQUE);
      return;
    }

    setPhysique(loadUserPhysique(userId));

    const handlePhysiqueUpdate = (event: Event) => {
      const custom = event as CustomEvent<{ userId?: string }>;
      if (!custom.detail?.userId || custom.detail.userId === userId) {
        setPhysique(loadUserPhysique(userId));
      }
    };

    window.addEventListener("user-physique-updated", handlePhysiqueUpdate as EventListener);
    return () => window.removeEventListener("user-physique-updated", handlePhysiqueUpdate as EventListener);
  }, [userId]);

  // ── Weight standards from DB (admin-configured BW% per exercise+gender) ──
  const [weightStandards, setWeightStandards] = useState<WeightStandardsMap>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/weight-standards");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const map: WeightStandardsMap = {};
        for (const item of data.standards ?? []) {
          if (!map[item.exerciseId]) map[item.exerciseId] = { male: null, female: null };
          if (item.gender === "MALE") map[item.exerciseId].male = item;
          else if (item.gender === "FEMALE") map[item.exerciseId].female = item;
        }
        setWeightStandards(map);
      } catch {
        // Silently fall back to hardcoded standards
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Persist level defaults in localStorage ──
  useEffect(() => {
    if (!userId) return;
    const stored = localStorage.getItem(`progression-levels-${userId}`);
    if (stored) {
      try { setLevelDefaults(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, [userId]);

  // ── Persist ready-to-log queue items so logger/back navigation does not drop them ──
  useEffect(() => {
    if (!readyToLogQueueStorageKey) {
      setReadyToLogQueueItems([]);
      setReadyToLogQueueHydrated(false);
      return;
    }

    try {
      const raw = localStorage.getItem(readyToLogQueueStorageKey);
      if (!raw) {
        setReadyToLogQueueItems([]);
      } else {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
          // Backward compatibility: migrate old exercise-id array storage.
          setReadyToLogQueueItems(
            parsed
              .filter((exerciseId): exerciseId is string => typeof exerciseId === "string")
              .map((exerciseId) => ({ id: createReadyToLogQueueItemId(), exerciseId }))
          );
        } else if (
          Array.isArray(parsed) &&
          parsed.every(
            (item) =>
              item &&
              typeof item === "object" &&
              typeof (item as ReadyToLogQueueItem).id === "string" &&
              typeof (item as ReadyToLogQueueItem).exerciseId === "string"
          )
        ) {
          setReadyToLogQueueItems(parsed as ReadyToLogQueueItem[]);
        } else {
          setReadyToLogQueueItems([]);
        }
      }
    } catch {
      setReadyToLogQueueItems([]);
    } finally {
      setReadyToLogQueueHydrated(true);
    }
  }, [readyToLogQueueStorageKey]);

  useEffect(() => {
    if (!readyToLogQueueStorageKey || !readyToLogQueueHydrated) return;

    try {
      localStorage.setItem(readyToLogQueueStorageKey, JSON.stringify(readyToLogQueueItems));
    } catch {
      // Ignore localStorage write failures.
    }
  }, [readyToLogQueueStorageKey, readyToLogQueueHydrated, readyToLogQueueItems]);

  const updateLevelDefault = useCallback((exerciseId: string, level: number) => {
    setLevelDefaults((prev) => {
      const next = { ...prev, [exerciseId]: level };
      if (userId) localStorage.setItem(`progression-levels-${userId}`, JSON.stringify(next));
      return next;
    });
  }, [userId]);

  const fetchExercises = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/progressions?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.exercises) setExercises(data.exercises);
    } catch (err) {
      console.error("Failed to fetch progressions:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  // Listen for uploads from exercises page
  useEffect(() => {
    const handler = () => fetchExercises();
    window.addEventListener("progression-exercises-updated", handler);
    return () => window.removeEventListener("progression-exercises-updated", handler);
  }, [fetchExercises]);

  // ── Toggle exercise selection ──
  const addExercise = useCallback((exerciseId: string) => {
    const queueItemId = createReadyToLogQueueItemId();
    setReadyToLogQueueItems((prev) => [...prev, { id: queueItemId, exerciseId }]);
    return queueItemId;
  }, []);

  const selectedExerciseIds = useMemo(
    () => new Set(readyToLogQueueItems.map((item) => item.exerciseId)),
    [readyToLogQueueItems]
  );

  const toggleExercise = useCallback((exerciseId: string) => {
    const itemsToRemove = readyToLogQueueItems.filter((item) => item.exerciseId === exerciseId);
    if (itemsToRemove.length === 0) {
      addExercise(exerciseId);
      return;
    }

    const removedIds = new Set(itemsToRemove.map((item) => item.id));
    setReadyToLogQueueItems((prev) => prev.filter((item) => !removedIds.has(item.id)));
    for (const item of itemsToRemove) {
      clearExerciseDraft(item.exerciseId);
    }
    setActiveQueueItemId((prev) => (prev && removedIds.has(prev) ? null : prev));
  }, [addExercise, clearExerciseDraft, readyToLogQueueItems]);

  const dismissQueueItem = useCallback((queueItemId: string) => {
    const target = readyToLogQueueItems.find((item) => item.id === queueItemId);
    if (!target) return;

    setReadyToLogQueueItems((prev) => prev.filter((item) => item.id !== queueItemId));
    clearExerciseDraft(target.exerciseId);
    setActiveQueueItemId((prev) => (prev === queueItemId ? null : prev));
  }, [clearExerciseDraft, readyToLogQueueItems]);

  // ── Day assignment management (for TechniqueManagementDrawer) ──
  const handleUpdateDayAssignments = useCallback(async (exerciseId: string, assignedDays: string) => {
    if (!userId) return;
    const dayIndices = assignedDays ? assignedDays.split(',').map(d => parseInt(d)).filter(d => !isNaN(d)) : [];
    const response = await fetch(`/api/progressions/${exerciseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, assignedDays: dayIndices }),
    });
    if (response.ok) {
      const { exercise } = await response.json();
      setExercises(prev => prev.map(ex =>
        ex.id === exerciseId ? { ...ex, assignedDays: exercise.assignedDays } : ex
      ));
    } else {
      throw new Error("Failed to update day assignments");
    }
  }, [userId]);

  const handleReorderExercises = useCallback((orderedIds: string[]) => {
    setExerciseOrder(orderedIds);
    if (userId) {
      localStorage.setItem(`cultivateos-progression-order-${userId}`, JSON.stringify(orderedIds));
    }
  }, [userId]);

  // Initialize exercise order from localStorage
  useEffect(() => {
    if (!userId) return;
    try {
      const stored = localStorage.getItem(`cultivateos-progression-order-${userId}`);
      if (stored) setExerciseOrder(JSON.parse(stored));
    } catch { /* ignore */ }
  }, [userId]);

  const handleDrawerOpen = useCallback(() => setIsDrawerOpen(true), []);
  const handleDrawerClose = useCallback(() => setIsDrawerOpen(false), []);

  // ── Log training data ──
  const handleLog = async (queueItemId: string, exerciseId: string, level: number, data: {
    weight1?: number; reps1?: number;
    weight2?: number; reps2?: number;
    weight3?: number; reps3?: number;
    holdTime?: number; holdTime2?: number; holdTime3?: number; modifier?: string; resistanceBandKg?: number; variant?: string; notes?: string;
  }) => {
    if (!userId) return;

    const exercise = exercises.find((e) => e.id === exerciseId);
    const autoLevel = exercise
      ? getAutoGymLevelFromSet(exercise, physique, {
          weight1: data.weight1,
          weight2: data.weight2,
          weight3: data.weight3,
        }, data.modifier, weightStandards)
      : null;
    const effectiveLevel =
      exercise && isGymCategoryExercise(exercise)
        ? (autoLevel ?? level)
        : level;

    const { resistanceBandKg: _ignoredResistanceBand, ...logData } = data;

    const res = await fetch(`/api/progressions/${exerciseId}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, level: effectiveLevel, ...logData }),
    });
    if (!res.ok) {
      const text = await res.text();
      let errMsg = "Failed to log";
      try {
        const err = JSON.parse(text);
        errMsg = err.error || errMsg;
      } catch {
        console.error(`Log failed (${res.status}):`, text.slice(0, 200));
      }
      throw new Error(errMsg);
    }

    await fetchExercises();
    dismissQueueItem(queueItemId);
  };

  // ── View detail ──
  const handleViewExercise = (exerciseId: string) => {
    const ex = exercises.find((e) => e.id === exerciseId);
    if (ex) setDetailExercise(ex);
  };

  // ── Derived data ──
  const autoLevelByExerciseId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const ex of exercises) {
      const level = getAutoGymLevel(ex, physique, weightStandards);
      if (level != null) map[ex.id] = level;
    }
    return map;
  }, [exercises, physique, weightStandards]);

  const categories = [
    ...new Set(exercises.flatMap((e) => parseCategoryTags(e.category))),
  ].sort();
  const types = [...new Set(exercises.map((e) => e.type).filter((t): t is string => !!t && t.trim().length > 0))].sort();
  const equipmentTypes = [...new Set(exercises.flatMap(getEquipmentTags))].sort();

  // Selected exercises in insertion order from the queue set.
  const selectedExercises = useMemo(
    () =>
      readyToLogQueueItems
        .map((item) => {
          const exercise = exercises.find((candidate) => candidate.id === item.exerciseId);
          if (!exercise) return null;
          return { queueItemId: item.id, exercise };
        })
        .filter((item): item is { queueItemId: string; exercise: ProgressionExercise } => Boolean(item)),
    [exercises, readyToLogQueueItems]
  );
  const loggerTargetQueueItemId = activeQueueItemId;
  const activeLoggerQueueItem = loggerTargetQueueItemId
    ? readyToLogQueueItems.find((item) => item.id === loggerTargetQueueItemId) ?? null
    : null;
  const activeLoggerExercise = activeLoggerQueueItem
    ? exercises.find((exercise) => exercise.id === activeLoggerQueueItem.exerciseId) ?? null
    : null;

  useEffect(() => {
    if (activeQueueItemId && !readyToLogQueueItems.some((item) => item.id === activeQueueItemId)) {
      setActiveQueueItemId(null);
    }
  }, [activeQueueItemId, readyToLogQueueItems]);

  // Escape should close logger first, then clear active table filter.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (activeQueueItemId) {
        event.preventDefault();
        setActiveQueueItemId(null);
        loggerHistoryArmedRef.current = false;
        return;
      }
      if (!selectedLogFilter) return;
      event.preventDefault();
      setSelectedLogFilter(null);
      filterHistoryArmedRef.current = false;
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeQueueItemId, selectedLogFilter]);

  // When logger is open, add a same-page history entry so mobile back closes the popup first.
  useEffect(() => {
    if (!activeQueueItemId) {
      loggerHistoryArmedRef.current = false;
      return;
    }
    if (loggerHistoryArmedRef.current) return;

    try {
      window.history.pushState({ workoutLogger: true, at: Date.now() }, "", window.location.href);
      loggerHistoryArmedRef.current = true;
    } catch {
      // Ignore history failures.
    }
  }, [activeQueueItemId]);

  // When filtered, add a same-page history entry so mobile back clears filter first.
  useEffect(() => {
    if (!selectedLogFilter) {
      filterHistoryArmedRef.current = false;
      return;
    }
    if (filterHistoryArmedRef.current) return;

    try {
      window.history.pushState({ workoutTableFilter: true, at: Date.now() }, "", window.location.href);
      filterHistoryArmedRef.current = true;
    } catch {
      // Ignore history failures.
    }
  }, [selectedLogFilter]);

  useEffect(() => {
    const onPopState = () => {
      if (activeQueueItemId) {
        setActiveQueueItemId(null);
        loggerHistoryArmedRef.current = false;
        return;
      }
      if (!selectedLogFilter) return;
      setSelectedLogFilter(null);
      filterHistoryArmedRef.current = false;
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [activeQueueItemId, selectedLogFilter]);

  // Android WebView hardware back fallback.
  useEffect(() => {
    const onBackButton = (event: Event) => {
      if (!activeQueueItemId && !selectedLogFilter) return;

      if (typeof (event as { preventDefault?: () => void }).preventDefault === "function") {
        (event as { preventDefault: () => void }).preventDefault();
      }

      if (activeQueueItemId) {
        setActiveQueueItemId(null);
        loggerHistoryArmedRef.current = false;
        return;
      }

      setSelectedLogFilter(null);
      filterHistoryArmedRef.current = false;
    };

    document.addEventListener("backbutton", onBackButton as EventListener);
    return () => document.removeEventListener("backbutton", onBackButton as EventListener);
  }, [activeQueueItemId, selectedLogFilter]);

  // Capacitor native Android back-button (reliable in APK webview).
  useEffect(() => {
    let handle: { remove: () => Promise<void> } | null = null;
    let cancelled = false;

    const register = async () => {
      try {
        const mod = await import("@capacitor/app");
        if (cancelled) return;
        const result = await mod.App.addListener("backButton", () => {
          if (activeQueueItemId) {
            setActiveQueueItemId(null);
            loggerHistoryArmedRef.current = false;
            return;
          }
          if (selectedLogFilter) {
            setSelectedLogFilter(null);
            filterHistoryArmedRef.current = false;
          }
        });
        if (cancelled) {
          void result.remove();
          return;
        }
        handle = result;
      } catch {
        // Capacitor App plugin unavailable outside native runtime.
      }
    };

    void register();

    return () => {
      cancelled = true;
      if (!handle) return;
      void handle.remove();
    };
  }, [activeQueueItemId, selectedLogFilter]);

  // ── Render ──

  const sidebar = (
    <ProgressionSidebar
      exercises={exercises}
      selectedIds={selectedExerciseIds}
      onToggleExercise={toggleExercise}
      onAddExercise={addExercise}
      onSelectWithLevel={(exerciseId, level, tierId) => {
        if (!selectedExerciseIds.has(exerciseId)) addExercise(exerciseId);
        if (tierId) {
          setSelectedTierIds((prev) => ({ ...prev, [exerciseId]: tierId }));
        }
        updateLevelDefault(exerciseId, level);
      }}
      selectedTierIds={selectedTierIds}
      searchTerm={searchTerm}
      onSearch={setSearchTerm}
      filterCategory={filterCategory}
      setFilterCategory={setFilterCategory}
      filterType={filterType}
      setFilterType={setFilterType}
      filterEquipment={filterEquipment}
      setFilterEquipment={setFilterEquipment}
      categories={categories}
      types={types}
      equipmentTypes={equipmentTypes}
      levelDefaults={levelDefaults}
      autoLevelByExerciseId={autoLevelByExerciseId}
      selectedDayFilter={selectedDayFilter}
      setSelectedDayFilter={setSelectedDayFilter}
      onDrawerOpen={handleDrawerOpen}
      userBodyweightKg={physique.bodyWeightKg}
    />
  );

  if (loading) {
    return (
      <PageLayout sidebar={sidebar} title="Training Grounds" subtitle="Record your cultivation sessions">
        <div className="flex items-center justify-center py-20">
          <p className="text-mist-mid text-sm animate-pulse">Loading exercises…</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout sidebar={sidebar} title="Training Grounds" subtitle="Record your cultivation sessions">
      {exercises.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="px-0 py-2 sm:py-3 space-y-3 sm:space-y-4">
          {/* Selected exercises queue */}
          {selectedExercises.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-1 sm:px-0">
                <div className="min-w-0">
                  <h3 className="text-xs text-mist-light uppercase tracking-wider">Ready To Log</h3>
                  <p className="mt-0.5 text-[10px] text-mist-dark">Tap a banner to open the logger popup.</p>
                </div>
                <button
                  onClick={() => {
                    for (const queuedItem of readyToLogQueueItems) {
                      clearExerciseDraft(queuedItem.exerciseId);
                    }
                    setReadyToLogQueueItems([]);
                    setActiveQueueItemId(null);
                  }}
                  className="whitespace-nowrap rounded-md border border-crimson/45 bg-crimson-deep/30 px-3 py-1.5 text-[11px] font-semibold text-crimson-light transition-all duration-150 hover:bg-crimson-deep/45 hover:border-crimson/70 hover:text-cloud-white active:scale-[0.98]"
                >
                  Clear all
                </button>
              </div>
              <div className="space-y-0">
                {selectedExercises.map(({ queueItemId, exercise }) => {
                  const isActiveLogger = loggerTargetQueueItemId === queueItemId;
                  const level = getSelectedLevel(exercise, levelDefaults, autoLevelByExerciseId);
                  const queueFilterLevel = isGymCategoryExercise(exercise) ? null : level;
                  const isFilterActiveForRow =
                    selectedLogFilter?.exerciseId === exercise.id &&
                    selectedLogFilter?.levelNameLevel === queueFilterLevel;
                  const rowDifficulty = getWeightedDifficulty(exercise, level) || exercise.difficulty;
                  const rowTierGlow = getTierGlowFromLogs(exercise, physique.bodyWeightKg);
                  const difficultyStyle = { glowColor: rowTierGlow.glowColor, glowShadow: `0 0 8px ${rowTierGlow.glowColor}30, inset 0 0 8px ${rowTierGlow.glowColor}10`, textColor: "" };
                  const conventionalDifficulty = rowTierGlow.tierName;
                  const displayName = stripBwPercentHint(getExerciseDisplayName(exercise, settings.terminologyMode));
                  const altName = settings.terminologyMode === "fantasy"
                    ? stripBwPercentHint(exercise.name || "")
                    : stripBwPercentHint(exercise.wuxiaName || "");
                  const showAltName = !!altName && altName !== displayName;
                  const draftSummary = draftSummaries[exercise.id];
                  const openLogger = () => {
                    setActiveQueueItemId(queueItemId);
                  };
                  return (
                    <div
                      key={queueItemId}
                      className={`relative mb-1 flex items-center gap-2 rounded-md border px-2.5 py-2 cursor-pointer transform-gpu transition-[transform,background-color] duration-75 ease-out hover:-translate-y-0.5 ${
                        isActiveLogger
                          ? "bg-ink-mid/45"
                          : "bg-ink-dark/45 hover:bg-ink-mid/35"
                      }`}
                      onClick={openLogger}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openLogger();
                        }
                      }}
                      style={{
                        borderColor: difficultyStyle.glowColor,
                        boxShadow: isActiveLogger
                          ? `${difficultyStyle.glowShadow}, 0 0 14px ${difficultyStyle.glowColor}, inset 0 0 0 1px ${difficultyStyle.glowColor}`
                          : `${difficultyStyle.glowShadow}, inset 0 0 0 1px ${difficultyStyle.glowColor}`,
                        backgroundImage: "linear-gradient(104deg, rgba(8,16,24,0.96) 0%, rgba(14,24,36,0.94) 100%)",
                      }}
                    >
                      <span
                        className="absolute left-0 top-0 h-full w-1 rounded-l-md"
                        style={{ backgroundColor: difficultyStyle.glowColor, boxShadow: `0 0 10px ${difficultyStyle.glowColor}` }}
                      />
                      <div className="min-w-0 flex-1 pl-1 text-left">
                        <div className="truncate text-[11px] font-semibold" style={{ color: difficultyStyle.glowColor }}>
                          {displayName}
                        </div>
                        {showAltName && (
                          <div className="truncate text-[10px] text-mist-light/80">
                            {settings.terminologyMode === "fantasy" ? "Conventional" : "Cultivation"}: {altName}
                          </div>
                        )}
                        <div className="mt-0.5 flex items-center gap-2 text-[10px]">
                          <span className="text-mist-dark">{exercise.category || exercise.type || ''}</span>
                          <span className="font-semibold" style={{ color: difficultyStyle.glowColor }}>{conventionalDifficulty}</span>
                        </div>
                        {draftSummary && (() => {
                          // Split summary into set data and config sections
                          const sections = draftSummary.split(" · ");
                          const setSection = sections[0]; // "S1: 25kg×12 | S2: 27.5kg×10" or similar
                          const configSections = sections.slice(1).filter(s => s !== "📝");
                          const hasNotes = sections.includes("📝");
                          return (
                            <div className="mt-1 space-y-0.5">
                              <div className="flex items-center gap-1.5 text-[10px] text-jade-light/80">
                                <span
                                  className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: difficultyStyle.glowColor, boxShadow: `0 0 4px ${difficultyStyle.glowColor}` }}
                                />
                                <span className="truncate">{setSection}{hasNotes ? " 📝" : ""}</span>
                              </div>
                              {configSections.length > 0 && (
                                <div className="flex items-center gap-1.5 text-[9px] text-mist-dark/80 pl-[13px] flex-wrap">
                                  {configSections.map((cfg, i) => (
                                    <span key={i} className="inline-flex items-center px-1 py-0 rounded bg-ink-mid/30 border border-ink-light/15">
                                      {cfg}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            const nextFilter: LogTableFilter = {
                              exerciseId: exercise.id,
                              levelNameLevel: queueFilterLevel,
                            };
                            const isSameFilter =
                              selectedLogFilter?.exerciseId === nextFilter.exerciseId &&
                              selectedLogFilter?.levelNameLevel === nextFilter.levelNameLevel;
                            setSelectedLogFilter(isSameFilter ? null : nextFilter);
                          }}
                          className={`inline-flex h-6 items-center justify-center rounded-md border px-2 text-[10px] font-semibold leading-none transition-all duration-150 ${
                            isFilterActiveForRow
                              ? "border-jade-glow/70 bg-jade-deep/35 text-jade-glow"
                              : "border-jade/40 bg-jade-deep/10 text-jade-light hover:bg-jade-deep/25 hover:border-jade-glow/60"
                          }`}
                          aria-label={`${isFilterActiveForRow ? "Clear" : "Apply"} log filter for ${stripBwPercentHint(exercise.wuxiaName || exercise.name)}`}
                          title={isFilterActiveForRow ? "Clear log filter" : "Filter logs to this exercise/tier"}
                        >
                          Filter
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            dismissQueueItem(queueItemId);
                          }}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-crimson/45 bg-crimson/10 text-[12px] font-bold leading-none text-crimson-light transition-all duration-150 hover:bg-crimson/20 hover:border-crimson/70"
                          aria-label={`Remove ${stripBwPercentHint(exercise.wuxiaName || exercise.name)}`}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Training Log Table (Unified) */}
          <section className={`space-y-3 rounded-lg border p-2 transition-colors ${selectedLogFilter ? "border-jade-glow/25 bg-ink-mid/20" : "border-transparent bg-transparent"}`}>
            <div className="flex items-center justify-between gap-2 px-1 sm:px-0">
              <h3 className="text-xs text-mist-light uppercase tracking-wider">Training Log</h3>
              <button
                onClick={() => setSelectedLogFilter(null)}
                disabled={!selectedLogFilter}
                className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                  selectedLogFilter
                    ? "border-jade/40 text-jade-light hover:bg-jade-deep/20"
                    : "border-jade/20 text-jade-light/0 pointer-events-none"
                }`}
                aria-hidden={!selectedLogFilter}
              >
                Clear Exercise Filter
              </button>
            </div>
            <div className="-mx-4 sm:-mx-6">
              <MemoUnifiedTrainingLogTable
                exercises={exercises}
                physique={physique}
                selectedLogFilter={selectedLogFilter}
                onSelectExercise={setSelectedLogFilter}
                onRefresh={fetchExercises}
                userId={userId || ''}
                weightStandards={weightStandards}
              />
            </div>
          </section>
        </div>
      )}

      {/* Detail View Modal */}
      <ExerciseDetailModal
        exercise={detailExercise}
        isOpen={detailExercise !== null}
        onClose={() => setDetailExercise(null)}
      />

      {/* Cultivation Color Guide Modal */}
      <CultivationColorGuide isOpen={showColorGuide} onClose={() => setShowColorGuide(false)} />

      {/* Technique Management Drawer */}
      <TechniqueManagementDrawer
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        exercises={exercises.map(e => ({
          id: e.id,
          name: e.name,
          wuxiaName: e.wuxiaName,
          difficulty: e.difficulty,
          wuxiaDifficulty: e.wuxiaDifficulty,
          type: e.type,
          wuxiaType: e.wuxiaType,
          story: e.story,
          assignedDays: e.assignedDays,
        }))}
        onUpdateDayAssignments={handleUpdateDayAssignments}
        onReorderExercises={handleReorderExercises}
        selectedDayFilter={selectedDayFilter}
      />

      {/* Ready-to-log popup logger — portalled to document.body to avoid transform stacking context issues */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {activeLoggerExercise && activeLoggerQueueItem && (
            <>
              <motion.button
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                onClick={() => setActiveQueueItemId(null)}
                className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px]"
                aria-label="Close logger"
              />
              <motion.div
                initial={isMobile ? { opacity: 0, y: 20 } : { opacity: 0, y: 14, scale: 0.97 }}
                animate={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, scale: 1 }}
                exit={isMobile ? { opacity: 0, y: 10 } : { opacity: 0, y: 10, scale: 0.97 }}
                transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
                className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain p-2 sm:p-6 antialiased [text-rendering:optimizeLegibility]"
                style={{ WebkitOverflowScrolling: "touch", WebkitFontSmoothing: "antialiased" }}
                onClick={() => setActiveQueueItemId(null)}
              >
                <div
                  className="mx-auto w-full max-w-4xl pb-[calc(env(safe-area-inset-bottom)+7rem)]"
                  onClick={(event) => event.stopPropagation()}
                >
                  <InlineLogForm
                    key={activeLoggerQueueItem.id}
                    queueItemId={activeLoggerQueueItem.id}
                    exercise={activeLoggerExercise}
                    selectedLevel={getSelectedLevel(activeLoggerExercise, levelDefaults, autoLevelByExerciseId)}
                    onSubmit={handleLog}
                    onChangeLevel={updateLevelDefault}
                    onDismiss={dismissQueueItem}
                    onViewDetail={handleViewExercise}
                    onExit={() => setActiveQueueItemId(null)}
                    draftStorageKey={getDraftStorageKey(activeLoggerExercise.id)}
                    physique={physique}
                    userId={userId ?? null}
                  />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </PageLayout>
  );
}
