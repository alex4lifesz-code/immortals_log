"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useMemo } from "react";
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
import { DEFAULT_USER_PHYSIQUE, loadUserPhysique, UserPhysiqueSettings } from "@/lib/user-physique";

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

const RESISTANCE_BAND_TOKEN = /^RB:\s*(\d+(?:\.\d+)?)\s*kg$/i;
const RESISTANCE_BAND_LEVEL_TOKEN = /^RBL:\s*(\d+)$/i;
const RESISTANCE_BAND_OPTIONS = [2.5, 5, 7.5, 10, 12.5, 15, 20, 25, 30] as const;
const MAX_RESISTANCE_BAND_KG = Math.max(...RESISTANCE_BAND_OPTIONS);

function formatResistanceBandLabel(kg: number): string {
  const normalized = Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace(/\.0$/, "");
  return `-${normalized}kg`;
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
  displayLevelOverride: number | null;
} {
  if (!modifier) return { baseModifier: null, resistanceBandKg: null, displayLevelOverride: null };

  const parts = modifier
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  let resistanceBandKg: number | null = null;
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
    baseParts.push(part);
  }

  return {
    baseModifier: baseParts.length > 0 ? baseParts.join(" | ") : null,
    resistanceBandKg,
    displayLevelOverride,
  };
}

function buildModifierWithBand(
  baseModifier: string | null | undefined,
  resistanceBandKg: number | null | undefined,
  displayLevelOverride?: number | null,
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
  return parts.length > 0 ? parts.join(" | ") : null;
}

// ── Helpers ──

function getSelectedLevel(
  exercise: ProgressionExercise,
  defaults: Record<string, number>,
  autoLevels: Record<string, number>
): number {
  if (Object.prototype.hasOwnProperty.call(defaults, exercise.id)) return defaults[exercise.id];
  if (autoLevels[exercise.id]) return autoLevels[exercise.id];
  return exercise.userProgress[0]?.currentLevel ?? 1;
}

function averageWeightsFromLog(log: ProgressionLog): number | null {
  const vals = [log.weight1, log.weight2, log.weight3].filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);
  if (vals.length === 0) return null;
  return vals.reduce((sum, v) => sum + v, 0) / vals.length;
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
    other: [18, 30, 42, 54, 66, 78, 90, 102, 114, 126],
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

function isGymCategoryExercise(exercise: ProgressionExercise): boolean {
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
  const name = (exercise.name || "").toLowerCase();
  const equipment = (exercise.equipmentType || "").toLowerCase();
  const category = (exercise.category || "").toLowerCase();

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
    "l-sit",
    "dragon flag",
    "human flag",
  ];
  const calisthenicsEquipmentHints = ["bar", "pull", "dip", "floor", "rings", "body", "parallette"];
  const gymHints = ["dumbbell", "barbell", "machine", "cable", "plate", "smith"];

  const looksCalisthenics =
    exercise.bodyweight ||
    exercise.rings ||
    calisthenicsNameHints.some((hint) => name.includes(hint)) ||
    calisthenicsEquipmentHints.some((hint) => equipment.includes(hint)) ||
    category.includes("calisthenics");

  if (looksCalisthenics) return true;

  return !gymHints.some((hint) => equipment.includes(hint) || name.includes(hint));
}


function getAutoGymLevelFromAverage(
  exercise: ProgressionExercise,
  physique: UserPhysiqueSettings,
  avgWeight: number | null
): number | null {
  if (!isGymCategoryExercise(exercise)) return null;
  if (!isGymWeightTrackedExercise(exercise)) return null;
  if (!physique.bodyWeightKg || physique.bodyWeightKg <= 0) return null;
  if (!exercise.tiers || exercise.tiers.length === 0) return null;
  if (!avgWeight || avgWeight <= 0) return null;

  const sortedTiers = [...exercise.tiers].sort((a, b) => a.level - b.level);
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

function getAutoGymLevelFromSet(
  exercise: ProgressionExercise,
  physique: UserPhysiqueSettings,
  setData: {
    weight1?: number | null;
    weight2?: number | null;
    weight3?: number | null;
  },
  bandKg?: number | null
): number | null {
  const bandOffset = (typeof bandKg === "number" && bandKg > 0) ? bandKg : 0;
  const vals = [setData.weight1, setData.weight2, setData.weight3]
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0)
    .map((v) => Math.max(0, v - bandOffset));
  const avg = vals.length > 0 ? vals.reduce((sum, v) => sum + v, 0) / vals.length : null;
  return getAutoGymLevelFromAverage(exercise, physique, avg);
}

