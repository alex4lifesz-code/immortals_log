"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, startTransition, memo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import GlowButton from "@/components/ui/GlowButton";
import { useDisplaySettings, DEFAULT_UNIFIED_VISIBLE_COLUMNS, DISPLAY_DEFAULTS } from "@/context/DisplaySettingsContext";
import { useIsMobile } from "@/context/AppContext";
import { formatDateWithPreference } from "@/lib/constants";
import { api, ApiRequestError } from "@/lib/api-client";
import { getExerciseDisplayName } from "@/lib/exercise-name";
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
  parseModifierWithBand,
  stripBwPercentHint,
  getExerciseCategoryLabel,
  getEffectiveWeight,
  getTierName,
  MODIFIER_WEIGHT_OPTIONS,
} from "@/app/dashboard/workout/utils";

// ── UTLT-specific helpers ──

function parseModifierDisplayToSignedKg(modifier: string | null | undefined): number | null {
  if (!modifier) return null;
  const match = modifier.match(/([+-])\s*([\d.]+)\s*kg/i);
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  const parsed = Number(match[2]);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return sign * parsed;
}

function formatSignedModifierKg(value: number): string {
  const normalized = Math.round(value * 10) / 10;
  return `${normalized >= 0 ? "+" : "-"}${Math.abs(normalized)}kg`;
}

function abbreviateVariantText(text: string): string {
  const words = text.trim().split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, 2)
      .map((w) => `${w[0].toUpperCase()}${w.slice(1, 3).toLowerCase()}`)
      .join(" ");
  }
  const compact = words[0] ?? text.trim();
  if (!compact) return "";
  return `${compact.slice(0, 1).toUpperCase()}${compact.slice(1, 6).toLowerCase()}`;
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

interface ExerciseHistoryEntry {
  id: string;
  date: string;
  level?: number;
  weight1: number | null;
  reps1: number | null;
  weight2: number | null;
  reps2: number | null;
  weight3: number | null;
  reps3: number | null;
  holdTime: number | null;
  modifier: string | null;
  variant: string | null;
  notes: string | null;
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
        modifier: (() => {
          const netModifierKg = (parsed.modifierWeightKg ?? 0) - (parsed.resistanceBandKg ?? 0);
          if (netModifierKg !== 0) return formatSignedModifierKg(netModifierKg);
          return parsed.baseModifier;
        })(),
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

function formatSimpleSet(entry: UnifiedFlatLogEntry, index: 0 | 1 | 2, weightUnit: "kg" | "lbs"): string {
  const value = index === 0 ? entry.val1 : index === 1 ? entry.val2 : entry.val3;
  const reps = index === 0 ? entry.reps1 : index === 1 ? entry.reps2 : entry.reps3;
  if (value == null && reps == null) return "-";
  const valueDisplay = formatSetValue(value, entry.exerciseType, weightUnit);
  const repsDisplay = formatSetReps(reps, entry.exerciseType);
  if (entry.exerciseType === "timed") return valueDisplay;
  if (reps == null) return valueDisplay;
  if (value == null) return `x ${repsDisplay}`;
  return `${valueDisplay} x ${repsDisplay}`;
}

const TrainingLogMobileCard = memo(function TrainingLogMobileCard({
  entry,
  entryDisplayName,
  typeLabel,
  formattedEntryDate,
  variationDisplay,
  weightUnit,
}: {
  entry: UnifiedFlatLogEntry;
  entryDisplayName: string;
  typeLabel: string;
  formattedEntryDate: string;
  variationDisplay: string;
  weightUnit: "kg" | "lbs";
}) {
  return (
    <div
      className="w-full rounded-lg border px-3 py-2.5 text-left"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-hover)", color: "var(--text-primary)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{entryDisplayName}</p>
          <p className="mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>{formattedEntryDate}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="rounded-md border px-1.5 py-0.5 text-[10px]" style={{ borderColor: "var(--accent)", backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}>
            Lv {entry.levelNameLevel}
          </span>
          <span className="rounded-md border px-1.5 py-0.5 text-[10px]" style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in srgb, var(--border) 20%, transparent)", color: "var(--text-secondary)" }}>
            {typeLabel}
          </span>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1">
        <div className="rounded-md border px-2 py-1 text-center" style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in srgb, var(--border) 15%, transparent)" }}>
          <p className="text-[9px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Set 1</p>
          <p className="text-[10px]" style={{ color: "var(--text-primary)" }}>{formatSimpleSet(entry, 0, weightUnit)}</p>
        </div>
        <div className="rounded-md border px-2 py-1 text-center" style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in srgb, var(--border) 15%, transparent)" }}>
          <p className="text-[9px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Set 2</p>
          <p className="text-[10px]" style={{ color: "var(--text-primary)" }}>{formatSimpleSet(entry, 1, weightUnit)}</p>
        </div>
        <div className="rounded-md border px-2 py-1 text-center" style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in srgb, var(--border) 15%, transparent)" }}>
          <p className="text-[9px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Set 3</p>
          <p className="text-[10px]" style={{ color: "var(--text-primary)" }}>{formatSimpleSet(entry, 2, weightUnit)}</p>
        </div>
      </div>

      {(entry.modifier || entry.variant || entry.notes) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {entry.modifier && (
            <span className="rounded border px-1.5 py-0.5 text-[10px]" style={{ borderColor: "var(--gold)", backgroundColor: "color-mix(in srgb, var(--gold) 12%, transparent)", color: "var(--gold)" }}>
              {entry.modifier}
            </span>
          )}
          {entry.variant && (
            <span className="rounded border px-1.5 py-0.5 text-[10px]" style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in srgb, var(--border) 15%, transparent)", color: "var(--text-secondary)" }}>
              {variationDisplay === "full" ? entry.variant : abbreviateVariantText(entry.variant)}
            </span>
          )}
        </div>
      )}

      {entry.notes && (
        <p className="mt-2 line-clamp-2 text-[10px]" style={{ color: "var(--text-secondary)" }}>
          {entry.notes}
        </p>
      )}
    </div>
  );
});

type HeaderSortDirection = "asc" | "desc";

interface HeaderSortState {
  columnId: string;
  direction: HeaderSortDirection;
}

const TRAINING_LOG_SORT_STORAGE_KEY_PREFIX = "training-log-table-sort-v1";
const TRAINING_LOG_COLUMN_ORDER_STORAGE_KEY_PREFIX = "training-log-column-order-v1";
const CANONICAL_INPUT_EXERCISE_NAMES = new Set([
  "Muscle up",
  "Pull up",
  "Dip",
  "Push up",
  "Handstand",
  "Handstand push up",
  "Front lever",
  "Back lever",
  "Planche",
  "Dragon flag",
  "L-sit",
  "Human flag",
  "Hang",
  "Support hold",
  "Leg raise",
  "Pistol squat",
  "Squat",
  "Bench press",
  "Chest fly",
  "Row",
  "Lat pulldown",
  "Deadlift",
  "Leg press",
  "Leg extension",
  "Leg curl",
  "Calf raise",
  "Hip abduction",
  "Shoulder press",
  "Lateral raise",
  "Front raise",
  "Upright row",
  "Reverse fly",
  "Face pull",
  "Bicep curl",
  "Forearm curl",
  "Tricep pushdown",
  "Cable kickback",
]);

type InputExerciseSearchResult = {
  exercise: ProgressionExercise;
  displayLabel: string;
  searchLabel: string;
  prefillLevel?: string;
  prefillVariant?: string;
};

function getDefaultWorkoutInput() {
  return {
    date: new Date().toISOString().slice(0, 10),
    exerciseId: "",
    level: "",
    val1: "",
    reps1: "",
    val2: "",
    reps2: "",
    val3: "",
    reps3: "",
    modifierKg: "",
    variant: "",
    notes: "",
  };
}

type WorkoutInputState = ReturnType<typeof getDefaultWorkoutInput>;

function clearWorkoutInputEntryFields(input: WorkoutInputState, exerciseId: string): WorkoutInputState {
  return {
    ...input,
    exerciseId,
    level: "",
    val1: "",
    reps1: "",
    val2: "",
    reps2: "",
    val3: "",
    reps3: "",
    modifierKg: "",
    variant: "",
    notes: "",
  };
}

function readPersistedTableModes(storageKey: string): { fitToScreenMode: boolean | null; simpleView: boolean | null } {
  if (typeof window === "undefined") return { fitToScreenMode: null, simpleView: null };
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { fitToScreenMode: null, simpleView: null };
    const parsed = JSON.parse(raw) as { fitToScreenMode?: boolean; simpleView?: boolean };
    const fitToScreenMode = typeof parsed.fitToScreenMode === "boolean" ? parsed.fitToScreenMode : null;
    const simpleView = typeof parsed.simpleView === "boolean" ? parsed.simpleView : null;
    return { fitToScreenMode, simpleView };
  } catch {
    return { fitToScreenMode: null, simpleView: null };
  }
}

function readPersistedWorkoutInput(storageKey: string): WorkoutInputState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WorkoutInputState>;
    const fallback = getDefaultWorkoutInput();
    return {
      date: typeof parsed.date === "string" && parsed.date ? parsed.date : fallback.date,
      exerciseId: typeof parsed.exerciseId === "string" ? parsed.exerciseId : "",
      level: typeof parsed.level === "string" ? parsed.level : "",
      val1: typeof parsed.val1 === "string" ? parsed.val1 : "",
      reps1: typeof parsed.reps1 === "string" ? parsed.reps1 : "",
      val2: typeof parsed.val2 === "string" ? parsed.val2 : "",
      reps2: typeof parsed.reps2 === "string" ? parsed.reps2 : "",
      val3: typeof parsed.val3 === "string" ? parsed.val3 : "",
      reps3: typeof parsed.reps3 === "string" ? parsed.reps3 : "",
      modifierKg: typeof parsed.modifierKg === "string" ? parsed.modifierKg : "",
      variant: typeof parsed.variant === "string" ? parsed.variant : "",
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
    };
  } catch {
    return null;
  }
}

function readPersistedSortState(storageKey: string): HeaderSortState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HeaderSortState;
    if (!parsed || typeof parsed.columnId !== "string") return null;
    if (parsed.direction !== "asc" && parsed.direction !== "desc") return null;
    return parsed;
  } catch {
    return null;
  }
}

function readPersistedColumnOrder(storageKey: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return null;
  }
}

function parseDataColumnIndex(columnId: string): number | null {
  if (!columnId.startsWith("data-")) return null;
  const parsed = Number(columnId.slice(5));
  return Number.isInteger(parsed) ? parsed : null;
}

// ── The Unified Training Log Table ──

