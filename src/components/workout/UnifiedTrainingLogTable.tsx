"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, startTransition, memo } from "react";
import { createPortal } from "react-dom";
import GlowButton from "@/components/ui/GlowButton";
import GlowCard from "@/components/ui/GlowCard";
import { useDisplaySettings, DEFAULT_UNIFIED_VISIBLE_COLUMNS } from "@/context/DisplaySettingsContext";
import { useAppContext } from "@/context/AppContext";
import { getTypeColor, formatDateWithPreference } from "@/lib/constants";
import { getDifficultyColorClass, getDifficultyGlowStyleScaled } from "@/lib/difficulty-styles";
import { getExerciseDisplayName, getTypeDisplayName, getDifficultyDisplayName, getTypeColorKey } from "@/lib/exercise-name";
import { inferExerciseType, formatSetValue, formatSetReps, getColumnHeaders, kgToLbs, type ExerciseType } from "@/lib/unit-conversion";
import { UserPhysiqueSettings } from "@/lib/user-physique";
import type { WeightStandardRecord } from "@/lib/weight-standards";
import { TIER_NAMES, TIER_COLORS } from "@/lib/weight-standards";

export type WeightStandardsMap = Record<string, { male: WeightStandardRecord | null; female: WeightStandardRecord | null }>;

// Re-export needed types to keep the component self-contained
export interface ProgressionTier {
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

export interface ProgressionVariation {
  id: string;
  name: string;
  wuxiaName: string;
  difficulty: string;
  description: string;
  wuxiaDifficulty: string;
  wuxiaType: string;
}

export interface ProgressionModifier {
  id: string;
  type: string;
  available: boolean;
  difficultyMod: number;
  notes: string;
}

export interface ProgressionLog {
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

export interface UserProgress {
  id: string;
  currentLevel: number;
  logs: ProgressionLog[];
}

export interface ProgressionExercise {
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

export interface LogTableFilter {
  exerciseId: string;
  levelNameLevel: number | null;
}

// ── Shared helpers (imported from workout page) ──
// These functions are passed in or re-implemented to avoid circular deps

const RESISTANCE_BAND_OPTIONS = [2, 5, 7, 10, 12, 15, 18, 20, 25, 30, 35, 40, 45, 50, 55, 60];
const MODIFIER_WEIGHT_OPTIONS = [2.5, 5, 7.5, 10, 12.5, 15, 20, 25, 30, 35, 40, 45, 50] as const;

function formatResistanceBandLabel(kg: number): string {
  return `-${kg}kg`;
}

function formatModifierWeightLabel(kg: number): string {
  const normalized = Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace(/\.0$/, "");
  return `+${normalized}kg`;
}

function parseModifierDisplayToKg(modifier: string | null | undefined): number | null {
  if (!modifier) return null;
  const match = modifier.match(/\+\s*([\d.]+)\s*kg/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getEffectiveWeight(avg: number, bandKg?: number | null, modifierWeightKg?: number | null): number {
  const bandOffset = typeof bandKg === "number" && Number.isFinite(bandKg) && bandKg > 0 ? bandKg : 0;
  const modifierOffset =
    typeof modifierWeightKg === "number" && Number.isFinite(modifierWeightKg) && modifierWeightKg > 0
      ? modifierWeightKg
      : 0;
  return Math.max(0, avg - bandOffset + modifierOffset);
}

function parseModifierWithBand(modifier: string | null | undefined): {
  baseModifier: string | null;
  resistanceBandKg: number | null;
  modifierWeightKg: number | null;
  displayLevelOverride: number | null;
} {
  if (!modifier) return { baseModifier: null, resistanceBandKg: null, modifierWeightKg: null, displayLevelOverride: null };
  let base = modifier;
  let bandKg: number | null = null;
  let levelOverride: number | null = null;
  let modifierWeightKg: number | null = null;
  const bandMatch = modifier.match(/RB:\s*([\d.]+)\s*kg/i);
  if (bandMatch) {
    bandKg = parseFloat(bandMatch[1]);
    base = base.replace(/RB:\s*[\d.]+\s*kg/i, "").trim();
  }
  const levelMatch = modifier.match(/RBL:\s*(\d+)/i);
  if (levelMatch) {
    levelOverride = parseInt(levelMatch[1]);
    base = base.replace(/RBL:\s*\d+/i, "").trim();
  }
  const mwMatch = modifier.match(/MW:\s*([\d.]+)\s*kg/i);
  if (mwMatch) {
    modifierWeightKg = parseFloat(mwMatch[1]);
    base = base.replace(/MW:\s*[\d.]+\s*kg/i, "").trim();
  }
  const trimmed = base.replace(/\s*[|;,]\s*$/g, "").trim();
  base = trimmed.length > 0 ? trimmed : "";
  return { baseModifier: base || null, resistanceBandKg: bandKg, modifierWeightKg, displayLevelOverride: levelOverride };
}

function buildModifierWithBand(
  baseModifier: string | null | undefined,
  bandKg: number | null | undefined,
  level: number | undefined,
  modifierWeightKg?: number | null,
): string | null {
  const parts: string[] = [];
  if (baseModifier) parts.push(baseModifier);
  if (bandKg != null && bandKg > 0) parts.push(`RB: ${bandKg}kg`);
  if (bandKg != null && bandKg > 0 && level != null) parts.push(`RBL: ${level}`);
  if (modifierWeightKg != null && modifierWeightKg > 0) parts.push(`MW: ${modifierWeightKg}kg`);
  return parts.length > 0 ? parts.join(" | ") : null;
}

function stripBwPercentHint(label: string): string {
  return label.replace(/\s*\([\d.]+%\s*BW\)/i, "");
}

function isGymCategoryExercise(exercise: ProgressionExercise): boolean {
  const tags = (exercise.category || "").split(",").map((t) => t.trim().toLowerCase());
  return tags.includes("gym") || tags.includes("weight training") || tags.includes("machines");
}

function getExerciseCategoryLabel(exercise: ProgressionExercise | undefined): string {
  if (!exercise) return "—";
  const tags = (exercise.category || "").split(",").map((t) => t.trim().toLowerCase());
  if (tags.includes("gym") || tags.includes("weight training") || tags.includes("machines")) return "GYM";
  if (tags.includes("yoga") || tags.includes("stretching")) return "Yoga";
  if (tags.includes("cardio")) return "Cardio";
  return "Cali";
}

function getBandSoftDimOpacity(kg: number | null | undefined): number {
  if (!kg || kg <= 0) return 1;
  return Math.max(0.4, 1 - kg * 0.01);
}

function getBandAdjustedGlowStyle(
  glowStyle: React.CSSProperties,
  bandKg: number | null | undefined,
): React.CSSProperties {
  if (!bandKg || bandKg <= 0) return glowStyle;
  const dimFactor = Math.max(0.25, 1 - bandKg * 0.015);
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(glowStyle)) {
    if (typeof val === "string" && val.includes("rgba")) {
      result[key] = val.replace(/rgba\(([^)]+)\)/g, (_m, inside) => {
        const parts = inside.split(",");
        if (parts.length === 4) {
          const alpha = parseFloat(parts[3]) * dimFactor;
          return `rgba(${parts[0]},${parts[1]},${parts[2]},${alpha.toFixed(3)})`;
        }
        return _m;
      });
    } else {
      result[key] = val;
    }
  }
  return result as React.CSSProperties;
}

function abbreviateVariantText(text: string): string {
  const words = text.trim().split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length >= 2) return words.slice(0, 4).map((w) => w[0].toUpperCase()).join("");
  const compact = words[0] ?? text.trim();
  return compact.slice(0, 6).toUpperCase();
}

function getTierName(exercise: ProgressionExercise, level: number): string {
  const tier = exercise.tiers.find((t) => t.level === level);
  return tier ? tier.name : `Level ${level}`;
}

// ── Tier standards (bodyweight-percentage based) ──
const TIER_STANDARDS = [
  { tier: 1, name: "Untrained", minPercentage: 0, maxPercentage: 50, color: "#4ade80" },
  { tier: 2, name: "Beginner", minPercentage: 50, maxPercentage: 75, color: "#fbbf24" },
  { tier: 3, name: "Novice", minPercentage: 75, maxPercentage: 100, color: "#f87171" },
  { tier: 4, name: "Intermediate", minPercentage: 100, maxPercentage: 125, color: "#a78bfa" },
  { tier: 5, name: "Advanced", minPercentage: 125, maxPercentage: 150, color: "#f472b6" },
  { tier: 6, name: "Elite", minPercentage: 150, maxPercentage: Infinity, color: "#67e8f9" },
];

function getTierFromWeights(
  exercise: ProgressionExercise,
  userBodyweightKg: number | null,
): { glowColor: string; tierName: string } {
  const DEFAULT = { glowColor: TIER_STANDARDS[0].color, tierName: TIER_STANDARDS[0].name };
  if (!userBodyweightKg || userBodyweightKg <= 0) return DEFAULT;

  const logs = exercise.userProgress?.[0]?.logs ?? [];
  if (logs.length === 0) return DEFAULT;

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
    if (log.weight1 && log.weight1 > 0) allWeights.push(log.weight1);
    if (log.weight2 && log.weight2 > 0) allWeights.push(log.weight2);
    if (log.weight3 && log.weight3 > 0) allWeights.push(log.weight3);
  }
  if (allWeights.length === 0) return DEFAULT;

