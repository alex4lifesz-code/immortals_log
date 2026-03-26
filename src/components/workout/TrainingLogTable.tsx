"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, startTransition, memo } from "react";
import { createPortal } from "react-dom";
import GlowButton from "@/components/ui/GlowButton";
import { useDisplaySettings, DEFAULT_UNIFIED_VISIBLE_COLUMNS, DISPLAY_DEFAULTS } from "@/context/DisplaySettingsContext";
import { useAppContext } from "@/context/AppContext";
import { getTypeColor, formatDateWithPreference } from "@/lib/constants";
import { api, ApiRequestError } from "@/lib/api-client";
import { getExerciseDisplayName, getTypeDisplayName, getTypeColorKey } from "@/lib/exercise-name";
import { inferExerciseType, formatSetValue, formatSetReps, getColumnHeaders, kgToLbs, type ExerciseType } from "@/lib/unit-conversion";
import { UserPhysiqueSettings } from "@/lib/user-physique";

// Types — single source of truth
import type {
  ProgressionExercise,
  ProgressionLog,
  LogTableFilter,
} from "@/app/dashboard/workout/types";
export type { ProgressionExercise, ProgressionLog, LogTableFilter };

// Utilities — imported from shared workout utils
import {
  formatResistanceBandLabel,
  formatModifierWeightLabel,
  parseModifierWithBand,
  buildModifierWithBand,
  stripBwPercentHint,
  isGymCategoryExercise,
  getExerciseCategoryLabel,
  getBandSoftDimOpacity,
  getBandAdjustedGlowStyle,
  getEffectiveWeight,
  getTierName,
  RESISTANCE_BAND_OPTIONS,
  MODIFIER_WEIGHT_OPTIONS,
} from "@/app/dashboard/workout/utils";

// ── UTLT-specific helpers ──