function TrainingLogTable({
  exercises,
  physique,
  onRefresh,
  userId,
  hideInputSection,
  disableExerciseLinks,
  prefillExerciseId,
  prefillExerciseName,
  prefillProgression,
  prefillVariant,
}: {
  exercises: ProgressionExercise[];
  physique: UserPhysiqueSettings;
  onRefresh: () => void;
  userId: string;
  hideInputSection?: boolean;
  disableExerciseLinks?: boolean;
  prefillExerciseId?: string | null;
  prefillExerciseName?: string | null;
  prefillProgression?: string | null;
  prefillVariant?: string | null;
}) {
  const allEntries = useMemo(() => flattenLogsUnified(exercises), [exercises]);
  const exerciseLookup = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises]);
  const { settings } = useDisplaySettings();
  const isMobile = useIsMobile();
  const exerciseMetaById = useMemo(() => {
    const map = new Map<string, { displayName: string; categoryLabel: string; variationOptions: string[] }>();
    for (const exercise of exercises) {
      map.set(exercise.id, {
        displayName: stripBwPercentHint(getExerciseDisplayName(exercise, settings.terminologyMode)),
        categoryLabel: getExerciseCategoryLabel(exercise),
        variationOptions: (exercise.variations ?? []).map((variant) => variant.name).filter(Boolean),
      });
    }
    return map;
  }, [exercises, settings.terminologyMode]);

  const [isEditMode, setIsEditMode] = useState(false);
  const [editingData, setEditingData] = useState<Record<string, {
    val1: number | null; reps1: number | null;
    val2: number | null; reps2: number | null;
    val3: number | null; reps3: number | null;
    exerciseId: string;
    level: number;
    modifier: string | null; variant: string | null; notes: string | null;
    exerciseType: ExerciseType;
  }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ logId: string; exerciseName: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedEditLogId, setSelectedEditLogId] = useState<string | null>(null);
  const [hoveredEditLogId, setHoveredEditLogId] = useState<string | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRafRef = useRef<number | null>(null);
  const tableDragStateRef = useRef<{ active: boolean; startX: number; startScrollLeft: number; pointerId: number | null }>({
    active: false,
    startX: 0,
    startScrollLeft: 0,
    pointerId: null,
  });
  const suppressTableClickRef = useRef(false);
  const [tableScrollTop, setTableScrollTop] = useState(0);
  const [tableViewportHeight, setTableViewportHeight] = useState(560);
  const [openModeVirtualMetrics, setOpenModeVirtualMetrics] = useState({ scrollTop: 0, viewportHeight: 560 });
  const [isTableDragging, setIsTableDragging] = useState(false);
  const resolvedUserId = userId && userId.trim().length > 0 ? userId : "anonymous";
  const tableModeStorageKey = `training-log-table-mode:${resolvedUserId}`;
  const workoutInputStorageKey = `training-log-workout-input:${resolvedUserId}`;
  const sortStorageKey = `${TRAINING_LOG_SORT_STORAGE_KEY_PREFIX}:${resolvedUserId}`;
  const columnOrderStorageKey = `${TRAINING_LOG_COLUMN_ORDER_STORAGE_KEY_PREFIX}:${resolvedUserId}`;
  const [workoutInput, setWorkoutInput] = useState<WorkoutInputState>(() => {
    const persisted = readPersistedWorkoutInput(workoutInputStorageKey);
    return persisted ?? getDefaultWorkoutInput();
  });
  const [fitToScreenMode, setFitToScreenMode] = useState<boolean>(() => {
    const persisted = readPersistedTableModes(tableModeStorageKey);
    return persisted.fitToScreenMode ?? true;
  });
  const [isSimpleView, setIsSimpleView] = useState<boolean>(() => {
    const persisted = readPersistedTableModes(tableModeStorageKey);
    return persisted.simpleView ?? false;
  });
  const [loadedTableModeKey, setLoadedTableModeKey] = useState<string>(tableModeStorageKey);
  const [loadedWorkoutInputKey, setLoadedWorkoutInputKey] = useState<string>(workoutInputStorageKey);
  const [loadedSortStorageKey, setLoadedSortStorageKey] = useState<string>(sortStorageKey);
  const [loadedColumnOrderStorageKey, setLoadedColumnOrderStorageKey] = useState<string>(columnOrderStorageKey);
  const [historyDockOpen, setHistoryDockOpen] = useState(false);
  const [historyDockExpanded, setHistoryDockExpanded] = useState(false);
  const [historyData, setHistoryData] = useState<ExerciseHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const historyDockRef = useRef<HTMLDivElement | null>(null);
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState("");
  const [exerciseDropdownOpen, setExerciseDropdownOpen] = useState(false);
  const [exerciseHighlightIndex, setExerciseHighlightIndex] = useState(-1);
  const exerciseSearchWrapRef = useRef<HTMLDivElement | null>(null);
  const exerciseInputRef = useRef<HTMLInputElement | null>(null);
  const exerciseDropdownListRef = useRef<HTMLDivElement | null>(null);
  const [exerciseDropdownRect, setExerciseDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const appliedPrefillRef = useRef<string | null>(null);

  useEffect(() => {
    if (isEditMode) {
      setIsSimpleView(false);
    }
  }, [isEditMode]);

  useEffect(() => {
    if (loadedTableModeKey === tableModeStorageKey) return;
    const persisted = readPersistedTableModes(tableModeStorageKey);
    setFitToScreenMode(persisted.fitToScreenMode ?? true);
    setIsSimpleView(persisted.simpleView ?? false);
    setLoadedTableModeKey(tableModeStorageKey);
  }, [loadedTableModeKey, tableModeStorageKey]);

  useEffect(() => {
    if (loadedWorkoutInputKey === workoutInputStorageKey) return;
    const persisted = readPersistedWorkoutInput(workoutInputStorageKey);
    setWorkoutInput(persisted ?? getDefaultWorkoutInput());
    setLoadedWorkoutInputKey(workoutInputStorageKey);
  }, [loadedWorkoutInputKey, workoutInputStorageKey]);

  useEffect(() => {
    if (loadedTableModeKey !== tableModeStorageKey) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(tableModeStorageKey, JSON.stringify({ fitToScreenMode, simpleView: isSimpleView }));
    } catch {
      // Ignore storage write errors.
    }
  }, [fitToScreenMode, isSimpleView, loadedTableModeKey, tableModeStorageKey]);

  useEffect(() => {
    if (loadedWorkoutInputKey !== workoutInputStorageKey) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(workoutInputStorageKey, JSON.stringify(workoutInput));
    } catch {
      // Ignore storage write errors.
    }
  }, [loadedWorkoutInputKey, workoutInput, workoutInputStorageKey]);

  useEffect(() => {
    return () => {
      if (tableScrollRafRef.current != null) {
        window.cancelAnimationFrame(tableScrollRafRef.current);
      }
    };
  }, []);

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
  const showProgression = visibleColumnSet.has("progression") && !isSimpleView;
  const showModifier = visibleColumnSet.has("modifier");
  const showBand = false;
  const showVariant = visibleColumnSet.has("variant") && !isSimpleView;
  const showNotes = visibleColumnSet.has("notes");
  const showStandardWeight = false;
  const showAvgWeight = visibleColumnSet.has("avgWeight");
  const showLevelColumn = !isSimpleView;
  const showActionsColumn = isEditMode;

  const useMobileTableStyling = isMobile;
  const effectiveCompact = compactSetting === "compact" || (compactSetting === "auto" && useMobileTableStyling);

  void logMode;

  const shouldRenderModifierColumn = showModifier;
  const anyBand = false;
  const shouldRenderVariantColumn = showVariant;
  const reduceColumnsForSmallScreens = useMobileTableStyling && !isEditMode;
  const showVariantColumnResponsive = shouldRenderVariantColumn && !reduceColumnsForSmallScreens;
  const showNotesResponsive = showNotes && !reduceColumnsForSmallScreens;
  const showStandardWeightResponsive = showStandardWeight && !reduceColumnsForSmallScreens;
  const showAvgWeightResponsive = showAvgWeight && !reduceColumnsForSmallScreens;

  const VIRTUAL_ROW_HEIGHT = effectiveCompact ? 36 : 44;
  const VIRTUAL_OVERSCAN = 10;

  useEffect(() => {
    const syncViewportHeight = () => {
      const el = tableScrollRef.current;
      if (!el) return;

      // Keep the table body inside the viewport so the card bottom remains visible.
      const rect = el.getBoundingClientRect();
      const bottomGap = isMobile ? 10 : 14;
      const minHeight = isMobile ? 220 : 260;
      const available = Math.floor(window.innerHeight - rect.top - bottomGap);
      setTableViewportHeight(Math.max(minHeight, available));
    };

    syncViewportHeight();
    window.addEventListener("resize", syncViewportHeight);
    window.addEventListener("scroll", syncViewportHeight, { passive: true });
    return () => {
      window.removeEventListener("resize", syncViewportHeight);
      window.removeEventListener("scroll", syncViewportHeight);
    };
  }, [isMobile, allEntries.length]);

  useEffect(() => {
    if (!isEditMode || !selectedEditLogId) return;

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const selectedRowSelector = `tr[data-log-row='true'][data-log-id='${selectedEditLogId}']`;
      if (!target.closest(selectedRowSelector)) {
        revertRowEdits(selectedEditLogId);
        setSelectedEditLogId(null);
        setHoveredEditLogId(null);
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => document.removeEventListener("mousedown", handleDocumentMouseDown);
  }, [isEditMode, selectedEditLogId]);

  // Determine column headers based on exercise types visible in the dataset
  const entryExerciseTypes = useMemo(() => allEntries.map((e) => e.exerciseType), [allEntries]);
  const { labels: headerLabels, types: headerTypes, keys: headerKeys } = useMemo(
    () => getColumnHeaders(entryExerciseTypes, columnGrouped),
    [entryExerciseTypes, columnGrouped],
  );

  // Filter data columns by visibility
  const visibleDataIndices = useMemo(() => {
    return headerKeys
      .map((key, idx) => ({ key, idx }))
      .filter(({ key }) => visibleColumnSet.has(key as import("@/context/DisplaySettingsContext").UnifiedVisibleColumnKey));
  }, [headerKeys, visibleColumnSet]);

  const defaultColumnOrder = useMemo(() => {
    const cols: string[] = [];
    if (showDate) cols.push("date");
    if (showCategory) cols.push("category");
    cols.push("exercise");
    if (showProgression) cols.push("progression");
    if (showVariantColumnResponsive) cols.push("variant");
    if (showLevelColumn) cols.push("level");

    // Insert data columns and place modifier after reps3
    let modifierInserted = false;
    visibleDataIndices.forEach(({ key, idx }, i) => {
      cols.push(`data-${idx}`);
      if (key === "reps3" && shouldRenderModifierColumn) {
        cols.push("modifier");
        modifierInserted = true;
      }
    });
    // Fallback: if modifier not inserted (e.g. reps3 not present), insert as before
    if (shouldRenderModifierColumn && !modifierInserted) {
      cols.push("modifier");
    }
    if (anyBand && showBand) cols.push("band");
    if (showNotesResponsive) cols.push("notes");
    if (showStandardWeightResponsive) cols.push("next");
    if (showAvgWeightResponsive) cols.push("avg");
    if (showActionsColumn) cols.push("actions");
    return cols;
  }, [
    anyBand,
    showAvgWeightResponsive,
    showBand,
    showCategory,
    showDate,
    showProgression,
    showLevelColumn,
    showNotesResponsive,
    showActionsColumn,
    showStandardWeightResponsive,
    showVariantColumnResponsive,
    shouldRenderModifierColumn,
    visibleDataIndices,
  ]);

  const [columnOrder, setColumnOrder] = useState<string[]>(() => readPersistedColumnOrder(columnOrderStorageKey) ?? []);
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
  const [hoveredHeaderId, setHoveredHeaderId] = useState<string | null>(null);
  const [sortState, setSortState] = useState<HeaderSortState | null>(() => readPersistedSortState(sortStorageKey));

  useEffect(() => {
    if (loadedSortStorageKey === sortStorageKey) return;
    setSortState(readPersistedSortState(sortStorageKey));
    setLoadedSortStorageKey(sortStorageKey);
  }, [loadedSortStorageKey, sortStorageKey]);

  useEffect(() => {
    if (loadedColumnOrderStorageKey === columnOrderStorageKey) return;
    setColumnOrder(readPersistedColumnOrder(columnOrderStorageKey) ?? []);
    setLoadedColumnOrderStorageKey(columnOrderStorageKey);
  }, [columnOrderStorageKey, loadedColumnOrderStorageKey]);

  useEffect(() => {
    if (loadedSortStorageKey !== sortStorageKey || typeof window === "undefined") return;
    try {
      if (!sortState) {
        window.localStorage.removeItem(sortStorageKey);
      } else {
        window.localStorage.setItem(sortStorageKey, JSON.stringify(sortState));
      }
    } catch {
      // Ignore storage write errors.
    }
  }, [loadedSortStorageKey, sortState, sortStorageKey]);

  useEffect(() => {
    if (loadedColumnOrderStorageKey !== columnOrderStorageKey || typeof window === "undefined") return;
    try {
      if (columnOrder.length === 0) {
        window.localStorage.removeItem(columnOrderStorageKey);
      } else {
        window.localStorage.setItem(columnOrderStorageKey, JSON.stringify(columnOrder));
      }
    } catch {
      // Ignore storage write errors.
    }
  }, [columnOrder, columnOrderStorageKey, loadedColumnOrderStorageKey]);

  useEffect(() => {
    setColumnOrder((prev) => {
      if (prev.length === 0) return defaultColumnOrder;
      const next = [...prev];
      defaultColumnOrder.forEach((id) => {
        if (!next.includes(id)) next.push(id);
      });
      return next;
    });
  }, [defaultColumnOrder]);

  const orderedColumnIds = useMemo(() => {
    const sourceOrder = columnOrder.length > 0 ? columnOrder : defaultColumnOrder;
    const visibleSet = new Set(defaultColumnOrder);
    const visibleOrdered = sourceOrder.filter((id) => visibleSet.has(id));
    defaultColumnOrder.forEach((id) => {
      if (!visibleOrdered.includes(id)) visibleOrdered.push(id);
    });
    return visibleOrdered;
  }, [columnOrder, defaultColumnOrder]);

  useEffect(() => {
    if (!sortState) return;
    if (!orderedColumnIds.includes(sortState.columnId)) {
      setSortState(null);
    }
  }, [orderedColumnIds, sortState]);

  const moveColumn = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setColumnOrder((prev) => {
      const sourceOrder = prev.length > 0 ? prev : defaultColumnOrder;
      const fromIndex = sourceOrder.indexOf(fromId);
      const toIndex = sourceOrder.indexOf(toId);
      if (fromIndex < 0 || toIndex < 0) return sourceOrder;
      const next = [...sourceOrder];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const handleHeaderSort = (columnId: string) => {
    if (isEditMode) return;
    if (columnId === "actions") return;
    setSortState((prev) => {
      if (!prev || prev.columnId !== columnId) return { columnId, direction: "asc" };
      return { columnId, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
  };

  /** Get the raw numeric value for a data column */
  const getRawCellValue = (entry: UnifiedFlatLogEntry, colType: "value" | "reps", fieldIndex: number): number | null => {
    if (colType === "reps") {
      return fieldIndex === 0 ? entry.reps1 : fieldIndex === 1 ? entry.reps2 : entry.reps3;
    }
    return fieldIndex === 0 ? entry.val1 : fieldIndex === 1 ? entry.val2 : entry.val3;
  };

  const entries = useMemo(() => {
    if (!sortState) return allEntries;

    const getSortValue = (entry: UnifiedFlatLogEntry): number | string | null => {
      const ex = exerciseLookup.get(entry.exerciseId);

      if (sortState.columnId === "date") return new Date(entry.date).getTime();
      if (sortState.columnId === "category") return getExerciseCategoryLabel(ex).toLowerCase();
      if (sortState.columnId === "level") return entry.levelNameLevel;
      if (sortState.columnId === "progression") {
        const progressionLabel = ex
          ? stripBwPercentHint(getTierName(ex, entry.levelNameLevel))
          : `Level ${entry.levelNameLevel}`;
        return progressionLabel.toLowerCase();
      }
      if (sortState.columnId === "exercise") {
        const entryDisplayName = ex
          ? stripBwPercentHint(getExerciseDisplayName(ex, settings.terminologyMode))
          : stripBwPercentHint(entry.exerciseName);
        return entryDisplayName.toLowerCase();
      }
      if (sortState.columnId === "modifier") return parseModifierDisplayToSignedKg(entry.modifier);
      if (sortState.columnId === "band") return entry.resistanceBandKg;
      if (sortState.columnId === "variant") return (entry.variant ?? "").toLowerCase();
      if (sortState.columnId === "notes") return (entry.notes ?? "").toLowerCase();
      if (sortState.columnId === "next") {
        return getNextTierStandardWeightKg(
          ex,
          [entry.origWeight1, entry.origWeight2, entry.origWeight3],
          physique.bodyWeightKg,
          entry.resistanceBandKg,
          parseModifierDisplayToSignedKg(entry.modifier),
        );
      }
      if (sortState.columnId === "avg") return getEntryAvgWeight(entry);

      const dataIdx = parseDataColumnIndex(sortState.columnId);
      if (dataIdx == null) return null;
      const colType = headerTypes[dataIdx];
      if (colType !== "value" && colType !== "reps") return null;
      const fieldIndex = colType === "value"
        ? (columnGrouped ? dataIdx : Math.floor(dataIdx / 2))
        : (columnGrouped ? dataIdx - 3 : Math.floor(dataIdx / 2));
      return getRawCellValue(entry, colType, fieldIndex);
    };

    const directionFactor = sortState.direction === "asc" ? 1 : -1;
    return allEntries
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => {
        const aVal = getSortValue(a.entry);
        const bVal = getSortValue(b.entry);

        const aNullish = aVal == null || aVal === "";
        const bNullish = bVal == null || bVal === "";
        if (aNullish && bNullish) return a.index - b.index;
        if (aNullish) return 1;
        if (bNullish) return -1;

        if (typeof aVal === "number" && typeof bVal === "number") {
          if (aVal === bVal) return a.index - b.index;
          return (aVal - bVal) * directionFactor;
        }

        const aText = String(aVal);
        const bText = String(bVal);
        const textCmp = aText.localeCompare(bText, undefined, { numeric: true, sensitivity: "base" });
        if (textCmp === 0) return a.index - b.index;
        return textCmp * directionFactor;
      })
      .map((item) => item.entry);
  }, [allEntries, sortState, exerciseLookup, settings.terminologyMode, physique.bodyWeightKg, headerTypes, columnGrouped]);

  useEffect(() => {
    if (!isEditMode) return;
    if (entries.length === 0) {
      if (selectedEditLogId) setSelectedEditLogId(null);
      return;
    }
    if (!selectedEditLogId || !entries.some((entry) => entry.logId === selectedEditLogId)) {
      setSelectedEditLogId(entries[0].logId);
      setHoveredEditLogId(entries[0].logId);
    }
  }, [entries, isEditMode, selectedEditLogId]);

  useEffect(() => {
    if (!isEditMode || !selectedEditLogId) return;
    const scrollEl = tableScrollRef.current;
    if (!scrollEl) return;

    const frame = window.requestAnimationFrame(() => {
      const actionCell = scrollEl.querySelector(
        `td[data-actions-cell='true'][data-log-id='${selectedEditLogId}']`,
      ) as HTMLElement | null;
      if (!actionCell) return;

      const cellLeft = actionCell.offsetLeft;
      const cellRight = cellLeft + actionCell.offsetWidth;
      const viewportLeft = scrollEl.scrollLeft;
      const viewportRight = viewportLeft + scrollEl.clientWidth;

      if (cellRight > viewportRight - 8) {
        scrollEl.scrollTo({ left: cellRight - scrollEl.clientWidth + 12, behavior: "smooth" });
      } else if (cellLeft < viewportLeft + 8) {
        scrollEl.scrollTo({ left: Math.max(0, cellLeft - 12), behavior: "smooth" });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isEditMode, selectedEditLogId]);

  useEffect(() => {
    if (isMobile || fitToScreenMode) return;

    const syncOpenModeVirtualMetrics = () => {
      const el = tableScrollRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollTop = Math.max(0, -rect.top);
      const viewportHeight = Math.max(VIRTUAL_ROW_HEIGHT, window.innerHeight);
      setOpenModeVirtualMetrics((prev) => (
        prev.scrollTop === scrollTop && prev.viewportHeight === viewportHeight
          ? prev
          : { scrollTop, viewportHeight }
      ));
    };

    syncOpenModeVirtualMetrics();
    window.addEventListener("scroll", syncOpenModeVirtualMetrics, { passive: true });
    window.addEventListener("resize", syncOpenModeVirtualMetrics);
    return () => {
      window.removeEventListener("scroll", syncOpenModeVirtualMetrics);
      window.removeEventListener("resize", syncOpenModeVirtualMetrics);
    };
  }, [VIRTUAL_ROW_HEIGHT, fitToScreenMode, isMobile]);

  const shouldVirtualizeTable = !isMobile && entries.length > 40;
  const virtualScrollTop = fitToScreenMode ? tableScrollTop : openModeVirtualMetrics.scrollTop;
  const virtualViewportHeight = fitToScreenMode ? tableViewportHeight : openModeVirtualMetrics.viewportHeight;
  const virtualWindow = useMemo(() => {
    const total = entries.length;
    if (!shouldVirtualizeTable) {
      return {
        start: 0,
        end: total,
        topPad: 0,
        bottomPad: 0,
        visibleEntries: entries,
      };
    }
    const visibleCount = Math.ceil(virtualViewportHeight / VIRTUAL_ROW_HEIGHT) + VIRTUAL_OVERSCAN * 2;
    const start = Math.max(0, Math.floor(virtualScrollTop / VIRTUAL_ROW_HEIGHT) - VIRTUAL_OVERSCAN);
    const end = Math.min(total, start + visibleCount);
    return {
      start,
      end,
      topPad: start * VIRTUAL_ROW_HEIGHT,
      bottomPad: Math.max(0, (total - end) * VIRTUAL_ROW_HEIGHT),
      visibleEntries: entries.slice(start, end),
    };
  }, [entries, shouldVirtualizeTable, virtualScrollTop, virtualViewportHeight, VIRTUAL_ROW_HEIGHT]);

  const isOpenedTableMode = !fitToScreenMode;
  const tableEntries = shouldVirtualizeTable ? virtualWindow.visibleEntries : entries;

  const tableMinWidth = useMemo(() => {
    const renderedColumnCount = orderedColumnIds.length;

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
    showLevelColumn,
    showNotesResponsive,
    showActionsColumn,
    showStandardWeightResponsive,
    showVariantColumnResponsive,
    shouldRenderModifierColumn,
    orderedColumnIds.length,
  ]);

  const formattedDateByLogId = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of entries) {
      map.set(entry.logId, formatDate(entry.date, dateFormat));
    }
    return map;
  }, [entries, dateFormat]);

  const selectedInputExercise = useMemo(
    () => (workoutInput.exerciseId ? exerciseLookup.get(workoutInput.exerciseId) : undefined),
    [exerciseLookup, workoutInput.exerciseId],
  );

  const sortedExercises = useMemo(() => {
    const canonicalOnly = exercises.filter((exercise) => CANONICAL_INPUT_EXERCISE_NAMES.has((exercise.name || "").trim()));
    const source = canonicalOnly.length > 0 ? canonicalOnly : exercises;

    return [...source].sort((a, b) => {
      const aName = exerciseMetaById.get(a.id)?.displayName ?? a.name;
      const bName = exerciseMetaById.get(b.id)?.displayName ?? b.name;
      return aName.localeCompare(bName, undefined, { sensitivity: "base", numeric: true });
    });
  }, [exerciseMetaById, exercises]);

  const sortedExerciseOptions = useMemo(
    () => sortedExercises.map((exercise) => ({
      id: exercise.id,
      label: exerciseMetaById.get(exercise.id)?.displayName ?? stripBwPercentHint(getExerciseDisplayName(exercise, settings.terminologyMode)),
    })),
    [exerciseMetaById, settings.terminologyMode, sortedExercises],
  );

  const filteredInputExercises = useMemo<InputExerciseSearchResult[]>(() => {
    const query = exerciseSearchTerm.trim().toLowerCase();

    const baseResults = sortedExercises.map((exercise) => {
      const displayName = exerciseMetaById.get(exercise.id)?.displayName ?? exercise.name;
      const canonicalName = String(exercise.name || "").trim();
      const progressionNames = [...(exercise.tiers ?? [])]
        .sort((a, b) => a.level - b.level)
        .map((tier) => ({
          level: String(tier.level),
          name: stripBwPercentHint(tier.name || "").trim(),
        }))
        .filter((tier) => tier.name.length > 0);
      const variantNames = (exercise.variations ?? [])
        .map((variant) => String(variant.name || "").trim())
        .filter(Boolean);

      return {
        exercise,
        displayName,
        canonicalName,
        progressionNames,
        variantNames,
      };
    });

    if (!query) {
      return baseResults.slice(0, 40).map((row) => ({
        exercise: row.exercise,
        displayLabel: row.displayName,
        searchLabel: row.displayName,
      }));
    }

    const next: InputExerciseSearchResult[] = [];
    const seen = new Set<string>();
    const pushUnique = (item: InputExerciseSearchResult) => {
      const key = `${item.exercise.id}::${item.prefillLevel || ""}::${item.prefillVariant || ""}::${item.searchLabel.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      next.push(item);
    };

    for (const row of baseResults) {
      if (row.displayName.toLowerCase().includes(query) || row.canonicalName.toLowerCase().includes(query)) {
        pushUnique({
          exercise: row.exercise,
          displayLabel: row.displayName,
          searchLabel: row.displayName,
        });
      }

      for (const progression of row.progressionNames) {
        if (!progression.name.toLowerCase().includes(query)) continue;
        const contextual = `(${progression.name}) ${row.displayName}`;
        pushUnique({
          exercise: row.exercise,
          displayLabel: contextual,
          searchLabel: contextual,
          prefillLevel: progression.level,
        });
      }

      for (const variant of row.variantNames) {
        if (!variant.toLowerCase().includes(query)) continue;
        const contextual = `(${variant}) ${row.displayName}`;
        pushUnique({
          exercise: row.exercise,
          displayLabel: contextual,
          searchLabel: contextual,
          prefillVariant: variant,
        });
      }
    }

    return next.slice(0, 40);
  }, [exerciseMetaById, exerciseSearchTerm, sortedExercises]);

  const signedModifierOptions = useMemo(() => {
    const positives = [...MODIFIER_WEIGHT_OPTIONS].sort((a, b) => a - b);
    return [-2.5, ...positives];
  }, []);

  const inputVariantOptions = useMemo(
    () => {
      const base = (selectedInputExercise?.variations ?? []).map((variant) => variant.name).filter(Boolean);
      const selectedVariant = String(workoutInput.variant || "").trim();
      if (!selectedVariant) return base;
      if (base.some((variant) => variant.toLowerCase() === selectedVariant.toLowerCase())) return base;
      return [...base, selectedVariant];
    },
    [selectedInputExercise, workoutInput.variant],
  );
  const inputProgressionOptions = useMemo(() => {
    const tiers = [...(selectedInputExercise?.tiers ?? [])]
      .sort((a, b) => a.level - b.level)
      .map((tier) => ({
        value: String(tier.level),
        label: stripBwPercentHint(tier.name || `Level ${tier.level}`),
      }));

    if (tiers.length === 0) return [{ value: "1", label: "Level 1" }];
    return tiers;
  }, [selectedInputExercise]);

  useEffect(() => {
    if (!selectedInputExercise) return;
    setWorkoutInput((prev) => {
      if (prev.exerciseId !== selectedInputExercise.id) return prev;
      if (prev.level && inputProgressionOptions.some((option) => option.value === prev.level)) return prev;
      const fallbackLevel = String(selectedInputExercise.userProgress?.[0]?.currentLevel ?? Number(inputProgressionOptions[0]?.value || "1"));
      return { ...prev, level: fallbackLevel };
    });
  }, [inputProgressionOptions, selectedInputExercise]);

  const hasSelectedInputExercise = Boolean(workoutInput.exerciseId);

  useEffect(() => {
    if (!userId || !selectedInputExercise?.id) {
      setHistoryData([]);
      setHistoryLoading(false);
      return;
    }

    let cancelled = false;
    setHistoryLoading(true);

    fetch(`/api/exercises/history?exerciseId=${encodeURIComponent(selectedInputExercise.id)}`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        const nextHistory = Array.isArray(data?.history) ? (data.history as ExerciseHistoryEntry[]) : [];
        setHistoryData(nextHistory);
        if (nextHistory.length > 0) {
          setHistoryDockOpen(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setHistoryData([]);
      })
      .finally(() => {
        if (cancelled) return;
        setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedInputExercise?.id, userId]);

  useEffect(() => {
    if (!workoutInput.exerciseId) {
      setExerciseSearchTerm("");
      return;
    }
    const selectedExercise = exerciseLookup.get(workoutInput.exerciseId);
    if (!selectedExercise) {
      setExerciseSearchTerm("");
      return;
    }
    setExerciseSearchTerm(stripBwPercentHint(getExerciseDisplayName(selectedExercise, settings.terminologyMode)));
  }, [workoutInput.exerciseId, exerciseLookup, settings.terminologyMode]);

  useEffect(() => {
    const normalizedName = (prefillExerciseName || "").trim().toLowerCase();
    const prefillKey = prefillExerciseId
      ? `id:${prefillExerciseId}`
      : normalizedName
        ? `name:${normalizedName}`
        : null;

    if (!prefillKey) {
      appliedPrefillRef.current = null;
      return;
    }
    if (appliedPrefillRef.current === prefillKey) return;

    let resolvedExerciseId: string | null = null;
    if (prefillExerciseId && exerciseLookup.has(prefillExerciseId)) {
      resolvedExerciseId = prefillExerciseId;
    } else if (normalizedName) {
      const match = exercises.find((exercise) => {
        const displayName = stripBwPercentHint(getExerciseDisplayName(exercise, settings.terminologyMode)).trim().toLowerCase();
        const canonicalName = (exercise.name || "").trim().toLowerCase();
        return displayName === normalizedName || canonicalName === normalizedName;
      });
      resolvedExerciseId = match?.id ?? null;
    }

    if (!resolvedExerciseId) return;

    const selectedExercise = exerciseLookup.get(resolvedExerciseId as string);
    const normalizedPrefillProgression = String(prefillProgression || "").trim().toLowerCase();
    const matchedLevel = selectedExercise?.tiers
      ?.find((tier) => stripBwPercentHint(tier.name || "").trim().toLowerCase() === normalizedPrefillProgression)
      ?.level;
    const defaultLevel = String(matchedLevel ?? selectedExercise?.userProgress?.[0]?.currentLevel ?? 1);
    const normalizedPrefillVariant = String(prefillVariant || "").trim();
    setWorkoutInput((prev) => ({
      ...clearWorkoutInputEntryFields(prev, resolvedExerciseId as string),
      level: defaultLevel,
      variant: normalizedPrefillVariant,
    }));
    setExerciseDropdownOpen(false);
    setExerciseHighlightIndex(-1);
    appliedPrefillRef.current = prefillKey;
  }, [exerciseLookup, exercises, prefillExerciseId, prefillExerciseName, prefillProgression, prefillVariant, settings.terminologyMode]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!exerciseSearchWrapRef.current || (target && exerciseSearchWrapRef.current.contains(target))) return;
      setExerciseDropdownOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!historyDockOpen || isMobile) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !historyDockRef.current) return;
      if (historyDockRef.current.contains(target)) return;
      setHistoryDockOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [historyDockOpen, isMobile]);

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
      setSelectedEditLogId(entries[0]?.logId ?? null);
      setHoveredEditLogId(entries[0]?.logId ?? null);
      startTransition(() => {
        const newData: typeof editingData = {};
        entries.forEach((entry) => {
          newData[entry.logId] = {
            val1: entry.val1, reps1: entry.reps1,
            val2: entry.val2, reps2: entry.reps2,
            val3: entry.val3, reps3: entry.reps3,
            exerciseId: entry.exerciseId,
            level: entry.level,
            modifier: entry.modifier,
            variant: entry.variant,
            notes: entry.notes,
            exerciseType: entry.exerciseType,
          };
        });
        setEditingData(newData);
      });
    } else {
      setIsEditMode(false);
      setSelectedEditLogId(null);
      setHoveredEditLogId(null);
    }
  };

  const handleEditChange = (logId: string, field: string, value: string | number | null) => {
    setEditingData((prev) => ({ ...prev, [logId]: { ...prev[logId], [field]: value } }));
  };

  const buildUpdateFromEditingData = (id: string, data: typeof editingData[string]) => {
    const isTimed = data.exerciseType === "timed";
    const signedModifierKg = parseModifierDisplayToSignedKg(data.modifier);
    return {
      id,
      exerciseId: data.exerciseId,
      level: data.level,
      weight1: isTimed ? null : data.val1,
      reps1: data.reps1,
      weight2: isTimed ? null : data.val2,
      reps2: data.reps2,
      weight3: isTimed ? null : data.val3,
      holdTime: isTimed ? data.val1 : null,
      holdTime2: isTimed ? data.val2 : null,
      holdTime3: isTimed ? data.val3 : null,
      modifier: signedModifierKg != null ? formatSignedModifierKg(signedModifierKg) : (data.modifier ?? null),
      variant: data.variant,
      notes: data.notes,
    };
  };

  const revertRowEdits = (logId: string) => {
    const original = entries.find((entry) => entry.logId === logId);
    if (!original) return;
    setEditingData((prev) => {
      const existing = prev[logId];
      if (!existing) return prev;
      return {
        ...prev,
        [logId]: {
          ...existing,
          exerciseId: original.exerciseId,
          level: original.level,
          val1: original.val1,
          reps1: original.reps1,
          val2: original.val2,
          reps2: original.reps2,
          val3: original.val3,
          reps3: original.reps3,
          modifier: original.modifier,
          variant: original.variant,
          notes: original.notes,
          exerciseType: original.exerciseType,
        },
      };
    });
  };

  const handleSaveSingleRow = async (logId: string) => {
    const rowData = editingData[logId];
    if (!rowData) return;
    setIsSaving(true);
    try {
      await api.post<{ error?: string }>("/api/progressions/logs/update", {
        updates: [buildUpdateFromEditingData(logId, rowData)],
      });
      setSaveMessage({ type: "success", text: "Row updated successfully" });
      setSelectedEditLogId(null);
      setHoveredEditLogId(null);
      onRefresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setSaveMessage({ type: "error", text: err.message || "Failed to save row" });
      } else {
        setSaveMessage({ type: "error", text: "Network error — unable to save row" });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const updates = Object.entries(editingData).map(([id, data]) => buildUpdateFromEditingData(id, data));
      await api.post<{ error?: string }>("/api/progressions/logs/update", { updates });
      setSaveMessage({ type: "success", text: "Training logs updated successfully!" });
      setIsEditMode(false);
      setEditingData({});
      setSelectedEditLogId(null);
      setHoveredEditLogId(null);
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
    setSelectedEditLogId(null);
    setHoveredEditLogId(null);
  };

  const handleResetHeadersToDefault = () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(columnOrderStorageKey);
        window.localStorage.removeItem(sortStorageKey);
      } catch {
        // Ignore storage cleanup errors.
      }
    }
    setColumnOrder(defaultColumnOrder);
    setSortState(null);
    setDraggingColumnId(null);
    setHoveredHeaderId(null);
  };

  const handleWorkoutInputChange = (field: keyof typeof workoutInput, value: string | number) => {
    setWorkoutInput((prev) => ({ ...prev, [field]: value }));
  };

  const handleWorkoutExerciseSelection = (exerciseId: string) => {
    const selectedExercise = exerciseLookup.get(exerciseId);
    const nextLevel = String(selectedExercise?.userProgress?.[0]?.currentLevel ?? 1);
    setWorkoutInput((prev) => {
      if (prev.exerciseId === exerciseId) return prev;
      return {
        ...clearWorkoutInputEntryFields(prev, exerciseId),
        level: nextLevel,
      };
    });
  };

  const applyInputExerciseSelection = (result: InputExerciseSearchResult) => {
    const selectedExercise = result.exercise;
    const defaultLevel = String(selectedExercise.userProgress?.[0]?.currentLevel ?? 1);
    const nextLevel = result.prefillLevel || defaultLevel;

    setWorkoutInput((prev) => ({
      ...clearWorkoutInputEntryFields(prev, selectedExercise.id),
      level: nextLevel,
      variant: result.prefillVariant || "",
    }));
    setExerciseSearchTerm(result.searchLabel);
    setExerciseDropdownOpen(false);
    setExerciseHighlightIndex(-1);
  };

  const endTableDrag = () => {
    tableDragStateRef.current.active = false;
    tableDragStateRef.current.pointerId = null;
    suppressTableClickRef.current = false;
    setIsTableDragging(false);
  };

  const handleTablePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    // Only drag-scroll the header in edit mode
    if (!isEditMode) return;

    const target = event.target as HTMLElement | null;
    if (!target?.closest("thead")) return;
    if (target?.closest("input, select, textarea, button, a, label, [role='button']")) return;

    const el = tableScrollRef.current;
    if (!el) return;
    if (el.scrollWidth <= el.clientWidth + 1) return;

    tableDragStateRef.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: el.scrollLeft,
      pointerId: event.pointerId,
    };
    suppressTableClickRef.current = false;
    setIsTableDragging(true);
    el.setPointerCapture?.(event.pointerId);
  };

  const handleTablePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!tableDragStateRef.current.active) return;
    const el = tableScrollRef.current;
    if (!el) return;

    const deltaX = event.clientX - tableDragStateRef.current.startX;
    if (Math.abs(deltaX) > 4) {
      suppressTableClickRef.current = true;
    }
    el.scrollLeft = tableDragStateRef.current.startScrollLeft - deltaX;
    event.preventDefault();
  };

  const handleTablePointerUp = () => {
    if (!tableDragStateRef.current.active) return;
    const el = tableScrollRef.current;
    if (el && tableDragStateRef.current.pointerId != null) {
      el.releasePointerCapture?.(tableDragStateRef.current.pointerId);
    }
    endTableDrag();
  };

  const handleAddWorkoutLog = async () => {
    if (!workoutInput.exerciseId) {
      setSaveMessage({ type: "error", text: "Please select an exercise first" });
      return;
    }

    const selectedExercise = exerciseLookup.get(workoutInput.exerciseId);
    if (!selectedExercise) {
      setSaveMessage({ type: "error", text: "Selected exercise is not available" });
      return;
    }

    const parseNumeric = (value: string, integerOnly = false): number | null => {
      if (!value || value.trim() === "") return null;
      const parsed = integerOnly ? parseInt(value, 10) : parseFloat(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const val1 = parseNumeric(workoutInput.val1);
    const reps1 = parseNumeric(workoutInput.reps1, true);
    const val2 = parseNumeric(workoutInput.val2);
    const reps2 = parseNumeric(workoutInput.reps2, true);
    const val3 = parseNumeric(workoutInput.val3);
    const reps3 = parseNumeric(workoutInput.reps3, true);

    const hasAnySetData = [val1, reps1, val2, reps2, val3, reps3].some((v) => v != null);
    if (!hasAnySetData) {
      setSaveMessage({ type: "error", text: "Enter at least one set value before adding" });
      return;
    }

    const exerciseType = inferExerciseType(selectedExercise, false);
    const selectedLevel = Number.parseInt(workoutInput.level || "", 10);
    const level = Number.isFinite(selectedLevel) && selectedLevel > 0
      ? selectedLevel
      : (selectedExercise.userProgress?.[0]?.currentLevel ?? 1);
    const modifier = workoutInput.modifierKg ? formatSignedModifierKg(parseFloat(workoutInput.modifierKg)) : null;
    const createdAtDate = workoutInput.date ? new Date(`${workoutInput.date}T00:00:00`) : null;
    const createdAt = createdAtDate && !Number.isNaN(createdAtDate.getTime()) ? createdAtDate.toISOString() : undefined;

    setIsSaving(true);
    try {
      await api.post(`/api/progressions/${workoutInput.exerciseId}/log`, {
        level,
        weight1: exerciseType === "timed" ? null : val1,
        reps1,
        weight2: exerciseType === "timed" ? null : val2,
        reps2,
        weight3: exerciseType === "timed" ? null : val3,
        reps3,
        holdTime: exerciseType === "timed" ? val1 : null,
        holdTime2: exerciseType === "timed" ? val2 : null,
        holdTime3: exerciseType === "timed" ? val3 : null,
        modifier,
        variant: workoutInput.variant || null,
        notes: workoutInput.notes || null,
        completed: false,
        createdAt,
      });

      setSaveMessage({ type: "success", text: "Training log added" });
      setWorkoutInput((prev) => ({
        ...prev,
        val1: "",
        reps1: "",
        val2: "",
        reps2: "",
        val3: "",
        reps3: "",
        modifierKg: "",
        variant: "",
        notes: "",
      }));
      onRefresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setSaveMessage({ type: "error", text: err.message || "Failed to add training log" });
      } else {
        setSaveMessage({ type: "error", text: "Network error — unable to add log" });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const resetWorkoutInput = () => {
    setWorkoutInput(getDefaultWorkoutInput());
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
    (showLevelColumn ? 1 : 0) +
    (showProgression ? 1 : 0) +
    1 +
    visibleDataIndices.length +
    (shouldRenderModifierColumn ? 1 : 0) +
    (anyBand && showBand ? 1 : 0) +
    (showVariantColumnResponsive ? 1 : 0) +
    (showNotesResponsive ? 1 : 0) +
    (showStandardWeightResponsive ? 1 : 0) +
    (showAvgWeightResponsive ? 1 : 0) +
    (showActionsColumn ? 1 : 0);

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

  /** Map visible column back to edit data field */
  const getEditField = (colType: "value" | "reps", fieldIndex: number): string => {
    if (colType === "reps") return `reps${fieldIndex + 1}`;
    return `val${fieldIndex + 1}`;
  };

  const headerTypographyClass = "font-medium text-[10px] sm:text-[11px] uppercase tracking-[0.08em]";
  const headerPadClass = effectiveCompact ? "py-1.5" : "py-2";
  const cellPadTight = effectiveCompact ? "px-0.5 py-1" : "px-0.5 py-1.5";
  const cellPadStandard = effectiveCompact ? "px-1 py-1" : "px-1 py-1.5";
  const cellPadWide = effectiveCompact ? "px-1 py-1" : "px-1.5 py-1.5";
  const cellPadExercise = effectiveCompact ? "px-1 py-1" : "px-1.5 py-1.5";

  return (
    <>
      <div className="w-full">
        {!isMobile && !hideInputSection && (
          <div
            className="w-full rounded-2xl relative overflow-hidden mb-4"
            style={{ borderColor: "var(--border)", border: "1px solid", backgroundColor: "var(--surface)" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#f5f5f5", backgroundColor: "#f5f5f5" }}>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                Training Log Input Section
              </span>
            </div>
            <div className="px-4 py-3">
              <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-center" style={{ color: "var(--text-muted)" }}>Date</label>
                <input
                  type="date"
                  value={workoutInput.date}
                  onChange={(event) => handleWorkoutInputChange("date", event.target.value)}
                  className="rounded px-2 py-1 text-xs outline-none"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", border: "1px solid", color: "var(--text-primary)" }}
                />
              </div>

              <div className="flex flex-col gap-1 min-w-[220px]" ref={exerciseSearchWrapRef}>
                <label className="text-[10px] text-center" style={{ color: "var(--text-muted)" }}>Exercise</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center" style={{ color: "var(--text-muted)" }}>
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden>
                      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M13.5 13.5L18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input
                    ref={exerciseInputRef}
                    type="text"
                    value={exerciseSearchTerm}
                    onFocus={() => {
                      if (workoutInput.exerciseId) setExerciseSearchTerm("");
                      const rect = exerciseInputRef.current?.getBoundingClientRect();
                      if (rect) setExerciseDropdownRect({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
                      setExerciseDropdownOpen(true);
                    }}
                    onClick={() => {
                      if (workoutInput.exerciseId) setExerciseSearchTerm("");
                      const rect = exerciseInputRef.current?.getBoundingClientRect();
                      if (rect) setExerciseDropdownRect({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
                      setExerciseDropdownOpen(true);
                    }}
                    onBlur={() => {
                      // Restore the selected exercise name if the user didn't pick a new one
                      const selected = exerciseLookup.get(workoutInput.exerciseId);
                      if (selected && exerciseSearchTerm.trim() === "") {
                        setExerciseSearchTerm(exerciseMetaById.get(selected.id)?.displayName ?? stripBwPercentHint(getExerciseDisplayName(selected, settings.terminologyMode)));
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        const selected = exerciseLookup.get(workoutInput.exerciseId);
                        setExerciseSearchTerm(
                          selected
                            ? exerciseMetaById.get(selected.id)?.displayName ?? stripBwPercentHint(getExerciseDisplayName(selected, settings.terminologyMode))
                            : "",
                        );
                        setExerciseDropdownOpen(false);
                        setExerciseHighlightIndex(-1);
                        return;
                      }
                      if (!exerciseDropdownOpen || filteredInputExercises.length === 0) return;
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setExerciseHighlightIndex((prev) => {
                          const next = prev < filteredInputExercises.length - 1 ? prev + 1 : 0;
                          // scroll highlighted item into view
                          requestAnimationFrame(() => {
                            exerciseDropdownListRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
                          });
                          return next;
                        });
                      } else if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setExerciseHighlightIndex((prev) => {
                          const next = prev > 0 ? prev - 1 : filteredInputExercises.length - 1;
                          requestAnimationFrame(() => {
                            exerciseDropdownListRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
                          });
                          return next;
                        });
                      } else if (event.key === "Enter") {
                        event.preventDefault();
                        const idx = exerciseHighlightIndex >= 0 ? exerciseHighlightIndex : 0;
                        const picked = filteredInputExercises[idx];
                        if (picked) {
                          applyInputExerciseSelection(picked);
                        }
                      }
                    }}
                    onChange={(event) => {
                      const nextTerm = event.target.value;
                      setExerciseSearchTerm(nextTerm);
                      setExerciseDropdownOpen(true);
                      setExerciseHighlightIndex(-1);
                    }}
                    placeholder="Search exercise"
                    className="w-full rounded py-1 pl-7 pr-7 text-xs outline-none"
                    style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", border: "1px solid", color: "var(--text-primary)" }}
                  />
                  {exerciseSearchTerm.trim() !== "" && (
                    <button
                      type="button"
                      onClick={() => {
                        resetWorkoutInput();
                        setExerciseDropdownOpen(false);
                        setExerciseHighlightIndex(-1);
                      }}
                      className="absolute inset-y-0 right-1 flex items-center justify-center px-1.5"
                      style={{ color: "var(--text-muted)" }}
                      aria-label="Clear exercise search"
                      title="Clear"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden>
                        <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}

                  {/* dropdown rendered via portal — see portalled section at component bottom */}
                </div>
              </div>

              <div className="flex flex-col gap-1 min-w-[150px]">
                <label className="text-[10px] text-center" style={{ color: "var(--text-muted)" }}>Progression</label>
                <select
                  value={workoutInput.level}
                  onChange={(event) => handleWorkoutInputChange("level", event.target.value)}
                  disabled={!hasSelectedInputExercise}
                  className="rounded px-2 py-1 text-xs outline-none"
                  style={{
                    backgroundColor: !hasSelectedInputExercise ? "color-mix(in srgb, var(--border) 14%, var(--surface))" : "var(--surface)",
                    borderColor: "var(--border)",
                    border: "1px solid",
                    color: !hasSelectedInputExercise ? "var(--text-muted)" : "var(--text-secondary)",
                    opacity: !hasSelectedInputExercise ? 0.6 : 1,
                    cursor: !hasSelectedInputExercise ? "not-allowed" : "pointer",
                  }}
                >
                  {inputProgressionOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              {[1, 2, 3].map((setNo) => (
                <div key={`set-${setNo}`} className="flex flex-col gap-1">
                  <label className="text-[10px] text-center" style={{ color: "var(--text-muted)" }}>{`Set ${setNo}`}</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={workoutInput[`val${setNo}` as "val1" | "val2" | "val3"]}
                      onChange={(event) => handleWorkoutInputChange(`val${setNo}` as "val1" | "val2" | "val3", event.target.value)}
                      placeholder="W"
                      disabled={!hasSelectedInputExercise}
                      className="w-[56px] rounded px-2 py-1 text-xs outline-none"
                      style={{
                        backgroundColor: !hasSelectedInputExercise ? "color-mix(in srgb, var(--border) 14%, var(--surface))" : "var(--surface)",
                        borderColor: "var(--border)",
                        border: "1px solid",
                        color: !hasSelectedInputExercise ? "var(--text-muted)" : "var(--text-primary)",
                        opacity: !hasSelectedInputExercise ? 0.6 : 1,
                        cursor: !hasSelectedInputExercise ? "not-allowed" : "text",
                      }}
                    />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={workoutInput[`reps${setNo}` as "reps1" | "reps2" | "reps3"]}
                      onChange={(event) => handleWorkoutInputChange(`reps${setNo}` as "reps1" | "reps2" | "reps3", event.target.value)}
                      placeholder="R"
                      disabled={!hasSelectedInputExercise}
                      className="w-[50px] rounded px-2 py-1 text-xs outline-none"
                      style={{
                        backgroundColor: !hasSelectedInputExercise ? "color-mix(in srgb, var(--border) 14%, var(--surface))" : "var(--surface)",
                        borderColor: "var(--border)",
                        border: "1px solid",
                        color: !hasSelectedInputExercise ? "var(--text-muted)" : "var(--text-primary)",
                        opacity: !hasSelectedInputExercise ? 0.6 : 1,
                        cursor: !hasSelectedInputExercise ? "not-allowed" : "text",
                      }}
                    />
                  </div>
                </div>
              ))}

              <div className="flex flex-col gap-1 w-[110px]">
                <label className="text-[10px] text-center" style={{ color: "var(--text-muted)" }}>Modifier</label>
                <select
                  value={workoutInput.modifierKg}
                  onChange={(event) => handleWorkoutInputChange("modifierKg", event.target.value)}
                  disabled={!hasSelectedInputExercise}
                  className="rounded px-2 py-1 text-xs outline-none"
                  style={{
                    backgroundColor: !hasSelectedInputExercise ? "color-mix(in srgb, var(--border) 14%, var(--surface))" : "var(--surface)",
                    borderColor: "var(--border)",
                    border: "1px solid",
                    color: !hasSelectedInputExercise ? "var(--text-muted)" : "var(--gold)",
                    opacity: !hasSelectedInputExercise ? 0.6 : 1,
                    cursor: !hasSelectedInputExercise ? "not-allowed" : "pointer",
                  }}
                >
                  <option value=""></option>
                  {signedModifierOptions.map((kg) => (
                    <option key={String(kg)} value={String(kg)}>
                      {formatSignedModifierKg(kg)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1 min-w-[150px]">
                <label className="text-[10px] text-center" style={{ color: "var(--text-muted)" }}>Variant</label>
                <select
                  value={workoutInput.variant}
                  onChange={(event) => handleWorkoutInputChange("variant", event.target.value)}
                  disabled={!hasSelectedInputExercise}
                  className="rounded px-2 py-1 text-xs outline-none"
                  style={{
                    backgroundColor: !hasSelectedInputExercise ? "color-mix(in srgb, var(--border) 14%, var(--surface))" : "var(--surface)",
                    borderColor: "var(--border)",
                    border: "1px solid",
                    color: !hasSelectedInputExercise ? "var(--text-muted)" : "var(--text-primary)",
                    opacity: !hasSelectedInputExercise ? 0.6 : 1,
                    cursor: !hasSelectedInputExercise ? "not-allowed" : "pointer",
                  }}
                >
                  <option value="">-</option>
                  {inputVariantOptions.map((variantName) => (
                    <option key={variantName} value={variantName}>{variantName}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1 min-w-[180px] grow">
                <label className="text-[10px] text-center" style={{ color: "var(--text-muted)" }}>Notes</label>
                <input
                  type="text"
                  value={workoutInput.notes}
                  onChange={(event) => handleWorkoutInputChange("notes", event.target.value)}
                  placeholder="Optional notes"
                  disabled={!hasSelectedInputExercise}
                  className="rounded px-2 py-1 text-xs outline-none"
                  style={{
                    backgroundColor: !hasSelectedInputExercise ? "color-mix(in srgb, var(--border) 14%, var(--surface))" : "var(--surface)",
                    borderColor: "var(--border)",
                    border: "1px solid",
                    color: !hasSelectedInputExercise ? "var(--text-muted)" : "var(--text-primary)",
                    opacity: !hasSelectedInputExercise ? 0.6 : 1,
                    cursor: !hasSelectedInputExercise ? "not-allowed" : "text",
                  }}
                />
              </div>

              <div className="flex items-end gap-2">
                <button
                  type="button"
                  className="text-xs px-3 py-1 rounded-md border transition-all duration-100 hover:scale-105 active:scale-95"
                  style={{
                    borderColor: !hasSelectedInputExercise ? "var(--border)" : "var(--accent)",
                    color: !hasSelectedInputExercise ? "var(--text-muted)" : "var(--accent)",
                    backgroundColor: !hasSelectedInputExercise
                      ? "color-mix(in srgb, var(--border) 10%, transparent)"
                      : "color-mix(in srgb, var(--accent) 6%, transparent)",
                    opacity: !hasSelectedInputExercise ? 0.7 : 1,
                    cursor: !hasSelectedInputExercise ? "not-allowed" : "pointer",
                  }}
                  onClick={handleAddWorkoutLog}
                  disabled={isSaving || !hasSelectedInputExercise}
                >
                  {isSaving ? "Saving..." : "+ Add"}
                </button>
                <button
                  type="button"
                  className="text-xs px-3 py-1 rounded-md border transition-all duration-100 hover:scale-105 active:scale-95"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  onClick={resetWorkoutInput}
                >
                  Reset
                </button>
              </div>
              </div>
            </div>
          </div>
        )}

        <div
          className="w-full rounded-2xl relative overflow-hidden"
          style={{
            borderColor: "var(--border)",
            border: "1px solid",
            backgroundColor: "var(--surface)"
          }}
        >
          <div className="relative">
          {/* Edit header bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#f5f5f5", backgroundColor: "#f5f5f5" }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>Training Log</span>
                {saveMessage && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ fontSize: "11px", color: saveMessage.type === "success" ? "var(--accent)" : "var(--danger)" }}
                  >
                    {saveMessage.text}
                  </motion.span>
                )}
                {isEditMode && !selectedEditLogId && (
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    Select a row to edit
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isMobile && entries.length > 0 && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isSimpleView}
                    aria-disabled={isEditMode}
                    onClick={() => setIsSimpleView((prev) => !prev)}
                    disabled={isEditMode}
                    className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[11px] transition-all duration-100 hover:scale-105 active:scale-95"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--text-secondary)",
                      backgroundColor: "var(--surface)",
                      opacity: isEditMode ? 0.5 : 1,
                      cursor: isEditMode ? "not-allowed" : "pointer",
                    }}
                    title="Simple view"
                  >
                    <span>Simple View</span>
                    <span
                      className="relative inline-flex h-4 w-8 items-center rounded-full transition-colors"
                      style={{
                        backgroundColor: isSimpleView
                          ? "color-mix(in srgb, var(--accent) 40%, transparent)"
                          : "color-mix(in srgb, var(--border) 55%, transparent)",
                      }}
                    >
                      <span
                        className="absolute h-3 w-3 rounded-full transition-all"
                        style={{
                          left: isSimpleView ? "16px" : "2px",
                          backgroundColor: isSimpleView ? "var(--accent)" : "var(--text-muted)",
                        }}
                      />
                    </span>
                  </button>
                )}
                {!isMobile && entries.length > 0 && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isOpenedTableMode}
                    onClick={() => setFitToScreenMode((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[11px] transition-all duration-100 hover:scale-105 active:scale-95"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--surface)" }}
                    title={isOpenedTableMode ? "Full-page table" : "Fit-to-screen table"}
                  >
                    <span>Open</span>
                    <span
                      className="relative inline-flex h-4 w-8 items-center rounded-full transition-colors"
                      style={{
                        backgroundColor: isOpenedTableMode
                          ? "color-mix(in srgb, var(--accent) 40%, transparent)"
                          : "color-mix(in srgb, var(--border) 55%, transparent)",
                      }}
                    >
                      <span
                        className="absolute h-3 w-3 rounded-full transition-all"
                        style={{
                          left: isOpenedTableMode ? "16px" : "2px",
                          backgroundColor: isOpenedTableMode ? "var(--accent)" : "var(--text-muted)",
                        }}
                      />
                    </span>
                  </button>
                )}
                {!isMobile && entries.length > 0 && isEditMode ? (
                  <>
                    <GlowButton variant="ghost" size="sm" onClick={handleResetHeadersToDefault} disabled={isSaving}>
                      Reset Headers
                    </GlowButton>
                    <GlowButton variant="jade" size="sm" onClick={handleSaveChanges} disabled={isSaving}>
                      {isSaving ? "Saving..." : "✓ Save"}
                    </GlowButton>
                    <GlowButton variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
                      ✕ Cancel
                    </GlowButton>
                  </>
                ) : !isMobile && entries.length > 0 ? (
                  <button
                    onClick={handleEditModeToggle}
                    className="text-xs px-3 py-1 rounded-md border transition-all duration-100 hover:scale-105 active:scale-95"
                    style={{
                      borderColor: "var(--accent)",
                      color: "var(--accent)",
                      backgroundColor: "color-mix(in srgb, var(--accent) 5%, transparent)"
                    }}
                  >
                    ✎ Edit
                  </button>
                ) : (
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>No logs yet</span>
                )}
              </div>
            </div>

          {isMobile ? (
            <div
              ref={tableScrollRef}
              className="overflow-y-auto px-2 py-2 space-y-2 scrollbar-hide"
              style={{
                WebkitOverflowScrolling: "touch",
                backgroundColor: "var(--background)",
                height: `${tableViewportHeight}px`,
                maxHeight: `${tableViewportHeight}px`,
              }}
            >
              {entries.length === 0 ? (
                <div className="rounded-lg border px-3 py-4 text-center text-xs" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--text-muted)" }}>
                  No training data logged yet.
                </div>
              ) : (
                entries.map((entry) => {
                  const ex = exerciseLookup.get(entry.exerciseId);
                  const exerciseMeta = ex ? exerciseMetaById.get(ex.id) : undefined;
                  const entryDisplayName = ex
                    ? (exerciseMeta?.displayName ?? stripBwPercentHint(getExerciseDisplayName(ex, settings.terminologyMode)))
                    : stripBwPercentHint(entry.exerciseName);
                  const typeLabel = exerciseMeta?.categoryLabel ?? getExerciseCategoryLabel(ex);
                  const formattedEntryDate = formattedDateByLogId.get(entry.logId) ?? formatDate(entry.date, dateFormat);

                  return (
                    <TrainingLogMobileCard
                      key={entry.logId}
                      entry={entry}
                      entryDisplayName={entryDisplayName}
                      typeLabel={typeLabel}
                      formattedEntryDate={formattedEntryDate}
                      variationDisplay={variationDisplay}
                      weightUnit={weightUnit}
                    />
                  );
                })
              )}
            </div>
          ) : (
          <div
            ref={tableScrollRef}
            onScroll={(event) => {
              if (!fitToScreenMode) return;
              const top = (event.currentTarget as HTMLDivElement).scrollTop;
              if (tableScrollRafRef.current != null) {
                window.cancelAnimationFrame(tableScrollRafRef.current);
              }
              tableScrollRafRef.current = window.requestAnimationFrame(() => {
                setTableScrollTop(top);
                tableScrollRafRef.current = null;
              });
            }}
            onPointerDown={handleTablePointerDown}
            onPointerMove={handleTablePointerMove}
            onPointerUp={handleTablePointerUp}
            onPointerCancel={handleTablePointerUp}
            onClickCapture={(event) => {
              if (suppressTableClickRef.current) {
                suppressTableClickRef.current = false;
                event.preventDefault();
                event.stopPropagation();
                return;
              }
              if (!isEditMode || !selectedEditLogId) return;
              const target = event.target as HTMLElement;
              if (!target.closest("tr[data-log-row='true']")) {
                revertRowEdits(selectedEditLogId);
                setSelectedEditLogId(null);
                setHoveredEditLogId(null);
              }
            }}
            className={`${fitToScreenMode ? "overflow-auto" : "overflow-visible"} w-full ${useMobileTableStyling ? "scrollbar-hide" : ""}`}
            style={{
              WebkitOverflowScrolling: "touch",
              backgroundColor: "var(--surface)",
              height: fitToScreenMode ? `${tableViewportHeight}px` : "auto",
              maxHeight: fitToScreenMode ? `${tableViewportHeight}px` : "none",
            }}
          >
          <table
            className="text-xs w-full border-collapse"
            style={{ whiteSpace: "nowrap", minWidth: tableMinWidth, backgroundColor: "var(--surface)", tableLayout: "fixed" }}
          >
            <thead
              className="sticky top-0 z-10"
              style={{
                backgroundColor: "var(--surface)",
                boxShadow: "0 -2px 0 var(--surface)",
                cursor: isEditMode ? (isTableDragging ? "grabbing" : "grab") : undefined,
              }}
            >
              <tr
                className="border-b"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                {orderedColumnIds.map((columnId) => {
                  const isSortedColumn = sortState?.columnId === columnId;
                  const sortArrow = isSortedColumn ? (sortState?.direction === "asc" ? "↑" : "↓") : null;
                  const renderHeaderLabel = (label: string) => (
                    <span className="inline-flex items-center justify-center gap-1">
                      <span>{label}</span>
                      {sortArrow && (
                        <span className="text-[10px]" style={{ color: "var(--accent)" }}>{sortArrow}</span>
                      )}
                    </span>
                  );

                  const sharedKey = `header-${columnId}`;
                  const sharedProps = {
                    draggable: isEditMode ? true : undefined,
                    onClick: () => handleHeaderSort(columnId),
                    onDragStart: () => {
                      if (!isEditMode) return;
                      setDraggingColumnId(columnId);
                    },
                    onMouseEnter: () => {
                      if (!isEditMode) return;
                      setHoveredHeaderId(columnId);
                    },
                    onMouseLeave: () => {
                      setHoveredHeaderId((prev) => (prev === columnId ? null : prev));
                    },
                    onDragOver: (event: React.DragEvent<HTMLTableHeaderCellElement>) => {
                      if (!isEditMode) return;
                      event.preventDefault();
                    },
                    onDrop: () => {
                      if (!isEditMode) return;
                      if (!draggingColumnId) return;
                      moveColumn(draggingColumnId, columnId);
                      setDraggingColumnId(null);
                    },
                    onDragEnd: () => setDraggingColumnId(null),
                    className: `${headerPadClass} ${isEditMode ? "cursor-grab active:cursor-grabbing" : (columnId === "actions" ? "cursor-default" : "cursor-pointer")} select-none ${headerTypographyClass}`,
                    style: {
                      opacity: draggingColumnId === columnId ? 0.6 : 1,
                      backgroundColor: isEditMode && hoveredHeaderId === columnId
                        ? "color-mix(in srgb, var(--accent) 10%, var(--surface))"
                        : "var(--surface)",
                      boxShadow: isEditMode && hoveredHeaderId === columnId
                        ? "inset 0 -1px 0 color-mix(in srgb, var(--accent) 45%, transparent)"
                        : undefined,
                      transition: "background-color 140ms ease, box-shadow 140ms ease, opacity 140ms ease",
                    } as React.CSSProperties,
                  };

                  if (columnId === "date") {
                    return (
                      <th key={sharedKey} {...sharedProps} className={`${sharedProps.className} px-1 sm:px-1.5 w-[6rem] min-w-[6rem] text-center`}>
                        {renderHeaderLabel("Date")}
                      </th>
                    );
                  }
                  if (columnId === "category") {
                    return (
                      <th key={sharedKey} {...sharedProps} className={`${sharedProps.className} px-0.5 sm:px-1 w-[5rem] min-w-[5rem] text-center`}>
                        {renderHeaderLabel("Category")}
                      </th>
                    );
                  }
                  if (columnId === "level") {
                    return (
                      <th key={sharedKey} {...sharedProps} className={`${sharedProps.className} px-0.5 sm:px-1 w-[4rem] min-w-[4rem] text-center`}>
                        {renderHeaderLabel("Level")}
                      </th>
                    );
                  }
                  if (columnId === "exercise") {
                    return (
                      <th key={sharedKey} {...sharedProps} className={`${sharedProps.className} px-1 sm:px-1.5 w-[12rem] min-w-[12rem] text-left`}>
                        {renderHeaderLabel("Exercise")}
                      </th>
                    );
                  }
                  if (columnId === "progression") {
                    return (
                      <th key={sharedKey} {...sharedProps} className={`${sharedProps.className} px-1 sm:px-1.5 w-[7.5rem] min-w-[7.5rem] text-left`}>
                        {renderHeaderLabel("Progression")}
                      </th>
                    );
                  }
                  if (columnId === "modifier") {
                    return (
                      <th key={sharedKey} {...sharedProps} className={`${sharedProps.className} px-0.5 sm:px-1 w-[4.5rem] min-w-[4.5rem] text-center text-gold`}>
                        {renderHeaderLabel("Mod")}
                      </th>
                    );
                  }
                  if (columnId === "band") {
                    return (
                      <th key={sharedKey} {...sharedProps} className={`${sharedProps.className} px-0.5 sm:px-1 w-[5rem] min-w-[5rem] text-center text-mountain-blue-glow`}>
                        {renderHeaderLabel("Band")}
                      </th>
                    );
                  }
                  if (columnId === "variant") {
                    return (
                      <th key={sharedKey} {...sharedProps} className={`${sharedProps.className} px-0.5 sm:px-1 w-[5.5rem] min-w-[5.5rem] text-left text-mountain-blue-glow`}>
                        {renderHeaderLabel("Variant")}
                      </th>
                    );
                  }
                  if (columnId === "notes") {
                    return (
                      <th key={sharedKey} {...sharedProps} className={`${sharedProps.className} px-1 sm:px-1.5 w-[9rem] min-w-[9rem] text-center`}>
                        {renderHeaderLabel("Notes")}
                      </th>
                    );
                  }
                  if (columnId === "next") {
                    return (
                      <th key={sharedKey} {...sharedProps} className={`${sharedProps.className} px-0.5 sm:px-1 w-[4rem] min-w-[4rem] text-center text-difficulty-green`}>
                        {renderHeaderLabel("Next")}
                      </th>
                    );
                  }
                  if (columnId === "avg") {
                    return (
                      <th key={sharedKey} {...sharedProps} className={`${sharedProps.className} px-0.5 sm:px-1 w-[4rem] min-w-[4rem] text-center text-difficulty-cyan`}>
                        {renderHeaderLabel("Avg")}
                      </th>
                    );
                  }
                  if (columnId === "actions") {
                    return (
                      <th
                        key={sharedKey}
                        {...sharedProps}
                        className={`${sharedProps.className} px-1 w-[4.5rem] min-w-[4.5rem] text-center align-middle`}
                        style={{ ...(sharedProps.style ?? {}), color: "var(--text-muted)" }}
                      >
                        {isEditMode ? "⋮" : ""}
                      </th>
                    );
                  }

                  const dataIdx = parseDataColumnIndex(columnId);
                  if (dataIdx == null) return null;
                  return (
                    <th
                      key={sharedKey}
                      {...sharedProps}
                      className={`${sharedProps.className} px-0.5 sm:px-1 w-[3.25rem] min-w-[3.25rem] text-center tabular-nums`}
                      style={{
                        ...(sharedProps.style ?? {}),
                        ...(columnColors ? { color: headerTypes[dataIdx] === "value" ? "var(--col-weight)" : "var(--col-reps)" } : {}),
                      }}
                    >
                      {renderHeaderLabel(headerLabels[dataIdx])}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody style={{ backgroundColor: "var(--surface)" }}>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={emptyRowColSpan} className="py-8 text-center text-sm" style={{ color: "var(--text-muted)", backgroundColor: "var(--surface)" }}>
                    No training data logged yet. Select an exercise from the sidebar to log your first set.
                  </td>
                </tr>
              ) : (
                <>
                  {shouldVirtualizeTable && virtualWindow.topPad > 0 && (
                    <tr aria-hidden="true" style={{ backgroundColor: "var(--surface)" }}>
                      <td colSpan={emptyRowColSpan} style={{ height: `${virtualWindow.topPad}px`, backgroundColor: "var(--surface)" }} />
                    </tr>
                  )}
                  {tableEntries.map((entry, visibleIndex) => {
                    const absoluteIndex = shouldVirtualizeTable ? virtualWindow.start + visibleIndex : visibleIndex;
                    const editData = editingData[entry.logId];
                    const isRowEditing = isEditMode && selectedEditLogId === entry.logId && !!editData;
                    const effectiveExerciseId = isRowEditing && editData ? editData.exerciseId : entry.exerciseId;
                    const ex = exerciseLookup.get(effectiveExerciseId);
                    const exerciseMeta = ex ? exerciseMetaById.get(ex.id) : undefined;
                    const categoryLabel = exerciseMeta?.categoryLabel ?? getExerciseCategoryLabel(ex);
                    const categoryColor = categoryLabel === "GYM"
                      ? "var(--gold)"
                      : categoryLabel === "Yoga"
                        ? "var(--mountain-blue-glow)"
                        : categoryLabel === "Cardio"
                          ? "var(--crimson-light)"
                          : "var(--accent)";
                    const isOlderThan7Days = Date.now() - new Date(entry.date).getTime() > 7 * 24 * 60 * 60 * 1000;
                    const activeBand = entry.resistanceBandKg;
                    const activeModifierKg = isRowEditing
                      ? parseModifierDisplayToSignedKg(editData.modifier)
                      : parseModifierDisplayToSignedKg(entry.modifier);
                    const entryDisplayName = ex
                      ? (exerciseMeta?.displayName ?? stripBwPercentHint(getExerciseDisplayName(ex, settings.terminologyMode)))
                      : stripBwPercentHint(entry.exerciseName);
                    const exerciseVariantOptions = exerciseMeta?.variationOptions ?? [];
                    const selectedVariantValue = editData?.variant ?? "";
                    const variantSelectOptions =
                      selectedVariantValue && !exerciseVariantOptions.includes(selectedVariantValue)
                        ? [...exerciseVariantOptions, selectedVariantValue]
                        : exerciseVariantOptions;
                    const progressionTierOptions = [...(ex?.tiers ?? [])].sort((a, b) => a.level - b.level);
                    const selectedProgressionLevel = editData?.level ?? entry.levelNameLevel;
                    const progressionSelectOptions =
                      progressionTierOptions.some((tier) => tier.level === selectedProgressionLevel)
                        ? progressionTierOptions
                        : [
                            ...progressionTierOptions,
                            {
                              id: `fallback-${selectedProgressionLevel}`,
                              level: selectedProgressionLevel,
                              name: `Level ${selectedProgressionLevel}`,
                              wuxiaName: "",
                              difficulty: "",
                              wuxiaDifficulty: "",
                              wuxiaType: "",
                              description: "",
                              targetHold: null,
                              targetReps: null,
                              targetRepsText: null,
                            },
                          ].sort((a, b) => a.level - b.level);
                    const formattedEntryDate = formattedDateByLogId.get(entry.logId) ?? formatDate(entry.date, dateFormat);
                    const displayLevel = isRowEditing && editData ? editData.level : entry.levelNameLevel;
                    const progressionLabelForExercise = ex
                      ? stripBwPercentHint(getTierName(ex, displayLevel))
                      : "";
                    const variantLabelForExercise = ((isRowEditing && editData ? editData.variant : entry.variant) ?? "").trim();
                    const showSimpleProgressionLabel = isSimpleView && progressionLabelForExercise.trim().length > 0;
                    const showSimpleVariantLabel = isSimpleView && variantLabelForExercise.length > 0;

                    // Determine per-row value display style
                    const isTimedEntry = entry.exerciseType === "timed";

                    return (
                      <tr
                        key={entry.logId}
                        data-log-row="true"
                        data-log-id={entry.logId}
                        className={`border-b transition-colors ${isEditMode ? "cursor-pointer" : ""}`}
                        onClick={() => {
                          if (isEditMode) setSelectedEditLogId(entry.logId);
                        }}
                        onMouseEnter={() => {
                          if (isEditMode) setHoveredEditLogId(entry.logId);
                        }}
                        onMouseLeave={() => {
                          if (isEditMode) {
                            setHoveredEditLogId((prev) => (prev === entry.logId ? null : prev));
                          }
                        }}
                        style={{
                          borderColor: "var(--border)",
                          backgroundColor: isRowEditing
                            ? "color-mix(in srgb, var(--accent) 7%, transparent)"
                            : isEditMode && hoveredEditLogId === entry.logId
                              ? "color-mix(in srgb, var(--accent) 4%, transparent)"
                            : "var(--surface)",
                          opacity: isEditMode && isOlderThan7Days ? 0.62 : 1,
                        }}
                      >
                        {orderedColumnIds.map((columnId) => {
                          if (columnId === "date") {
                            return (
                              <td key={`${entry.logId}-date`} className={`${cellPadStandard} w-[6rem] min-w-[6rem] text-center text-xs align-middle whitespace-nowrap`} style={{ color: "var(--text-secondary)" }}>
                                {formattedEntryDate}
                              </td>
                            );
                          }

                          if (columnId === "category") {
                            return (
                              <td key={`${entry.logId}-category`} className={`${cellPadTight} w-[5rem] min-w-[5rem] text-center align-middle`}>
                                <span
                                  className="inline-block px-2 py-1 border rounded text-[10px] leading-none font-semibold"
                                  style={{
                                    color: categoryColor,
                                    borderColor: "color-mix(in srgb, currentColor 50%, var(--border))",
                                    backgroundColor: "color-mix(in srgb, currentColor 10%, transparent)",
                                  }}
                                >
                                  {categoryLabel}
                                </span>
                              </td>
                            );
                          }

                          if (columnId === "level") {
                            return (
                              <td key={`${entry.logId}-level`} className={`${cellPadStandard} w-[4rem] min-w-[4rem] text-center align-middle`}>
                                <span className="text-[10px] font-semibold" style={{ color: "var(--accent)" }}>
                                  Lv {entry.levelNameLevel}
                                </span>
                              </td>
                            );
                          }

                          if (columnId === "exercise") {
                            return (
                              <td
                                key={`${entry.logId}-exercise`}
                                className={`${cellPadExercise} align-middle whitespace-nowrap overflow-hidden text-ellipsis transition-colors`}
                                style={{ minWidth: "140px", maxWidth: "12rem" }}
                              >
                                {isRowEditing && editData ? (
                                  <select
                                    value={editData.exerciseId}
                                    onChange={(e) => {
                                      const nextExerciseId = e.target.value;
                                      handleEditChange(entry.logId, "exerciseId", nextExerciseId);
                                      handleEditChange(entry.logId, "variant", null);
                                    }}
                                    className="block w-full min-w-0 max-w-full rounded px-2 py-1 text-xs outline-none"
                                    style={{
                                      backgroundColor: "var(--surface)",
                                      borderColor: "var(--border)",
                                      border: "1px solid",
                                      color: "var(--text-primary)",
                                    }}
                                  >
                                    {sortedExerciseOptions.map((exerciseOption) => (
                                      <option key={exerciseOption.id} value={exerciseOption.id}>
                                        {exerciseOption.label}
                                      </option>
                                    ))}
                                  </select>
                                ) : disableExerciseLinks ? (
                                  <div className="flex min-w-0 items-center gap-1 overflow-hidden">
                                    <span
                                      className="text-xs truncate"
                                      title={entryDisplayName}
                                      style={{ color: "var(--text-primary)", textDecoration: "none" }}
                                    >
                                      {entryDisplayName}
                                    </span>
                                    {(showSimpleProgressionLabel || showSimpleVariantLabel) && (
                                      <div className="flex items-center gap-1 overflow-hidden text-[10px]" style={{ color: "var(--text-muted)" }}>
                                        {showSimpleProgressionLabel && (
                                          <span
                                            className="inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded border px-1 py-0.5"
                                            style={{
                                              color: "var(--accent)",
                                              borderColor: "color-mix(in srgb, var(--accent) 45%, var(--border))",
                                              backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)",
                                            }}
                                          >
                                            {progressionLabelForExercise}
                                          </span>
                                        )}
                                        {showSimpleVariantLabel && (
                                          <span
                                            className="inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded border px-1 py-0.5"
                                            style={{
                                              color: "var(--mountain-blue-glow)",
                                              borderColor: "color-mix(in srgb, var(--mountain-blue-glow) 45%, var(--border))",
                                              backgroundColor: "color-mix(in srgb, var(--mountain-blue-glow) 10%, transparent)",
                                            }}
                                          >
                                            {variantLabelForExercise}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex min-w-0 items-center gap-1 overflow-hidden">
                                    <Link
                                      href={`/dashboard/workout-history/${entry.exerciseId}`}
                                      className="text-xs training-log-exercise-link truncate"
                                      title={entryDisplayName}
                                      onClick={(e) => {
                                        // Prevent navigation when in edit mode
                                        if (isEditMode) e.preventDefault();
                                      }}
                                    >
                                      {entryDisplayName}
                                    </Link>
                                    {(showSimpleProgressionLabel || showSimpleVariantLabel) && (
                                      <div className="flex items-center gap-1 overflow-hidden text-[10px]" style={{ color: "var(--text-muted)" }}>
                                        {showSimpleProgressionLabel && (
                                          <span
                                            className="inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded border px-1 py-0.5"
                                            style={{
                                              color: "var(--accent)",
                                              borderColor: "color-mix(in srgb, var(--accent) 45%, var(--border))",
                                              backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)",
                                            }}
                                          >
                                            {progressionLabelForExercise}
                                          </span>
                                        )}
                                        {showSimpleVariantLabel && (
                                          <span
                                            className="inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded border px-1 py-0.5"
                                            style={{
                                              color: "var(--mountain-blue-glow)",
                                              borderColor: "color-mix(in srgb, var(--mountain-blue-glow) 45%, var(--border))",
                                              backgroundColor: "color-mix(in srgb, var(--mountain-blue-glow) 10%, transparent)",
                                            }}
                                          >
                                            {variantLabelForExercise}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          }

                          if (columnId === "progression") {
                            const progressionLabel = ex
                              ? stripBwPercentHint(getTierName(ex, displayLevel))
                              : `Level ${displayLevel}`;
                            return isRowEditing && editData ? (
                              <td key={`${entry.logId}-progression`} className="w-[7.5rem] min-w-[7.5rem] overflow-hidden px-1 py-1.5 text-left align-middle [contain:paint]">
                                <select
                                  value={String(editData.level)}
                                  onChange={(e) => handleEditChange(entry.logId, "level", parseInt(e.target.value, 10))}
                                  className="block w-full min-w-0 max-w-full rounded px-2 py-1 text-left text-xs outline-none transition-all duration-200"
                                  style={{
                                    backgroundColor: "var(--surface)",
                                    borderColor: "var(--border)",
                                    border: "1px solid",
                                    color: "var(--text-secondary)"
                                  }}
                                >
                                  {progressionSelectOptions.map((tier) => (
                                    <option key={`${entry.logId}-tier-${tier.level}`} value={String(tier.level)}>
                                      {stripBwPercentHint(tier.name || `Level ${tier.level}`)}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            ) : (
                              <td
                                key={`${entry.logId}-progression`}
                                className={`${cellPadWide} w-[7.5rem] min-w-[7.5rem] text-left text-xs align-middle`}
                                title={progressionLabel}
                                style={{ color: "var(--text-secondary)" }}
                              >
                                <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                                  {progressionLabel}
                                </span>
                              </td>
                            );
                          }

                          if (columnId === "modifier") {
                            return isRowEditing && editData ? (
                              <td key={`${entry.logId}-modifier`} className="w-[4.5rem] min-w-[4.5rem] overflow-hidden px-1 py-1.5 text-center align-middle [contain:paint]">
                                <select
                                  value={(() => {
                                    const kg = parseModifierDisplayToSignedKg(editData.modifier);
                                    return kg != null ? String(kg) : "";
                                  })()}
                                  onChange={(e) => {
                                    const next = e.target.value ? formatSignedModifierKg(parseFloat(e.target.value)) : null;
                                    handleEditChange(entry.logId, "modifier", next);
                                  }}
                                  className="block w-full min-w-0 max-w-full rounded px-1 py-1 text-center text-xs outline-none transition-all duration-200"
                                  style={{
                                    backgroundColor: "var(--surface)",
                                    borderColor: "var(--border)",
                                    border: "1px solid",
                                    color: "var(--gold)"
                                  }}
                                >
                                  <option value=""></option>
                                  {signedModifierOptions.map((kg) => (
                                    <option key={String(kg)} value={String(kg)}>
                                      {formatSignedModifierKg(kg)}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            ) : (
                              <td
                                key={`${entry.logId}-modifier`}
                                className={`${cellPadStandard} w-[4.5rem] min-w-[4.5rem] text-center text-gold text-xs whitespace-nowrap align-middle`}
                                title={entry.modifier || ""}
                              >
                                {entry.modifier || "—"}
                              </td>
                            );
                          }

                          if (columnId === "variant") {
                            return isRowEditing && editData ? (
                              <td key={`${entry.logId}-variant`} className="w-[5.5rem] min-w-[5.5rem] overflow-hidden px-1 py-1.5 text-left align-middle [contain:paint]">
                                <select
                                  value={editData.variant ?? ""}
                                  onChange={(e) => handleEditChange(entry.logId, "variant", e.target.value || null)}
                                  className="block w-full min-w-0 max-w-full rounded px-2 py-1 text-left text-xs outline-none transition-all duration-200"
                                  style={{
                                    backgroundColor: "var(--surface)",
                                    borderColor: "var(--border)",
                                    border: "1px solid",
                                    color: "var(--mountain-blue-glow)"
                                  }}
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
                                key={`${entry.logId}-variant`}
                                className={`${cellPadStandard} w-[5.5rem] min-w-[5.5rem] text-left text-mountain-blue-glow text-xs align-middle`}
                                title={entry.variant || ""}
                              >
                                <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                                  {entry.variant
                                    ? variationDisplay === "full"
                                      ? entry.variant
                                      : abbreviateVariantText(entry.variant)
                                    : "—"}
                                </span>
                              </td>
                            );
                          }

                          if (columnId === "notes") {
                            return isRowEditing && editData ? (
                              <td key={`${entry.logId}-notes`} className="w-[9rem] min-w-[9rem] overflow-hidden px-1.5 py-1.5 align-middle [contain:paint]">
                                <input
                                  type="text"
                                  value={editData.notes ?? ""}
                                  onChange={(e) => handleEditChange(entry.logId, "notes", e.target.value || null)}
                                  placeholder="Add notes..."
                                  className="block w-full min-w-0 max-w-full rounded px-2 py-1 text-xs outline-none transition-all duration-200"
                                  style={{
                                    backgroundColor: "var(--surface)",
                                    borderColor: "var(--border)",
                                    border: "1px solid",
                                    color: "var(--text-primary)"
                                  }}
                                />
                              </td>
                            ) : (
                              <td
                                key={`${entry.logId}-notes`}
                                className={`${cellPadWide} w-[9rem] min-w-[9rem] text-mist-light text-xs align-middle`}
                                title={entry.notes || ""}
                              >
                                <div className="flex items-center gap-1 overflow-hidden">
                                  <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                    {entry.notes || "—"}
                                  </span>
                                  {entry.completed && <span className="shrink-0" style={{ color: "var(--accent)" }}>✦</span>}
                                </div>
                              </td>
                            );
                          }

                          if (columnId === "next") {
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
                                key={`${entry.logId}-next`}
                                className={`${cellPadStandard} w-[4rem] min-w-[4rem] text-center text-difficulty-green text-xs tabular-nums align-middle`}
                                title={stdDisplay != null ? `Next tier target: ${stdDisplay} ${weightUnit}` : "At max tier"}
                              >
                                {stdDisplay != null ? stdDisplay.toFixed(1) : "✦"}
                              </td>
                            );
                          }

                          if (columnId === "avg") {
                            const avgKg = getEntryAvgWeight(entry);
                            const avgDisplay = avgKg != null ? (weightUnit === "lbs" ? kgToLbs(avgKg) : Math.round(avgKg * 10) / 10) : null;
                            return (
                              <td
                                key={`${entry.logId}-avg`}
                                className={`${cellPadStandard} w-[4rem] min-w-[4rem] text-center text-difficulty-cyan text-xs tabular-nums align-middle`}
                                title={avgDisplay != null ? `Avg: ${avgDisplay} ${weightUnit}` : "No weight data"}
                              >
                                {avgDisplay != null ? avgDisplay.toFixed(1) : "—"}
                              </td>
                            );
                          }

                          if (columnId === "actions") {
                            return (
                              <td
                                key={`${entry.logId}-actions`}
                                data-actions-cell="true"
                                data-log-id={entry.logId}
                                className="px-1 py-1.5 w-[4.5rem] min-w-[4.5rem] text-center align-middle"
                              >
                                {isEditMode && selectedEditLogId === entry.logId ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <motion.button
                                      whileHover={{ scale: 1.12 }}
                                      whileTap={{ scale: 0.94 }}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleSaveSingleRow(entry.logId);
                                      }}
                                      className="transition-colors text-base leading-none"
                                      style={{ color: "var(--accent)", cursor: "pointer" }}
                                      title="Save this row"
                                      disabled={isSaving}
                                    >
                                      ✓
                                    </motion.button>
                                    <motion.button
                                      whileHover={{ scale: 1.12 }}
                                      whileTap={{ scale: 0.94 }}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setDeleteConfirm({ logId: entry.logId, exerciseName: entryDisplayName });
                                      }}
                                      className="transition-colors text-base leading-none"
                                      style={{
                                        color: "var(--danger)",
                                        cursor: "pointer"
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.color = "var(--gold)"}
                                      onMouseLeave={(e) => e.currentTarget.style.color = "var(--danger)"}
                                      title="Delete this log record"
                                      disabled={isDeleting}
                                    >
                                      ✕
                                    </motion.button>
                                  </div>
                                ) : (
                                  <span className="text-lg" style={{ color: "transparent" }}>•</span>
                                )}
                              </td>
                            );
                          }

                          const dataIdx = parseDataColumnIndex(columnId);
                          if (dataIdx == null) return null;
                          const colType = headerTypes[dataIdx];
                          const fieldIndex = colType === "value"
                            ? (columnGrouped ? dataIdx : Math.floor(dataIdx / 2))
                            : (columnGrouped ? dataIdx - 3 : Math.floor(dataIdx / 2));

                          if (isRowEditing && editData) {
                            const editField = getEditField(colType, fieldIndex);
                            const editVal = editData[editField as keyof typeof editData] as number | null;
                            const isValue = colType === "value";
                            return (
                              <td key={`${entry.logId}-data-${dataIdx}`} className="w-[3.25rem] min-w-[3.25rem] px-1 py-1.5 text-center align-middle overflow-hidden [contain:paint]">
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
                                  className="block w-full min-w-0 max-w-full rounded px-1 py-1 text-center text-xs outline-none transition-all"
                                  style={{
                                    backgroundColor: "var(--surface)",
                                    borderColor: "var(--border)",
                                    color: "var(--text-primary)",
                                    border: "1px solid"
                                  }}
                                />
                              </td>
                            );
                          }

                          const rawValue = getRawCellValue(entry, colType, fieldIndex);
                          const displayText = renderCellValue(entry, colType, fieldIndex);
                          const valueColor = isTimedEntry && colType === "value" ? "var(--timed-color)" : undefined;

                          return (
                            <td
                              key={`${entry.logId}-data-${dataIdx}`}
                              className={`${cellPadStandard} w-[3.25rem] min-w-[3.25rem] text-center text-xs leading-tight align-middle whitespace-nowrap overflow-hidden [contain:paint]`}
                              style={{
                                color: !valueColor ? "var(--text-primary)" : valueColor,
                                ...getZeroValueStyle(rawValue, colType, entry.exerciseType),
                              }}
                            >
                              {displayText}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {shouldVirtualizeTable && virtualWindow.bottomPad > 0 && (
                    <tr aria-hidden="true" style={{ backgroundColor: "var(--surface)" }}>
                      <td colSpan={emptyRowColSpan} style={{ height: `${virtualWindow.bottomPad}px`, backgroundColor: "var(--surface)" }} />
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
          </div>
          )}
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
                  className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] max-w-[90vw] rounded-xl shadow-2xl p-5"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", border: "1px solid", boxShadow: "var(--danger-modal-glow)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--danger)" }}>Delete Training Record</h3>
                  <p className="text-xs mb-5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    Are you sure you want to permanently delete the log record for{" "}
                    <span className="font-medium" style={{ color: "var(--accent)" }}>{deleteConfirm.exerciseName}</span>? This action
                    cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleDeleteLog(deleteConfirm.logId)}
                      disabled={isDeleting}
                      className="flex-1 px-4 py-2 text-xs font-semibold rounded-lg border transition-all duration-200 disabled:opacity-50"
                      style={{
                        backgroundColor: "color-mix(in srgb, var(--danger) 10%, transparent)",
                        borderColor: "var(--danger)",
                        color: "var(--danger)"
                      }}
                    >
                      {isDeleting ? "Deleting..." : "Delete Record"}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setDeleteConfirm(null)}
                      disabled={isDeleting}
                      className="flex-1 px-4 py-2 text-xs font-semibold rounded-lg border transition-all duration-200 disabled:opacity-50"
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--text-secondary)"
                      }}
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

      {!isMobile && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed bottom-0 right-3 z-50">
            {historyDockOpen ? (
              <div
                ref={historyDockRef}
                className="rounded-t-xl border shadow-2xl overflow-hidden transition-[width] duration-200"
                style={{
                  width: historyDockExpanded
                    ? "min(620px, calc(100vw - 0.25rem))"
                    : "min(300px, calc(100vw - 0.25rem))",
                  backgroundColor: "var(--surface)",
                  borderColor: "var(--border)",
                  boxShadow: "var(--shadow-elev-2)",
                }}
              >
                <div
                  className="flex items-center justify-between px-3 py-2 border-b transition-all duration-200"
                  style={{ borderColor: "var(--border)", backgroundColor: "#f5f5f5" }}
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-primary)" }}>
                      Exercise History
                    </p>
                    <p className="text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>
                      {selectedInputExercise
                        ? stripBwPercentHint(getExerciseDisplayName(selectedInputExercise, settings.terminologyMode))
                        : "Select an exercise in Training Log Input"}
                    </p>
                  </div>
                  <div className="ml-3 flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Minimize exercise history"
                      title="Minimize"
                      onClick={() => setHistoryDockOpen(false)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded border text-xs font-bold transition-colors hover:bg-ink-mid/35"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    >
                      _
                    </button>
                    <button
                      type="button"
                      aria-label={historyDockExpanded ? "Collapse exercise history" : "Expand exercise history"}
                      title={historyDockExpanded ? "Collapse" : "Expand"}
                      onClick={() => setHistoryDockExpanded((prev) => !prev)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded border text-xs font-bold transition-colors hover:bg-ink-mid/35"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    >
                      {historyDockExpanded ? "↔" : "⤢"}
                    </button>
                    <button
                      type="button"
                      aria-label="Close exercise history"
                      title="Close"
                      onClick={() => setHistoryDockOpen(false)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded border text-xs font-bold transition-colors hover:bg-ink-mid/35"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    >
                      x
                    </button>
                  </div>
                </div>

                <div className="max-h-[320px] overflow-auto sidebar-scroll">
                  {!selectedInputExercise ? (
                    <p className="text-xs px-2 py-3" style={{ color: "var(--text-muted)" }}>
                      Choose an exercise from the input section to view its history.
                    </p>
                  ) : historyLoading ? (
                    <p className="text-xs px-2 py-3" style={{ color: "var(--text-muted)" }}>
                      Loading history...
                    </p>
                  ) : historyData.length === 0 ? (
                    <p className="text-xs px-2 py-3" style={{ color: "var(--text-muted)" }}>
                      No history found for this exercise yet.
                    </p>
                  ) : (
                    <table className="w-full text-[11px] border-collapse whitespace-nowrap">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                          <th className="text-center px-2 py-1 font-semibold" style={{ color: "var(--text-secondary)", backgroundColor: "var(--surface)" }}>Date</th>
                          <th className="text-center px-2 py-1 font-semibold" style={{ color: "var(--accent)", backgroundColor: "var(--surface)" }}>
                            {historyDockExpanded ? "Progression" : "P"}
                          </th>
                          <th className="text-center px-2 py-1 font-semibold" style={{ color: "var(--col-weight)", backgroundColor: "var(--surface)" }}>
                            {historyDockExpanded ? "Average Weight" : "Avg W"}
                          </th>
                          <th className="text-center px-2 py-1 font-semibold" style={{ color: "var(--col-reps)", backgroundColor: "var(--surface)" }}>
                            {historyDockExpanded ? "Average Reps" : "Avg R"}
                          </th>
                          <th className="text-center px-2 py-1 font-semibold" style={{ color: "var(--gold)", backgroundColor: "var(--surface)" }}>
                            {historyDockExpanded ? "Modifier" : "Mod"}
                          </th>
                          <th className="text-center px-2 py-1 font-semibold" style={{ color: "var(--text-secondary)", backgroundColor: "var(--surface)" }}>
                            {historyDockExpanded ? "Variant" : "Var"}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.slice(0, 24).map((entry) => {
                          const weights = [entry.weight1, entry.weight2, entry.weight3].filter(
                            (value): value is number => value != null,
                          );
                          const reps = [entry.reps1, entry.reps2, entry.reps3].filter(
                            (value): value is number => value != null,
                          );
                          const avgWeightKg =
                            weights.length > 0 ? weights.reduce((sum, value) => sum + value, 0) / weights.length : null;
                          const avgReps =
                            reps.length > 0 ? reps.reduce((sum, value) => sum + value, 0) / reps.length : null;
                          const avgWeightDisplay =
                            avgWeightKg == null
                              ? null
                              : weightUnit === "lbs"
                                ? kgToLbs(avgWeightKg)
                                : Math.round(avgWeightKg * 10) / 10;
                          const avgWeightText =
                            avgWeightDisplay != null
                              ? `${avgWeightDisplay.toFixed(1)} ${weightUnit}`
                              : entry.holdTime != null
                                ? `${entry.holdTime}s`
                                : "-";
                          const avgRepsText = avgReps != null ? avgReps.toFixed(1) : "-";
                          const modifierText = entry.modifier?.trim() ? entry.modifier : "-";
                          const variantRaw = entry.variant?.trim() || "";
                          const variantAbbrev = variantRaw ? abbreviateVariantText(variantRaw) : "-";
                          const variantDisplayText = historyDockExpanded ? (variantRaw || "-") : variantAbbrev;
                          const progressionLevel = Number.isFinite(entry.level) ? Number(entry.level) : null;
                          const progressionText = progressionLevel != null
                            ? stripBwPercentHint(getTierName(selectedInputExercise, progressionLevel))
                            : "-";
                          const compactProgressionText = progressionText === "-"
                            ? "-"
                            : (() => {
                                const initials = progressionText
                                  .split(/\s+/)
                                  .filter(Boolean)
                                  .map((word) => word[0]?.toUpperCase() ?? "")
                                  .join("");
                                return (initials || progressionText.slice(0, 2).toUpperCase()).slice(0, 2);
                              })();
                          const progressionDisplayText = historyDockExpanded ? progressionText : compactProgressionText;
                          const weightBreakdown = `W1:${entry.weight1 ?? "-"} W2:${entry.weight2 ?? "-"} W3:${entry.weight3 ?? "-"}`;
                          const repsBreakdown = `R1:${entry.reps1 ?? "-"} R2:${entry.reps2 ?? "-"} R3:${entry.reps3 ?? "-"}`;
                          const avgWeightTitle = `${weightBreakdown} | Mod: ${modifierText}`;
                          const avgRepsTitle = `${repsBreakdown} | Mod: ${modifierText}`;

                          return (
                            <tr key={entry.id} className="border-b" style={{ borderColor: "color-mix(in srgb, var(--border) 55%, transparent)" }}>
                              <td className="px-2 py-1 text-center whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                                {formatDateWithPreference(new Date(entry.date), settings.dateFormat || "dd-mmm-yyyy")}
                              </td>
                              <td className="px-2 py-1 text-center whitespace-nowrap" style={{ color: "var(--accent)" }} title={progressionText}>{progressionDisplayText}</td>
                              <td className="px-2 py-1 text-center tabular-nums" style={{ color: "var(--text-primary)" }} title={avgWeightTitle}>{avgWeightText}</td>
                              <td className="px-2 py-1 text-center tabular-nums" style={{ color: "var(--text-primary)" }} title={avgRepsTitle}>{avgRepsText}</td>
                              <td className="px-2 py-1 text-center whitespace-nowrap" style={{ color: "var(--gold)" }} title={modifierText}>{modifierText}</td>
                              <td className="px-2 py-1 text-center whitespace-nowrap" style={{ color: "var(--text-primary)" }} title={variantRaw || "-"}>{variantDisplayText}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setHistoryDockOpen(true)}
                className="w-[min(180px,calc(100vw-0.25rem))] rounded-t-xl border border-b-0 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] shadow-lg transition-all duration-200 hover:bg-ink-mid/30 hover:shadow-[0_16px_36px_rgb(0_0_0_/_0.35)] hover:border-jade-glow/55"
                style={{
                  backgroundColor: "var(--surface)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                History
              </button>
            )}
          </div>,
          document.body,
        )}

      {/* Exercise search dropdown — portalled to escape overflow:hidden on the card */}
      {exerciseDropdownOpen && exerciseDropdownRect && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={exerciseDropdownListRef}
            className="fixed z-[200] overflow-y-auto rounded border shadow-lg"
            style={{
              top: exerciseDropdownRect.top + 4,
              left: exerciseDropdownRect.left,
              width: exerciseDropdownRect.width,
              maxHeight: "14rem",
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            {filteredInputExercises.length === 0 ? (
              <p className="px-2 py-2 text-xs" style={{ color: "var(--text-muted)" }}>No exercises found</p>
            ) : (
              filteredInputExercises.map((result, idx) => {
                const isHighlighted = idx === exerciseHighlightIndex;
                return (
                  <button
                    key={`${result.exercise.id}:${result.prefillLevel || ""}:${result.prefillVariant || ""}:${idx}`}
                    type="button"
                    onMouseDown={(e) => {
                      // prevent blur from firing before click, and stop the document
                      // mousedown listener from closing the dropdown before click fires
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={() => {
                      applyInputExerciseSelection(result);
                    }}
                    className="block w-full truncate px-2 py-1.5 text-left text-xs transition-none hover:bg-ink-mid/25"
                    style={{
                      color: "var(--text-primary)",
                      backgroundColor: isHighlighted ? "color-mix(in srgb, var(--accent) 18%, transparent)" : undefined,
                    }}
                    title={result.displayLabel}
                  >
                    {result.displayLabel}
                  </button>
                );
              })
            )}
          </div>,
          document.body,
        )}

    </>
  );
}

const MemoTrainingLogTable = memo(TrainingLogTable);
export { TrainingLogTable, MemoTrainingLogTable };
export type { UnifiedFlatLogEntry };