  const avgWeight = allWeights.reduce((s, w) => s + w, 0) / allWeights.length;
  const percentage = (avgWeight / userBodyweightKg) * 100;
  const currentTier = TIER_STANDARDS.find(
    (t) => percentage >= t.minPercentage && percentage < t.maxPercentage
  ) || TIER_STANDARDS[TIER_STANDARDS.length - 1];
  return { glowColor: currentTier.color, tierName: currentTier.name };
}

/** Build tier array from a DB WeightStandardRecord, falling back to hardcoded TIER_STANDARDS. */
function buildTierArray(record: WeightStandardRecord | null | undefined) {
  if (!record) return TIER_STANDARDS;
  return [
    { tier: 1, name: TIER_NAMES[0], minPercentage: record.tier1Min, maxPercentage: record.tier1Max, color: TIER_COLORS[0] },
    { tier: 2, name: TIER_NAMES[1], minPercentage: record.tier2Min, maxPercentage: record.tier2Max, color: TIER_COLORS[1] },
    { tier: 3, name: TIER_NAMES[2], minPercentage: record.tier3Min, maxPercentage: record.tier3Max, color: TIER_COLORS[2] },
    { tier: 4, name: TIER_NAMES[3], minPercentage: record.tier4Min, maxPercentage: record.tier4Max, color: TIER_COLORS[3] },
    { tier: 5, name: TIER_NAMES[4], minPercentage: record.tier5Min, maxPercentage: record.tier5Max, color: TIER_COLORS[4] },
    { tier: 6, name: TIER_NAMES[5], minPercentage: record.tier6Min, maxPercentage: record.tier6Max, color: TIER_COLORS[5] },
  ];
}

/** Compute tier from a single log entry's weights (per-row). */
function getTierFromEntryWeights(
  weights: (number | null)[],
  userBodyweightKg: number | null,
  bandKg?: number | null,
  modifierWeightKg?: number | null,
  exerciseStandard?: WeightStandardRecord | null,
): { glowColor: string; tierName: string } {
  const tiers = buildTierArray(exerciseStandard);
  const DEFAULT = { glowColor: tiers[0].color, tierName: tiers[0].name };
  if (!userBodyweightKg || userBodyweightKg <= 0) return DEFAULT;
  const valid = weights.filter((w): w is number => w != null && w > 0);
  if (valid.length === 0) return DEFAULT;
  const avg = valid.reduce((s, w) => s + w, 0) / valid.length;
  const effectiveWeight = getEffectiveWeight(avg, bandKg, modifierWeightKg);
  const pct = (effectiveWeight / userBodyweightKg) * 100;
  const tier = tiers.find((t) => pct >= t.minPercentage && pct < t.maxPercentage) || tiers[tiers.length - 1];
  return { glowColor: tier.color, tierName: tier.name };
}

function getWeightedDifficulty(
  exercise: ProgressionExercise,
  level: number,
  variant?: string | null,
  modifier?: string | null,
): string {
  const tier = exercise.tiers.find((t) => t.level === level);
  const baseDiff = tier?.difficulty || exercise.difficulty;
  return baseDiff;
}

function getAutoGymLevelFromSet(
  _exercise: ProgressionExercise,
  _physique: UserPhysiqueSettings,
  _weights: { weight1: number | null; weight2: number | null; weight3: number | null },
  _bandKg: number | null,
): number | null {
  // Simplified — real implementation in workout page
  return null;
}

/** Get the standard weight (kg) for the NEXT tier of an exercise (the target to reach). */
function getNextTierStandardWeightKg(
  exercise: ProgressionExercise | undefined,
  currentWeights: (number | null)[],
  userBodyweightKg: number | null,
  bandKg?: number | null,
  modifierWeightKg?: number | null,
): number | null {
  if (!exercise || !userBodyweightKg || userBodyweightKg <= 0) return null;

  // Calculate current tier from the entry's weights
  const valid = currentWeights.filter((w): w is number => w != null && w > 0);
  if (valid.length === 0) return null;
  const avg = valid.reduce((s, w) => s + w, 0) / valid.length;
  const effectiveWeight = getEffectiveWeight(avg, bandKg, modifierWeightKg);
  const pct = (effectiveWeight / userBodyweightKg) * 100;
  const currentTier = TIER_STANDARDS.find((t) => pct >= t.minPercentage && pct < t.maxPercentage) || TIER_STANDARDS[TIER_STANDARDS.length - 1];
  const nextTier = TIER_STANDARDS.find((t) => t.tier === currentTier.tier + 1);
  if (!nextTier) return null; // Already at Elite

  // Next tier's minimum percentage * bodyweight = target weight
  return (nextTier.minPercentage / 100) * userBodyweightKg;
}

/** Compute average effective weight from a log entry (band assistance + added modifier weight). */
function getEntryAvgWeight(entry: UnifiedFlatLogEntry): number | null {
  if (entry.exerciseType === "timed") return null;
  const weights = [entry.origWeight1, entry.origWeight2, entry.origWeight3].filter(
    (w): w is number => w != null && w > 0,
  );
  if (weights.length === 0) return null;
  const avg = weights.reduce((s, w) => s + w, 0) / weights.length;
  return getEffectiveWeight(avg, entry.resistanceBandKg, entry.modifierWeightKg);
}

// ── Unified Flat Log Entry ──

interface UnifiedFlatLogEntry {
  logId: string;
  date: string;
  exerciseName: string;
  exerciseId: string;
  level: number;
  levelNameLevel: number;
  tierName: string;
  // Unified value columns: weight OR holdTime depending on exercise type
  val1: number | null;
  val2: number | null;
  val3: number | null;
  reps1: number | null;
  reps2: number | null;
  reps3: number | null;
  modifier: string | null;
  resistanceBandKg: number | null;
  modifierWeightKg: number | null;
  variant: string | null;
  notes: string | null;
  completed: boolean;
  exerciseType: ExerciseType;
  // Keep originals for edit mode save
  origWeight1: number | null;
  origWeight2: number | null;
  origWeight3: number | null;
  origHoldTime: number | null;
  origHoldTime2: number | null;
  origHoldTime3: number | null;
}

function flattenLogsUnified(exercises: ProgressionExercise[]): UnifiedFlatLogEntry[] {
  const entries: UnifiedFlatLogEntry[] = [];

  for (const ex of exercises) {
    const progress = ex.userProgress[0];
    if (!progress) continue;
    for (const log of progress.logs) {
      const hasHold = log.holdTime != null || log.holdTime2 != null || log.holdTime3 != null;
      const exType = inferExerciseType(ex, hasHold);
      const parsed = parseModifierWithBand(log.modifier);

      // Unified values: use holdTime for timed, weight for weighted/bodyweight
      const val1 = hasHold ? log.holdTime : log.weight1;
      const val2 = hasHold ? log.holdTime2 : log.weight2;
      const val3 = hasHold ? log.holdTime3 : log.weight3;

      entries.push({
        logId: log.id,
        date: log.createdAt,
        exerciseName: ex.name,
        exerciseId: ex.id,
        level: log.level,
        levelNameLevel: parsed.displayLevelOverride ?? log.level,
        tierName: stripBwPercentHint(getTierName(ex, parsed.displayLevelOverride ?? log.level)),
        val1,
        val2,
        val3,
        reps1: log.reps1,
        reps2: log.reps2,
        reps3: log.reps3,
        modifier: parsed.modifierWeightKg != null
          ? [parsed.baseModifier, `+${parsed.modifierWeightKg}kg`].filter(Boolean).join(" | ")
          : parsed.baseModifier,
        resistanceBandKg: parsed.resistanceBandKg,
        modifierWeightKg: parsed.modifierWeightKg,
        variant: log.variant,
        notes: log.notes,
        completed: log.completed,
        exerciseType: exType,
        origWeight1: log.weight1,
        origWeight2: log.weight2,
        origWeight3: log.weight3,
        origHoldTime: log.holdTime,
        origHoldTime2: log.holdTime2,
        origHoldTime3: log.holdTime3,
      });
    }
  }
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return entries;
}

function formatDate(dateString: string, dateFormat: "dd-mm-yyyy" | "dd-mmm-yyyy" | "dd-mm-yy" | "dd-mmm-yy"): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDateWithPreference(date, dateFormat);
}