function recentAverageWeightBandAdjusted(logs: ProgressionLog[], limit = 3): number | null {
  const sorted = [...logs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
  const vals = sorted
    .map((log) => {
      const avg = averageWeightsFromLog(log);
      if (avg == null) return null;
      const { resistanceBandKg } = parseModifierWithBand(log.modifier);
      const offset = (typeof resistanceBandKg === "number" && resistanceBandKg > 0) ? resistanceBandKg : 0;
      return Math.max(0, avg - offset);
    })
    .filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return vals.reduce((sum, v) => sum + v, 0) / vals.length;
}

function getAutoGymLevel(exercise: ProgressionExercise, physique: UserPhysiqueSettings): number | null {
  const logs = exercise.userProgress[0]?.logs ?? [];
  const avgWeight = recentAverageWeightBandAdjusted(logs, 3);
  return getAutoGymLevelFromAverage(exercise, physique, avgWeight);
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
                          {getExerciseDisplayName(tier, settings.terminologyMode)}
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

// ── Training Log Table ──

interface FlatLogEntry {
  logId: string;
  date: string;
  exerciseName: string;
  exerciseId: string;
  level: number;
  levelNameLevel: number;
  tierName: string;
  weight1: number | null;
  reps1: number | null;
  weight2: number | null;
  reps2: number | null;
  weight3: number | null;
  reps3: number | null;
  holdTime: number | null;
  holdTime2: number | null;
  holdTime3: number | null;
  modifier: string | null;
  resistanceBandKg: number | null;
  variant: string | null;
  notes: string | null;
  completed: boolean;
  hasHold: boolean;
}

function flattenLogs(exercises: ProgressionExercise[]): FlatLogEntry[] {
  const entries: FlatLogEntry[] = [];

  for (const ex of exercises) {
    const progress = ex.userProgress[0];
    if (!progress) continue;
    for (const log of progress.logs) {
      const logHasHold = log.holdTime != null || log.holdTime2 != null || log.holdTime3 != null;
      const parsed = parseModifierWithBand(log.modifier);
      entries.push({
        logId: log.id,
        date: log.createdAt,
        exerciseName: ex.name,
        exerciseId: ex.id,
        level: log.level,
        levelNameLevel: parsed.displayLevelOverride ?? log.level,
        tierName: stripBwPercentHint(getTierName(ex, parsed.displayLevelOverride ?? log.level)),
        weight1: log.weight1,
        reps1: log.reps1,
        weight2: log.weight2,
        reps2: log.reps2,
        weight3: log.weight3,
        reps3: log.reps3,
        holdTime: log.holdTime,
        holdTime2: log.holdTime2,
        holdTime3: log.holdTime3,
        modifier: parsed.baseModifier,
        resistanceBandKg: parsed.resistanceBandKg,
        variant: log.variant,
        notes: log.notes,
        completed: log.completed,
        hasHold: logHasHold,
      });
    }
  }
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return entries;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function displayVal(v: number | null): string {
  return v != null ? String(v) : "—";
}

function abbreviateVariantText(text: string): string {
  const words = text
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return words.slice(0, 4).map((w) => w[0].toUpperCase()).join("");
  }

  const compact = words[0] ?? text.trim();
  return compact.slice(0, 6).toUpperCase();
}

function TrainingLogTable({
  exercises,
  physique,
  selectedExerciseId,
  onSelectExercise,
  onRefresh,
  userId,
}: {
  exercises: ProgressionExercise[];
  physique: UserPhysiqueSettings;
  selectedExerciseId: string | null;
  onSelectExercise: (exerciseId: string | null) => void;
  onRefresh: () => void;
  userId: string;
}) {
  const allEntries = useMemo(() => flattenLogs(exercises), [exercises]);
  // Show only selected exercise when a filter is active.
  const entries = allEntries.filter(e => !e.hasHold && (!selectedExerciseId || e.exerciseId === selectedExerciseId));
  const { settings } = useDisplaySettings();
  const { isMobile } = useAppContext();

  const [isEditMode, setIsEditMode] = useState(false);
  const [editingData, setEditingData] = useState<Record<string, {
    weight1: number | null; reps1: number | null;
    weight2: number | null; reps2: number | null;
    weight3: number | null; reps3: number | null;
    level: number;
    modifier: string | null; resistanceBandKg: number | null; variant: string | null; notes: string | null;
  }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ logId: string; exerciseName: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [levelPicker, setLevelPicker] = useState<{ logId: string; exerciseId: string } | null>(null);

  const logMode = settings.progressionLogMode ?? "name-illumination-realm";
  const compactSetting = settings.progressionLogCompact ?? "auto";
  const glowIntensity = settings.glowIntensityProgressionLog ?? 100;
  const columnColors = settings.progressionColumnColorsEnabled ?? true;
  const columnGrouped = settings.progressionColumnOrderGrouped ?? false;
  const variationDisplay = settings.progressionVariationDisplay ?? "abbreviation";

  const effectiveCompact = compactSetting === "compact" || (compactSetting === "auto" && isMobile);

  const showIllumination = logMode !== "name-only";
  const showRealm = logMode === "name-illumination-realm" || logMode === "name-illumination-realm-path";
  const showPath = logMode === "name-illumination-realm-path";

  // Build exercise lookup for display
  const exerciseLookup = new Map(exercises.map(e => [e.id, e]));

  const anyModifier = entries.some(e => e.modifier);
  const anyBand = true;
  const selectedExerciseHasVariations = selectedExerciseId
    ? (exerciseLookup.get(selectedExerciseId)?.variations?.length ?? 0) > 0
    : false;
  const anyVariant = isEditMode || entries.some(e => e.variant) || selectedExerciseHasVariations;

  const getZeroValueStyle = (value: number | null, colType: string): React.CSSProperties | undefined => {
    if (value === 0) return { backgroundColor: 'var(--ink-mid)', color: 'var(--mist-dark)' };
    if (columnColors && colType === 'weight') return { backgroundColor: 'var(--col-weight-bg)' };
    if (columnColors && colType === 'reps') return { backgroundColor: 'var(--col-reps-bg)' };
    return undefined;
  };

  // Clear save message after 5 seconds
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  const handleEditModeToggle = () => {
    if (!isEditMode) {
      const newData: typeof editingData = {};
      entries.forEach(entry => {
        const ex = exerciseLookup.get(entry.exerciseId);
        const autoFromSet = ex
          ? getAutoGymLevelFromSet(ex, physique, {
              weight1: entry.weight1,
              weight2: entry.weight2,
              weight3: entry.weight3,
            }, entry.resistanceBandKg)
          : null;
        const effectiveLevel =
          ex && isGymCategoryExercise(ex)
            ? (autoFromSet ?? entry.level)
            : entry.level;
        newData[entry.logId] = {
          weight1: entry.weight1, reps1: entry.reps1,
          weight2: entry.weight2, reps2: entry.reps2,
          weight3: entry.weight3, reps3: entry.reps3,
          level: effectiveLevel,
          modifier: entry.modifier, resistanceBandKg: entry.resistanceBandKg, variant: entry.variant, notes: entry.notes,
        };
      });
      setEditingData(newData);
    }
    setIsEditMode(!isEditMode);
  };

  const handleEditChange = (logId: string, field: string, value: string | number | null) => {
    setEditingData(prev => ({ ...prev, [logId]: { ...prev[logId], [field]: value } }));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const updates = Object.entries(editingData).map(([id, data]) => ({
        id,
        level: data.level,
        weight1: data.weight1,
        reps1: data.reps1,
        weight2: data.weight2,
        reps2: data.reps2,
        weight3: data.weight3,
        reps3: data.reps3,
        modifier: buildModifierWithBand(data.modifier, data.resistanceBandKg, data.level),
        variant: data.variant,
        notes: data.notes,
      }));
      const res = await fetch("/api/progressions/logs/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates, userId }),
      });
      if (res.ok) {
        setSaveMessage({ type: "success", text: "Training logs updated successfully!" });
        setIsEditMode(false);
        setEditingData({});
        onRefresh();
      } else {
        const data = await res.json();
        setSaveMessage({ type: "error", text: data.error || "Failed to save changes" });
      }
    } catch {
      setSaveMessage({ type: "error", text: "Network error — unable to save changes" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setEditingData({});
  };

  const handleDeleteLog = async (logId: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/progressions/logs/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId, userId }),
      });
      if (res.ok) {
        setSaveMessage({ type: "success", text: "Log record deleted successfully" });
        setDeleteConfirm(null);
        onRefresh();
      } else {
        const data = await res.json();
        setSaveMessage({ type: "error", text: data.error || "Failed to delete record" });
      }
    } catch {
      setSaveMessage({ type: "error", text: "Network error — unable to delete record" });
    } finally {
      setIsDeleting(false);
    }
  };

  // Column order
  const dataColumns = columnGrouped
    ? ["weight1", "weight2", "weight3", "reps1", "reps2", "reps3"] as const
    : ["weight1", "reps1", "weight2", "reps2", "weight3", "reps3"] as const;

  const dataColumnLabels = columnGrouped
    ? ["W1", "W2", "W3", "R1", "R2", "R3"]
    : ["W1", "R1", "W2", "R2", "W3", "R3"];

  const dataColumnTypes = columnGrouped
    ? ["weight", "weight", "weight", "reps", "reps", "reps"]
    : ["weight", "reps", "weight", "reps", "weight", "reps"];

  const fieldMeta: Record<string, { type: "weight" | "reps"; min: string; max?: string; step?: string }> = {
    weight1: { type: "weight", min: "0", step: "0.5" },
    weight2: { type: "weight", min: "0", step: "0.5" },
    weight3: { type: "weight", min: "0", step: "0.5" },
    reps1: { type: "reps", min: "0", max: "500" },
    reps2: { type: "reps", min: "0", max: "500" },
    reps3: { type: "reps", min: "0", max: "500" },
  };

  return (
    <>
    <GlowCard className="!p-0 overflow-hidden" glow="jade" hoverable={false}>
      {/* Edit header bar */}
      {entries.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-ink-light">
          <div className="flex items-center gap-2">
            {saveMessage && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`text-[11px] ${saveMessage.type === "success" ? "text-jade-light" : "text-crimson-light"}`}
              >
                {saveMessage.text}
              </motion.span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <>
                <GlowButton variant="jade" size="sm" onClick={handleSaveChanges} disabled={isSaving}>
                  {isSaving ? "Saving..." : "✓ Save"}
                </GlowButton>
                <GlowButton variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
                  ✕ Cancel
                </GlowButton>
              </>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleEditModeToggle}
                className="text-xs px-3 py-1 rounded border border-jade-glow/40 text-jade-light hover:bg-jade-deep/10 transition-all"
              >
                ✎ Edit
              </motion.button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        <table className={`text-xs border-collapse w-full`} style={{ whiteSpace: "nowrap", minWidth: effectiveCompact ? "400px" : (isEditMode ? "720px" : "650px") }}>
          <thead>
            <tr className="border-b-2 border-jade-glow/50 bg-ink-mid/40 text-mist-light">
              <th className={`${effectiveCompact ? 'py-1 px-1' : 'py-2 px-1.5'} text-left font-semibold uppercase tracking-wider text-[11px]`}>Date</th>
              <th className={`${effectiveCompact ? 'py-1 px-0.5' : 'py-2 px-1'} text-center font-semibold uppercase tracking-wider text-[11px]`}>Lvl</th>
              <th className={`${effectiveCompact ? 'py-1 px-0.5' : 'py-2 px-1'} text-center font-semibold uppercase tracking-wider text-[11px]`}>Category</th>
              <th className={`${effectiveCompact ? 'py-1 px-1' : 'py-2 px-1.5'} text-left font-semibold uppercase tracking-wider text-[11px]`}>Exercise</th>
              {dataColumnLabels.map((label, idx) => (
                <th
                  key={label + idx}
                  className={`${effectiveCompact ? 'py-1 px-0.5' : 'py-2 px-1'} text-center font-semibold uppercase tracking-wider text-[11px]`}
                  style={columnColors ? { color: dataColumnTypes[idx] === "weight" ? "var(--col-weight)" : "var(--col-reps)" } : undefined}
                >
                  {label}
                </th>
              ))}
              {anyModifier && (
                <th className={`${effectiveCompact ? 'py-1 px-0.5' : 'py-2 px-1'} text-center font-semibold uppercase tracking-wider text-[11px] text-amber-400`}>Mod</th>
              )}
              {anyBand && (
                <th className={`${effectiveCompact ? 'py-1 px-0.5' : 'py-2 px-1'} text-center font-semibold uppercase tracking-wider text-[11px] text-sky-300`}>Band</th>
              )}
              {anyVariant && (
                <th className={`${effectiveCompact ? 'py-1 px-0.5' : 'py-2 px-1'} text-center font-semibold uppercase tracking-wider text-[11px] text-purple-400`}>Variant</th>
              )}
              <th className={`${effectiveCompact ? 'py-1 px-1' : 'py-2 px-1.5'} text-left font-semibold uppercase tracking-wider text-[11px]`}>Notes</th>
              {isEditMode && <th className="px-1 py-2 text-center font-semibold text-mist-glow text-[11px] align-middle">⋮</th>}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={11 + (anyModifier ? 1 : 0) + (anyBand ? 1 : 0) + (anyVariant ? 1 : 0) + (isEditMode ? 1 : 0)} className="py-6 text-center text-mist-mid text-sm">
                  No training data logged yet. Select an exercise from the sidebar to log your first set.
                </td>
              </tr>
            ) : (
              <AnimatePresence initial={false}>
                {entries.map((entry) => {
                  const ex = exerciseLookup.get(entry.exerciseId);
                  const editData = editingData[entry.logId];
                  const autoFromSet = ex
                    ? getAutoGymLevelFromSet(ex, physique, {
                        weight1: entry.weight1,
                        weight2: entry.weight2,
                        weight3: entry.weight3,
                      }, entry.resistanceBandKg)
                    : null;
                  const effectiveLevel =
                    ex && isGymCategoryExercise(ex)
                      ? (autoFromSet ?? entry.level)
                      : entry.level;
                  const previewLevel = isEditMode && editData ? editData.level : effectiveLevel;
                  const activeModifier = isEditMode && editData ? editData.modifier : entry.modifier;
                  const activeVariant = isEditMode && editData ? editData.variant : entry.variant;
                  const tier = ex?.tiers.find(t => t.level === previewLevel);
                  const displayTier = ex?.tiers.find(t => t.level === entry.levelNameLevel);
                  const tierDifficulty = ex ? getWeightedDifficulty(ex, previewLevel, activeVariant, activeModifier) : '';
                  const tierDifficultyDisplay = getDifficultyDisplayName(
                    { difficulty: tierDifficulty, wuxiaDifficulty: tierDifficulty },
                    settings.terminologyMode
                  ) || tierDifficulty;
                  const diffColorClass = tierDifficulty ? getDifficultyColorClass(tierDifficulty) : '';
                  const exerciseGlow = tierDifficulty ? getDifficultyGlowStyleScaled(tierDifficulty, glowIntensity) : {};
                  const activeBand = isEditMode && editData ? editData.resistanceBandKg : entry.resistanceBandKg;
                  const isBandAssistedCali = getExerciseCategoryLabel(ex) === "Cali" && typeof activeBand === "number" && activeBand > 0;
                  const displayGlowStyle = isBandAssistedCali
                    ? getBandAdjustedGlowStyle(exerciseGlow as React.CSSProperties, activeBand)
                    : exerciseGlow;
                  const softDimStyle = isBandAssistedCali
                    ? ({ opacity: getBandSoftDimOpacity(activeBand) } as React.CSSProperties)
                    : undefined;
                  const entryDisplayName = isEditMode && ex
                    ? stripBwPercentHint(getExerciseDisplayName(tier || ex, settings.terminologyMode))
                    : displayTier
                    ? stripBwPercentHint(getExerciseDisplayName(displayTier, settings.terminologyMode))
                    : ex ? stripBwPercentHint(getExerciseDisplayName(ex, settings.terminologyMode)) : stripBwPercentHint(entry.exerciseName);
                  const shownLevel = previewLevel;
                  const exerciseVariantOptions = (ex?.variations ?? []).map((v) => v.name).filter(Boolean);
                  const selectedVariantValue = editData?.variant ?? "";
                  const variantSelectOptions =
                    selectedVariantValue && !exerciseVariantOptions.includes(selectedVariantValue)
                      ? [...exerciseVariantOptions, selectedVariantValue]
                      : exerciseVariantOptions;

                  return (
                    <motion.tr
                      key={entry.logId}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12, ease: "easeOut" }}
                      className={`border-b transition-all duration-200 ${
                        isEditMode
                          ? "border-jade-glow/20 bg-jade-deep/10 hover:bg-jade-deep/15"
                          : "border-ink-light hover:bg-ink-mid/15"
                      }`}
                    >
                      <td className={`${effectiveCompact ? 'px-1 py-1' : 'px-1.5 py-1.5'} text-mist-light text-xs align-middle whitespace-nowrap`}>{formatDate(entry.date)}</td>
                      <td className={`${effectiveCompact ? 'px-0.5 py-1' : 'px-1 py-1.5'} text-center align-middle`}>
                        <span className="text-[10px] text-gold" title={stripBwPercentHint(tier?.name || entry.tierName)}>{shownLevel}</span>
                      </td>
                      <td className={`${effectiveCompact ? 'px-0.5 py-1' : 'px-1 py-1.5'} text-center align-middle`}>
                        <span className={`text-[10px] font-semibold ${getExerciseCategoryLabel(ex) === "GYM" ? "text-gold" : "text-jade-light"}`}>
                          {getExerciseCategoryLabel(ex)}
                        </span>
                      </td>
                      <td
                        className={`${effectiveCompact ? 'px-1 py-1' : 'px-1.5 py-1.5'} align-middle whitespace-nowrap cursor-pointer hover:bg-jade-deep/10 rounded transition-colors ${isEditMode ? 'ring-1 ring-jade-glow/20' : ''}`}
                        style={{ minWidth: "120px" }}
                        onClick={() => {
                          if (isEditMode) {
                            setLevelPicker({ logId: entry.logId, exerciseId: entry.exerciseId });
                            return;
                          }
                          onSelectExercise(entry.exerciseId === selectedExerciseId ? null : entry.exerciseId);
                        }}
                      >
                        {!showIllumination ? (
                          <span className="text-xs text-cloud-white" style={softDimStyle} title={entryDisplayName}>
                            {entryDisplayName}
                          </span>
                        ) : (
                          <div
                            className="px-2 py-1 rounded border inline-flex items-center gap-1.5"
                            style={
                              glowIntensity > 0
                                ? ({ ...(displayGlowStyle as React.CSSProperties), ...(softDimStyle || {}) } as React.CSSProperties)
                                : softDimStyle
                            }
                            title={entryDisplayName}
                          >
                            <span className={`text-xs font-normal ${diffColorClass}`}>
                              {entryDisplayName}
                            </span>
                            {showRealm && ex && (
                              <>
                                <span className={`inline-flex items-center px-1 py-0 rounded text-[9px] font-medium ${diffColorClass} border border-current/20 opacity-80`}>
                                  {tierDifficultyDisplay}
                                </span>
                                {showPath && ex.type && (
                                  <span className={`inline-flex items-center px-1 py-0 rounded text-[9px] font-medium ${getTypeColor(getTypeColorKey(ex))} border border-current/20 opacity-70`}>
                                    {getTypeDisplayName(ex, settings.terminologyMode)}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </td>
                      {dataColumns.map((col, idx) => {
                        const meta = fieldMeta[col];
                        if (isEditMode && editData) {
                          const editVal = editData[col as keyof typeof editData];
                          return (
                            <td key={col + idx} className="px-1 py-1.5 text-center align-middle">
                              <input
                                type="number"
                                min={meta.min}
                                max={meta.max}
                                step={meta.step}
                                value={editVal ?? ""}
                                onChange={(e) =>
                                  handleEditChange(
                                    entry.logId,
                                    col,
                                    e.target.value
                                      ? meta.type === "weight" ? parseFloat(e.target.value) : parseInt(e.target.value)
                                      : null
                                  )
                                }
                                placeholder="—"
                                className="w-full min-w-[52px] bg-ink-deep border border-jade-glow/30 rounded px-1 py-1 text-cloud-white text-center text-xs outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.4)]"
                              />
                            </td>
                          );
                        }
                        return (
                          <td
                            key={col + idx}
                            className={`${effectiveCompact ? 'px-0.5 py-1' : 'px-1 py-1.5'} text-center text-cloud-white text-xs align-middle`}
                            style={getZeroValueStyle(entry[col], dataColumnTypes[idx])}
                          >
                            {displayVal(entry[col])}
                          </td>
                        );
                      })}
                      {anyModifier && (
                        isEditMode && editData ? (
                          <td className="px-1 py-1.5 text-center align-middle">
                            <input
                              type="text"
                              value={editData.modifier ?? ""}
                              onChange={(e) => handleEditChange(entry.logId, "modifier", e.target.value || null)}
                              placeholder="—"
                              className="w-full min-w-[52px] bg-ink-deep border border-jade-glow/30 rounded px-1 py-1 text-amber-400 text-center text-xs outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.4)]"
                            />
                          </td>
                        ) : (
                          <td className={`${effectiveCompact ? 'px-0.5 py-1' : 'px-1 py-1.5'} text-center text-amber-400 text-xs whitespace-nowrap align-middle`} title={entry.modifier || ""}>
                            {entry.modifier || "—"}
                          </td>
                        )
                      )}
                      {anyBand && (
                        isEditMode && editData ? (
                          <td className="px-1 py-1.5 text-center align-middle">
                            <select
                              value={editData.resistanceBandKg != null ? String(editData.resistanceBandKg) : ""}
                              onChange={(e) =>
                                handleEditChange(
                                  entry.logId,
                                  "resistanceBandKg",
                                  e.target.value ? parseFloat(e.target.value) : null
                                )
                              }
                              className="w-full min-w-[70px] bg-ink-deep border border-jade-glow/30 rounded px-1 py-1 text-sky-300 text-center text-xs outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.4)]"
                            >
                              <option value="">—</option>
                              {RESISTANCE_BAND_OPTIONS.map((kg) => (
                                <option key={kg} value={String(kg)}>
                                  {formatResistanceBandLabel(kg)}
                                </option>
                              ))}
                            </select>
                          </td>
                        ) : (
                          <td className={`${effectiveCompact ? 'px-0.5 py-1' : 'px-1 py-1.5'} text-center text-sky-300 text-xs whitespace-nowrap align-middle`}>
                            {entry.resistanceBandKg != null ? formatResistanceBandLabel(entry.resistanceBandKg) : "—"}
                          </td>
                        )
                      )}
                      {anyVariant && (
                        isEditMode && editData ? (
                          <td className="px-1 py-1.5 text-center align-middle">
                            <select
                              value={editData.variant ?? ""}
                              onChange={(e) => handleEditChange(entry.logId, "variant", e.target.value || null)}
                              className="w-full min-w-[70px] bg-ink-deep border border-jade-glow/30 rounded px-1 py-1 text-purple-400 text-center text-xs outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.4)]"
                            >
                              <option value="">—</option>
                              {variantSelectOptions.map((variantName) => (
                                <option key={variantName} value={variantName}>
                                  {variantName}
                                </option>
                              ))}
                            </select>
                          </td>
                        ) : (
                          <td className={`${effectiveCompact ? 'px-0.5 py-1' : 'px-1 py-1.5'} text-center text-purple-400 text-xs whitespace-nowrap align-middle`} title={entry.variant || ""}>
                            {entry.variant
                              ? variationDisplay === "full"
                                ? entry.variant
                                : abbreviateVariantText(entry.variant)
                              : "—"}
                          </td>
                        )
                      )}
                      {isEditMode && editData ? (
                        <td className="px-1.5 py-1.5 align-middle">
                          <input
                            type="text"
                            value={editData.notes ?? ""}
                            onChange={(e) => handleEditChange(entry.logId, "notes", e.target.value || null)}
                            placeholder="Add notes..."
                            className="w-full min-w-[100px] bg-ink-deep border border-jade-glow/30 rounded px-2 py-1 text-cloud-white text-xs placeholder:text-mist-dark outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.4)]"
                          />
                        </td>
                      ) : (
                        <td className={`${effectiveCompact ? 'px-1 py-1' : 'px-1.5 py-1.5'} text-mist-light text-xs whitespace-nowrap align-middle`} title={entry.notes || ""}>
                          {entry.notes || "—"}
                          {entry.completed && <span className="text-jade-glow ml-1">✦</span>}
                        </td>
                      )}
                      {isEditMode && (
                        <td className="px-1 py-1.5 text-center align-middle">
                          <motion.button
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setDeleteConfirm({ logId: entry.logId, exerciseName: entryDisplayName })}
                            className="text-crimson-light hover:text-crimson-glow transition-colors text-lg"
                            title="Delete this log record"
                            disabled={isDeleting}
                          >
                            ✕
                          </motion.button>
                        </td>
                      )}
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>
    </GlowCard>

    {/* Delete Confirmation Modal */}
    <AnimatePresence>
      {deleteConfirm && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
            onClick={() => setDeleteConfirm(null)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] max-w-[90vw] bg-ink-deep border border-ink-light rounded-xl shadow-2xl p-5"
            style={{ boxShadow: "0 0 30px rgba(200, 50, 50, 0.15), 0 20px 40px rgba(0,0,0,0.4)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-crimson-light mb-3">Delete Training Record</h3>
            <p className="text-xs text-mist-light mb-5 leading-relaxed">
              Are you sure you want to permanently delete the log record for{" "}
              <span className="text-cloud-white font-medium">{deleteConfirm.exerciseName}</span>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleDeleteLog(deleteConfirm.logId)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-xs font-semibold rounded-lg bg-crimson-deep/30 border border-crimson/50 text-crimson-light hover:bg-crimson-deep/50 transition-all duration-200 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Record"}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-xs font-semibold rounded-lg border border-ink-light text-mist-light hover:bg-ink-mid/30 transition-all duration-200 disabled:opacity-50"
              >
                Cancel
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

    <AnimatePresence>
      {levelPicker && (() => {
        const ex = exerciseLookup.get(levelPicker.exerciseId);
        if (!ex) return null;
        const tiers = [...ex.tiers].sort((a, b) => a.level - b.level);
        const current = editingData[levelPicker.logId]?.level
          ?? entries.find((e) => e.logId === levelPicker.logId)?.level
          ?? 1;

        return (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
              onClick={() => setLevelPicker(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] max-w-[92vw] bg-ink-deep border border-ink-light rounded-xl shadow-2xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold text-cloud-white mb-3">Change Progression Tier</h3>
              <p className="text-[11px] text-mist-light mb-3">{stripBwPercentHint(getExerciseDisplayName(ex, settings.terminologyMode))}</p>
              <div className="max-h-[280px] overflow-y-auto space-y-1 pr-1">
                {tiers.map((t) => {
                  const active = t.level === current;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        handleEditChange(levelPicker.logId, "level", t.level);
                        setLevelPicker(null);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded border transition-colors ${active ? "border-jade-glow/50 bg-jade-deep/20 text-jade-light" : "border-ink-light/40 bg-ink-mid/20 text-mist-light hover:border-jade-glow/35 hover:bg-jade-deep/10"}`}
                    >
                      <span className="text-[11px] font-semibold">Lv.{t.level} - {stripBwPercentHint(getExerciseDisplayName(t, settings.terminologyMode))}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => setLevelPicker(null)}
                  className="px-3 py-1.5 text-xs rounded border border-ink-light text-mist-light hover:bg-ink-mid/30"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </>
        );
      })()}
    </AnimatePresence>
    </>
  );
}

// ── Hold Training Log Table (separate table below main for hold-based exercises) ──

function HoldTrainingLogTable({
  exercises,
  selectedExerciseId,
  onSelectExercise,
  onRefresh,
  userId,
}: {
  exercises: ProgressionExercise[];
  selectedExerciseId: string | null;
  onSelectExercise: (exerciseId: string | null) => void;
  onRefresh: () => void;
  userId: string;
}) {
  const allEntries = useMemo(() => flattenLogs(exercises), [exercises]);
  const entries = allEntries.filter(e => e.hasHold && (!selectedExerciseId || e.exerciseId === selectedExerciseId));
  const { settings } = useDisplaySettings();
  const { isMobile } = useAppContext();

  const [isEditMode, setIsEditMode] = useState(false);
  const [editingData, setEditingData] = useState<Record<string, {
    reps1: number | null; holdTime: number | null;
    reps2: number | null; holdTime2: number | null;
    reps3: number | null; holdTime3: number | null;
    level: number;
    modifier: string | null; resistanceBandKg: number | null; variant: string | null; notes: string | null;
  }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ logId: string; exerciseName: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [levelPicker, setLevelPicker] = useState<{ logId: string; exerciseId: string } | null>(null);

  const logMode = settings.progressionLogMode ?? "name-illumination-realm";
  const compactSetting = settings.progressionLogCompact ?? "auto";
  const glowIntensity = settings.glowIntensityProgressionLog ?? 100;
  const columnColors = settings.progressionColumnColorsEnabled ?? true;
  const columnGrouped = settings.progressionColumnOrderGrouped ?? false;
  const variationDisplay = settings.progressionVariationDisplay ?? "abbreviation";

  const effectiveCompact = compactSetting === "compact" || (compactSetting === "auto" && isMobile);

  const showIllumination = logMode !== "name-only";
  const showRealm = logMode === "name-illumination-realm" || logMode === "name-illumination-realm-path";
  const showPath = logMode === "name-illumination-realm-path";

  const exerciseLookup = new Map(exercises.map(e => [e.id, e]));

  const anyModifier = entries.some(e => e.modifier);
  const anyBand = true;
  const selectedExerciseHasVariations = selectedExerciseId
    ? (exerciseLookup.get(selectedExerciseId)?.variations?.length ?? 0) > 0
    : false;
  const anyVariant = isEditMode || entries.some(e => e.variant) || selectedExerciseHasVariations;

  const getZeroValueStyle = (value: number | null, colType: string): React.CSSProperties | undefined => {
    if (value === 0) return { backgroundColor: 'var(--ink-mid)', color: 'var(--mist-dark)' };
    if (columnColors && colType === 'reps') return { backgroundColor: 'var(--col-reps-bg)' };
    if (columnColors && colType === 'hold') return { backgroundColor: 'rgba(94, 184, 232, 0.08)' };
    return undefined;
  };

  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  const handleEditModeToggle = () => {
    if (!isEditMode) {
      const newData: typeof editingData = {};
      entries.forEach(entry => {
        newData[entry.logId] = {
          reps1: entry.reps1, holdTime: entry.holdTime,
          reps2: entry.reps2, holdTime2: entry.holdTime2,
          reps3: entry.reps3, holdTime3: entry.holdTime3,
          level: entry.level,
          modifier: entry.modifier, resistanceBandKg: entry.resistanceBandKg, variant: entry.variant, notes: entry.notes,
        };
      });
      setEditingData(newData);
    }
    setIsEditMode(!isEditMode);
  };

  const handleEditChange = (logId: string, field: string, value: string | number | null) => {
    setEditingData(prev => ({ ...prev, [logId]: { ...prev[logId], [field]: value } }));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const updates = Object.entries(editingData).map(([id, data]) => ({
        id,
        level: data.level,
        weight1: null, weight2: null, weight3: null,
        reps1: data.reps1, holdTime: data.holdTime,
        reps2: data.reps2, holdTime2: data.holdTime2,
        reps3: data.reps3, holdTime3: data.holdTime3,
        modifier: buildModifierWithBand(data.modifier, data.resistanceBandKg, data.level), variant: data.variant, notes: data.notes,
      }));
      const res = await fetch("/api/progressions/logs/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates, userId }),
      });
      if (res.ok) {
        setSaveMessage({ type: "success", text: "Timed hold logs updated!" });
        setIsEditMode(false);
        setEditingData({});
        onRefresh();
      } else {
        const data = await res.json();
        setSaveMessage({ type: "error", text: data.error || "Failed to save changes" });
      }
    } catch {
      setSaveMessage({ type: "error", text: "Network error — unable to save changes" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setEditingData({});
  };

  const handleDeleteLog = async (logId: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/progressions/logs/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId, userId }),
      });
      if (res.ok) {
        setSaveMessage({ type: "success", text: "Log record deleted successfully" });
        setDeleteConfirm(null);
        onRefresh();
      } else {
        const data = await res.json();
        setSaveMessage({ type: "error", text: data.error || "Failed to delete record" });
      }
    } catch {
      setSaveMessage({ type: "error", text: "Network error — unable to delete record" });
    } finally {
      setIsDeleting(false);
    }
  };

  if (entries.length === 0) return null;

  const holdFields = columnGrouped
    ? [
        { key: "holdTime", label: "T1", type: "hold" },
        { key: "holdTime2", label: "T2", type: "hold" },
        { key: "holdTime3", label: "T3", type: "hold" },
        { key: "reps1", label: "W1", type: "reps" },
        { key: "reps2", label: "W2", type: "reps" },
        { key: "reps3", label: "W3", type: "reps" },
      ] as const
    : [
        { key: "holdTime", label: "T1", type: "hold" },
        { key: "reps1", label: "W1", type: "reps" },
        { key: "holdTime2", label: "T2", type: "hold" },
        { key: "reps2", label: "W2", type: "reps" },
        { key: "holdTime3", label: "T3", type: "hold" },
        { key: "reps3", label: "W3", type: "reps" },
      ] as const;

  return (
    <>
    <GlowCard className="!p-0 overflow-hidden" glow="jade" hoverable={false}>
      {/* Edit header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-ink-light">
        <div className="flex items-center gap-2">
          {saveMessage && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`text-[11px] ${saveMessage.type === "success" ? "text-jade-light" : "text-crimson-light"}`}
            >
              {saveMessage.text}
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditMode ? (
            <>
              <GlowButton variant="jade" size="sm" onClick={handleSaveChanges} disabled={isSaving}>
                {isSaving ? "Saving..." : "✓ Save"}
              </GlowButton>
              <GlowButton variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
                ✕ Cancel
              </GlowButton>
            </>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleEditModeToggle}
              className="text-xs px-3 py-1 rounded border border-jade-glow/40 text-jade-light hover:bg-jade-deep/10 transition-all"
            >
              ✎ Edit
            </motion.button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        <table className={`text-xs border-collapse w-full`} style={{ whiteSpace: "nowrap", minWidth: effectiveCompact ? "450px" : (isEditMode ? "720px" : "650px") }}>
          <thead>
            <tr className="border-b-2 border-mountain-blue-glow/50 bg-ink-mid/40 text-mist-light">
              <th className={`${effectiveCompact ? 'py-1 px-1' : 'py-2 px-1.5'} text-left font-semibold uppercase tracking-wider text-[11px]`}>Date</th>
              <th className={`${effectiveCompact ? 'py-1 px-0.5' : 'py-2 px-1'} text-center font-semibold uppercase tracking-wider text-[11px]`}>Lvl</th>
              <th className={`${effectiveCompact ? 'py-1 px-0.5' : 'py-2 px-1'} text-center font-semibold uppercase tracking-wider text-[11px]`}>Category</th>
              <th className={`${effectiveCompact ? 'py-1 px-1' : 'py-2 px-1.5'} text-left font-semibold uppercase tracking-wider text-[11px]`}>Exercise</th>
              {holdFields.map((field) => (
                <th
                  key={field.key}
                  className={`${effectiveCompact ? 'py-1 px-0.5' : 'py-2 px-1'} text-center ${field.type === 'hold' ? 'font-bold' : 'font-semibold'} uppercase tracking-wider text-[11px]`}
                  style={columnColors ? { color: field.type === 'hold' ? '#5eb8e8' : 'var(--col-reps)' } : undefined}
                >
                  {field.label}
                </th>
              ))}
              {anyModifier && (
                <th className={`${effectiveCompact ? 'py-1 px-0.5' : 'py-2 px-1'} text-center font-semibold uppercase tracking-wider text-[11px] text-amber-400`}>Mod</th>
              )}
              {anyBand && (
                <th className={`${effectiveCompact ? 'py-1 px-0.5' : 'py-2 px-1'} text-center font-semibold uppercase tracking-wider text-[11px] text-sky-300`}>Band</th>
              )}
              {anyVariant && (
                <th className={`${effectiveCompact ? 'py-1 px-0.5' : 'py-2 px-1'} text-center font-semibold uppercase tracking-wider text-[11px] text-purple-400`}>Variant</th>
              )}
              <th className={`${effectiveCompact ? 'py-1 px-1' : 'py-2 px-1.5'} text-left font-semibold uppercase tracking-wider text-[11px]`}>Notes</th>
              {isEditMode && <th className="px-1 py-2 text-center font-semibold text-mist-glow text-[11px] align-middle">⋮</th>}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {entries.map((entry, _i) => {
                const ex = exerciseLookup.get(entry.exerciseId);
                const editData = editingData[entry.logId];
                const previewLevel = isEditMode && editData ? editData.level : entry.level;
                const activeModifier = isEditMode && editData ? editData.modifier : entry.modifier;
                const activeVariant = isEditMode && editData ? editData.variant : entry.variant;
                const tier = ex?.tiers.find(t => t.level === previewLevel);
                const displayTier = ex?.tiers.find(t => t.level === entry.levelNameLevel);
                const tierDifficulty = ex ? getWeightedDifficulty(ex, previewLevel, activeVariant, activeModifier) : '';
                const tierDifficultyDisplay = getDifficultyDisplayName(
                  { difficulty: tierDifficulty, wuxiaDifficulty: tierDifficulty },
                  settings.terminologyMode
                ) || tierDifficulty;
                const diffColorClass = tierDifficulty ? getDifficultyColorClass(tierDifficulty) : '';
                const exerciseGlow = tierDifficulty ? getDifficultyGlowStyleScaled(tierDifficulty, glowIntensity) : {};
                const activeBand = isEditMode && editData ? editData.resistanceBandKg : entry.resistanceBandKg;
                const isBandAssistedCali = getExerciseCategoryLabel(ex) === "Cali" && typeof activeBand === "number" && activeBand > 0;
                const displayGlowStyle = isBandAssistedCali
                  ? getBandAdjustedGlowStyle(exerciseGlow as React.CSSProperties, activeBand)
                  : exerciseGlow;
                const softDimStyle = isBandAssistedCali
                  ? ({ opacity: getBandSoftDimOpacity(activeBand) } as React.CSSProperties)
                  : undefined;
                const entryDisplayName = isEditMode && ex
                  ? stripBwPercentHint(getExerciseDisplayName(tier || ex, settings.terminologyMode))
                  : displayTier
                  ? stripBwPercentHint(getExerciseDisplayName(displayTier, settings.terminologyMode))
                  : ex ? stripBwPercentHint(getExerciseDisplayName(ex, settings.terminologyMode)) : stripBwPercentHint(entry.exerciseName);
                const shownLevel = previewLevel;
                const exerciseVariantOptions = (ex?.variations ?? []).map((v) => v.name).filter(Boolean);
                const selectedVariantValue = editData?.variant ?? "";
                const variantSelectOptions =
                  selectedVariantValue && !exerciseVariantOptions.includes(selectedVariantValue)
                    ? [...exerciseVariantOptions, selectedVariantValue]
                    : exerciseVariantOptions;

                return (
                  <motion.tr
                    key={entry.logId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12, ease: "easeOut" }}
                    className={`border-b transition-all duration-200 ${
                      isEditMode
                        ? "border-jade-glow/20 bg-jade-deep/10 hover:bg-jade-deep/15"
                        : "border-ink-light hover:bg-ink-mid/15"
                    }`}
                  >
                    <td className={`${effectiveCompact ? 'px-1 py-1' : 'px-1.5 py-1.5'} text-mist-light text-xs align-middle whitespace-nowrap`}>{formatDate(entry.date)}</td>
                    <td className={`${effectiveCompact ? 'px-0.5 py-1' : 'px-1 py-1.5'} text-center align-middle`}>
                      <span className="text-[10px] text-gold" title={stripBwPercentHint(tier?.name || entry.tierName)}>{shownLevel}</span>
                    </td>
                    <td className={`${effectiveCompact ? 'px-0.5 py-1' : 'px-1 py-1.5'} text-center align-middle`}>
                      <span className={`text-[10px] font-semibold ${getExerciseCategoryLabel(ex) === "GYM" ? "text-gold" : "text-jade-light"}`}>
                        {getExerciseCategoryLabel(ex)}
                      </span>
                    </td>
                    <td
                      className={`${effectiveCompact ? 'px-1 py-1' : 'px-1.5 py-1.5'} align-middle whitespace-nowrap cursor-pointer hover:bg-jade-deep/10 rounded transition-colors ${isEditMode ? 'ring-1 ring-jade-glow/20' : ''}`}
                      style={{ minWidth: "120px" }}
                      onClick={() => {
                        if (isEditMode) {
                          setLevelPicker({ logId: entry.logId, exerciseId: entry.exerciseId });
                          return;
                        }
                        onSelectExercise(entry.exerciseId === selectedExerciseId ? null : entry.exerciseId);
                      }}
                    >
                      {!showIllumination ? (
                        <span className="text-xs text-cloud-white" style={softDimStyle} title={entryDisplayName}>
                          {entryDisplayName}
                        </span>
                      ) : (
                        <div
                          className="px-2 py-1 rounded border inline-flex items-center gap-1.5"
                          style={
                            glowIntensity > 0
                              ? ({ ...(displayGlowStyle as React.CSSProperties), ...(softDimStyle || {}) } as React.CSSProperties)
                              : softDimStyle
                          }
                          title={entryDisplayName}
                        >
                          <span className={`text-xs font-normal ${diffColorClass}`}>
                            {entryDisplayName}
                          </span>
                          {showRealm && ex && (
                            <>
                              <span className={`inline-flex items-center px-1 py-0 rounded text-[9px] font-medium ${diffColorClass} border border-current/20 opacity-80`}>
                                {tierDifficultyDisplay}
                              </span>
                              {showPath && ex.type && (
                                <span className={`inline-flex items-center px-1 py-0 rounded text-[9px] font-medium ${getTypeColor(getTypeColorKey(ex))} border border-current/20 opacity-70`}>
                                  {getTypeDisplayName(ex, settings.terminologyMode)}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </td>
                    {holdFields.map((field) => {
                      const value = entry[field.key as keyof typeof entry] as number | null;
                      if (isEditMode && editData) {
                        const editVal = editData[field.key as keyof typeof editData];
                        return (
                          <td key={field.key} className="px-1 py-1.5 text-center align-middle">
                            <input
                              type="number"
                              min="0"
                              max={field.type === "reps" ? "500" : "9999"}
                              value={editVal ?? ""}
                              onChange={(e) =>
                                handleEditChange(
                                  entry.logId,
                                  field.key,
                                  e.target.value ? parseInt(e.target.value) : null
                                )
                              }
                              placeholder="—"
                              className="w-full min-w-[52px] bg-ink-deep border border-jade-glow/30 rounded px-1 py-1 text-cloud-white text-center text-xs outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.4)]"
                            />
                          </td>
                        );
                      }
                      if (field.type === "hold") {
                        return (
                          <td key={field.key} className={`${effectiveCompact ? 'px-0.5 py-1' : 'px-1 py-1.5'} text-center text-xs font-medium align-middle`} style={{ color: '#5eb8e8', ...getZeroValueStyle(value, 'hold') }}>
                            {value != null ? `${value}s` : "—"}
                          </td>
                        );
                      }
                      return (
                        <td key={field.key} className={`${effectiveCompact ? 'px-0.5 py-1' : 'px-1 py-1.5'} text-center text-cloud-white text-xs align-middle`} style={getZeroValueStyle(value, 'reps')}>
                          {displayVal(value)}
                        </td>
                      );
                    })}
                    {anyModifier && (
                      isEditMode && editData ? (
                        <td className="px-1 py-1.5 text-center align-middle">
                          <input
                            type="text"
                            value={editData.modifier ?? ""}
                            onChange={(e) => handleEditChange(entry.logId, "modifier", e.target.value || null)}
                            placeholder="—"
                            className="w-full min-w-[52px] bg-ink-deep border border-jade-glow/30 rounded px-1 py-1 text-amber-400 text-center text-xs outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.4)]"
                          />
                        </td>
                      ) : (
                        <td className={`${effectiveCompact ? 'px-0.5 py-1' : 'px-1 py-1.5'} text-center text-amber-400 text-xs whitespace-nowrap align-middle`} title={entry.modifier || ""}>
                          {entry.modifier || "—"}
                        </td>
                      )
                    )}
                    {anyBand && (
                      isEditMode && editData ? (
                        <td className="px-1 py-1.5 text-center align-middle">
                          <select
                            value={editData.resistanceBandKg != null ? String(editData.resistanceBandKg) : ""}
                            onChange={(e) =>
                              handleEditChange(
                                entry.logId,
                                "resistanceBandKg",
                                e.target.value ? parseFloat(e.target.value) : null
                              )
                            }
                            className="w-full min-w-[70px] bg-ink-deep border border-jade-glow/30 rounded px-1 py-1 text-sky-300 text-center text-xs outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.4)]"
                          >
                            <option value="">—</option>
                            {RESISTANCE_BAND_OPTIONS.map((kg) => (
                              <option key={kg} value={String(kg)}>
                                {formatResistanceBandLabel(kg)}
                              </option>
                            ))}
                          </select>
                        </td>
                      ) : (
                        <td className={`${effectiveCompact ? 'px-0.5 py-1' : 'px-1 py-1.5'} text-center text-sky-300 text-xs whitespace-nowrap align-middle`}>
                          {entry.resistanceBandKg != null ? formatResistanceBandLabel(entry.resistanceBandKg) : "—"}
                        </td>
                      )
                    )}
                    {anyVariant && (
                      isEditMode && editData ? (
                        <td className="px-1 py-1.5 text-center align-middle">
                          <select
                            value={editData.variant ?? ""}
                            onChange={(e) => handleEditChange(entry.logId, "variant", e.target.value || null)}
                            className="w-full min-w-[70px] bg-ink-deep border border-jade-glow/30 rounded px-1 py-1 text-purple-400 text-center text-xs outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.4)]"
                          >
                            <option value="">—</option>
                            {variantSelectOptions.map((variantName) => (
                              <option key={variantName} value={variantName}>
                                {variantName}
                              </option>
                            ))}
                          </select>
                        </td>
                      ) : (
                        <td className={`${effectiveCompact ? 'px-0.5 py-1' : 'px-1 py-1.5'} text-center text-purple-400 text-xs whitespace-nowrap align-middle`} title={entry.variant || ""}>
                          {entry.variant
                            ? variationDisplay === "full"
                              ? entry.variant
                              : abbreviateVariantText(entry.variant)
                            : "—"}
                        </td>
                      )
                    )}
                    {isEditMode && editData ? (
                      <td className="px-1.5 py-1.5 align-middle">
                        <input
                          type="text"
                          value={editData.notes ?? ""}
                          onChange={(e) => handleEditChange(entry.logId, "notes", e.target.value || null)}
                          placeholder="Add notes..."
                          className="w-full min-w-[100px] bg-ink-deep border border-jade-glow/30 rounded px-2 py-1 text-cloud-white text-xs placeholder:text-mist-dark outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.4)]"
                        />
                      </td>
                    ) : (
                      <td className={`${effectiveCompact ? 'px-1 py-1' : 'px-1.5 py-1.5'} text-mist-light text-xs whitespace-nowrap align-middle`} title={entry.notes || ""}>
                        {entry.notes || "—"}
                        {entry.completed && <span className="text-jade-glow ml-1">✦</span>}
                      </td>
                    )}
                    {isEditMode && (
                      <td className="px-1 py-1.5 text-center align-middle">
                        <motion.button
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setDeleteConfirm({ logId: entry.logId, exerciseName: entryDisplayName })}
                          className="text-crimson-light hover:text-crimson-glow transition-colors text-lg"
                          title="Delete this log record"
                          disabled={isDeleting}
                        >
                          ✕
                        </motion.button>
                      </td>
                    )}
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </GlowCard>

    {/* Delete Confirmation Modal */}
    <AnimatePresence>
      {deleteConfirm && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
            onClick={() => setDeleteConfirm(null)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] max-w-[90vw] bg-ink-deep border border-ink-light rounded-xl shadow-2xl p-5"
            style={{ boxShadow: "0 0 30px rgba(200, 50, 50, 0.15), 0 20px 40px rgba(0,0,0,0.4)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-crimson-light mb-3">Delete Training Record</h3>
            <p className="text-xs text-mist-light mb-5 leading-relaxed">
              Are you sure you want to permanently delete the log record for{" "}
              <span className="text-cloud-white font-medium">{deleteConfirm.exerciseName}</span>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleDeleteLog(deleteConfirm.logId)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-xs font-semibold rounded-lg bg-crimson-deep/30 border border-crimson/50 text-crimson-light hover:bg-crimson-deep/50 transition-all duration-200 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Record"}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-xs font-semibold rounded-lg border border-ink-light text-mist-light hover:bg-ink-mid/30 transition-all duration-200 disabled:opacity-50"
              >
                Cancel
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

    <AnimatePresence>
      {levelPicker && (() => {
        const ex = exerciseLookup.get(levelPicker.exerciseId);
        if (!ex) return null;
        const tiers = [...ex.tiers].sort((a, b) => a.level - b.level);
        const current = editingData[levelPicker.logId]?.level
          ?? entries.find((e) => e.logId === levelPicker.logId)?.level
          ?? 1;

        return (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
              onClick={() => setLevelPicker(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] max-w-[92vw] bg-ink-deep border border-ink-light rounded-xl shadow-2xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold text-cloud-white mb-3">Change Progression Tier</h3>
              <p className="text-[11px] text-mist-light mb-3">{stripBwPercentHint(getExerciseDisplayName(ex, settings.terminologyMode))}</p>
              <div className="max-h-[280px] overflow-y-auto space-y-1 pr-1">
                {tiers.map((t) => {
                  const active = t.level === current;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        handleEditChange(levelPicker.logId, "level", t.level);
                        setLevelPicker(null);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded border transition-colors ${active ? "border-jade-glow/50 bg-jade-deep/20 text-jade-light" : "border-ink-light/40 bg-ink-mid/20 text-mist-light hover:border-jade-glow/35 hover:bg-jade-deep/10"}`}
                    >
                      <span className="text-[11px] font-semibold">Lv.{t.level} - {stripBwPercentHint(getExerciseDisplayName(t, settings.terminologyMode))}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => setLevelPicker(null)}
                  className="px-3 py-1.5 text-xs rounded border border-ink-light text-mist-light hover:bg-ink-mid/30"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </>
        );
      })()}
    </AnimatePresence>
    </>
  );
}

// ── Inline Log Form (appears above table for selected exercises) ──

function InlineLogForm({
  exercise,
  selectedLevel,
  onSubmit,
  onChangeLevel,
  onDismiss,
  onViewDetail,
}: {
  exercise: ProgressionExercise;
  selectedLevel: number;
  onSubmit: (exerciseId: string, level: number, data: {
    weight1?: number; reps1?: number;
    weight2?: number; reps2?: number;
    weight3?: number; reps3?: number;
    holdTime?: number; holdTime2?: number; holdTime3?: number; modifier?: string; resistanceBandKg?: number; variant?: string; notes?: string;
  }) => Promise<void>;
  onChangeLevel: (exerciseId: string, level: number) => void;
  onDismiss: (exerciseId: string) => void;
  onViewDetail: (exerciseId: string) => void;
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
  const [selectedModifier, setSelectedModifier] = useState("");
  const [selectedResistanceBand, setSelectedResistanceBand] = useState("");
  const [selectedVariation, setSelectedVariation] = useState("");
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
  const showHold = inputMode === "hold";
  const { settings } = useDisplaySettings();

  const mode = settings.progressionCardMode ?? "name-illumination-realm-path";
  const cardStyle = settings.progressionCardStyle ?? "default";
  const isCompact = settings.progressionCardCompact ?? false;
  const glowIntensity = settings.glowIntensityProgressionCards ?? 100;
  const loreVisible = settings.progressionCardLoreVisible ?? true;

  const _showIllumination = mode !== "name-only";
  const _showRealm = mode === "name-illumination-realm" || mode === "name-illumination-realm-path";
  const showPath = mode === "name-illumination-realm-path";
  const isScrollStyle = cardStyle === "scroll-card";

  const _diffColorClass = getDifficultyColorClass(getWeightedDifficulty(exercise, selectedLevel, selectedVariation || undefined, selectedModifier || undefined));
  const _glowStyle = getDifficultyGlowStyleScaled(getWeightedDifficulty(exercise, selectedLevel, selectedVariation || undefined, selectedModifier || undefined), glowIntensity);
  const currentDifficulty = getWeightedDifficulty(exercise, selectedLevel, selectedVariation || undefined, selectedModifier || undefined);
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
  const showResistanceBand = supportsResistanceBandAssistance(exercise);

  useEffect(() => {
    setInputMode(getTierInputMode(exercise, selectedLevel));
    setTimerRunning(false);
    setTimerStartedAt(null);
    setTimerElapsedMs(0);
    setTimerTick(0);
  }, [exercise, exercise.id, selectedLevel]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => setTimerTick(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [timerRunning]);

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
      setTimeout(() => setShakeError(false), 500);
      return;
    }
    const hasData = w1 || r1 || w2 || r2 || w3 || r3 || hold || hold2 || hold3 || notes || selectedModifier || selectedResistanceBand || selectedVariation;
    if (!hasData) return;
    setSubmitting(true);
    setSaved(false);
    try {
      const toKg = (v: string): number => {
        const n = parseFloat(v);
        return weightUnit === "lbs" ? Math.round(n * 453.592) / 1000 : n;
      };
      const resistanceBandKg = selectedResistanceBand ? parseFloat(selectedResistanceBand) : undefined;
      await onSubmit(exercise.id, selectedLevel, {
        weight1: w1 ? toKg(w1) : undefined,
        reps1: r1 ? parseInt(r1) : undefined,
        weight2: w2 ? toKg(w2) : undefined,
        reps2: r2 ? parseInt(r2) : undefined,
        weight3: w3 ? toKg(w3) : undefined,
        reps3: r3 ? parseInt(r3) : undefined,
        holdTime: hold ? parseInt(hold) : undefined,
        holdTime2: hold2 ? parseInt(hold2) : undefined,
        holdTime3: hold3 ? parseInt(hold3) : undefined,
        modifier: buildModifierWithBand(selectedModifier || undefined, resistanceBandKg, selectedLevel) ?? undefined,
        resistanceBandKg: resistanceBandKg ?? undefined,
        variant: selectedVariation || undefined,
        notes: notes || undefined,
      });
      setW1(""); setR1(""); setW2(""); setR2(""); setW3(""); setR3(""); setHold(""); setHold2(""); setHold3(""); setNotes(""); setSelectedModifier(""); setSelectedResistanceBand(""); setSelectedVariation("");
      resetTimer();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const tierName = getTierName(exercise, selectedLevel);
  const diffStyle = getDifficultyStyle(currentDifficulty);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className={`relative rounded-xl border-2 overflow-hidden ${isCompact ? 'p-2' : 'p-3'}`}
        style={{
          background: 'var(--ink-deep)',
          borderColor: `${diffStyle.glowColor}90`,
          boxShadow: `0 0 28px ${diffStyle.glowColor}70, 0 0 56px ${diffStyle.glowColor}35, inset 0 0 28px ${diffStyle.glowColor}20, inset 0 1px 0 rgba(255,255,255,0.04)`,
        }}
      >
        {/* Difficulty accent stripe */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
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
              {currentDifficultyDisplay}
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
              onClick={() => onViewDetail(exercise.id)}
              className="text-mist-dark/60 hover:text-cloud-white transition-colors text-xs px-1.5 py-0.5 rounded hover:bg-ink-mid/30"
              title="View full progression details"
            >
              ⓘ
            </button>
            <button
              onClick={() => onDismiss(exercise.id)}
              className="text-mist-dark/60 hover:text-crimson-light transition-colors text-sm px-1.5 py-0.5 rounded hover:bg-crimson-deep/10"
              title="Dismiss"
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

        {/* Controls row: Level + Mode + Modifiers */}
        <div className="flex items-center gap-2 mb-2.5 pl-2 flex-wrap">
          {/* Level selector */}
          <select
            value={selectedLevel}
            onChange={(e) => {
              const nextLevel = Number(e.target.value);
              setInputMode(getTierInputMode(exercise, nextLevel));
              onChangeLevel(exercise.id, nextLevel);
            }}
            className="bg-ink-dark border rounded px-2 py-1 text-xs outline-none transition-colors cursor-pointer"
            style={{
              borderColor: `${diffStyle.glowColor}30`,
              color: diffStyle.glowColor,
            }}
          >
            {exercise.tiers.map((t) => {
              const logs = exercise.userProgress[0]?.logs ?? [];
              const count = logs.filter((l) =>
                l.level === t.level
                && (!selectedModifier || l.modifier === selectedModifier)
                && (!selectedVariation || l.variant === selectedVariation)
                && (showHold
                  ? (l.holdTime != null || l.holdTime2 != null || l.holdTime3 != null)
                  : (l.weight1 != null || l.weight2 != null || l.weight3 != null))
              ).length;
              return (
                <option key={t.level} value={t.level}>
                  Lv.{t.level} — {t.name} ({count})
                </option>
              );
            })}
          </select>

          {/* Tier name */}
          <span className="text-[10px] text-mist-dark/70 truncate hidden sm:inline">{tierName}</span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* kg / lbs toggle — weight mode only */}
          {!showHold && (
            <div className="flex rounded-md overflow-hidden border border-ink-light/30">
              <button
                onClick={() => setWeightUnit("kg")}
                className={`px-2 py-1 text-[10px] font-semibold transition-all duration-200 border-r border-ink-light/30 ${
                  weightUnit === "kg"
                    ? "bg-jade-deep/55 text-cloud-white"
                    : "bg-ink-mid/60 text-mist-light hover:bg-ink-mid/80 hover:text-cloud-white"
                }`}
              >
                kg
              </button>
              <button
                onClick={() => setWeightUnit("lbs")}
                className={`px-2 py-1 text-[10px] font-semibold transition-all duration-200 ${
                  weightUnit === "lbs"
                    ? "bg-jade-deep/55 text-cloud-white"
                    : "bg-ink-mid/60 text-mist-light hover:bg-ink-mid/80 hover:text-cloud-white"
                }`}
              >
                lbs
              </button>
            </div>
          )}

          {/* Mode toggle */}
          <div className="flex rounded-md overflow-hidden border border-ink-light/30">
            <button
              onClick={() => { setInputMode("weight"); setW1(""); setW2(""); setW3(""); setR1(""); setR2(""); setR3(""); setHold(""); setHold2(""); setHold3(""); resetTimer(); }}
              className={`px-2.5 py-1 text-[10px] font-semibold transition-all duration-200 border-r ${
                inputMode === "weight"
                  ? "bg-jade-deep/55 text-cloud-white border-jade/40 shadow-[inset_0_0_0_1px_rgba(58,143,143,0.25)]"
                  : "bg-ink-mid/60 text-mist-light border-ink-light/30 hover:bg-ink-mid/80 hover:text-cloud-white"
              }`}
            >
              Weight
            </button>
            <button
              onClick={() => { setInputMode("hold"); setW1(""); setW2(""); setW3(""); setR1(""); setR2(""); setR3(""); setHold(""); setHold2(""); setHold3(""); resetTimer(); }}
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

        {/* Optional modifiers row */}
        {((exercise.modifiers && exercise.modifiers.length > 0) || showResistanceBand || (exercise.variations && exercise.variations.length > 0)) && (
          <div className="flex items-center gap-2 mb-2.5 pl-2 flex-wrap">
            {exercise.modifiers && exercise.modifiers.length > 0 && (
              <select
                value={selectedModifier}
                onChange={(e) => setSelectedModifier(e.target.value)}
                className="bg-ink-dark border border-ink-light/20 rounded px-2 py-1 text-xs text-gold outline-none
                           focus:border-gold/40 transition-colors cursor-pointer"
              >
                <option value="">No modifier</option>
                {exercise.modifiers.filter(m => m.available).map((m) => (
                  <option key={m.id} value={m.type}>
                    {m.type}{m.difficultyMod !== 0 ? ` (${m.difficultyMod > 0 ? "+" : ""}${m.difficultyMod})` : ""}
                  </option>
                ))}
              </select>
            )}
            {showResistanceBand && (
              <select
                value={selectedResistanceBand}
                onChange={(e) => setSelectedResistanceBand(e.target.value)}
                className="bg-ink-dark border border-ink-light/20 rounded px-2 py-1 text-xs text-sky-300 outline-none
                           focus:border-sky-300/40 transition-colors cursor-pointer"
              >
                <option value="">No resistance band</option>
                {RESISTANCE_BAND_OPTIONS.map((kg) => (
                  <option key={kg} value={String(kg)}>
                    Resistance band {formatResistanceBandLabel(kg)}
                  </option>
                ))}
              </select>
            )}
            {exercise.variations && exercise.variations.length > 0 && (
              <select
                value={selectedVariation}
                onChange={(e) => setSelectedVariation(e.target.value)}
                className="bg-ink-dark border border-ink-light/20 rounded px-2 py-1 text-xs text-crimson-light outline-none
                           focus:border-crimson/40 transition-colors cursor-pointer"
              >
                <option value="">No variation</option>
                {exercise.variations.map((v) => (
                  <option key={v.id} value={v.name}>
                    {v.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Input grid */}
        <div className="pl-2">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(6, 1fr) 1.5fr" }}>
            {/* Column headers */}
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

            {/* Input fields */}
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

        {/* Footer */}
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
  onSelectWithLevel,
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
}: {
  exercises: ProgressionExercise[];
  selectedIds: Set<string>;
  onToggleExercise: (id: string) => void;
  onSelectWithLevel: (exerciseId: string, level: number) => void;
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
}) {
  const { settings } = useDisplaySettings();
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("cultivateos-progression-sidebar-compact") === "true"; } catch { return false; }
  });

  // Persist compact state
  useEffect(() => {
    try { localStorage.setItem("cultivateos-progression-sidebar-compact", String(isCompact)); } catch {}
  }, [isCompact]);

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
  const expandTiers = settings.progressionSidebarExpandTiers ?? true;

  const hiddenSidebarExerciseNames = new Set([
    "dumbbell bicep curl",
    "leg curl",
    "leg extension",
    "seated cable row",
  ]);

  const showIllumination = displayMode !== "name-only";
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

  // Apply filters
  const filtered = exercises.filter((e) => {
    if (hiddenSidebarExerciseNames.has(String(e.name || "").trim().toLowerCase())) {
      return false;
    }

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
      case "level-high": {
        const aLvl = levelDefaults[a.id] || autoLevelByExerciseId[a.id] || (a.userProgress[0]?.currentLevel ?? 1);
        const bLvl = levelDefaults[b.id] || autoLevelByExerciseId[b.id] || (b.userProgress[0]?.currentLevel ?? 1);
        return bLvl - aLvl;
      }
      case "level-low": {
        const aLvl = levelDefaults[a.id] || autoLevelByExerciseId[a.id] || (a.userProgress[0]?.currentLevel ?? 1);
        const bLvl = levelDefaults[b.id] || autoLevelByExerciseId[b.id] || (b.userProgress[0]?.currentLevel ?? 1);
        return aLvl - bLvl;
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

  const [showFilters, setShowFilters] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const activeFiltersCount = (filterCategory ? 1 : 0) + (filterType ? 1 : 0) + (filterEquipment ? 1 : 0);
  const searchQuery = searchTerm.trim();
  const isSearchActive = searchQuery.length > 0;
  const canCollapseAll = sorted.some((exercise) => expandedIds.has(exercise.id));

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const sortOptions = [
    { key: "a-z", label: "A–Z", icon: "↕" },
    { key: "z-a", label: "Z–A", icon: "↕" },
    { key: "recent", label: "Recent", icon: "◷" },
    { key: "most-logged", label: "Most Logged", icon: "▤" },
    { key: "level-high", label: "Level ↓", icon: "▾" },
    { key: "level-low", label: "Level ↑", icon: "▴" },
    { key: "selected", label: "Selected", icon: "✦" },
  ] as const;

  return (
    <div className="h-full flex flex-col">
      {/* ── Toolbar ── */}
      <div className="px-3 pt-2.5 pb-2 shrink-0 space-y-2">
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
            className="w-full bg-ink-dark/80 border border-ink-light/50 rounded-lg pl-8 pr-8 py-1.5 text-[11px] text-cloud-white placeholder:text-mist-dark/70 outline-none transition-all duration-200 focus:border-jade-glow/60 focus:bg-ink-dark"
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
                flex-1 py-1 text-[10px] font-semibold rounded-md transition-all duration-200 border
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
                className="!py-1 !text-[10px] shrink-0"
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
                    flex-1 py-1 text-[10px] font-semibold transition-all duration-200 relative flex flex-col items-center gap-0.5
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
          <div className="flex-1" />

          {/* Expand / Collapse all */}
          {expandTiers && !isSearchActive && sorted.length > 0 && (
            <button
              onClick={() => setExpandedIds(new Set())}
              disabled={!canCollapseAll}
              className={`group inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md border focus-visible:outline-none focus-visible:ring-2 transition-all duration-200 text-[10px] font-semibold tracking-wide ${
                canCollapseAll
                  ? 'border-jade/45 bg-jade-deep/30 text-jade-light hover:bg-jade-deep/45 hover:border-jade/65 hover:text-cloud-white focus-visible:ring-jade-glow/35 shadow-[0_0_10px_rgba(58,143,143,0.18)]'
                  : 'border-ink-light/35 bg-ink-mid/20 text-mist-dark/70 cursor-not-allowed focus-visible:ring-mist-mid/20 opacity-80'
              }`}
              title={canCollapseAll ? "Collapse all tier panels" : "No expanded tier panels"}
              aria-label="Collapse all tier panels"
            >
              <svg className={`w-3 h-3 shrink-0 transition-transform duration-200 ${canCollapseAll ? 'group-hover:translate-y-px' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10l-7 7-7-7" />
              </svg>
              Collapse
            </button>
          )}

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`w-7 h-7 rounded-md flex items-center justify-center border transition-all duration-150 ${
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
            className={`w-7 h-7 rounded-md flex items-center justify-center border transition-all duration-150 ${
              isCompact
                ? 'bg-jade-deep/25 border-jade/40 text-jade-glow'
                : 'border-ink-light/40 text-mist-dark hover:text-mist-light hover:border-ink-light/60'
            }`}
            title={isCompact ? "Expanded view" : "Compact view"}
          >
            {isCompact ? (
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
                    <span className="text-[9px] text-mist-dark/80 uppercase tracking-widest font-medium">Category</span>
                    {filterCategory && (
                      <button onClick={() => setFilterCategory("")} className="text-[9px] text-jade-glow/70 hover:text-jade-glow transition-colors">clear</button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setFilterCategory("")}
                      className={`text-[10px] px-2 py-0.5 rounded-md transition-all duration-150 border ${
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
                        className={`text-[10px] px-2 py-0.5 rounded-md transition-all duration-150 border ${
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
                    <span className="text-[9px] text-mist-dark/80 uppercase tracking-widest font-medium">Type</span>
                    {filterType && (
                      <button onClick={() => setFilterType("")} className="text-[9px] text-jade-glow/70 hover:text-jade-glow transition-colors">clear</button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setFilterType("")}
                      className={`text-[10px] px-2 py-0.5 rounded-md transition-all duration-150 border ${
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
                        className={`text-[10px] px-2 py-0.5 rounded-md transition-all duration-150 border ${
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
                    <span className="text-[9px] text-mist-dark/80 uppercase tracking-widest font-medium">Equipment</span>
                    {filterEquipment && (
                      <button onClick={() => setFilterEquipment("")} className="text-[9px] text-jade-glow/70 hover:text-jade-glow transition-colors">clear</button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {equipmentTypes.map((eq) => (
                      <button
                        key={eq}
                        onClick={() => setFilterEquipment(filterEquipment === eq ? "" : eq)}
                        className={`text-[10px] px-2 py-0.5 rounded-md transition-all duration-150 border ${
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
                <span className="text-[9px] text-mist-dark/80 uppercase tracking-widest font-medium block mb-1">Sort By</span>
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value)}
                  className="w-full bg-ink-dark/80 border border-ink-light/40 rounded-md px-2 py-1 text-[11px] text-cloud-white outline-none transition-all duration-150 focus:border-jade-glow/50 appearance-none cursor-pointer"
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
              onClick={() => { for (const id of [...selectedIds]) onToggleExercise(id); }}
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
                {exercises.length === 0 ? "Upload a JSON file to add exercises" : "No exercises match current filters"}
              </p>
              {activeFiltersCount > 0 && (
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
          <div className={`${isCompact ? 'space-y-px' : 'space-y-1'}`}>
            {sorted.map((exercise, idx) => {
              const isActive = selectedIds.has(exercise.id);
              const currentLevel = exercise.userProgress[0]?.currentLevel ?? 1;
              const effectiveLevel = levelDefaults[exercise.id] || autoLevelByExerciseId[exercise.id] || currentLevel;
              const typeColor = getTypeColor(getTypeColorKey(exercise));
              const displayName = getExerciseDisplayName(exercise, settings.terminologyMode);
              const typeKey = getTypeColorKey(exercise);
              const typeEmoji = typeKey === "Upper Heaven" ? "☁️"
                : typeKey === "Lower Realms" ? "🔥"
                : typeKey === "Heart Meridian" ? "💚"
                : "⭐";
              const levelDifficulty = getWeightedDifficulty(exercise, effectiveLevel);
              const levelDiffColor = 'text-jade-glow';
              const glowStyle = {};
              const logCount = exercise.userProgress[0]?.logs?.length ?? 0;
              const isExpanded = expandTiers && expandedIds.has(exercise.id);
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

              // Shared tier expansion panel
              const tierPanel = isExpanded && exercise.tiers.length > 0 ? (
                <AnimatePresence initial={false}>
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="pt-1.5 mt-1.5 border-t border-ink-light/20 space-y-0.5">
                      {exercise.tiers.map((tier) => {
                        const isCurrent = tier.level === effectiveLevel;
                        const isActiveTier = isActive && isCurrent;
                        return (
                          <div
                            key={tier.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isActive && isCurrent) {
                                // clicking the already-active tier → remove exercise
                                onToggleExercise(exercise.id);
                              } else {
                                // clicking any other tier → add (or switch level)
                                onSelectWithLevel(exercise.id, tier.level);
                              }
                            }}
                            className={`flex items-center gap-1.5 px-1.5 py-[3px] rounded text-[10px] transition-colors cursor-pointer ${
                              isActiveTier ? 'bg-jade-deep/25 hover:bg-crimson-deep/20' : isCurrent ? 'bg-jade-deep/15 hover:bg-jade-deep/25' : 'hover:bg-jade-deep/10'
                            }`}
                          >
                            <span className={`font-mono w-4 text-center shrink-0 ${isCurrent ? 'text-gold font-bold' : 'text-mist-dark/60'}`}>
                              {tier.level}
                            </span>
                            <span className={`truncate flex-1 ${isActiveTier ? 'text-jade-light font-semibold' : 'text-jade-glow'} ${isCurrent ? 'font-medium' : 'opacity-70'}`} title={tier.wuxiaName || tier.name}>
                              {settings.terminologyMode === "fantasy" && tier.wuxiaName ? tier.wuxiaName : tier.name}
                            </span>
                            {isActiveTier ? (
                              <span className="shrink-0 text-[8px] text-crimson-light/70" title="Click to remove">✕</span>
                            ) : isCurrent ? (
                              <span className="shrink-0 text-[8px] text-gold/80">◆</span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                </AnimatePresence>
              ) : null;

              // Chevron indicator (only in expand-tiers mode)
              const chevron = expandTiers && exercise.tiers.length > 0 ? (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleExpand(exercise.id); }}
                  className={`shrink-0 inline-flex items-center justify-center w-5 h-5 rounded border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-glow/30 ${
                    isExpanded
                      ? 'border-jade/40 bg-jade-deep/20 text-jade-light hover:border-jade/60 hover:bg-jade-deep/30'
                      : 'border-ink-light/40 bg-ink-dark/35 text-mist-dark hover:text-mist-light hover:border-ink-light/70 hover:bg-ink-mid/30'
                  }`}
                  title={isExpanded ? "Collapse tiers" : "Expand tiers"}
                  aria-label={isExpanded ? "Collapse tiers" : "Expand tiers"}
                >
                  <svg className={`w-3 h-3 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : null;

              // Row click handler: expand/collapse tiers when expandTiers is on, otherwise toggle selection
              const handleRowClick = expandTiers
                ? () => toggleExpand(exercise.id)
                : () => onToggleExercise(exercise.id);

              /* ═══ Compact mode ═══ */
              if (isCompact) {
                return (
                  <div key={exercise.id}>
                    <div
                      className={`
                        relative flex items-center gap-1.5 px-2.5 py-[5px] rounded-md cursor-pointer transition-all duration-150
                        group border
                        ${isActive
                          ? 'bg-jade-deep/20 border-jade/30'
                          : isSearchMatch
                            ? 'bg-jade-deep/10 border-jade-glow/45 shadow-[0_0_10px_rgba(58,143,143,0.16)] hover:bg-jade-deep/15'
                            : 'bg-ink-dark/40 border-ink-light/50 hover:bg-ink-mid/20 hover:border-ink-light/70'
                        }
                      `}
                      style={showIllumination && isActive ? glowStyle as React.CSSProperties : undefined}
                      onClick={handleRowClick}
                    >
                      {chevron}
                      {/* Selection indicator */}
                      <div className={`w-1 h-4 rounded-full shrink-0 transition-all duration-200 ${isActive ? 'bg-jade-glow' : 'bg-transparent group-hover:bg-ink-light/40'}`} />
                      <span className={`text-[11px] truncate flex-1 ${showIllumination ? levelDiffColor : isActive ? 'text-cloud-white' : 'text-mist-light'}`} title={displayName}>
                        {displayName}
                      </span>
                      {logCount > 0 && (
                        <span className="text-[8px] text-mist-dark/70 font-mono shrink-0">{logCount}</span>
                      )}
                      <span className="text-[9px] text-gold/80 shrink-0 font-mono">Lv.{effectiveLevel}</span>
                      <span className={`shrink-0 text-[8px] font-medium px-1 py-0 rounded ${!expandTiers ? levelDiffColor : levelDiffColor + ' opacity-70'}`}>
                        {!expandTiers ? levelDifficulty : levelDifficulty.split(" ").map(w => w[0]).join("")}
                      </span>
                    </div>
                    {expandTiers && tierPanel}
                  </div>
                );
              }

              /* ═══ Scroll-Card Style (expanded) ═══ */
              if (isScrollStyle) {
                return (
                  <motion.div
                    key={exercise.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.015, duration: 0.2 }}
                  >
                    <div
                      className={`
                        relative p-2.5 rounded-lg border cursor-pointer transition-all duration-200 group
                        ${isActive
                          ? 'bg-jade-deep/15 border-jade/30 shadow-[0_0_10px_rgba(58,143,143,0.1)]'
                          : isSearchMatch
                            ? 'bg-jade-deep/10 border-jade-glow/45 shadow-[0_0_12px_rgba(58,143,143,0.14)] hover:bg-jade-deep/15'
                            : 'bg-ink-dark/40 border-ink-light/50 hover:border-ink-light/70 hover:bg-ink-mid/15'
                        }
                      `}
                      style={showIllumination && glowIntensity > 0 ? glowStyle as React.CSSProperties : undefined}
                      onClick={handleRowClick}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <div className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-jade-glow" />
                      )}

                      <div className="flex items-start gap-2">
                        <span className="text-base pt-0.5 opacity-70 shrink-0">{typeEmoji}</span>
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {chevron}
                            <h3 className={`text-[11px] font-medium ${showIllumination ? levelDiffColor : 'text-cloud-white'} truncate flex-1 leading-snug`} title={displayName}>
                              {displayName}
                            </h3>
                            <span className="text-[9px] text-gold/70 shrink-0 font-mono">Lv.{effectiveLevel}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-1 flex-wrap">
                            <span className={`text-[8px] font-medium px-1.5 py-0 rounded ${levelDiffColor} bg-ink-dark/50 border border-current/20`}>
                              {levelDifficulty}
                            </span>
                            {showPath && (
                              <span className={`text-[8px] px-1.5 py-0 rounded ${typeColor} bg-ink-dark/30 border border-current/15 opacity-70`}>
                                {getTypeDisplayName(exercise, settings.terminologyMode)}
                              </span>
                            )}
                            <EquipmentBadges exercise={exercise} />
                            {logCount > 0 && (
                              <span className="text-[8px] text-mist-dark/60 font-mono">{logCount} log{logCount !== 1 ? "s" : ""}</span>
                            )}
                          </div>
                          {showRealm && exercise.category && (
                            <span className="text-[9px] text-mist-dark/60 mt-0.5">{exercise.category}</span>
                          )}
                          {loreVisible && showPath && exercise.story && (
                            <p className="mt-1 text-[9px] text-mist-mid/70 leading-relaxed line-clamp-2">
                              {exercise.story}
                            </p>
                          )}
                          {expandTiers && tierPanel}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              }

              /* ═══ Default Style (expanded) ═══ */
              return (
                <motion.div
                  key={exercise.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.015, duration: 0.2 }}
                >
                  <div
                    className={`
                      relative p-2 rounded-lg border cursor-pointer transition-all duration-200 group
                      ${isActive
                        ? 'bg-jade-deep/15 border-jade/30'
                        : isSearchMatch
                          ? 'bg-jade-deep/10 border-jade-glow/45 shadow-[0_0_12px_rgba(58,143,143,0.14)] hover:bg-jade-deep/15'
                          : 'bg-ink-dark/40 border-ink-light/50 hover:border-ink-light/70 hover:bg-ink-mid/15'
                      }
                    `}
                    style={showIllumination ? glowStyle as React.CSSProperties : undefined}
                    onClick={handleRowClick}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-jade-glow" />
                    )}

                    <div className="flex items-center gap-1.5 pl-1">
                      {chevron}
                      <div className={`text-[11px] font-medium ${showIllumination ? levelDiffColor : isActive ? 'text-cloud-white' : 'text-mist-light'} transition-colors duration-150 truncate flex-1`} title={displayName}>
                        {displayName}
                      </div>
                      {logCount > 0 && (
                        <span className="text-[8px] text-mist-dark/60 font-mono shrink-0">{logCount}</span>
                      )}
                      <span className="text-[9px] text-gold/70 shrink-0 font-mono">Lv.{effectiveLevel}</span>
                      <span className={`shrink-0 text-[8px] font-medium px-1.5 py-0 rounded ${levelDiffColor} bg-ink-dark/30 border border-current/15`}>
                        {levelDifficulty}
                      </span>
                    </div>
                    {(showRealm || showPath) && (
                      <div className="flex items-center gap-1 mt-0.5 pl-1 flex-wrap">
                        {showPath && (
                          <span className={`inline-flex items-center px-1.5 py-0 rounded text-[8px] ${typeColor} opacity-60`}>
                            {getTypeDisplayName(exercise, settings.terminologyMode)}
                          </span>
                        )}
                        <EquipmentBadges exercise={exercise} />
                        {showRealm && exercise.category && (
                          <span className="text-[8px] text-mist-dark/50">{exercise.category}</span>
                        )}
                      </div>
                    )}
                    {loreVisible && showPath && exercise.story && (
                      <p className="text-[9px] text-mist-mid/60 leading-relaxed line-clamp-2 mt-0.5 pl-1">
                        {exercise.story}
                      </p>
                    )}
                    {expandTiers && tierPanel}
                  </div>
                </motion.div>
              );
            })}
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
  const { user } = useAuth();
  const [exercises, setExercises] = useState<ProgressionExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterEquipment, setFilterEquipment] = useState("");
  const [detailExercise, setDetailExercise] = useState<ProgressionExercise | null>(null);
  const [levelDefaults, setLevelDefaults] = useState<Record<string, number>>({});
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set());
  const [selectedLogExerciseId, setSelectedLogExerciseId] = useState<string | null>(null);
  const [showColorGuide, setShowColorGuide] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | null>(null);
  const [_exerciseOrder, setExerciseOrder] = useState<string[]>([]);
  const [physique, setPhysique] = useState<UserPhysiqueSettings>(DEFAULT_USER_PHYSIQUE);

  const userId = user?.id;

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

  // ── Persist level defaults in localStorage ──
  useEffect(() => {
    if (!userId) return;
    const stored = localStorage.getItem(`progression-levels-${userId}`);
    if (stored) {
      try { setLevelDefaults(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, [userId]);

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
  const toggleExercise = useCallback((id: string) => {
    setSelectedExerciseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const dismissExercise = useCallback((id: string) => {
    setSelectedExerciseIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

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
  const handleLog = async (exerciseId: string, level: number, data: {
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
        }, data.resistanceBandKg)
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
      const level = getAutoGymLevel(ex, physique);
      if (level != null) map[ex.id] = level;
    }
    return map;
  }, [exercises, physique]);

  const categories = [
    ...new Set(exercises.flatMap((e) => parseCategoryTags(e.category))),
  ].sort();
  const types = [...new Set(exercises.map((e) => e.type).filter((t): t is string => !!t && t.trim().length > 0))].sort();
  const equipmentTypes = [...new Set(exercises.flatMap(getEquipmentTags))].sort();

  // Selected exercises in order they were added
  const selectedExercises = exercises.filter((e) => selectedExerciseIds.has(e.id));

  // ── Render ──

  const sidebar = (
    <ProgressionSidebar
      exercises={exercises}
      selectedIds={selectedExerciseIds}
      onToggleExercise={toggleExercise}
      onSelectWithLevel={(exerciseId, level) => {
        if (!selectedExerciseIds.has(exerciseId)) toggleExercise(exerciseId);
        updateLevelDefault(exerciseId, level);
      }}
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
        <div className="p-4 space-y-4">
          {/* Color guide */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowColorGuide(true)}
              className="ml-auto px-2.5 py-1 rounded-md text-[10px] font-semibold border border-ink-light/60 text-mist-dark hover:text-cloud-white hover:border-mist-dark transition-all duration-200 flex items-center gap-1"
              title="Cultivation Color System"
            >
              <span className="text-sm">🌈</span> Colors
            </button>
          </div>

          {/* Selected exercise log forms (above table) */}
          {selectedExercises.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs text-mist-light uppercase tracking-wider">Log Training Data</h3>
                <button
                  onClick={() => setSelectedExerciseIds(new Set())}
                  className="text-[10px] text-mist-dark hover:text-crimson-light transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="space-y-2">
                <AnimatePresence>
                  {selectedExercises.map((exercise) => (
                    <InlineLogForm
                      key={exercise.id}
                      exercise={exercise}
                      selectedLevel={getSelectedLevel(exercise, levelDefaults, autoLevelByExerciseId)}
                      onSubmit={handleLog}
                      onChangeLevel={updateLevelDefault}
                      onDismiss={dismissExercise}
                      onViewDetail={handleViewExercise}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* Training Log Table */}
          <section>
            <div className="flex items-center justify-between mb-3 gap-2">
              <h3 className="text-xs text-mist-light uppercase tracking-wider">Training Log</h3>
              {selectedLogExerciseId && (
                <button
                  onClick={() => setSelectedLogExerciseId(null)}
                  className="text-[10px] px-2 py-1 rounded border border-jade/40 text-jade-light hover:bg-jade-deep/20"
                >
                  Clear Exercise Filter
                </button>
              )}
            </div>
            <TrainingLogTable
              exercises={exercises}
              physique={physique}
              selectedExerciseId={selectedLogExerciseId}
              onSelectExercise={setSelectedLogExerciseId}
              onRefresh={fetchExercises}
              userId={userId || ''}
            />
          </section>

          {/* Timed Hold Log Table */}
          {exercises.some(hasHoldBasedTiers) && (
            <section>
              <h3 className="text-xs text-mountain-blue-glow uppercase tracking-wider mb-3">Timed Hold Log</h3>
              <HoldTrainingLogTable
                exercises={exercises}
                selectedExerciseId={selectedLogExerciseId}
                onSelectExercise={setSelectedLogExerciseId}
                onRefresh={fetchExercises}
                userId={userId || ''}
              />
            </section>
          )}
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
    </PageLayout>
  );
}