function parseModifierDisplayToKg(modifier: string | null | undefined): number | null {
  if (!modifier) return null;
  const match = modifier.match(/\+\s*([\d.]+)\s*kg/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function abbreviateVariantText(text: string): string {
  const words = text.trim().split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length >= 2) return words.slice(0, 4).map((w) => w[0].toUpperCase()).join("");
  const compact = words[0] ?? text.trim();
  return compact.slice(0, 6).toUpperCase();
}

const ROW_GLOW_COLOR = "var(--exercise-glow)";

function getTierFromEntryWeights(
  exercise: ProgressionExercise | undefined,
  level: number,
): { glowColor: string; tierName: string } {
  return {
    glowColor: ROW_GLOW_COLOR,
    tierName: stripBwPercentHint(exercise ? getTierName(exercise, level) : `Level ${level}`),
  };
}

function getNextTierStandardWeightKg(
  exercise: ProgressionExercise | undefined,
  currentWeights: (number | null)[],
  userBodyweightKg: number | null,
  bandKg?: number | null,
  modifierWeightKg?: number | null,
): number | null {
  void exercise;
  void currentWeights;
  void userBodyweightKg;
  void bandKg;
  void modifierWeightKg;
  return null;
}

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

// ── The Unified Training Log Table ──

function TrainingLogTable({
  exercises,
  physique,
  selectedLogFilter,
  onSelectExercise,
  onRefresh,
}: {
  exercises: ProgressionExercise[];
  physique: UserPhysiqueSettings;
  selectedLogFilter: LogTableFilter | null;
  onSelectExercise: (filter: LogTableFilter | null) => void;
  onRefresh: () => void;
  userId: string;
}) {
  const allEntries = useMemo(() => flattenLogsUnified(exercises), [exercises]);
  const exerciseLookup = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises]);

  const isSelectedGymExercise = selectedLogFilter
    ? (() => {
        const selectedExercise = exerciseLookup.get(selectedLogFilter.exerciseId);
        return selectedExercise ? isGymCategoryExercise(selectedExercise) : false;
      })()
    : false;

  const entries = useMemo(
    () =>
      allEntries.filter(
        (entry) =>
          !selectedLogFilter ||
          (entry.exerciseId === selectedLogFilter.exerciseId &&
            (isSelectedGymExercise || entry.levelNameLevel === selectedLogFilter.levelNameLevel))
      ),
    [allEntries, selectedLogFilter, isSelectedGymExercise]
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

  const logMode = DISPLAY_DEFAULTS.progressionLogMode;
  const compactSetting = DISPLAY_DEFAULTS.progressionLogCompact;
  const glowIntensity = DISPLAY_DEFAULTS.glowIntensityProgressionLog;
  const columnColors = DISPLAY_DEFAULTS.progressionColumnColorsEnabled;
  const columnGrouped = DISPLAY_DEFAULTS.progressionColumnOrderGrouped;
  const variationDisplay = settings.progressionVariationDisplay ?? "abbreviation";
  const dateFormat = settings.dateFormat || "dd-mmm-yyyy";
  const weightUnit = settings.defaultWeightUnit ?? "kg";
  const visibleColumnKeys = DEFAULT_UNIFIED_VISIBLE_COLUMNS;
  const visibleColumnSet = useMemo(() => new Set(visibleColumnKeys), [visibleColumnKeys]);
  const showDate = visibleColumnSet.has("date");
  const showCategory = visibleColumnSet.has("category");
  const showModifier = visibleColumnSet.has("modifier");
  const showBand = visibleColumnSet.has("band");
  const showVariant = visibleColumnSet.has("variant");
  const showNotes = visibleColumnSet.has("notes");
  const showStandardWeight = false;
  const showAvgWeight = visibleColumnSet.has("avgWeight");

  const useMobileTableStyling = isMobile;
  const effectiveCompact = compactSetting === "compact" || (compactSetting === "auto" && useMobileTableStyling);

  const showIllumination = logMode !== "name-only";
  const showRealm = logMode === "name-illumination-realm" || logMode === "name-illumination-realm-path";
  const showPath = logMode === "name-illumination-realm-path";

  const shouldRenderModifierColumn = showModifier;
  const anyBand = useMemo(
    () => entries.some((entry) => entry.resistanceBandKg != null),
    [entries]
  );
  const shouldRenderVariantColumn = showVariant;
  const reduceColumnsForSmallScreens = useMobileTableStyling && !isEditMode;
  const showVariantColumnResponsive = shouldRenderVariantColumn && !reduceColumnsForSmallScreens;
  const showNotesResponsive = showNotes && !reduceColumnsForSmallScreens;
  const showStandardWeightResponsive = showStandardWeight && !reduceColumnsForSmallScreens;
  const showAvgWeightResponsive = showAvgWeight && !reduceColumnsForSmallScreens;

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

  const tableMinWidth = useMemo(() => {
    const renderedColumnCount =
      (showDate ? 1 : 0) +
      (showCategory ? 1 : 0) +
      1 +
      visibleDataIndices.length +
      (shouldRenderModifierColumn ? 1 : 0) +
      (anyBand && showBand ? 1 : 0) +
      (showVariantColumnResponsive ? 1 : 0) +
      (showNotesResponsive ? 1 : 0) +
      (showStandardWeightResponsive ? 1 : 0) +
      (showAvgWeightResponsive ? 1 : 0) +
      (isEditMode ? 1 : 0);

    const base = renderedColumnCount * (effectiveCompact ? 62 : 74);
    return `${Math.max(base, effectiveCompact ? 360 : 560)}px`;
  }, [
    anyBand,
    effectiveCompact,
    isEditMode,
    showAvgWeightResponsive,
    showBand,
    showCategory,
    showDate,
    showNotesResponsive,
    showStandardWeightResponsive,
    showVariantColumnResponsive,
    shouldRenderModifierColumn,
    visibleDataIndices.length,
  ]);

  const getZeroValueStyle = (value: number | null, colType: string, exType: ExerciseType): React.CSSProperties | undefined => {
    if (value === 0) return { backgroundColor: "var(--ink-mid)", color: "var(--mist-dark)" };
    if (columnColors && colType === "value") {
      if (exType === "timed") return { backgroundColor: "var(--timed-cell-bg)" };
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
      await api.post<{ error?: string }>("/api/progressions/logs/update", { updates });
      setSaveMessage({ type: "success", text: "Training logs updated successfully!" });
      setIsEditMode(false);
      setEditingData({});
      onRefresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setSaveMessage({ type: "error", text: err.message || "Failed to save changes" });
      } else {
        setSaveMessage({ type: "error", text: "Network error — unable to save changes" });
      }
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
      await api.post("/api/progressions/logs/delete", { logId });
      setSaveMessage({ type: "success", text: "Log record deleted successfully" });
      setDeleteConfirm(null);
      onRefresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setSaveMessage({ type: "error", text: err.message || "Failed to delete record" });
      } else {
        setSaveMessage({ type: "error", text: "Network error — unable to delete record" });
      }
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
    (showVariantColumnResponsive ? 1 : 0) +
    (showNotesResponsive ? 1 : 0) +
    (showStandardWeightResponsive ? 1 : 0) +
    (showAvgWeightResponsive ? 1 : 0) +
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

  const headerTypographyClass = "font-semibold text-[10px] sm:text-[11px] normal-case sm:uppercase tracking-normal sm:tracking-wide";
  const headerPadClass = effectiveCompact ? "py-1.5" : "py-2.5";

  return (
    <>
      <div className="w-full">
        <div
          className="w-full rounded-xl border border-jade-glow/25 backdrop-blur-sm shadow-[var(--shadow-elev-1)] relative overflow-hidden"
          style={{ background: "var(--surface-gradient-strong)" }}
        >
          <div className="relative">
          {/* Edit header bar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-jade-glow/20">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-cloud-white">Training Log</span>
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
                {entries.length > 0 && isEditMode ? (
                  <>
                    <GlowButton variant="jade" size="sm" onClick={handleSaveChanges} disabled={isSaving}>
                      {isSaving ? "Saving..." : "✓ Save"}
                    </GlowButton>
                    <GlowButton variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
                      ✕ Cancel
                    </GlowButton>
                  </>
                ) : entries.length > 0 ? (
                  <button
                    onClick={handleEditModeToggle}
                    className="text-xs px-3 py-1 rounded border border-jade-glow/40 text-jade-light hover:bg-jade-deep/10 hover:scale-105 active:scale-95 transition-all duration-100"
                  >
                    ✎ Edit
                  </button>
                ) : (
                  <span className="text-[11px] text-mist-dark">No logs yet</span>
                )}
              </div>
            </div>

          <div
            className={`overflow-x-auto w-full ${useMobileTableStyling ? "scrollbar-hide" : ""}`}
            style={{ WebkitOverflowScrolling: "touch" }}
          >
          <table
            className="text-xs border-collapse w-full"
            style={{ whiteSpace: "nowrap", minWidth: tableMinWidth }}
          >
            <thead
              className={useMobileTableStyling ? "sticky top-0 z-10" : ""}
              style={useMobileTableStyling ? { background: "var(--surface-gradient-strong)" } : undefined}
            >
              <tr className="border-b border-jade-glow/30 text-mist-dark">
                {showDate && (
                  <th className={`${headerPadClass} px-1 sm:px-1.5 w-[6rem] min-w-[6rem] text-center ${headerTypographyClass}`}>
                    Date
                  </th>
                )}
                {showCategory && (
                  <th className={`${headerPadClass} px-0.5 sm:px-1 w-[5rem] min-w-[5rem] text-center ${headerTypographyClass}`}>
                    Category
                  </th>
                )}
                <th className={`${headerPadClass} px-1 sm:px-1.5 text-left ${headerTypographyClass}`}>
                  Exercise
                </th>
                {visibleDataIndices.map(({ idx }) => (
                  <th
                    key={headerLabels[idx] + idx}
                    className={`${headerPadClass} px-0.5 sm:px-1 w-[3.25rem] min-w-[3.25rem] text-center tabular-nums ${headerTypographyClass}`}
                    style={columnColors ? { color: headerTypes[idx] === "value" ? "var(--col-weight)" : "var(--col-reps)" } : undefined}
                  >
                    {headerLabels[idx]}
                  </th>
                ))}
                {shouldRenderModifierColumn && (
                  <th className={`${headerPadClass} px-0.5 sm:px-1 w-[4.5rem] min-w-[4.5rem] text-center ${headerTypographyClass} text-gold`}>
                    Mod
                  </th>
                )}
                {anyBand && showBand && (
                  <th className={`${headerPadClass} px-0.5 sm:px-1 w-[5rem] min-w-[5rem] text-center ${headerTypographyClass} text-mountain-blue-glow`}>
                    Band
                  </th>
                )}
                {showVariantColumnResponsive && (
                  <th className={`${headerPadClass} px-0.5 sm:px-1 w-[6.5rem] min-w-[6.5rem] text-center ${headerTypographyClass} text-mountain-blue-glow`}>
                    Variant
                  </th>
                )}
                {showNotesResponsive && (
                  <th className={`${headerPadClass} px-1 sm:px-1.5 w-[9rem] min-w-[9rem] text-center ${headerTypographyClass}`}>
                    Notes
                  </th>
                )}
                {showStandardWeightResponsive && (
                  <th className={`${headerPadClass} px-0.5 sm:px-1 w-[4rem] min-w-[4rem] text-center ${headerTypographyClass} text-difficulty-green`}>
                    Next
                  </th>
                )}
                {showAvgWeightResponsive && (
                  <th className={`${headerPadClass} px-0.5 sm:px-1 w-[4rem] min-w-[4rem] text-center ${headerTypographyClass} text-difficulty-cyan`}>
                    Avg
                  </th>
                )}
                {isEditMode && (
                  <th className={`${headerPadClass} px-1 text-center ${headerTypographyClass} text-mist-glow align-middle`}>⋮</th>
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
                <>
                  {entries.map((entry) => {
                    const ex = exerciseLookup.get(entry.exerciseId);
                    const editData = editingData[entry.logId];
                    const activeBand = isEditMode && editData ? editData.resistanceBandKg : entry.resistanceBandKg;
                    const activeModifierKg = isEditMode && editData
                      ? parseModifierDisplayToKg(editData.modifier)
                      : entry.modifierWeightKg;
                    const rowTierInfo = getTierFromEntryWeights(ex, entry.levelNameLevel);
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
                      <tr
                        key={entry.logId}
                        className={`border-b ${
                          isEditMode
                            ? "border-jade-glow/15 bg-jade-deep/5"
                            : "border-ink-light/50"
                        }`}
                      >
                        {showDate && (
                          <td className={`${effectiveCompact ? "px-1 py-1" : "px-1 py-1.5"} w-[6rem] min-w-[6rem] text-center text-mist-light text-xs align-middle whitespace-nowrap`}>
                            {formatDate(entry.date, dateFormat)}
                          </td>
                        )}
                        {showCategory && (
                          <td className={`${effectiveCompact ? "px-0.5 py-1" : "px-0.5 py-1.5"} w-[5rem] min-w-[5rem] text-center align-middle`}>
                            <span
                              className={`text-[10px] font-semibold ${
                                getExerciseCategoryLabel(ex) === "GYM"
                                  ? "text-gold"
                                  : getExerciseCategoryLabel(ex) === "Yoga"
                                    ? "text-mountain-blue-glow"
                                    : getExerciseCategoryLabel(ex) === "Cardio"
                                      ? "text-crimson-light"
                                      : "text-jade-light"
                              }`}
                            >
                              {getExerciseCategoryLabel(ex)}
                            </span>
                          </td>
                        )}
                        <td
                          className={`${effectiveCompact ? "px-1 py-1" : "px-1.5 py-1.5"} align-middle whitespace-nowrap cursor-pointer ${isEditMode ? "ring-1 ring-jade-glow/20" : ""}`}
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
                            <span className="text-xs text-cloud-white hover:bg-jade-deep/20 transition-colors duration-100 px-1 py-0.5 rounded" style={softDimStyle} title={entryDisplayName}>
                              {entryDisplayName}
                            </span>
                          ) : (
                            <div
                              className="px-2 py-1 rounded-md border inline-flex items-center gap-1.5 hover:bg-jade-deep/20 transition-colors duration-100"
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
                              <td key={headerLabels[idx] + idx} className="w-[3.25rem] min-w-[3.25rem] px-1 py-1.5 text-center align-middle overflow-hidden [contain:paint]">
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
                                  className="w-full min-w-[52px] bg-ink-deep border border-jade-glow/30 rounded px-1 py-1 text-cloud-white text-center text-xs outline-none transition-all duration-200 hover:border-jade-glow/50 hover:bg-ink-dark/60 focus:border-jade-glow focus:shadow-[var(--glow-subtle)]"
                                />
                              </td>
                            );
                          }

                          const rawValue = getRawCellValue(entry, colType, fieldIndex);
                          const displayText = renderCellValue(entry, colType, fieldIndex);
                          const valueColor = isTimedEntry && colType === "value" ? "var(--timed-color)" : undefined;

                          return (
                            <td
                              key={headerLabels[idx] + idx}
                              className={`${effectiveCompact ? "px-0.5 py-1" : "px-1 py-1.5"} w-[3.25rem] min-w-[3.25rem] text-center text-xs leading-tight align-middle whitespace-nowrap overflow-hidden [contain:paint] ${!valueColor ? "text-cloud-white" : ""}`}
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
                                className="w-full min-w-[70px] bg-ink-deep border border-jade-glow/30 rounded px-1 py-1 text-gold text-center text-xs outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[var(--glow-subtle)]"
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
                              className={`${effectiveCompact ? "px-0.5 py-1" : "px-1 py-1.5"} w-[4.5rem] min-w-[4.5rem] text-center text-gold text-xs whitespace-nowrap align-middle`}
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
                                className="w-full min-w-[70px] bg-ink-deep border border-jade-glow/30 rounded px-1 py-1 text-mountain-blue-glow text-center text-xs outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[var(--glow-subtle)]"
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
                              className={`${effectiveCompact ? "px-0.5 py-1" : "px-1 py-1.5"} w-[5rem] min-w-[5rem] text-center text-mountain-blue-glow text-xs whitespace-nowrap align-middle`}
                            >
                              {entry.resistanceBandKg != null ? formatResistanceBandLabel(entry.resistanceBandKg) : "—"}
                            </td>
                          )
                        )}
                        {showVariantColumnResponsive && (
                          isEditMode && editData ? (
                            <td className="w-[6.5rem] min-w-[6.5rem] px-1 py-1.5 text-center align-middle">
                              <select
                                value={editData.variant ?? ""}
                                onChange={(e) => handleEditChange(entry.logId, "variant", e.target.value || null)}
                                className="w-full min-w-[70px] bg-ink-deep border border-jade-glow/30 rounded px-1 py-1 text-mountain-blue-glow text-center text-xs outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[var(--glow-subtle)]"
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
                              className={`${effectiveCompact ? "px-0.5 py-1" : "px-1 py-1.5"} w-[6.5rem] min-w-[6.5rem] text-center text-mountain-blue-glow text-xs whitespace-nowrap align-middle`}
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
                        {showNotesResponsive && (
                          isEditMode && editData ? (
                            <td className="w-[9rem] min-w-[9rem] px-1.5 py-1.5 align-middle">
                              <input
                                type="text"
                                value={editData.notes ?? ""}
                                onChange={(e) => handleEditChange(entry.logId, "notes", e.target.value || null)}
                                placeholder="Add notes..."
                                className="w-full min-w-[100px] bg-ink-deep border border-jade-glow/30 rounded px-2 py-1 text-cloud-white text-xs placeholder:text-mist-dark outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[var(--glow-subtle)]"
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
                        {showStandardWeightResponsive && (() => {
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
                              className={`${effectiveCompact ? "px-0.5 py-1" : "px-1 py-1.5"} w-[4rem] min-w-[4rem] text-center text-difficulty-green text-xs tabular-nums align-middle`}
                              title={stdDisplay != null ? `Next tier target: ${stdDisplay} ${weightUnit}` : "At max tier"}
                            >
                              {stdDisplay != null ? stdDisplay.toFixed(1) : "✦"}
                            </td>
                          );
                        })()}
                        {showAvgWeightResponsive && (() => {
                          const avgKg = getEntryAvgWeight(entry);
                          const avgDisplay = avgKg != null ? (weightUnit === "lbs" ? kgToLbs(avgKg) : Math.round(avgKg * 10) / 10) : null;
                          return (
                            <td
                              className={`${effectiveCompact ? "px-0.5 py-1" : "px-1 py-1.5"} w-[4rem] min-w-[4rem] text-center text-difficulty-cyan text-xs tabular-nums align-middle`}
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
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>
          </table>
          </div>
          </div>
        </div>
      </div>

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
                  style={{ boxShadow: "var(--danger-modal-glow)" }}
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

const MemoTrainingLogTable = memo(TrainingLogTable);
export { TrainingLogTable, MemoTrainingLogTable };
export type { UnifiedFlatLogEntry };