function displayVal(v: number | null): string {
  return v != null ? String(v) : "—";
}

// ── The Unified Training Log Table ──

function UnifiedTrainingLogTable({
  exercises,
  physique,
  selectedLogFilter,
  onSelectExercise,
  onRefresh,
  userId,
  weightStandards,
}: {
  exercises: ProgressionExercise[];
  physique: UserPhysiqueSettings;
  selectedLogFilter: LogTableFilter | null;
  onSelectExercise: (filter: LogTableFilter | null) => void;
  onRefresh: () => void;
  userId: string;
  weightStandards?: WeightStandardsMap;
}) {
  const allEntries = useMemo(() => flattenLogsUnified(exercises), [exercises]);
  const exerciseLookup = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises]);

  const isSelectedGymExercise = selectedLogFilter
    ? (() => {
        const selectedExercise = exerciseLookup.get(selectedLogFilter.exerciseId);
        return selectedExercise ? isGymCategoryExercise(selectedExercise) : false;
      })()
    : false;

  const entries = allEntries.filter(
    (entry) =>
      !selectedLogFilter ||
      (entry.exerciseId === selectedLogFilter.exerciseId &&
        (isSelectedGymExercise || entry.levelNameLevel === selectedLogFilter.levelNameLevel))
  );
  const { settings } = useDisplaySettings();
  const { isMobile } = useAppContext();

  const [isEditMode, setIsEditMode] = useState(false);
  const [editingData, setEditingData] = useState<Record<string, {
    val1: number | null; reps1: number | null;
    val2: number | null; reps2: number | null;
    val3: number | null; reps3: number | null;
    level: number;
    modifier: string | null; resistanceBandKg: number | null; variant: string | null; notes: string | null;
    exerciseType: ExerciseType;
  }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ logId: string; exerciseName: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [levelPicker, setLevelPicker] = useState<{ logId: string; exerciseId: string } | null>(null);

  const logMode = settings.progressionLogMode ?? "name-illumination-realm";
  const compactSetting = settings.progressionLogCompact ?? "compact";
  const glowIntensity = settings.glowIntensityProgressionLog ?? 100;
  const columnColors = settings.progressionColumnColorsEnabled ?? true;
  const columnGrouped = settings.progressionColumnOrderGrouped ?? true;
  const variationDisplay = settings.progressionVariationDisplay ?? "abbreviation";
  const dateFormat = settings.dateFormat || "dd-mmm-yyyy";
  const weightUnit = settings.defaultWeightUnit ?? "kg";
  const visibleColumnKeys = settings.unifiedVisibleColumns ?? DEFAULT_UNIFIED_VISIBLE_COLUMNS;
  const visibleColumnSet = useMemo(() => new Set(visibleColumnKeys), [visibleColumnKeys]);
  const showDate = visibleColumnSet.has("date");
  const showCategory = visibleColumnSet.has("category");
  const showModifier = visibleColumnSet.has("modifier");
  const showBand = visibleColumnSet.has("band");
  const showVariant = visibleColumnSet.has("variant");
  const showNotes = visibleColumnSet.has("notes");
  const showStandardWeight = visibleColumnSet.has("standardWeight");
  const showAvgWeight = visibleColumnSet.has("avgWeight");

  const effectiveCompact = compactSetting === "compact" || (compactSetting === "auto" && isMobile);

  const showIllumination = logMode !== "name-only";
  const showRealm = logMode === "name-illumination-realm" || logMode === "name-illumination-realm-path";
  const showPath = logMode === "name-illumination-realm-path";

  const shouldRenderModifierColumn = showModifier;
  const anyBand = true;
  const shouldRenderVariantColumn = showVariant;

  // Determine column headers based on exercise types visible in the entries
  const entryExerciseTypes = useMemo(() => entries.map((e) => e.exerciseType), [entries]);
  const { labels: headerLabels, types: headerTypes, keys: headerKeys } = useMemo(
    () => getColumnHeaders(entryExerciseTypes, columnGrouped),
    [entryExerciseTypes, columnGrouped],
  );

  // Filter data columns by visibility
  const visibleDataIndices = useMemo(() => {
    return headerKeys.map((key, idx) => ({ key, idx })).filter(({ key }) => visibleColumnSet.has(key as import("@/context/DisplaySettingsContext").UnifiedVisibleColumnKey));
  }, [headerKeys, visibleColumnSet]);

  const getZeroValueStyle = (value: number | null, colType: string, exType: ExerciseType): React.CSSProperties | undefined => {
    if (value === 0) return { backgroundColor: "var(--ink-mid)", color: "var(--mist-dark)" };
    if (columnColors && colType === "value") {
      if (exType === "timed") return { backgroundColor: "rgba(94, 184, 232, 0.08)" };
      return { backgroundColor: "var(--col-weight-bg)" };
    }
    if (columnColors && colType === "reps") return { backgroundColor: "var(--col-reps-bg)" };
    return undefined;
  };

  const handleEditModeToggle = () => {
    if (!isEditMode) {
      setIsEditMode(true);
      startTransition(() => {
        const newData: typeof editingData = {};
        entries.forEach((entry) => {
          newData[entry.logId] = {
            val1: entry.val1, reps1: entry.reps1,
            val2: entry.val2, reps2: entry.reps2,
            val3: entry.val3, reps3: entry.reps3,
            level: entry.level,
            modifier: entry.modifier,
            resistanceBandKg: entry.resistanceBandKg,
            variant: entry.variant,
            notes: entry.notes,
            exerciseType: entry.exerciseType,
          };
        });
        setEditingData(newData);
      });
    } else {
      setIsEditMode(false);
    }
  };

  const handleEditChange = (logId: string, field: string, value: string | number | null) => {
    setEditingData((prev) => ({ ...prev, [logId]: { ...prev[logId], [field]: value } }));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const updates = Object.entries(editingData).map(([id, data]) => {
        const isTimed = data.exerciseType === "timed";
        const modifierWeightKg = parseModifierDisplayToKg(data.modifier);
        const baseModifier = modifierWeightKg == null ? (data.modifier ?? null) : null;
        return {
          id,
          level: data.level,
          weight1: isTimed ? null : data.val1,
          reps1: data.reps1,
          weight2: isTimed ? null : data.val2,
          reps2: data.reps2,
          weight3: isTimed ? null : data.val3,
          holdTime: isTimed ? data.val1 : null,
          holdTime2: isTimed ? data.val2 : null,
          holdTime3: isTimed ? data.val3 : null,
          modifier: buildModifierWithBand(baseModifier, data.resistanceBandKg, data.level, modifierWeightKg),
          variant: data.variant,
          notes: data.notes,
        };
      });
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
      setIsEditMode(false);
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

  const emptyRowColSpan =
    (showDate ? 1 : 0) +
    (showCategory ? 1 : 0) +
    1 +
    visibleDataIndices.length +
    (shouldRenderModifierColumn ? 1 : 0) +
    (anyBand && showBand ? 1 : 0) +
    (shouldRenderVariantColumn ? 1 : 0) +
    (showNotes ? 1 : 0) +
    (showStandardWeight ? 1 : 0) +
    (showAvgWeight ? 1 : 0) +
    (isEditMode ? 1 : 0);

  /** Render the value for a given data column */
  const renderCellValue = (entry: UnifiedFlatLogEntry, colType: "value" | "reps", fieldIndex: number): string => {
    if (colType === "reps") {
      const val = fieldIndex === 0 ? entry.reps1 : fieldIndex === 1 ? entry.reps2 : entry.reps3;
      return formatSetReps(val, entry.exerciseType);
    }
    // Value column
    const val = fieldIndex === 0 ? entry.val1 : fieldIndex === 1 ? entry.val2 : entry.val3;
    return formatSetValue(val, entry.exerciseType, weightUnit);
  };

  /** Get the raw numeric value for a data column */
  const getRawCellValue = (entry: UnifiedFlatLogEntry, colType: "value" | "reps", fieldIndex: number): number | null => {
    if (colType === "reps") {
      return fieldIndex === 0 ? entry.reps1 : fieldIndex === 1 ? entry.reps2 : entry.reps3;
    }
    return fieldIndex === 0 ? entry.val1 : fieldIndex === 1 ? entry.val2 : entry.val3;
  };

  /** Map visible column back to edit data field */
  const getEditField = (colType: "value" | "reps", fieldIndex: number): string => {
    if (colType === "reps") return `reps${fieldIndex + 1}`;
    return `val${fieldIndex + 1}`;
  };

  return (
    <>
      <GlowCard className={isMobile ? "w-full !p-0 border-x-0 rounded-none" : "w-full !p-0"} glow="jade" hoverable={false}>
        {/* Edit header bar */}
        {entries.length > 0 && (
          <div className="flex items-center justify-between px-3 py-2 border-b border-jade-glow/20">
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
                <button
                  onClick={handleEditModeToggle}
                  className="text-xs px-3 py-1 rounded border border-jade-glow/40 text-jade-light hover:bg-jade-deep/10 hover:scale-105 active:scale-95 transition-all duration-100"
                >
                  ✎ Edit
                </button>
              )}
            </div>
          </div>
        )}

        <div className="overflow-x-auto -mx-4 px-4" style={{ WebkitOverflowScrolling: "touch" }}>
          <table
            className="text-xs border-collapse w-full"
            style={{ whiteSpace: "nowrap", minWidth: effectiveCompact ? "400px" : isEditMode ? "720px" : "650px" }}
          >
            <thead>
              <tr className="border-b border-jade-glow/30 text-mist-dark">
                {showDate && (
                  <th className={`${effectiveCompact ? "py-1 px-1" : "py-2 px-1.5"} w-[6.5rem] min-w-[6.5rem] text-left font-semibold uppercase tracking-wider text-[11px]`}>
                    Date
                  </th>
                )}
                {showCategory && (
                  <th className={`${effectiveCompact ? "py-1 px-0.5" : "py-2 px-1"} w-[5.25rem] min-w-[5.25rem] text-center font-semibold uppercase tracking-wider text-[11px]`}>
                    Category
                  </th>
                )}
                <th className={`${effectiveCompact ? "py-1 px-1" : "py-2 px-1.5"} text-left font-semibold uppercase tracking-wider text-[11px]`}>
                  Exercise
                </th>
                {visibleDataIndices.map(({ idx }) => (
                  <th
                    key={headerLabels[idx] + idx}
                    className={`${effectiveCompact ? "py-1 px-0.5" : "py-2 px-1"} w-[3.25rem] min-w-[3.25rem] text-center font-semibold tabular-nums uppercase tracking-wider text-[11px]`}
                    style={columnColors ? { color: headerTypes[idx] === "value" ? "var(--col-weight)" : "var(--col-reps)" } : undefined}
                  >
                    {headerLabels[idx]}
                  </th>
                ))}
                {shouldRenderModifierColumn && (
                  <th className={`${effectiveCompact ? "py-1 px-0.5" : "py-2 px-1"} w-[4.5rem] min-w-[4.5rem] text-center font-semibold uppercase tracking-wider text-[11px] text-amber-400`}>
                    Mod
                  </th>
                )}
                {anyBand && showBand && (
                  <th className={`${effectiveCompact ? "py-1 px-0.5" : "py-2 px-1"} w-[5rem] min-w-[5rem] text-center font-semibold uppercase tracking-wider text-[11px] text-sky-300`}>
                    Band
                  </th>
                )}
                {shouldRenderVariantColumn && (
                  <th className={`${effectiveCompact ? "py-1 px-0.5" : "py-2 px-1"} w-[6.5rem] min-w-[6.5rem] text-center font-semibold uppercase tracking-wider text-[11px] text-purple-400`}>
                    Variant
                  </th>
                )}
                {showNotes && (
                  <th className={`${effectiveCompact ? "py-1 px-1" : "py-2 px-1.5"} w-[9rem] min-w-[9rem] text-left font-semibold uppercase tracking-wider text-[11px]`}>
                    Notes
                  </th>
                )}
                {showStandardWeight && (
                  <th className={`${effectiveCompact ? "py-1 px-0.5" : "py-2 px-1"} w-[4rem] min-w-[4rem] text-center font-semibold uppercase tracking-wider text-[11px] text-emerald-400`}>
                    Next
                  </th>
                )}
                {showAvgWeight && (
                  <th className={`${effectiveCompact ? "py-1 px-0.5" : "py-2 px-1"} w-[4rem] min-w-[4rem] text-center font-semibold uppercase tracking-wider text-[11px] text-cyan-400`}>
                    Avg
                  </th>
                )}
                {isEditMode && (
                  <th className="px-1 py-2 text-center font-semibold text-mist-glow text-[11px] align-middle">⋮</th>
                )}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={emptyRowColSpan} className="py-6 text-center text-mist-mid text-sm">
                    No training data logged yet. Select an exercise from the sidebar to log your first set.
                  </td>
                </tr>
              ) : (
                <AnimatePresence initial={false}>
                  {entries.map((entry) => {
                    const ex = exerciseLookup.get(entry.exerciseId);
                    const editData = editingData[entry.logId];
                    const previewLevel = isEditMode && editData ? editData.level : entry.level;
                    const activeModifier = isEditMode && editData ? editData.modifier : entry.modifier;
                    const activeVariant = isEditMode && editData ? editData.variant : entry.variant;
                    const tier = ex?.tiers.find((t) => t.level === previewLevel);
                    const displayTier = ex?.tiers.find((t) => t.level === entry.levelNameLevel);
                    const activeBand = isEditMode && editData ? editData.resistanceBandKg : entry.resistanceBandKg;
                    const activeModifierKg = isEditMode && editData
                      ? parseModifierDisplayToKg(editData.modifier)
                      : entry.modifierWeightKg;
                    const exStandards = weightStandards?.[entry.exerciseId];
                    const genderStandard = exStandards
                      ? (physique.gender === "female" ? exStandards.female : exStandards.male)
                      : null;
                    const rowTierInfo = getTierFromEntryWeights(
                      [entry.origWeight1, entry.origWeight2, entry.origWeight3],
                      physique.bodyWeightKg,
                      activeBand,
                      activeModifierKg,
                      genderStandard,
                    );
                    const tierDifficultyDisplay = rowTierInfo.tierName;
                    const exerciseGlow = glowIntensity > 0
                      ? { boxShadow: `0 0 ${Math.round(glowIntensity * 0.12)}px ${rowTierInfo.glowColor}40, inset 0 0 ${Math.round(glowIntensity * 0.08)}px ${rowTierInfo.glowColor}15`, borderColor: rowTierInfo.glowColor } as React.CSSProperties
                      : {} as React.CSSProperties;
                    const isBandAssistedCali =
                      getExerciseCategoryLabel(ex) === "Cali" && typeof activeBand === "number" && activeBand > 0;
                    const displayGlowStyle = isBandAssistedCali
                      ? getBandAdjustedGlowStyle(exerciseGlow as React.CSSProperties, activeBand)
                      : exerciseGlow;
                    const softDimStyle = isBandAssistedCali
                      ? ({ opacity: getBandSoftDimOpacity(activeBand) } as React.CSSProperties)
                      : undefined;
                    const entryDisplayName = ex
                      ? stripBwPercentHint(getExerciseDisplayName(ex, settings.terminologyMode))
                      : stripBwPercentHint(entry.exerciseName);
                    const exerciseVariantOptions = (ex?.variations ?? []).map((v) => v.name).filter(Boolean);
                    const selectedVariantValue = editData?.variant ?? "";
                    const variantSelectOptions =
                      selectedVariantValue && !exerciseVariantOptions.includes(selectedVariantValue)
                        ? [...exerciseVariantOptions, selectedVariantValue]
                        : exerciseVariantOptions;

                    // Determine per-row value display style
                    const isTimedEntry = entry.exerciseType === "timed";

                    return (
                      <motion.tr
                        key={entry.logId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12, ease: "easeOut" }}
                        className={`border-b transition-all duration-100 ${
                          isEditMode
                            ? "border-jade-glow/15 bg-jade-deep/5 hover:bg-jade-deep/10"
                            : "border-ink-light/50 hover:bg-ink-mid/10"
                        }`}
                      >
                        {showDate && (
                          <td className={`${effectiveCompact ? "px-1 py-1" : "px-1.5 py-1.5"} w-[6.5rem] min-w-[6.5rem] text-mist-light text-xs align-middle whitespace-nowrap`}>
                            {formatDate(entry.date, dateFormat)}
                          </td>
                        )}
                        {showCategory && (
                          <td className={`${effectiveCompact ? "px-0.5 py-1" : "px-1 py-1.5"} w-[5.25rem] min-w-[5.25rem] text-center align-middle`}>
                            <span
                              className={`text-[10px] font-semibold ${
                                getExerciseCategoryLabel(ex) === "GYM"
                                  ? "text-gold"
                                  : getExerciseCategoryLabel(ex) === "Yoga"
                                    ? "text-purple-400"
                                    : getExerciseCategoryLabel(ex) === "Cardio"
                                      ? "text-orange-400"
                                      : "text-jade-light"
                              }`}
                            >
                              {getExerciseCategoryLabel(ex)}
                            </span>
                          </td>
                        )}
                        <td
                          className={`${effectiveCompact ? "px-1 py-1" : "px-1.5 py-1.5"} align-middle whitespace-nowrap cursor-pointer hover:bg-jade-deep/10 transition-colors ${isEditMode ? "ring-1 ring-jade-glow/20" : ""}`}
                          style={{ minWidth: "120px" }}
                          onClick={() => {
                            if (isEditMode) {
                              setLevelPicker({ logId: entry.logId, exerciseId: entry.exerciseId });
                              return;
                            }
                            const nextFilter: LogTableFilter = {
                              exerciseId: entry.exerciseId,
                              levelNameLevel: ex && isGymCategoryExercise(ex) ? null : entry.levelNameLevel,
                            };
                            const isSameFilter =
                              selectedLogFilter?.exerciseId === nextFilter.exerciseId &&
                              selectedLogFilter?.levelNameLevel === nextFilter.levelNameLevel;
                            onSelectExercise(isSameFilter ? null : nextFilter);
                          }}
                        >
                          {!showIllumination ? (
                            <span className="text-xs text-cloud-white" style={softDimStyle} title={entryDisplayName}>
                              {entryDisplayName}
                            </span>
                          ) : (
                            <div
                              className="px-2 py-1 rounded-md border inline-flex items-center gap-1.5"
                              style={
                                glowIntensity > 0
                                  ? ({ ...(displayGlowStyle as React.CSSProperties), ...(softDimStyle || {}) } as React.CSSProperties)
                                  : softDimStyle
                              }
                              title={entryDisplayName}
                            >
                              <span className="text-xs font-normal" style={{ color: rowTierInfo.glowColor }}>{entryDisplayName}</span>
                              {showRealm && ex && (
                                <>
                                  <span
                                    className="inline-flex items-center px-1 py-0 rounded text-[9px] font-medium border opacity-80"
                                    style={{ color: rowTierInfo.glowColor, borderColor: `${rowTierInfo.glowColor}30` }}
                                  >
                                    {tierDifficultyDisplay}
                                  </span>
                                  {showPath && ex.type && (
                                    <span
                                      className={`inline-flex items-center px-1 py-0 rounded text-[9px] font-medium ${getTypeColor(getTypeColorKey(ex))} border border-current/20 opacity-70`}
                                    >
                                      {getTypeDisplayName(ex, settings.terminologyMode)}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </td>
                        {visibleDataIndices.map(({ idx }) => {
                          const colType = headerTypes[idx];
                          // Map to field index (0, 1, 2) regardless of grouped/interleaved order
                          const fieldIndex = colType === "value"
                            ? (columnGrouped ? idx : Math.floor(idx / 2))
                            : (columnGrouped ? idx - 3 : Math.floor(idx / 2));

                          if (isEditMode && editData) {
                            const editField = getEditField(colType, fieldIndex);
                            const editVal = editData[editField as keyof typeof editData] as number | null;
                            const isValue = colType === "value";
                            return (
                              <td key={headerLabels[idx] + idx} className="w-[3.25rem] min-w-[3.25rem] px-1 py-1.5 text-center align-middle">
                                <input
                                  type="number"
                                  min="0"
                                  max={isValue ? undefined : "500"}
                                  step={isValue && !isTimedEntry ? "0.5" : undefined}
                                  value={editVal ?? ""}
                                  onChange={(e) =>
                                    handleEditChange(
                                      entry.logId,
                                      editField,
                                      e.target.value
                                        ? isValue && !isTimedEntry
                                          ? parseFloat(e.target.value)
                                          : parseInt(e.target.value)
                                        : null,
                                    )
                                  }
                                  placeholder="—"
                                  className="w-full min-w-[52px] bg-ink-deep border border-jade-glow/30 rounded px-1 py-1 text-cloud-white text-center text-xs outline-none transition-all duration-200 hover:border-jade-glow/50 hover:bg-ink-dark/60 focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.4)]"
                                />
                              </td>
                            );
                          }

                          const rawValue = getRawCellValue(entry, colType, fieldIndex);
                          const displayText = renderCellValue(entry, colType, fieldIndex);
                          const valueColor = isTimedEntry && colType === "value" ? "#5eb8e8" : undefined;

                          return (
                            <td
                              key={headerLabels[idx] + idx}
                              className={`${effectiveCompact ? "px-0.5 py-1" : "px-1 py-1.5"} w-[3.25rem] min-w-[3.25rem] text-center text-xs align-middle ${!valueColor ? "text-cloud-white" : ""}`}
                              style={{
                                ...getZeroValueStyle(rawValue, colType, entry.exerciseType),
                                ...(valueColor ? { color: valueColor } : {}),
                              }}
                            >
                              {displayText}
                            </td>
                          );
                        })}
                        {shouldRenderModifierColumn && (
                          isEditMode && editData ? (
                            <td className="w-[4.5rem] min-w-[4.5rem] px-1 py-1.5 text-center align-middle">
                              <select
                                value={(() => {
                                  const kg = parseModifierDisplayToKg(editData.modifier);
                                  return kg != null ? String(kg) : "";
                                })()}
                                onChange={(e) => {
                                  const next = e.target.value ? formatModifierWeightLabel(parseFloat(e.target.value)) : null;
                                  handleEditChange(entry.logId, "modifier", next);
                                }}
                                className="w-full min-w-[70px] bg-ink-deep border border-jade-glow/30 rounded px-1 py-1 text-amber-400 text-center text-xs outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.4)]"
                              >
                                <option value="">—</option>
                                {MODIFIER_WEIGHT_OPTIONS.map((kg) => (
                                  <option key={kg} value={String(kg)}>
                                    {formatModifierWeightLabel(kg)}
                                  </option>
                                ))}
                              </select>
                            </td>
                          ) : (
                            <td
                              className={`${effectiveCompact ? "px-0.5 py-1" : "px-1 py-1.5"} w-[4.5rem] min-w-[4.5rem] text-center text-amber-400 text-xs whitespace-nowrap align-middle`}
                              title={entry.modifier || ""}
                            >
                              {entry.modifier || "—"}
                            </td>
                          )
                        )}
                        {anyBand && showBand && (
                          isEditMode && editData ? (
                            <td className="w-[5rem] min-w-[5rem] px-1 py-1.5 text-center align-middle">
                              <select
                                value={editData.resistanceBandKg != null ? String(editData.resistanceBandKg) : ""}
                                onChange={(e) =>
                                  handleEditChange(entry.logId, "resistanceBandKg", e.target.value ? parseFloat(e.target.value) : null)
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
                            <td
                              className={`${effectiveCompact ? "px-0.5 py-1" : "px-1 py-1.5"} w-[5rem] min-w-[5rem] text-center text-sky-300 text-xs whitespace-nowrap align-middle`}
                            >
                              {entry.resistanceBandKg != null ? formatResistanceBandLabel(entry.resistanceBandKg) : "—"}
                            </td>
                          )
                        )}
                        {shouldRenderVariantColumn && (
                          isEditMode && editData ? (
                            <td className="w-[6.5rem] min-w-[6.5rem] px-1 py-1.5 text-center align-middle">
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
                            <td
                              className={`${effectiveCompact ? "px-0.5 py-1" : "px-1 py-1.5"} w-[6.5rem] min-w-[6.5rem] text-center text-purple-400 text-xs whitespace-nowrap align-middle`}
                              title={entry.variant || ""}
                            >
                              {entry.variant
                                ? variationDisplay === "full"
                                  ? entry.variant
                                  : abbreviateVariantText(entry.variant)
                                : "—"}
                            </td>
                          )
                        )}
                        {showNotes && (
                          isEditMode && editData ? (
                            <td className="w-[9rem] min-w-[9rem] px-1.5 py-1.5 align-middle">
                              <input
                                type="text"
                                value={editData.notes ?? ""}
                                onChange={(e) => handleEditChange(entry.logId, "notes", e.target.value || null)}
                                placeholder="Add notes..."
                                className="w-full min-w-[100px] bg-ink-deep border border-jade-glow/30 rounded px-2 py-1 text-cloud-white text-xs placeholder:text-mist-dark outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.4)]"
                              />
                            </td>
                          ) : (
                            <td
                              className={`${effectiveCompact ? "px-1 py-1" : "px-1.5 py-1.5"} w-[9rem] min-w-[9rem] text-mist-light text-xs whitespace-nowrap align-middle`}
                              title={entry.notes || ""}
                            >
                              {entry.notes || "—"}
                              {entry.completed && <span className="text-jade-glow ml-1">✦</span>}
                            </td>
                          )
                        )}
                        {showStandardWeight && (() => {
                          const stdKg = getNextTierStandardWeightKg(
                            ex,
                            [entry.origWeight1, entry.origWeight2, entry.origWeight3],
                            physique.bodyWeightKg,
                            activeBand,
                            activeModifierKg,
                          );
                          const stdDisplay = stdKg != null ? (weightUnit === "lbs" ? kgToLbs(stdKg) : Math.round(stdKg * 10) / 10) : null;
                          return (
                            <td
                              className={`${effectiveCompact ? "px-0.5 py-1" : "px-1 py-1.5"} w-[4rem] min-w-[4rem] text-center text-emerald-400 text-xs tabular-nums align-middle`}
                              title={stdDisplay != null ? `Next tier target: ${stdDisplay} ${weightUnit}` : "At max tier"}
                            >
                              {stdDisplay != null ? stdDisplay.toFixed(1) : "✦"}
                            </td>
                          );
                        })()}
                        {showAvgWeight && (() => {
                          const avgKg = getEntryAvgWeight(entry);
                          const avgDisplay = avgKg != null ? (weightUnit === "lbs" ? kgToLbs(avgKg) : Math.round(avgKg * 10) / 10) : null;
                          return (
                            <td
                              className={`${effectiveCompact ? "px-0.5 py-1" : "px-1 py-1.5"} w-[4rem] min-w-[4rem] text-center text-cyan-400 text-xs tabular-nums align-middle`}
                              title={avgDisplay != null ? `Avg: ${avgDisplay} ${weightUnit}` : "No weight data"}
                            >
                              {avgDisplay != null ? avgDisplay.toFixed(1) : "—"}
                            </td>
                          );
                        })()}
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

      {/* Delete Confirmation Modal — portalled */}
      {typeof document !== "undefined" &&
        createPortal(
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
                    <span className="text-cloud-white font-medium">{deleteConfirm.exerciseName}</span>? This action
                    cannot be undone.
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
          </AnimatePresence>,
          document.body,
        )}

      {/* Level Picker Modal — portalled */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {levelPicker &&
              (() => {
                const ex = exerciseLookup.get(levelPicker.exerciseId);
                if (!ex) return null;
                const tiers = [...ex.tiers].sort((a, b) => a.level - b.level);
                const current =
                  editingData[levelPicker.logId]?.level ?? entries.find((e) => e.logId === levelPicker.logId)?.level ?? 1;

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
                      <p className="text-[11px] text-mist-light mb-3">
                        {stripBwPercentHint(getExerciseDisplayName(ex, settings.terminologyMode))}
                      </p>
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
                              <span className="text-[11px] font-semibold">
                                Lv.{t.level} - {stripBwPercentHint(getExerciseDisplayName(t, settings.terminologyMode))}
                              </span>
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
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

const MemoUnifiedTrainingLogTable = memo(UnifiedTrainingLogTable);
export { UnifiedTrainingLogTable, MemoUnifiedTrainingLogTable };
export type { UnifiedFlatLogEntry };
