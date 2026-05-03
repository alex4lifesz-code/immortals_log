"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useCallback, startTransition, memo, useRef, useEffect, Fragment } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GlowButton from "@/components/ui/GlowButton";
import MobileFocusOverlay, { MobileFocusTrigger } from "@/components/ui/MobileFocusOverlay";
import { useDisplaySettings, DEFAULT_UNIFIED_VISIBLE_COLUMNS, DISPLAY_DEFAULTS } from "@/context/DisplaySettingsContext";
import { useIsMobile } from "@/context/AppContext";
import { buildIsoAtUserDateTime, formatDateLocal, formatDateWithPreference } from "@/lib/constants";
import { api, ApiRequestError } from "@/lib/api-client";
import { getDeletedExerciseLabel, getExerciseDisplayName } from "@/lib/exercise-name";
import { rankExerciseSearchResults, type ExerciseSearchMatchSource } from "@/lib/exercise-search";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import { t, tHint } from "@/lib/terminology";
import { isDeletedExerciseDescription } from "@/lib/pending-exercises";
import { inferExerciseType, formatSetValue, formatSetReps, getColumnHeaders, kgToLbs, lbsToKg, type ExerciseType, type TimedUnitPref } from "@/lib/unit-conversion";
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

function getProgressionTierLabel(exercise: ProgressionExercise | undefined, level: number): string {
  if (!exercise) return "";
  const tier = exercise.tiers.find((t) => t.level === level);
  return tier ? stripBwPercentHint(tier.name) : "";
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

interface ExerciseHistoryResponse {
  history?: ExerciseHistoryEntry[];
  nextCursor?: string | null;
  data?: {
    history?: ExerciseHistoryEntry[];
    nextCursor?: string | null;
  };
}

type MobileInputPickerField = "level" | "variant" | "modifierKg";

interface MobileInputPickerState {
  field: MobileInputPickerField;
  title: string;
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
        exerciseName: isDeletedExerciseDescription(ex.story) ? getDeletedExerciseLabel(ex) : ex.name,
        exerciseId: ex.id,
        level: log.level,
        levelNameLevel: parsed.displayLevelOverride ?? log.level,
        tierName: getProgressionTierLabel(ex, parsed.displayLevelOverride ?? log.level),
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

function formatDate(
  dateString: string,
  dateFormat: "dd-mm-yyyy" | "dd-mmm-yyyy" | "dd-mm-yy" | "dd-mmm-yy",
  timeZone?: string,
): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMs >= 0 && diffMins < 60) {
    const minutes = Math.max(1, diffMins);
    return `${minutes} ${minutes === 1 ? t("minute ago", "normal") : t("minutes ago", "normal")}`;
  }
  if (diffMs >= 0 && diffHours < 24) {
    const hours = Math.max(1, diffHours);
    return `${hours} ${hours === 1 ? t("hour ago", "normal") : t("hours ago", "normal")}`;
  }
  if (diffMs >= 0 && diffDays < 7) {
    const days = Math.max(1, diffDays);
    return `${days} ${days === 1 ? t("day ago", "normal") : t("days ago", "normal")}`;
  }
  return formatDateWithPreference(date, dateFormat, timeZone);
}

function getCategoryTone(categoryLabel: string): { color: string; borderColor: string; backgroundColor: string } {
  const normalized = categoryLabel.trim().toLowerCase();
  const baseColor = normalized === "gym" || normalized.includes("strength") || normalized.includes("weight")
    ? "var(--category-gym)"
    : normalized === "yoga" || normalized.includes("mobility") || normalized.includes("flex")
      ? "var(--category-yoga)"
      : normalized === "cardio" || normalized.includes("conditioning") || normalized.includes("endurance")
        ? "var(--category-cardio)"
        : normalized === "cali" || normalized.includes("calisthenics") || normalized.includes("bodyweight")
          ? "var(--category-cali)"
          : normalized.includes("skill") || normalized.includes("balance")
            ? "var(--label-progression)"
            : "var(--text-secondary)";
  const color = `color-mix(in srgb, ${baseColor} 70%, var(--text-primary))`;

  return {
    color,
    borderColor: `color-mix(in srgb, ${baseColor} 56%, var(--border))`,
    backgroundColor: `color-mix(in srgb, ${baseColor} 18%, var(--surface))`,
  };
}

function getSimpleLabelTone(kind: "progression" | "variant"): { color: string; borderColor: string; backgroundColor: string } {
  const baseColor = kind === "progression" ? "var(--label-progression)" : "var(--label-variant)";
  const color = `color-mix(in srgb, ${baseColor} 72%, var(--text-primary))`;
  return {
    color,
    borderColor: `color-mix(in srgb, ${baseColor} 52%, var(--border))`,
    backgroundColor: `color-mix(in srgb, ${baseColor} 18%, var(--surface))`,
  };
}

const TrainingLogMobileCard = memo(function TrainingLogMobileCard({
  entry,
  entryDisplayName,
  typeLabel,
  formattedEntryDate,
  weightUnit,
  timedUnit,
  onOpenExerciseHistory,
}: {
  entry: UnifiedFlatLogEntry;
  entryDisplayName: string;
  typeLabel: string;
  formattedEntryDate: string;
  weightUnit: "kg" | "lbs";
  timedUnit: TimedUnitPref;
  onOpenExerciseHistory: () => void;
}) {
  const typeTone = getCategoryTone(typeLabel);
  const progressionTone = getSimpleLabelTone("progression");
  const variantTone = getSimpleLabelTone("variant");
  const badgeClassName = "training-log-mobile-entry-badge inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold leading-tight shadow-[0_1px_0_rgba(255,255,255,0.03)]";
  const valueSamples = [entry.val1, entry.val2, entry.val3].filter((value): value is number => value != null && Number.isFinite(value));
  const repsSamples = [entry.reps1, entry.reps2, entry.reps3].filter((reps): reps is number => reps != null && Number.isFinite(reps));
  const averageValue = valueSamples.length > 0 ? Math.round((valueSamples.reduce((sum, value) => sum + value, 0) / valueSamples.length) * 10) / 10 : null;
  const averageReps = repsSamples.length > 0 ? Math.round((repsSamples.reduce((sum, reps) => sum + reps, 0) / repsSamples.length) * 10) / 10 : null;
  const averageValueText = formatSetValue(averageValue, entry.exerciseType, weightUnit, undefined, timedUnit);
  const averageRepsText = formatSetReps(averageReps, entry.exerciseType);
  const hasAverageWeight = averageValue !== null;
  const hasAverageReps = averageReps !== null;
  const hasWeight = Boolean(entry.modifier);
  const isDeletedEntry = entryDisplayName.toLowerCase().startsWith("deleted exercise");

  return (
    <button
      type="button"
      onClick={onOpenExerciseHistory}
      className="training-log-mobile-entry-card w-full rounded-xl border px-3 py-2.5 text-left transition-all duration-150 hover:scale-[1.01] active:scale-[0.99]"
      style={{
        borderColor: "color-mix(in srgb, var(--jade-glow) 26%, var(--border))",
        background: "linear-gradient(160deg, color-mix(in srgb, var(--ink-deep) 94%, transparent) 0%, color-mix(in srgb, var(--ink-mid) 88%, transparent) 100%)",
        boxShadow: "0 0 0 1px color-mix(in srgb, var(--jade-glow) 10%, transparent)",
        color: "var(--text-primary)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="training-log-mobile-entry-title truncate text-xs font-semibold" style={{ color: isDeletedEntry ? "var(--crimson-light)" : "var(--cloud-white)" }}>{entryDisplayName}</p>
          <p className="training-log-mobile-entry-date mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>{formattedEntryDate}</p>
        </div>
        {(hasAverageWeight || hasAverageReps || hasWeight) && (
          <div
            className="training-log-mobile-entry-metrics ml-1 grid shrink-0 gap-1 rounded-md border px-1.5 py-1 text-right"
            style={{
              borderColor: "color-mix(in srgb, var(--jade-glow) 28%, var(--border))",
              backgroundColor: "color-mix(in srgb, var(--ink-mid) 82%, var(--ink-deep) 18%)",
            }}
          >
            {hasAverageWeight && (
              <span className="training-log-mobile-entry-metric-primary text-[10px] leading-tight" style={{ color: "var(--jade-light)" }}>
                {t("Avg Weight", "normal")}: {averageValueText}
              </span>
            )}
            {hasAverageReps && (
              <span className="training-log-mobile-entry-metric text-[10px] leading-tight" style={{ color: "var(--text-secondary)" }}>
                {t("Avg Reps", "normal")}: {averageRepsText}
              </span>
            )}
            {hasWeight && (
              <span className="training-log-mobile-entry-metric-accent text-[10px] leading-tight" style={{ color: "var(--gold)" }}>
                {t("Weight", "normal")}: {entry.modifier}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="training-log-mobile-entry-badges mt-1.5 flex flex-wrap items-center gap-1.5">
        <span
          className={badgeClassName}
          style={{
            borderColor: typeTone.borderColor,
            backgroundColor: `color-mix(in srgb, ${typeTone.backgroundColor} 88%, var(--ink-deep) 12%)`,
            color: typeTone.color,
            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${typeTone.color} 18%, transparent)`,
          }}
        >
          {typeLabel}
        </span>
        {entry.tierName.trim().length > 0 && (
          <span
            className={badgeClassName}
            style={{
              borderColor: progressionTone.borderColor,
              backgroundColor: `color-mix(in srgb, ${progressionTone.backgroundColor} 88%, var(--ink-deep) 12%)`,
              color: progressionTone.color,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${progressionTone.color} 18%, transparent)`,
            }}
            title={entry.tierName}
          >
            {entry.tierName}
          </span>
        )}
        {entry.variant && (
          <span
            className={badgeClassName}
            style={{
              borderColor: variantTone.borderColor,
              backgroundColor: `color-mix(in srgb, ${variantTone.backgroundColor} 88%, var(--ink-deep) 12%)`,
              color: variantTone.color,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${variantTone.color} 18%, transparent)`,
            }}
            title={entry.variant}
          >
            {entry.variant}
          </span>
        )}
      </div>

      {entry.notes && (
        <p className="training-log-mobile-entry-notes mt-1 line-clamp-2 text-[10px]" style={{ color: "var(--text-secondary)" }}>
          {entry.notes}
        </p>
      )}

      <div className="training-log-mobile-entry-footer mt-1.5 flex items-center justify-end gap-1 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "color-mix(in srgb, var(--jade-light) 78%, var(--text-secondary))" }}>
        <span>{t("View", "normal")}</span>
        <span aria-hidden>{">"}</span>
      </div>
    </button>
  );
});

type HeaderSortDirection = "asc" | "desc";

interface HeaderSortState {
  columnId: string;
  direction: HeaderSortDirection;
}

const TRAINING_LOG_SORT_STORAGE_KEY_PREFIX = "training-log-table-sort-v1";
const TRAINING_LOG_COLUMN_ORDER_STORAGE_KEY_PREFIX = "training-log-column-order-v1";

type InputExerciseSearchResult = {
  mode?: "exercise" | "custom";
  exercise?: ProgressionExercise;
  displayLabel: string;
  searchLabel: string;
  canonicalName: string;
  hasHistory?: boolean;
  lastLoggedAt?: string | null;
  matchSource?: ExerciseSearchMatchSource;
  prefillLevel?: string;
  prefillVariant?: string;
};

function getDefaultWorkoutInput(timeZone?: string) {
  return {
    date: formatDateLocal(new Date(), timeZone),
    newExerciseName: "",
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
    newExerciseName: "",
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

function readPersistedWorkoutInput(storageKey: string, timeZone?: string): WorkoutInputState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WorkoutInputState>;
    const fallback = getDefaultWorkoutInput(timeZone);
    return {
      date: typeof parsed.date === "string" && parsed.date ? parsed.date : fallback.date,
      newExerciseName: typeof parsed.newExerciseName === "string" ? parsed.newExerciseName : "",
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

function buildCreatedAtFromDateInput(dateValue: string, timeZone?: string): string | undefined {
  if (!dateValue) return undefined;
  return buildIsoAtUserDateTime(dateValue, timeZone);
}

function formatWorkoutInputDateDisplay(
  isoDate: string,
  dateFormat: "dd-mm-yyyy" | "dd-mmm-yyyy" | "dd-mm-yy" | "dd-mmm-yy",
  timeZone?: string,
): string {
  if (!isoDate) return "";
  return formatDateWithPreference(isoDate, dateFormat, timeZone);
}

function parseWorkoutInputDateDisplay(
  value: string,
  dateFormat: "dd-mm-yyyy" | "dd-mmm-yyyy" | "dd-mm-yy" | "dd-mmm-yy",
): string | null {
  const raw = value.trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : raw;
  }

  const parts = raw.split("-").map((p) => p.trim());
  if (parts.length !== 3) return null;

  const day = Number.parseInt(parts[0], 10);
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;

  let month: number | null = null;
  if (dateFormat.includes("mmm")) {
    const key = parts[1].slice(0, 3).toLowerCase();
    const months: Record<string, number> = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };
    month = Object.prototype.hasOwnProperty.call(months, key) ? months[key] : null;
  } else {
    const m = Number.parseInt(parts[1], 10);
    if (Number.isFinite(m) && m >= 1 && m <= 12) month = m - 1;
  }
  if (month == null) return null;

  let year = Number.parseInt(parts[2], 10);
  if (!Number.isFinite(year)) return null;
  if (dateFormat.endsWith("yy") && !dateFormat.endsWith("yyyy")) {
    year += year >= 70 ? 1900 : 2000;
  }

  const parsed = new Date(year, month, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  const yyyy = String(parsed.getFullYear());
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ── The Unified Training Log Table ──

function TrainingLogTable({
  exercises,
  physique,
  onRefresh,
  userId,
  historyTargetUserId,
  historyTargetUserName,
  trainingLogTitleOverride,
  hideInputSection,
  disableExerciseLinks,
  prefillExerciseId,
  prefillExerciseName,
  prefillProgression,
  prefillVariant,
  forceMobileInputOpen,
  forceDesktopTableOnMobile,
  forceSimpleViewOnly,
  forceAverageSummaryOnMobile,
  exerciseDetailSource,
}: {
  exercises: ProgressionExercise[];
  physique: UserPhysiqueSettings;
  onRefresh: () => void;
  userId: string;
  historyTargetUserId?: string;
  historyTargetUserName?: string;
  trainingLogTitleOverride?: string;
  hideInputSection?: boolean;
  disableExerciseLinks?: boolean;
  prefillExerciseId?: string | null;
  prefillExerciseName?: string | null;
  prefillProgression?: string | null;
  prefillVariant?: string | null;
  forceMobileInputOpen?: boolean;
  forceDesktopTableOnMobile?: boolean;
  forceSimpleViewOnly?: boolean;
  forceAverageSummaryOnMobile?: boolean;
  exerciseDetailSource?: "train" | "history";
}) {
  const router = useRouter();
  const allEntries = useMemo(() => flattenLogsUnified(exercises), [exercises]);
  const exerciseLookup = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises]);
  const { settings } = useDisplaySettings();
  const selectedTimeZone = settings.timeZone || "UTC";
  const isMobile = useIsMobile();
  const displayTerminologyMode = !settings.showExerciseForeignLanguage && settings.languageMode === "english"
    ? "normal"
    : settings.terminologyMode;
  const exerciseMetaById = useMemo(() => {
    const map = new Map<string, { displayName: string; categoryLabel: string; variationOptions: string[] }>();
    for (const exercise of exercises) {
      map.set(exercise.id, {
        displayName: stripBwPercentHint(getExerciseDisplayName(exercise, displayTerminologyMode, settings.showExerciseForeignLanguage)),
        categoryLabel: getExerciseCategoryLabel(exercise),
        variationOptions: (exercise.variations ?? []).map((variant) => variant.name).filter(Boolean),
      });
    }
    return map;
  }, [displayTerminologyMode, exercises, settings.showExerciseForeignLanguage]);

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
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteConfirmAcknowledge, setDeleteConfirmAcknowledge] = useState(false);
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
  const [isTableDragging, setIsTableDragging] = useState(false);
  const resolvedUserId = userId && userId.trim().length > 0 ? userId : "anonymous";
  const isViewingAnotherUser = Boolean(historyTargetUserId && historyTargetUserId !== userId);
  const canEditTrainingLogs = !isViewingAnotherUser;
  const shouldDisableInputSection = Boolean(hideInputSection) || isViewingAnotherUser;
  const defaultTrainingLogTitle = isViewingAnotherUser && historyTargetUserName?.trim().length
    ? `${historyTargetUserName.trim()} ${t("Training Log", "normal")}`
    : t("Training Log", "normal");
  const trainingLogTitle = trainingLogTitleOverride?.trim().length
    ? trainingLogTitleOverride.trim()
    : defaultTrainingLogTitle;
  const tableModeStorageKey = `training-log-table-mode:${resolvedUserId}`;
  const workoutInputStorageKey = `training-log-workout-input:${resolvedUserId}`;
  const sortStorageKey = `${TRAINING_LOG_SORT_STORAGE_KEY_PREFIX}:${resolvedUserId}`;
  const columnOrderStorageKey = `${TRAINING_LOG_COLUMN_ORDER_STORAGE_KEY_PREFIX}:${resolvedUserId}`;
  const [workoutInput, setWorkoutInput] = useState<WorkoutInputState>(() => {
    const persisted = readPersistedWorkoutInput(workoutInputStorageKey, selectedTimeZone);
    return persisted ?? getDefaultWorkoutInput(selectedTimeZone);
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
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyNextCursor, setHistoryNextCursor] = useState<string | null>(null);
  const historyDockRef = useRef<HTMLDivElement | null>(null);
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState("");
  const [exerciseDropdownOpen, setExerciseDropdownOpen] = useState(false);
  const [exerciseHighlightIndex, setExerciseHighlightIndex] = useState(-1);
  const [mobileTextPreview, setMobileTextPreview] = useState<{ label: string; value: string } | null>(null);
  const [mobileInputPicker, setMobileInputPicker] = useState<MobileInputPickerState | null>(null);
  const [mobilePickerCanScrollDown, setMobilePickerCanScrollDown] = useState(false);
  const modifierWheelScrollRef = useRef<HTMLDivElement | null>(null);
  const exerciseSearchWrapRef = useRef<HTMLDivElement | null>(null);
  const exerciseInputRef = useRef<HTMLInputElement | null>(null);
  const desktopDateInputRef = useRef<HTMLInputElement | null>(null);
  const exerciseDropdownListRef = useRef<HTMLDivElement | null>(null);

  const syncExerciseDropdownPosition = useCallback(() => {
    if (typeof window === "undefined") return;

    const input = exerciseInputRef.current;
    if (!input) return;

    const rect = input.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportWidth = Math.round(viewport?.width ?? window.innerWidth);
    const viewportTop = Math.round(viewport?.offsetTop ?? 0);
    const viewportLeft = Math.round(viewport?.offsetLeft ?? 0);
    const width = Math.max(180, Math.min(Math.round(rect.width), viewportWidth - 16));
    const left = Math.max(8, Math.min(Math.round(rect.left + viewportLeft), viewportWidth - width - 8));
    const top = Math.max(8, Math.round(rect.bottom + viewportTop));

    setExerciseDropdownRect({ top, left, width });
  }, []);

  const openExerciseHistoryFromMobileCard = useCallback((entry: UnifiedFlatLogEntry) => {
    const query = new URLSearchParams();
    if (historyTargetUserId) {
      query.set("targetUserId", historyTargetUserId);
    }
    if (exerciseDetailSource) {
      query.set("from", exerciseDetailSource);
    }
    const basePath = `${DASHBOARD_ROUTES.root}/workout-history/${encodeURIComponent(entry.exerciseId)}`;
    const href = query.toString() ? `${basePath}?${query.toString()}` : basePath;
    router.push(href);
  }, [exerciseDetailSource, historyTargetUserId, router]);
  const [exerciseDropdownRect, setExerciseDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const appliedPrefillRef = useRef<string | null>(null);
  const [inputMode, setInputMode] = useState<"existing" | "new">("existing");
  const [inputValueMode, setInputValueMode] = useState<"weight" | "timed">("weight");
  const [inputWeightUnit, setInputWeightUnit] = useState<"kg" | "lbs">(() => (settings.defaultWeightUnit === "lbs" ? "lbs" : "kg"));
  const [isDateInputEditing, setIsDateInputEditing] = useState(false);
  const [dateInputDraft, setDateInputDraft] = useState("");
  const [activeDesktopInputCell, setActiveDesktopInputCell] = useState<string | null>(null);
  const [mobileInputOpen, setMobileInputOpen] = useState(Boolean(forceMobileInputOpen));
  const [trainingLogFocusMode, setTrainingLogFocusMode] = useState(false);

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
    const persisted = readPersistedWorkoutInput(workoutInputStorageKey, selectedTimeZone);
    setWorkoutInput(persisted ?? getDefaultWorkoutInput(selectedTimeZone));
    setLoadedWorkoutInputKey(workoutInputStorageKey);
  }, [loadedWorkoutInputKey, selectedTimeZone, workoutInputStorageKey]);

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
    if (!isMobile || shouldDisableInputSection) {
      setMobileInputOpen(false);
    }
  }, [isMobile, shouldDisableInputSection]);

  useEffect(() => {
    if (canEditTrainingLogs) return;
    if (!isEditMode && selectedEditLogId == null) return;
    setIsEditMode(false);
    setSelectedEditLogId(null);
    setHoveredEditLogId(null);
    setEditingData({});
    setDeleteConfirm(null);
  }, [canEditTrainingLogs, isEditMode, selectedEditLogId]);

  useEffect(() => {
    if (!isMobile) return;
    if (forceMobileInputOpen) {
      setMobileInputOpen(true);
    }
  }, [forceMobileInputOpen, isMobile]);

  useEffect(() => {
    if (!exerciseDropdownOpen) return;

    const handleViewportRefresh = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        setExerciseDropdownOpen(false);
        return;
      }

      syncExerciseDropdownPosition();
    };

    const visualViewport = window.visualViewport;
    handleViewportRefresh();
    window.addEventListener("resize", handleViewportRefresh);
    window.addEventListener("orientationchange", handleViewportRefresh);
    window.addEventListener("scroll", handleViewportRefresh, true);
    document.addEventListener("visibilitychange", handleViewportRefresh);
    visualViewport?.addEventListener("resize", handleViewportRefresh);
    visualViewport?.addEventListener("scroll", handleViewportRefresh);

    return () => {
      window.removeEventListener("resize", handleViewportRefresh);
      window.removeEventListener("orientationchange", handleViewportRefresh);
      window.removeEventListener("scroll", handleViewportRefresh, true);
      document.removeEventListener("visibilitychange", handleViewportRefresh);
      visualViewport?.removeEventListener("resize", handleViewportRefresh);
      visualViewport?.removeEventListener("scroll", handleViewportRefresh);
    };
  }, [exerciseDropdownOpen, syncExerciseDropdownPosition]);

  // Body scroll lock removed — mobile input is now in normal flow, not a modal.

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
  const workoutInputDateDisplay = useMemo(
    () => formatWorkoutInputDateDisplay(workoutInput.date, dateFormat, selectedTimeZone),
    [dateFormat, selectedTimeZone, workoutInput.date],
  );
  const dateInputPlaceholder = useMemo(() => {
    if (dateFormat === "dd-mm-yyyy") return "dd-mm-yyyy";
    if (dateFormat === "dd-mm-yy") return "dd-mm-yy";
    if (dateFormat === "dd-mmm-yy") return "dd-mmm-yy";
    return "dd-mmm-yyyy";
  }, [dateFormat]);
  const weightUnit = settings.defaultWeightUnit ?? "kg";
  const timedUnit: TimedUnitPref = settings.defaultTimedUnit ?? "seconds";
  const effectiveSimpleView = forceSimpleViewOnly ? true : isSimpleView;
  const useMobileAverageSummary = isMobile
    && Boolean(forceDesktopTableOnMobile)
    && Boolean(forceSimpleViewOnly)
    && Boolean(forceAverageSummaryOnMobile);
  const visibleColumnKeys = DEFAULT_UNIFIED_VISIBLE_COLUMNS;
  const visibleColumnSet = useMemo(() => new Set(visibleColumnKeys), [visibleColumnKeys]);
  const showDate = visibleColumnSet.has("date");
  const showCategory = visibleColumnSet.has("category") && !isMobile;
  const showProgression = visibleColumnSet.has("progression") && !effectiveSimpleView;
  const showModifier = visibleColumnSet.has("modifier");
  const showBand = false;
  const showVariant = visibleColumnSet.has("variant") && !effectiveSimpleView;
  const showNotes = visibleColumnSet.has("notes");
  const showStandardWeight = false;
  const showAvgWeight = visibleColumnSet.has("avgWeight");
  const showLevelColumn = false;
  const showActionsColumn = canEditTrainingLogs && isEditMode;

  const useMobileTableStyling = isMobile && !forceDesktopTableOnMobile;
  const useMobileCardView = isMobile && !forceDesktopTableOnMobile;
  const enableMobileTapToPreview = isMobile && Boolean(forceDesktopTableOnMobile) && Boolean(forceSimpleViewOnly);
  const effectiveCompact = compactSetting === "compact" || (compactSetting === "auto" && useMobileTableStyling);

  const openMobileTextPreview = useCallback((label: string, value: string) => {
    if (!enableMobileTapToPreview) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    setMobileTextPreview({ label, value: trimmed });
  }, [enableMobileTapToPreview]);

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
      const mobileBottomNav = isMobile
        ? document.querySelector<HTMLElement>("[data-mobile-bottom-nav='true']")
        : null;
      const navHeight = mobileBottomNav ? Math.ceil(mobileBottomNav.getBoundingClientRect().height) : 0;
      const bottomGap = isMobile ? Math.max(8, navHeight + 6) : 14;
      const minHeight = isMobile ? 220 : 260;
      const available = Math.floor(window.innerHeight - rect.top - bottomGap);
      setTableViewportHeight(Math.max(minHeight, available));
    };

    syncViewportHeight();
    window.addEventListener("resize", syncViewportHeight);
    return () => {
      window.removeEventListener("resize", syncViewportHeight);
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
    const base = headerKeys
      .map((key, idx) => ({ key, idx }))
      .filter(({ key }) => visibleColumnSet.has(key as import("@/context/DisplaySettingsContext").UnifiedVisibleColumnKey));

    if (!useMobileAverageSummary) return base;

    const firstValue = base.find((item) => headerTypes[item.idx] === "value");
    const firstReps = base.find((item) => headerTypes[item.idx] === "reps");
    return [firstValue, firstReps].filter((item): item is { key: string; idx: number } => Boolean(item));
  }, [headerKeys, headerTypes, useMobileAverageSummary, visibleColumnSet]);

  const summaryValueDataIdx = useMemo(
    () => visibleDataIndices.find((item) => headerTypes[item.idx] === "value")?.idx ?? null,
    [headerTypes, visibleDataIndices],
  );
  const summaryRepsDataIdx = useMemo(
    () => visibleDataIndices.find((item) => headerTypes[item.idx] === "reps")?.idx ?? null,
    [headerTypes, visibleDataIndices],
  );

  const defaultColumnOrder = useMemo(() => {
    const cols: string[] = [];
    if (showDate) cols.push("date");
    if (showCategory) cols.push("category");
    cols.push("exercise");
    if (showProgression) cols.push("progression");
    if (showVariantColumnResponsive) cols.push("variant");

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
      if (sortState.columnId === "progression") {
        const progressionLabel = getProgressionTierLabel(ex, entry.levelNameLevel);
        return progressionLabel.toLowerCase();
      }
      if (sortState.columnId === "exercise") {
        const entryDisplayName = ex
          ? stripBwPercentHint(getExerciseDisplayName(ex, displayTerminologyMode, settings.showExerciseForeignLanguage))
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
  }, [allEntries, sortState, exerciseLookup, displayTerminologyMode, physique.bodyWeightKg, headerTypes, columnGrouped, settings.showExerciseForeignLanguage]);

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

  const isOpenedTableMode = !fitToScreenMode;
  const effectiveViewportHeight = isOpenedTableMode
    ? Math.min(entries.length, 30) * VIRTUAL_ROW_HEIGHT + 48
    : tableViewportHeight;

  const shouldVirtualizeTable = !isMobile && entries.length > 40;
  const virtualScrollTop = tableScrollTop;
  const virtualViewportHeight = effectiveViewportHeight;
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
    const selectableExercises = exercises.filter((exercise) => !isDeletedExerciseDescription(exercise.story));

    return [...selectableExercises].sort((a, b) => {
      const aName = exerciseMetaById.get(a.id)?.displayName ?? a.name;
      const bName = exerciseMetaById.get(b.id)?.displayName ?? b.name;
      return aName.localeCompare(bName, undefined, { sensitivity: "base", numeric: true });
    });
  }, [exerciseMetaById, exercises]);

  const sortedExerciseOptions = useMemo(
    () => sortedExercises.map((exercise) => ({
      id: exercise.id,
      label: exerciseMetaById.get(exercise.id)?.displayName ?? stripBwPercentHint(getExerciseDisplayName(exercise, displayTerminologyMode, settings.showExerciseForeignLanguage)),
    })),
    [exerciseMetaById, displayTerminologyMode, settings.showExerciseForeignLanguage, sortedExercises],
  );

  const sortedProgressionTiersByExerciseId = useMemo(() => {
    const map = new Map<string, ProgressionExercise["tiers"]>();
    for (const exercise of exercises) {
      map.set(exercise.id, [...(exercise.tiers ?? [])].sort((a, b) => a.level - b.level));
    }
    return map;
  }, [exercises]);

  const staleEntryByLogId = useMemo(() => {
    const map = new Map<string, boolean>();
    const staleCutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const entry of entries) {
      map.set(entry.logId, new Date(entry.date).getTime() < staleCutoffMs);
    }
    return map;
  }, [entries]);

  const filteredInputExercises = useMemo<InputExerciseSearchResult[]>(() => {
    const trimmedSearchTerm = exerciseSearchTerm.trim();
    const query = trimmedSearchTerm.toLowerCase();
    const customExerciseOption: InputExerciseSearchResult = {
      mode: "custom",
      displayLabel: trimmedSearchTerm ? `New Custom Exercise: ${trimmedSearchTerm}` : "New Custom Exercise",
      searchLabel: trimmedSearchTerm,
      canonicalName: trimmedSearchTerm,
      hasHistory: false,
      lastLoggedAt: null,
      matchSource: "name",
    };

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

      const logs = exercise.userProgress?.[0]?.logs ?? [];
      const latestLogDate = logs.length > 0
        ? logs.reduce((latest, log) => new Date(log.createdAt).getTime() > new Date(latest).getTime() ? log.createdAt : latest, logs[0].createdAt)
        : null;

      return {
        exercise,
        displayName,
        canonicalName,
        progressionNames,
        variantNames,
        hasHistory: logs.length > 0,
        lastLoggedAt: latestLogDate,
      };
    });

    if (!query) {
      return [
        customExerciseOption,
        ...baseResults.map((row) => ({
          mode: "exercise" as const,
          exercise: row.exercise,
          displayLabel: row.displayName,
          searchLabel: row.displayName,
          canonicalName: row.canonicalName,
          hasHistory: row.hasHistory,
          lastLoggedAt: row.lastLoggedAt,
          matchSource: "name" as const,
        })),
      ];
    }

    const next: InputExerciseSearchResult[] = [customExerciseOption];
    const seen = new Set<string>();
    const pushUnique = (item: InputExerciseSearchResult) => {
      if (!item.exercise) return;
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
          canonicalName: row.canonicalName,
          hasHistory: row.hasHistory,
          lastLoggedAt: row.lastLoggedAt,
          matchSource: "name",
        });
      }

      for (const progression of row.progressionNames) {
        if (!progression.name.toLowerCase().includes(query)) continue;
        const contextual = `(${progression.name}) ${row.displayName}`;
        pushUnique({
          exercise: row.exercise,
          displayLabel: contextual,
          searchLabel: contextual,
          canonicalName: row.canonicalName,
          hasHistory: row.hasHistory,
          lastLoggedAt: row.lastLoggedAt,
          matchSource: "progression",
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
          canonicalName: row.canonicalName,
          hasHistory: row.hasHistory,
          lastLoggedAt: row.lastLoggedAt,
          matchSource: "variant",
          prefillVariant: variant,
        });
      }
    }

    return rankExerciseSearchResults<InputExerciseSearchResult>(next, query);
  }, [exerciseMetaById, exerciseSearchTerm, sortedExercises]);

  const signedModifierOptions = useMemo(() => {
    const positives = [...MODIFIER_WEIGHT_OPTIONS].sort((a, b) => a - b);
    const negatives = positives.map((value) => -value).sort((a, b) => a - b);
    return [...negatives, ...positives];
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
        label: stripBwPercentHint(tier.name || "-"),
      }));

    if (tiers.length === 0) return [{ value: "1", label: "-" }];
    return tiers;
  }, [selectedInputExercise]);

  const selectedProgressionLabel = useMemo(() => {
    const selected = inputProgressionOptions.find((option) => option.value === workoutInput.level);
    return selected?.label ?? inputProgressionOptions[0]?.label ?? "-";
  }, [inputProgressionOptions, workoutInput.level]);

  const selectedVariantLabel = useMemo(() => {
    const variant = String(workoutInput.variant || "").trim();
    return variant || "-";
  }, [workoutInput.variant]);

  const selectedModifierLabel = useMemo(() => {
    const raw = String(workoutInput.modifierKg || "").trim();
    if (!raw) return "-";
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? formatSignedModifierKg(parsed) : raw;
  }, [workoutInput.modifierKg]);

  const modifierWheelOptions = useMemo(() => {
    const merged = Array.from(new Set([...signedModifierOptions, 0])).sort((a, b) => a - b);
    return merged.map((kg) => ({
      value: String(kg),
      label: kg === 0 ? "0" : formatSignedModifierKg(kg),
    }));
  }, [signedModifierOptions]);

  const mobileInputPickerOptions = useMemo(() => {
    if (!mobileInputPicker) return [] as Array<{ value: string; label: string }>;

    if (mobileInputPicker.field === "level") {
      return inputProgressionOptions.map((option) => ({ value: option.value, label: option.label }));
    }

    if (mobileInputPicker.field === "variant") {
      return [
        { value: "", label: "-" },
        ...inputVariantOptions.map((variant) => ({ value: variant, label: variant })),
      ];
    }

    return modifierWheelOptions;
  }, [mobileInputPicker, inputProgressionOptions, inputVariantOptions, modifierWheelOptions]);

  const mobileInputPickerCurrentValue = useMemo(() => {
    if (!mobileInputPicker) return "";
    if (mobileInputPicker.field === "level") return String(workoutInput.level || "");
    if (mobileInputPicker.field === "variant") return String(workoutInput.variant || "");
    return "0";
  }, [mobileInputPicker, workoutInput.level, workoutInput.variant, workoutInput.modifierKg]);

  useEffect(() => {
    if (!mobileInputPicker) return;
    const scroller = modifierWheelScrollRef.current;
    if (!scroller) return;

    const itemHeight = 44;
    const viewportHeight = 224;
    const sidePadding = (viewportHeight - itemHeight) / 2;
    const targetValue = mobileInputPicker.field === "modifierKg" ? "0" : mobileInputPickerCurrentValue;
    const selectedIndex = Math.max(
      0,
      mobileInputPickerOptions.findIndex((option) => option.value === targetValue),
    );
    const targetTop = selectedIndex * itemHeight - sidePadding;

    const applyScrollPosition = () => {
      scroller.scrollTop = Math.max(0, targetTop);
    };

    applyScrollPosition();
    const rafId = window.requestAnimationFrame(applyScrollPosition);
    const timeoutId = window.setTimeout(applyScrollPosition, 120);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [mobileInputPicker, mobileInputPickerOptions, mobileInputPickerCurrentValue]);

  useEffect(() => {
    if (!mobileInputPicker) {
      setMobilePickerCanScrollDown(false);
      return;
    }
    const scroller = modifierWheelScrollRef.current;
    if (!scroller) return;

    const updateScrollHints = () => {
      const canScrollDown = scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 4;
      setMobilePickerCanScrollDown(canScrollDown);
    };

    updateScrollHints();
    const rafId = window.requestAnimationFrame(updateScrollHints);
    const timeoutId = window.setTimeout(updateScrollHints, 120);
    scroller.addEventListener("scroll", updateScrollHints, { passive: true });
    window.addEventListener("resize", updateScrollHints);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      scroller.removeEventListener("scroll", updateScrollHints);
      window.removeEventListener("resize", updateScrollHints);
    };
  }, [mobileInputPicker, mobileInputPickerOptions]);

  useEffect(() => {
    if (!selectedInputExercise) return;
    setWorkoutInput((prev) => {
      if (prev.exerciseId !== selectedInputExercise.id) return prev;
      if (prev.level && inputProgressionOptions.some((option) => option.value === prev.level)) return prev;
      const fallbackLevel = String(selectedInputExercise.userProgress?.[0]?.currentLevel ?? Number(inputProgressionOptions[0]?.value || "1"));
      return { ...prev, level: fallbackLevel };
    });
  }, [inputProgressionOptions, selectedInputExercise]);

  useEffect(() => {
    if (inputMode === "new") {
      setInputValueMode("weight");
      return;
    }
    if (!selectedInputExercise) {
      setInputValueMode("weight");
      return;
    }
    const inferred = inferExerciseType(selectedInputExercise, false);
    setInputValueMode(inferred === "timed" ? "timed" : "weight");
  }, [inputMode, selectedInputExercise]);

  useEffect(() => {
    setInputWeightUnit(weightUnit === "lbs" ? "lbs" : "kg");
  }, [weightUnit]);

  const hasSelectedInputExercise = Boolean(workoutInput.exerciseId);
  const hasNewExerciseName = workoutInput.newExerciseName.trim().length >= 2;
  const canSubmitWorkoutInput = inputMode === "new" ? hasNewExerciseName : hasSelectedInputExercise;
  const isTimedInput = inputValueMode === "timed";
  const desktopValueHeaderPrefix = isTimedInput ? "T" : "W";
  const setValuePlaceholder = isTimedInput ? "secs" : (inputWeightUnit === "lbs" ? "lbs" : "kgs");
  const trainingLogHeaderTextColor = "var(--gold)";
  const inputSectionHeaderTextColor = "var(--jade-glow)";
  const inputProgressionTone = getSimpleLabelTone("progression");
  const inputVariantTone = getSimpleLabelTone("variant");
  const desktopInputSetColumns = columnGrouped
    ? [
        { key: "val1", label: `${desktopValueHeaderPrefix}1` },
        { key: "val2", label: `${desktopValueHeaderPrefix}2` },
        { key: "val3", label: `${desktopValueHeaderPrefix}3` },
        { key: "reps1", label: "R1" },
        { key: "reps2", label: "R2" },
        { key: "reps3", label: "R3" },
      ]
    : [
        { key: "val1", label: `${desktopValueHeaderPrefix}1` },
        { key: "reps1", label: "R1" },
        { key: "val2", label: `${desktopValueHeaderPrefix}2` },
        { key: "reps2", label: "R2" },
        { key: "val3", label: `${desktopValueHeaderPrefix}3` },
        { key: "reps3", label: "R3" },
      ];

  const fetchExerciseHistoryPage = useCallback(async (
    exerciseId: string,
    progressionLevel: number | null,
    cursor: string | null,
  ): Promise<{ history: ExerciseHistoryEntry[]; nextCursor: string | null }> => {
    const params = new URLSearchParams({ exerciseId, limit: "24" });
    if (typeof progressionLevel === "number" && Number.isFinite(progressionLevel) && progressionLevel > 0) {
      params.set("progressionLevel", String(progressionLevel));
    }
    if (historyTargetUserId) {
      params.set("targetUserId", historyTargetUserId);
    }
    if (cursor) {
      params.set("cursor", cursor);
    }
    const response = await fetch(`/api/exercises/history?${params.toString()}`, { credentials: "include" });
    if (!response.ok) {
      throw new Error("Failed to fetch exercise history page");
    }
    const data = (await response.json()) as ExerciseHistoryResponse;
    const payload = data.data ?? data;
    return {
      history: Array.isArray(payload.history) ? payload.history : [],
      nextCursor: typeof payload.nextCursor === "string" ? payload.nextCursor : null,
    };
  }, [historyTargetUserId]);

  useEffect(() => {
    if (inputMode === "new" || !selectedInputExercise?.id) {
      setHistoryData([]);
      setHistoryLoading(false);
      setHistoryLoadingMore(false);
      setHistoryNextCursor(null);
      return;
    }

    let cancelled = false;
    setHistoryLoading(true);
    setHistoryLoadingMore(false);
    setHistoryNextCursor(null);

    const selectedProgressionLevel = Number.parseInt(workoutInput.level || "", 10);
    const progressionLevel = Number.isFinite(selectedProgressionLevel) && selectedProgressionLevel > 0
      ? selectedProgressionLevel
      : null;

    fetchExerciseHistoryPage(selectedInputExercise.id, progressionLevel, null)
      .then(({ history, nextCursor }) => {
        if (cancelled) return;
        setHistoryData(history);
        setHistoryNextCursor(nextCursor);
        if (history.length > 0) {
          setHistoryDockOpen(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setHistoryData([]);
        setHistoryNextCursor(null);
      })
      .finally(() => {
        if (cancelled) return;
        setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchExerciseHistoryPage, inputMode, selectedInputExercise?.id, workoutInput.level]);

  const handleLoadMoreHistory = useCallback(async () => {
    const selectedExerciseId = selectedInputExercise?.id;
    const selectedProgressionLevel = Number.parseInt(workoutInput.level || "", 10);
    const progressionLevel = Number.isFinite(selectedProgressionLevel) && selectedProgressionLevel > 0
      ? selectedProgressionLevel
      : null;
    if (!selectedExerciseId || !historyNextCursor || historyLoading || historyLoadingMore) return;

    setHistoryLoadingMore(true);
    try {
      const { history, nextCursor } = await fetchExerciseHistoryPage(selectedExerciseId, progressionLevel, historyNextCursor);
      setHistoryData((prev) => {
        if (history.length === 0) return prev;
        const seen = new Set(prev.map((entry) => entry.id));
        const appended = history.filter((entry) => !seen.has(entry.id));
        return appended.length > 0 ? [...prev, ...appended] : prev;
      });
      setHistoryNextCursor(nextCursor);
    } catch {
      // Keep existing history panel state when pagination fails.
    } finally {
      setHistoryLoadingMore(false);
    }
  }, [fetchExerciseHistoryPage, historyLoading, historyLoadingMore, historyNextCursor, selectedInputExercise?.id, workoutInput.level]);

  useEffect(() => {
    if (inputMode === "new") {
      setExerciseSearchTerm("");
      return;
    }
    if (!workoutInput.exerciseId) {
      setExerciseSearchTerm("");
      return;
    }
    const selectedExercise = exerciseLookup.get(workoutInput.exerciseId);
    if (!selectedExercise) {
      setExerciseSearchTerm("");
      return;
    }
    setExerciseSearchTerm(stripBwPercentHint(getExerciseDisplayName(selectedExercise, displayTerminologyMode, settings.showExerciseForeignLanguage)));
  }, [inputMode, workoutInput.exerciseId, exerciseLookup, displayTerminologyMode, settings.showExerciseForeignLanguage]);

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
        const displayName = stripBwPercentHint(getExerciseDisplayName(exercise, displayTerminologyMode, settings.showExerciseForeignLanguage)).trim().toLowerCase();
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
  }, [exerciseLookup, exercises, prefillExerciseId, prefillExerciseName, prefillProgression, prefillVariant, displayTerminologyMode, settings.showExerciseForeignLanguage]);

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
    if (colType === "value" && exType === "timed") {
      return { backgroundColor: "var(--timed-cell-bg)" };
    }
    if (value === 0) return { backgroundColor: "var(--ink-mid)", color: "var(--mist-dark)" };
    if (columnColors && colType === "value") {
      return { backgroundColor: "var(--col-weight-bg)" };
    }
    if (columnColors && colType === "reps") return { backgroundColor: "var(--col-reps-bg)" };
    return undefined;
  };

  const handleEditModeToggle = () => {
    if (!canEditTrainingLogs) return;
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
      setEditingData({});
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
    if (!canEditTrainingLogs) return;
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
    if (!canEditTrainingLogs) return;
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

  const handleWorkoutInputDateBlur = () => {
    const parsed = parseWorkoutInputDateDisplay(dateInputDraft, dateFormat);
    if (parsed) {
      handleWorkoutInputChange("date", parsed);
    }
    setIsDateInputEditing(false);
  };

  const handleDesktopInputCellKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === "Escape") {
      setActiveDesktopInputCell(null);
      event.currentTarget.blur();
    }
  };

  const openDesktopDatePicker = useCallback(() => {
    const input = desktopDateInputRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerInput.showPicker === "function") {
      try {
        pickerInput.showPicker();
        return;
      } catch {
        // Some environments block programmatic picker opening.
      }
    }
    input.click();
  }, []);

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

  const selectNewCustomExercise = useCallback((prefillName?: string) => {
    const nextName = (prefillName ?? exerciseSearchTerm).trim();
    setInputMode("new");
    setWorkoutInput((prev) => ({
      ...clearWorkoutInputEntryFields(prev, ""),
      newExerciseName: nextName,
    }));
    setExerciseSearchTerm("");
    setExerciseDropdownOpen(false);
    setExerciseHighlightIndex(-1);
    requestAnimationFrame(() => setActiveDesktopInputCell("newExerciseName"));
  }, [exerciseSearchTerm]);

  const applyInputExerciseSelection = (result: InputExerciseSearchResult) => {
    if (result.mode === "custom") {
      selectNewCustomExercise(result.searchLabel);
      return;
    }

    const selectedExercise = result.exercise;
    if (!selectedExercise) return;
    const defaultLevel = String(selectedExercise.userProgress?.[0]?.currentLevel ?? 1);
    const nextLevel = result.prefillLevel || defaultLevel;

    setInputMode("existing");
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
    const toSeconds = (value: number | null): number | null => (value == null ? null : Math.max(0, Math.round(value)));
    const toStoredWeightKg = (value: number | null): number | null => {
      if (value == null) return null;
      if (isTimedInput) return null;
      return inputWeightUnit === "lbs" ? lbsToKg(value) : value;
    };
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

    if (inputMode === "new") {
      const nextExerciseName = workoutInput.newExerciseName.trim();
      if (nextExerciseName.length < 2) {
        setSaveMessage({ type: "error", text: "Enter a new exercise name" });
        return;
      }

      const createdAt = buildCreatedAtFromDateInput(workoutInput.date, selectedTimeZone);

      setIsSaving(true);
      try {
        const created = await api.post<{ exercise?: { id: string } }>("/api/exercise-library", {
          name: nextExerciseName,
          category: "Other",
          exerciseType: "bodyweight",
          muscleGroups: ["Other"],
          progression: [nextExerciseName],
          variations: [],
          pendingReview: true,
        });

        const exerciseId = created.exercise?.id;
        if (!exerciseId) {
          throw new Error("Unable to create exercise");
        }

        await api.post(`/api/progressions/${exerciseId}/log`, {
          level: 1,
          trainingDate: workoutInput.date,
          weight1: toStoredWeightKg(val1),
          reps1,
          weight2: toStoredWeightKg(val2),
          reps2,
          weight3: toStoredWeightKg(val3),
          reps3,
          holdTime: isTimedInput ? toSeconds(val1) : null,
          holdTime2: isTimedInput ? toSeconds(val2) : null,
          holdTime3: isTimedInput ? toSeconds(val3) : null,
          modifier: null,
          variant: null,
          notes: workoutInput.notes || null,
          completed: false,
          createdAt,
        });

        setSaveMessage({ type: "success", text: "Pending exercise added to log and library" });
        setWorkoutInput((prev) => ({
          ...prev,
          exerciseId: "",
          level: "",
          newExerciseName: "",
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
        setExerciseSearchTerm("");
        setExerciseDropdownOpen(false);
        setExerciseHighlightIndex(-1);
        window.dispatchEvent(new Event("progression-exercises-updated"));
        onRefresh();
        if (isMobile) handleMobileInputClose();
      } catch (err) {
        if (err instanceof ApiRequestError) {
          setSaveMessage({ type: "error", text: err.message || "Failed to add pending exercise" });
        } else {
          setSaveMessage({ type: "error", text: "Failed to create pending exercise" });
        }
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!workoutInput.exerciseId) {
      setSaveMessage({ type: "error", text: "Please select an exercise first" });
      return;
    }

    const selectedExercise = exerciseLookup.get(workoutInput.exerciseId);
    if (!selectedExercise) {
      setSaveMessage({ type: "error", text: "Selected exercise is not available" });
      return;
    }

    const selectedLevel = Number.parseInt(workoutInput.level || "", 10);
    const level = Number.isFinite(selectedLevel) && selectedLevel > 0
      ? selectedLevel
      : (selectedExercise.userProgress?.[0]?.currentLevel ?? 1);
    const modifier = workoutInput.modifierKg ? formatSignedModifierKg(parseFloat(workoutInput.modifierKg)) : null;
    const createdAt = buildCreatedAtFromDateInput(workoutInput.date, selectedTimeZone);

    setIsSaving(true);
    try {
      await api.post(`/api/progressions/${workoutInput.exerciseId}/log`, {
        level,
        trainingDate: workoutInput.date,
        weight1: toStoredWeightKg(val1),
        reps1,
        weight2: toStoredWeightKg(val2),
        reps2,
        weight3: toStoredWeightKg(val3),
        reps3,
        holdTime: isTimedInput ? toSeconds(val1) : null,
        holdTime2: isTimedInput ? toSeconds(val2) : null,
        holdTime3: isTimedInput ? toSeconds(val3) : null,
        modifier,
        variant: workoutInput.variant || null,
        notes: workoutInput.notes || null,
        completed: false,
        createdAt,
      });

      setSaveMessage({ type: "success", text: "Training log added" });
      setWorkoutInput((prev) => ({
        ...prev,
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
      }));
      setExerciseSearchTerm("");
      setExerciseDropdownOpen(false);
      setExerciseHighlightIndex(-1);
      onRefresh();
      if (isMobile) handleMobileInputClose();
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
    if (!canEditTrainingLogs) return;
    setIsDeleting(true);
    try {
      await api.post("/api/progressions/logs/delete", { logId });
      setSaveMessage({ type: "success", text: "Log record deleted successfully" });
      setDeleteConfirm(null);
      setDeleteConfirmText("");
      setDeleteConfirmAcknowledge(false);
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
      return val == null ? "" : formatSetReps(val, entry.exerciseType);
    }
    // Value column
    const val = fieldIndex === 0 ? entry.val1 : fieldIndex === 1 ? entry.val2 : entry.val3;
    return val == null ? "" : formatSetValue(val, entry.exerciseType, weightUnit, undefined, timedUnit);
  };

  /** Map visible column back to edit data field */
  const getEditField = (colType: "value" | "reps", fieldIndex: number): string => {
    if (colType === "reps") return `reps${fieldIndex + 1}`;
    return `val${fieldIndex + 1}`;
  };

  const handleMobileInputClose = () => {
    if (forceMobileInputOpen) {
      router.push("/dashboard/train");
      return;
    }
    setMobileInputOpen(false);
  };

  const headerTypographyClass = "font-semibold text-[10px] sm:text-[11px] uppercase tracking-[0.08em] text-jade-glow";
  const headerPadClass = effectiveCompact ? "tl-head-pad-compact" : "tl-head-pad";
  const cellPadTight = effectiveCompact ? "tl-cell-pad-tight-compact" : "tl-cell-pad-tight";
  const cellPadStandard = effectiveCompact ? "tl-cell-pad-standard-compact" : "tl-cell-pad-standard";
  const cellPadWide = effectiveCompact ? "tl-cell-pad-wide-compact" : "tl-cell-pad-wide";
  const cellPadExercise = effectiveCompact ? "tl-cell-pad-exercise-compact" : "tl-cell-pad-exercise";
  const segmentedToggleButtonClass = "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all duration-150";
  const toolbarButtonClass = "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]";
  const panelIconButtonClass = "inline-flex h-6 w-6 items-center justify-center rounded border text-xs font-bold transition-colors hover:bg-ink-mid/35";
  const mobileFieldRowClass = "training-log-mobile-row w-full min-w-0 max-w-[760px] mx-auto grid grid-cols-[5.25rem_minmax(0,1fr)] sm:grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2 px-2.5 sm:px-4";
  const mobileFieldLabelClass = "training-log-mobile-label text-xs font-medium text-left uppercase";
  const inputModeOptionButtonClass = `training-log-mobile-toggle w-full min-h-9 appearance-none rounded-md border px-3 py-2 text-center font-semibold leading-tight whitespace-nowrap transition-[transform,box-shadow,border-color,background-color,color] duration-150 hover:scale-[1.005] active:scale-[0.985] ${isMobile ? "text-sm" : "text-xs"}`;
  const selectCaretStyle = {
    appearance: "none" as const,
    backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23b5bac1' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.7' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
    backgroundPosition: "right 8px center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "16px",
    paddingRight: "30px",
  };
  const inputActionPrimaryStyle = {
    borderColor: "color-mix(in srgb, var(--jade-glow) 62%, var(--border))",
    color: "var(--cloud-white)",
    background: "linear-gradient(135deg, color-mix(in srgb, var(--jade-glow) 36%, var(--ink-mid)) 0%, color-mix(in srgb, var(--jade) 34%, var(--ink-deep)) 100%)",
    boxShadow: "0 0 0 1px color-mix(in srgb, var(--jade-glow) 22%, transparent) inset, 0 8px 18px color-mix(in srgb, black 28%, transparent)",
  };
  const inputActionSecondaryStyle = {
    borderColor: "color-mix(in srgb, var(--mountain-blue-glow) 42%, var(--border))",
    color: "color-mix(in srgb, var(--cloud-white) 92%, var(--mountain-blue-glow))",
    background: "linear-gradient(135deg, color-mix(in srgb, var(--mountain-blue-glow) 20%, var(--ink-mid)) 0%, color-mix(in srgb, var(--ink-mid) 80%, var(--ink-deep)) 100%)",
    boxShadow: "0 0 0 1px color-mix(in srgb, var(--mountain-blue-glow) 16%, transparent) inset, 0 6px 14px color-mix(in srgb, black 24%, transparent)",
  };
  const deleteTargetEntry = useMemo(() => {
    if (!deleteConfirm) return null;
    return entries.find((entry) => entry.logId === deleteConfirm.logId) ?? null;
  }, [deleteConfirm, entries]);
  const deleteTargetSetCount = deleteTargetEntry
    ? [deleteTargetEntry.reps1, deleteTargetEntry.reps2, deleteTargetEntry.reps3].filter((reps) => typeof reps === "number" && reps > 0).length
    : 0;
  const deleteTargetDate = deleteTargetEntry
    ? (formattedDateByLogId.get(deleteTargetEntry.logId) ?? formatDate(deleteTargetEntry.date, dateFormat))
    : "-";
  const isDeleteConfirmationReady = deleteConfirmAcknowledge && deleteConfirmText.trim().toUpperCase() === "DELETE";
  const shouldRenderInputSection = !shouldDisableInputSection && (!isMobile || mobileInputOpen);

  return (
    <>
      <div className="w-full">
        {!isMobile && isViewingAnotherUser && (
          <div
            className="mb-4 w-full rounded-2xl border px-4 py-3 relative overflow-hidden"
            style={{
              borderColor: "color-mix(in srgb, var(--jade-glow) 42%, var(--border))",
              background: "linear-gradient(145deg, color-mix(in srgb, var(--ink-deep) 88%, black 12%) 0%, color-mix(in srgb, var(--ink-mid) 88%, black 12%) 100%)",
              boxShadow: "0 0 0 1px color-mix(in srgb, var(--jade-glow) 20%, transparent), 0 10px 26px color-mix(in srgb, black 42%, transparent)",
            }}
          >
            <div
              aria-hidden="true"
              className="absolute left-0 top-0 h-full w-1"
              style={{ background: "linear-gradient(180deg, var(--jade-glow) 0%, color-mix(in srgb, var(--gold) 75%, var(--jade-glow)) 100%)" }}
            />
            <div className="flex items-center justify-between gap-3 pl-2">
              <span
                className="inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
                style={{
                  color: "var(--cloud-white)",
                  borderColor: "color-mix(in srgb, var(--jade-glow) 44%, var(--border))",
                  backgroundColor: "color-mix(in srgb, var(--jade-glow) 18%, var(--ink-deep))",
                }}
              >
                <span className="mr-1.5 inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--jade-light)" }} />
                <span title={tHint("Training Log Input Section", "normal") ?? undefined}>{t("Training Log Input Section", "normal")}</span>
              </span>
              <span
                className="rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                style={{
                  borderColor: "color-mix(in srgb, var(--gold) 42%, var(--border))",
                  color: "color-mix(in srgb, var(--gold) 72%, var(--cloud-white))",
                  backgroundColor: "color-mix(in srgb, var(--gold) 14%, var(--ink-deep))",
                }}
              >
                <span title={tHint("Collapsed", "normal") ?? undefined}>{t("Collapsed", "normal")}</span>
              </span>
            </div>
            <p className="mt-2 pl-2 text-xs" style={{ color: "color-mix(in srgb, var(--cloud-white) 78%, var(--text-secondary))" }}>
              {t("Input is disabled while viewing another user.", "normal")}
            </p>
          </div>
        )}
        {shouldRenderInputSection && (
          <div
            className="w-full rounded-2xl relative overflow-hidden min-w-0 mb-6 nyaa-input-section training-log-modern-shell"
          >
            <div
              className={`flex flex-wrap items-center justify-between gap-2.5 px-3 py-2.5 border-b min-w-0 ${isMobile ? "relative pr-20" : ""}`}
              style={{
                borderColor: "color-mix(in srgb, var(--jade-glow) 30%, var(--border))",
                backgroundColor: "color-mix(in srgb, var(--jade-glow) 9%, var(--ink-dark))",
              }}
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.09em] shrink-0" style={{ color: "var(--jade-light)" }} title={tHint("Training Log Input", "normal") ?? undefined}>
                {t("Training Log Input", "normal")}
              </span>
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                {!isMobile && (
                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center rounded-lg border p-1" style={{ borderColor: "color-mix(in srgb, var(--jade-glow) 25%, var(--border))", backgroundColor: "color-mix(in srgb, var(--ink-mid) 85%, var(--ink-deep))" }}>
                      <button
                        type="button"
                        onClick={() => setInputValueMode("weight")}
                        className={segmentedToggleButtonClass}
                        style={{
                          color: !isTimedInput ? "var(--cloud-white)" : "var(--text-secondary)",
                          backgroundColor: !isTimedInput ? "color-mix(in srgb, var(--jade-glow) 24%, transparent)" : "transparent",
                          boxShadow: !isTimedInput ? "0 0 0 1px color-mix(in srgb, var(--jade-glow) 35%, transparent) inset" : "none",
                        }}
                      >
                        <span title={tHint("Weight", "normal") ?? undefined}>{t("Weight", "normal")}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputValueMode("timed")}
                        className={segmentedToggleButtonClass}
                        style={{
                          color: isTimedInput ? "var(--cloud-white)" : "var(--text-secondary)",
                          backgroundColor: isTimedInput ? "color-mix(in srgb, var(--timed-color) 16%, transparent)" : "transparent",
                          boxShadow: isTimedInput ? "0 0 0 1px color-mix(in srgb, var(--timed-color) 45%, transparent) inset" : "none",
                        }}
                      >
                        <span title={tHint("Timed", "normal") ?? undefined}>{t("Timed", "normal")}</span>
                      </button>
                    </div>
                    <div className="inline-flex items-center rounded-lg border p-1" style={{ borderColor: "color-mix(in srgb, var(--jade-glow) 25%, var(--border))", backgroundColor: "color-mix(in srgb, var(--ink-mid) 85%, var(--ink-deep))" }}>
                      <button
                        type="button"
                        onClick={() => setInputWeightUnit("kg")}
                        disabled={isTimedInput}
                        className={segmentedToggleButtonClass}
                        style={{
                          color: inputWeightUnit === "kg" ? "var(--cloud-white)" : "var(--text-secondary)",
                          backgroundColor: inputWeightUnit === "kg" ? "color-mix(in srgb, var(--jade-glow) 24%, transparent)" : "transparent",
                          boxShadow: inputWeightUnit === "kg" ? "0 0 0 1px color-mix(in srgb, var(--jade-glow) 35%, transparent) inset" : "none",
                          opacity: isTimedInput ? 0.45 : 1,
                          cursor: isTimedInput ? "not-allowed" : "pointer",
                        }}
                      >
                        kg
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputWeightUnit("lbs")}
                        disabled={isTimedInput}
                        className={segmentedToggleButtonClass}
                        style={{
                          color: inputWeightUnit === "lbs" ? "var(--cloud-white)" : "var(--text-secondary)",
                          backgroundColor: inputWeightUnit === "lbs" ? "color-mix(in srgb, var(--jade-glow) 24%, transparent)" : "transparent",
                          boxShadow: inputWeightUnit === "lbs" ? "0 0 0 1px color-mix(in srgb, var(--jade-glow) 35%, transparent) inset" : "none",
                          opacity: isTimedInput ? 0.45 : 1,
                          cursor: isTimedInput ? "not-allowed" : "pointer",
                        }}
                      >
                        lbs
                      </button>
                    </div>
                  </div>
                )}
                <div className="inline-flex items-center rounded-lg border p-1" style={{ borderColor: "color-mix(in srgb, var(--jade-glow) 25%, var(--border))", backgroundColor: "color-mix(in srgb, var(--ink-mid) 85%, var(--ink-deep))" }}>
                  <button
                    type="button"
                    onClick={() => setInputMode("existing")}
                    className={segmentedToggleButtonClass}
                    style={{
                      color: inputMode === "existing" ? "var(--cloud-white)" : "var(--text-secondary)",
                      backgroundColor: inputMode === "existing" ? "color-mix(in srgb, var(--jade-glow) 24%, transparent)" : "transparent",
                      boxShadow: inputMode === "existing" ? "0 0 0 1px color-mix(in srgb, var(--jade-glow) 35%, transparent) inset" : "none",
                    }}
                  >
                    <span title={tHint("Existing Exercise", "normal") ?? undefined}>{t("Existing Exercise", "normal")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode("new");
                      setWorkoutInput((prev) => ({ ...prev, exerciseId: "", level: "", variant: "", modifierKg: "", notes: "" }));
                      setExerciseDropdownOpen(false);
                    }}
                    className={segmentedToggleButtonClass}
                    style={{
                      color: inputMode === "new" ? "var(--cloud-white)" : "var(--text-secondary)",
                      backgroundColor: inputMode === "new" ? "color-mix(in srgb, var(--forest) 18%, transparent)" : "transparent",
                      boxShadow: inputMode === "new" ? "0 0 0 1px color-mix(in srgb, var(--forest) 42%, transparent) inset" : "none",
                    }}
                  >
                    <span title={tHint("New Custom Exercise", "normal") ?? undefined}>{t("New Custom Exercise", "normal")}</span>
                  </button>
                </div>
              </div>
              {isMobile && (
                <button
                  type="button"
                  onClick={handleMobileInputClose}
                  className={`${toolbarButtonClass} absolute right-3 top-2`}
                  style={{ borderColor: "color-mix(in srgb, var(--jade-glow) 28%, var(--border))", color: "var(--cloud-white)", backgroundColor: "color-mix(in srgb, var(--jade-glow) 14%, transparent)" }}
                >
                  <span title={tHint("Close", "normal") ?? undefined}>{t("Close", "normal")}</span>
                </button>
              )}
            </div>
            <div className={`px-0 min-w-0 ${isMobile ? "py-3" : "pt-0 pb-3"}`}>
              {!isMobile && (
                <>
                <div className="training-log-input-grid-shell overflow-x-hidden rounded">
                  <table className="training-log-input-grid-table w-full table-fixed border-collapse text-[11px]" style={{ color: "var(--text-primary)" }}>
                    <colgroup>
                      <col style={{ width: inputMode === "existing" ? "8.3%" : "12.9%" }} />
                      <col style={{ width: inputMode === "existing" ? "23.5%" : "25.8%" }} />
                      {inputMode === "existing" && <col style={{ width: "10.3%" }} />}
                      {inputMode === "existing" && <col style={{ width: "12.4%" }} />}
                      <col style={{ width: inputMode === "existing" ? "4.5%" : "7%" }} />
                      <col style={{ width: inputMode === "existing" ? "4.5%" : "7%" }} />
                      <col style={{ width: inputMode === "existing" ? "4.5%" : "7%" }} />
                      <col style={{ width: inputMode === "existing" ? "4.5%" : "7%" }} />
                      <col style={{ width: inputMode === "existing" ? "4.5%" : "7%" }} />
                      <col style={{ width: inputMode === "existing" ? "4.5%" : "7%" }} />
                      {inputMode === "existing" && <col style={{ width: "6.2%" }} />}
                      <col style={{ width: inputMode === "existing" ? "12.8%" : "19.3%" }} />
                    </colgroup>
                    <thead className="training-log-input-grid-head">
                      <tr>
                        <th className="training-log-input-grid-th" style={{ color: inputSectionHeaderTextColor }} title={tHint("Date", "normal") ?? undefined}>{t("Date", "normal")}</th>
                        <th className="training-log-input-grid-th" style={{ color: inputSectionHeaderTextColor }} title={inputMode === "existing" ? (tHint("Exercise", "normal") ?? undefined) : (tHint("Exercise Name", "normal") ?? undefined)}>{inputMode === "existing" ? t("Exercise", "normal") : t("Exercise Name", "normal")}</th>
                        {inputMode === "existing" && (
                          <th className="training-log-input-grid-th" style={{ color: inputSectionHeaderTextColor }} title={tHint("Progression", "normal") ?? undefined}>{t("Progression", "normal")}</th>
                        )}
                        {inputMode === "existing" && (
                          <th className="training-log-input-grid-th" style={{ color: inputSectionHeaderTextColor }} title={tHint("Variant", "normal") ?? undefined}>{t("Variant", "normal")}</th>
                        )}
                        {desktopInputSetColumns.map((col) => (
                          <th
                            key={`desktop-input-head-${col.key}`}
                            className="training-log-input-grid-th"
                            style={{ color: inputSectionHeaderTextColor }}
                          >
                            {col.label}
                          </th>
                        ))}
                        {inputMode === "existing" && (
                          <th className="training-log-input-grid-th" style={{ color: inputSectionHeaderTextColor }} title={tHint("Mod", "normal") ?? undefined}>{t("Mod", "normal")}</th>
                        )}
                        <th className="training-log-input-grid-th training-log-input-grid-th-last" style={{ color: inputSectionHeaderTextColor }} title={tHint("Notes", "normal") ?? undefined}>{t("Notes", "normal")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="training-log-input-grid-row">
                        <td
                          className="training-log-input-grid-td"
                          onClick={openDesktopDatePicker}
                        >
                          <div className="relative">
                            <button
                              type="button"
                              onClick={openDesktopDatePicker}
                              className="w-full h-7 rounded border px-1.5 text-left text-[11px] appearance-none cursor-pointer hover:border-jade-glow/50 transition-colors"
                              style={{ borderColor: "color-mix(in srgb, var(--jade-glow) 30%, var(--border))", backgroundColor: "var(--ink-dark)", color: "var(--text-primary)" }}
                            >
                              {workoutInputDateDisplay || ""}
                            </button>
                            <input
                              ref={desktopDateInputRef}
                              type="date"
                              value={workoutInput.date}
                              onChange={(event) =>
                                setWorkoutInput((prev) => ({
                                  ...prev,
                                  date: event.target.value,
                                }))
                              }
                              className="absolute inset-0 h-full w-full opacity-0 pointer-events-none"
                              tabIndex={-1}
                              aria-hidden="true"
                            />
                          </div>
                        </td>
                        <td className="training-log-input-grid-td">
                          {inputMode === "existing" ? (
                            <div className="relative" ref={exerciseSearchWrapRef}>
                              <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center" style={{ color: "var(--text-secondary)" }}>
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
                                  syncExerciseDropdownPosition();
                                  setExerciseDropdownOpen(true);
                                }}
                                onClick={() => {
                                  if (workoutInput.exerciseId) setExerciseSearchTerm("");
                                  syncExerciseDropdownPosition();
                                  setExerciseDropdownOpen(true);
                                }}
                                onBlur={() => {
                                  const selected = exerciseLookup.get(workoutInput.exerciseId);
                                  if (selected && exerciseSearchTerm.trim() === "") {
                                    setExerciseSearchTerm(exerciseMetaById.get(selected.id)?.displayName ?? stripBwPercentHint(getExerciseDisplayName(selected, displayTerminologyMode, settings.showExerciseForeignLanguage)));
                                  }
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Escape") {
                                    event.preventDefault();
                                    const selected = exerciseLookup.get(workoutInput.exerciseId);
                                    setExerciseSearchTerm(
                                      selected
                                        ? exerciseMetaById.get(selected.id)?.displayName ?? stripBwPercentHint(getExerciseDisplayName(selected, displayTerminologyMode, settings.showExerciseForeignLanguage))
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
                                    if (picked) applyInputExerciseSelection(picked);
                                  }
                                }}
                                onChange={(event) => {
                                  const nextTerm = event.target.value;
                                  setExerciseSearchTerm(nextTerm);
                                  setExerciseDropdownOpen(true);
                                  setExerciseHighlightIndex(-1);
                                }}
                                placeholder=""
                                className="w-full h-7 rounded pl-6 pr-6 text-[11px] outline-none"
                                style={{ backgroundColor: "var(--ink-dark)", border: "1px solid color-mix(in srgb, var(--jade-glow) 30%, var(--border))", boxShadow: "none", color: "var(--text-primary)", textShadow: "none" }}
                              />
                              {exerciseSearchTerm.trim() ? (
                                <button
                                  type="button"
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                  }}
                                  onClick={() => {
                                    setExerciseSearchTerm("");
                                    syncExerciseDropdownPosition();
                                    setExerciseDropdownOpen(true);
                                    setExerciseHighlightIndex(-1);
                                  }}
                                  className="absolute inset-y-0 right-2 flex items-center text-[11px] font-semibold leading-none transition-colors hover:text-cloud-white"
                                  style={{ color: "var(--text-secondary)" }}
                                  aria-label="Clear exercise search"
                                >
                                  x
                                </button>
                              ) : null}
                              {exerciseSearchTerm.trim() !== "" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                        setExerciseSearchTerm("");
                                    resetWorkoutInput();
                                    setExerciseDropdownOpen(false);
                                    setExerciseHighlightIndex(-1);
                                  }}
                                  className="absolute inset-y-0 right-1 flex items-center justify-center px-1.5"
                                  style={{ color: "var(--text-secondary)" }}
                                  aria-label={t("Clear exercise search", "normal")}
                                  title={t("Clear", "normal")}
                                >
                                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden>
                                    <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ) : (
                            activeDesktopInputCell === "newExerciseName" ? (
                              <input
                                type="text"
                                value={workoutInput.newExerciseName}
                                autoFocus
                                onBlur={() => setActiveDesktopInputCell(null)}
                                onKeyDown={handleDesktopInputCellKeyDown}
                                onChange={(event) => handleWorkoutInputChange("newExerciseName", event.target.value)}
                                placeholder="Type custom exercise name"
                                className="w-full h-7 rounded px-1.5 text-[11px] outline-none"
                                style={{ backgroundColor: "var(--ink-dark)", border: "1px solid color-mix(in srgb, var(--jade-glow) 30%, var(--border))", boxShadow: "none", color: "var(--text-primary)", textShadow: "none" }}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setActiveDesktopInputCell("newExerciseName")}
                                className="w-full h-7 rounded border px-1.5 text-left text-[11px] appearance-none cursor-pointer hover:border-jade-glow/50 transition-colors"
                                style={{ borderColor: "color-mix(in srgb, var(--jade-glow) 30%, var(--border))", backgroundColor: "var(--ink-dark)", color: "var(--text-primary)" }}
                              >
                                {workoutInput.newExerciseName || ""}
                              </button>
                            )
                          )}
                        </td>
                        {inputMode === "existing" && (
                          <td className="training-log-input-grid-td">
                            <select
                              value={workoutInput.level}
                              onChange={(event) => handleWorkoutInputChange("level", event.target.value)}
                              disabled={!hasSelectedInputExercise}
                              className="w-full h-7 rounded px-1.5 text-[11px] outline-none hover:border-jade-glow/50 transition-colors"
                              style={{
                                backgroundColor: !hasSelectedInputExercise ? "color-mix(in srgb, var(--border) 14%, var(--surface))" : "var(--ink-dark)",
                                borderColor: "color-mix(in srgb, var(--jade-glow) 30%, var(--border))",
                                borderWidth: "1px",
                                borderStyle: "solid",
                                color: !hasSelectedInputExercise ? "var(--text-secondary)" : "var(--text-primary)",
                                opacity: !hasSelectedInputExercise ? 0.6 : 1,
                                cursor: !hasSelectedInputExercise ? "not-allowed" : "pointer",
                              }}
                            >
                              {inputProgressionOptions.map((option) => (
                                <option key={option.value} value={option.value} style={{ backgroundColor: "var(--surface)", color: "var(--text-primary)" }}>{option.label}</option>
                              ))}
                            </select>
                          </td>
                        )}
                        {inputMode === "existing" && (
                          <td className="training-log-input-grid-td">
                            <select
                              value={workoutInput.variant}
                              onChange={(event) => handleWorkoutInputChange("variant", event.target.value)}
                              disabled={!hasSelectedInputExercise}
                              className="w-full h-7 rounded px-1.5 text-[11px] outline-none hover:border-jade-glow/50 transition-colors"
                              style={{
                                backgroundColor: !hasSelectedInputExercise ? "color-mix(in srgb, var(--border) 14%, var(--surface))" : "var(--ink-dark)",
                                borderColor: "color-mix(in srgb, var(--jade-glow) 30%, var(--border))",
                                borderWidth: "1px",
                                borderStyle: "solid",
                                color: !hasSelectedInputExercise ? "var(--text-secondary)" : "var(--text-primary)",
                                opacity: !hasSelectedInputExercise ? 0.6 : 1,
                                cursor: !hasSelectedInputExercise ? "not-allowed" : "pointer",
                              }}
                            >
                              <option value="">-</option>
                              {inputVariantOptions.map((variantName) => (
                                <option key={variantName} value={variantName}>{variantName}</option>
                              ))}
                            </select>
                          </td>
                        )}
                        {desktopInputSetColumns.map((col) => {
                          const key = col.key as "val1" | "val2" | "val3" | "reps1" | "reps2" | "reps3";
                          const isValueField = key.startsWith("val");
                          const hasCellValue = Boolean(workoutInput[key]);
                          return (
                            <td key={`desktop-${key}`} className="training-log-input-grid-td">
                              {activeDesktopInputCell === key ? (
                                <input
                                  type="number"
                                  min="0"
                                  step={isValueField ? "0.5" : "1"}
                                  value={workoutInput[key]}
                                  autoFocus
                                  onBlur={() => setActiveDesktopInputCell(null)}
                                  onKeyDown={handleDesktopInputCellKeyDown}
                                  onChange={(event) => handleWorkoutInputChange(key, event.target.value)}
                                  placeholder={isValueField ? setValuePlaceholder : ""}
                                  disabled={!canSubmitWorkoutInput}
                                  className={`w-full h-7 rounded px-1.5 text-[11px] outline-none ${isValueField ? "text-center" : ""}`}
                                  style={{
                                    backgroundColor: !canSubmitWorkoutInput ? "color-mix(in srgb, var(--border) 14%, var(--surface))" : "var(--ink-dark)",
                                    borderColor: "color-mix(in srgb, var(--jade-glow) 40%, var(--border))",
                                    border: "1px solid",
                                    color: !canSubmitWorkoutInput ? "var(--text-secondary)" : "var(--text-primary)",
                                    opacity: !canSubmitWorkoutInput ? 0.6 : 1,
                                    cursor: !canSubmitWorkoutInput ? "not-allowed" : "text",
                                  }}
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => canSubmitWorkoutInput && setActiveDesktopInputCell(key)}
                                  disabled={!canSubmitWorkoutInput}
                                  className={`w-full h-7 rounded border px-1.5 text-[11px] appearance-none cursor-pointer hover:border-jade-glow/50 transition-colors ${isValueField ? "text-center" : "text-left"}`}
                                  style={{
                                    borderColor: "color-mix(in srgb, var(--jade-glow) 30%, var(--border))",
                                    backgroundColor: !canSubmitWorkoutInput ? "color-mix(in srgb, var(--border) 14%, var(--surface))" : "var(--ink-dark)",
                                    color: !canSubmitWorkoutInput
                                      ? "var(--text-secondary)"
                                      : (isValueField && !hasCellValue ? "color-mix(in srgb, var(--text-secondary) 82%, var(--surface))" : "var(--text-primary)"),
                                    opacity: !canSubmitWorkoutInput ? 0.6 : 1,
                                    cursor: !canSubmitWorkoutInput ? "not-allowed" : "text",
                                  }}
                                >
                                  {workoutInput[key] || (isValueField ? setValuePlaceholder : "")}
                                </button>
                              )}
                            </td>
                          );
                        })}
                        {inputMode === "existing" && (
                          <td className="training-log-input-grid-td">
                            <select
                              value={workoutInput.modifierKg}
                              onChange={(event) => handleWorkoutInputChange("modifierKg", event.target.value)}
                              disabled={!hasSelectedInputExercise}
                              className="w-full h-7 rounded px-1.5 text-[11px] outline-none hover:border-jade-glow/50 transition-colors"
                              style={{
                                backgroundColor: !hasSelectedInputExercise ? "color-mix(in srgb, var(--border) 14%, var(--surface))" : "var(--ink-dark)",
                                borderColor: "color-mix(in srgb, var(--jade-glow) 30%, var(--border))",
                                borderWidth: "1px",
                                borderStyle: "solid",
                                color: !hasSelectedInputExercise ? "var(--text-secondary)" : "var(--text-primary)",
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
                          </td>
                        )}
                        <td className="training-log-input-grid-td training-log-input-grid-td-last">
                          {activeDesktopInputCell === "notes" ? (
                            <input
                              type="text"
                              value={workoutInput.notes}
                              autoFocus
                              onBlur={() => setActiveDesktopInputCell(null)}
                              onKeyDown={handleDesktopInputCellKeyDown}
                              onChange={(event) => handleWorkoutInputChange("notes", event.target.value)}
                              placeholder=""
                              disabled={inputMode === "existing" && !hasSelectedInputExercise}
                              className="w-full h-7 rounded px-1.5 text-[11px] outline-none"
                              style={{
                                backgroundColor: inputMode === "existing" && !hasSelectedInputExercise
                                  ? "color-mix(in srgb, var(--border) 14%, var(--surface))"
                                  : "var(--ink-dark)",
                                borderColor: "color-mix(in srgb, var(--jade-glow) 30%, var(--border))",
                                border: "1px solid",
                                color: inputMode === "existing" && !hasSelectedInputExercise ? "var(--text-secondary)" : "var(--text-primary)",
                                opacity: inputMode === "existing" && !hasSelectedInputExercise ? 0.6 : 1,
                                cursor: inputMode === "existing" && !hasSelectedInputExercise ? "not-allowed" : "text",
                              }}
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => !(inputMode === "existing" && !hasSelectedInputExercise) && setActiveDesktopInputCell("notes")}
                              disabled={inputMode === "existing" && !hasSelectedInputExercise}
                              className="w-full h-7 rounded border px-1.5 text-left text-[11px] appearance-none cursor-pointer hover:border-jade-glow/50 transition-colors"
                              style={{
                                borderColor: "color-mix(in srgb, var(--jade-glow) 30%, var(--border))",
                                backgroundColor: inputMode === "existing" && !hasSelectedInputExercise
                                  ? "color-mix(in srgb, var(--border) 14%, var(--surface))"
                                  : "var(--ink-dark)",
                                color: inputMode === "existing" && !hasSelectedInputExercise ? "var(--text-secondary)" : "var(--text-primary)",
                                opacity: inputMode === "existing" && !hasSelectedInputExercise ? 0.6 : 1,
                                cursor: inputMode === "existing" && !hasSelectedInputExercise ? "not-allowed" : "text",
                              }}
                            >
                              {workoutInput.notes || ""}
                            </button>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="training-log-input-actions training-log-input-actions-desktop mt-1.5 flex items-center justify-end gap-1.5 pr-1">
                  <GlowButton
                    variant="jade"
                    size="sm"
                    onClick={handleAddWorkoutLog}
                    disabled={isSaving || !canSubmitWorkoutInput}
                    className={`training-log-input-action-btn training-log-input-action-primary ${!canSubmitWorkoutInput ? "opacity-50 cursor-not-allowed" : ""}`}
                    style={inputActionPrimaryStyle}
                  >
                    {isSaving ? "Saving..." : "+ Add"}
                  </GlowButton>
                  <GlowButton
                    variant="ghost"
                    size="sm"
                    onClick={resetWorkoutInput}
                    className="training-log-input-action-btn training-log-input-action-secondary"
                    style={inputActionSecondaryStyle}
                  >
                    Reset
                  </GlowButton>
                </div>
                </>
              )}

              {isMobile && (
              <div className={isMobile ? "grid grid-cols-1 gap-3" : "grid grid-cols-[repeat(28,minmax(0,1fr))] items-end gap-x-3 gap-y-2"}>
              <div className="training-log-mobile-shell mx-auto w-full max-w-[760px] space-y-4 px-2 sm:px-3">
              <div
                className="surface-panel training-log-mobile-card flex flex-col gap-2 p-4"
                style={{
                  boxShadow: "var(--shadow-elev-1), 0 0 0 1px rgba(58,143,143,0.22) inset",
                }}
              >
                <p className="training-log-mobile-section-title text-xs text-jade-glow uppercase tracking-wider mb-1">
                  Exercise Details
                </p>
              <div className={isMobile ? mobileFieldRowClass : "col-span-2 flex flex-col gap-1"}>
                <label className={isMobile ? mobileFieldLabelClass : "hidden"}>{t("Date", "normal")}</label>
                <input
                  type="date"
                  value={workoutInput.date}
                  onChange={(event) =>
                    setWorkoutInput((prev) => ({
                      ...prev,
                      date: event.target.value,
                    }))
                  }
                  className={`training-log-mobile-control rounded-md outline-none ${isMobile ? "flex-1 px-3 py-2 text-sm" : "px-2 py-1 text-xs"}`}
                  style={{ backgroundColor: "var(--ink-dark)", borderColor: "color-mix(in srgb, var(--border) 82%, transparent)", border: "1px solid", color: "var(--text-primary)" }}
                />
              </div>

              {inputMode === "existing" ? (
              <div className={isMobile ? mobileFieldRowClass : "col-span-4 flex flex-col gap-1 min-w-[220px]"} ref={exerciseSearchWrapRef}>
                <label className={isMobile ? mobileFieldLabelClass : "hidden"}>{t("Exercise", "normal")}</label>
                <div className={`relative ${isMobile ? "flex-1" : ""}`}>
                  <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center" style={{ color: "var(--text-secondary)" }}>
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
                      syncExerciseDropdownPosition();
                      setExerciseDropdownOpen(true);
                    }}
                    onClick={() => {
                      if (workoutInput.exerciseId) setExerciseSearchTerm("");
                      syncExerciseDropdownPosition();
                      setExerciseDropdownOpen(true);
                    }}
                    onBlur={() => {
                      // Restore the selected exercise name if the user didn't pick a new one
                      const selected = exerciseLookup.get(workoutInput.exerciseId);
                      if (selected && exerciseSearchTerm.trim() === "") {
                        setExerciseSearchTerm(exerciseMetaById.get(selected.id)?.displayName ?? stripBwPercentHint(getExerciseDisplayName(selected, displayTerminologyMode, settings.showExerciseForeignLanguage)));
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        const selected = exerciseLookup.get(workoutInput.exerciseId);
                        setExerciseSearchTerm(
                          selected
                            ? exerciseMetaById.get(selected.id)?.displayName ?? stripBwPercentHint(getExerciseDisplayName(selected, displayTerminologyMode, settings.showExerciseForeignLanguage))
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
                    placeholder=""
                    className={`training-log-mobile-control w-full rounded-md pl-7 pr-7 outline-none ${isMobile ? "py-2 text-sm" : "py-1 text-xs"}`}
                    style={{ backgroundColor: "var(--ink-dark)", borderColor: "color-mix(in srgb, var(--border) 82%, transparent)", border: "1px solid", color: "var(--text-primary)" }}
                  />
                  {exerciseSearchTerm.trim() !== "" && (
                    <button
                      type="button"
                      onClick={() => {
                        setExerciseSearchTerm("");
                        resetWorkoutInput();
                        setExerciseDropdownOpen(false);
                        setExerciseHighlightIndex(-1);
                      }}
                      className="absolute inset-y-0 right-1 flex items-center justify-center px-1.5"
                      style={{ color: "var(--text-secondary)" }}
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
              ) : (
              <div className={isMobile ? mobileFieldRowClass : "col-span-6 flex flex-col gap-1 min-w-[220px]"}>
                <label className={isMobile ? mobileFieldLabelClass : "hidden"}>{t("Exercise Name", "normal")}</label>
                <input
                  type="text"
                  value={workoutInput.newExerciseName}
                  onChange={(event) => handleWorkoutInputChange("newExerciseName", event.target.value)}
                  placeholder="Type custom exercise name"
                  className={`training-log-mobile-control w-full rounded-md outline-none ${isMobile ? "flex-1 px-3 py-2 text-sm" : "px-2 py-1 text-xs"}`}
                  style={{ backgroundColor: "var(--surface)", borderColor: "color-mix(in srgb, var(--border) 82%, transparent)", border: "1px solid", color: "var(--text-primary)" }}
                />
              </div>
              )}

              {inputMode === "existing" && (
                <>
                  <div className={isMobile ? mobileFieldRowClass : "col-span-2 flex flex-col gap-1 min-w-[150px]"}>
                    <label className={isMobile ? mobileFieldLabelClass : "hidden"}>{t("Progression", "normal")}</label>
                    {isMobile ? (
                      <button
                        type="button"
                        onClick={() => setMobileInputPicker({ field: "level", title: t("Progression", "normal") })}
                        disabled={!hasSelectedInputExercise}
                        className="training-log-mobile-picker flex flex-1 items-center justify-between rounded-md px-3 py-2 text-sm font-medium"
                        style={{
                          backgroundColor: !hasSelectedInputExercise ? "color-mix(in srgb, var(--border) 14%, var(--surface))" : "var(--surface)",
                          borderColor: "color-mix(in srgb, var(--border) 82%, transparent)",
                          borderWidth: "1px",
                          borderStyle: "solid",
                          color: !hasSelectedInputExercise ? "var(--text-secondary)" : "var(--text-primary)",
                          opacity: !hasSelectedInputExercise ? 0.6 : 1,
                          cursor: !hasSelectedInputExercise ? "not-allowed" : "pointer",
                        }}
                      >
                        <span className="truncate">{selectedProgressionLabel}</span>
                        <span className="ml-2 text-xs opacity-80">v</span>
                      </button>
                    ) : (
                      <select
                        value={workoutInput.level}
                        onChange={(event) => handleWorkoutInputChange("level", event.target.value)}
                        disabled={!hasSelectedInputExercise}
                        className={`training-log-mobile-control rounded outline-none font-medium ${isMobile ? "flex-1 px-3 py-2 text-sm" : "px-2 py-1 text-xs"}`}
                        style={{
                          backgroundColor: !hasSelectedInputExercise ? "color-mix(in srgb, var(--border) 14%, var(--surface))" : "var(--surface)",
                          borderColor: "var(--nyaa-table-grid)",
                          borderWidth: "1px",
                          borderStyle: "solid",
                          color: !hasSelectedInputExercise ? "var(--text-secondary)" : "var(--text-primary)",
                          opacity: !hasSelectedInputExercise ? 0.6 : 1,
                          cursor: !hasSelectedInputExercise ? "not-allowed" : "pointer",
                          boxShadow: hasSelectedInputExercise ? "inset 0 0 0 1px color-mix(in srgb, var(--border) 55%, transparent)" : undefined,
                          ...selectCaretStyle,
                        }}
                      >
                        {inputProgressionOptions.map((option) => (
                          <option key={option.value} value={option.value} style={{ backgroundColor: "var(--surface)", color: "var(--text-primary)" }}>{option.label}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className={isMobile ? mobileFieldRowClass : "col-span-2 flex flex-col gap-1 min-w-[150px]"}>
                    <label className={isMobile ? mobileFieldLabelClass : "hidden"}>{t("Variant", "normal")}</label>
                    {isMobile ? (
                      <button
                        type="button"
                        onClick={() => setMobileInputPicker({ field: "variant", title: t("Variant", "normal") })}
                        disabled={!hasSelectedInputExercise}
                        className="training-log-mobile-picker flex flex-1 items-center justify-between rounded-md px-3 py-2 text-sm font-medium"
                        style={{
                          backgroundColor: !hasSelectedInputExercise ? "color-mix(in srgb, var(--border) 14%, var(--surface))" : "var(--surface)",
                          borderColor: "color-mix(in srgb, var(--border) 82%, transparent)",
                          borderWidth: "1px",
                          borderStyle: "solid",
                          color: !hasSelectedInputExercise ? "var(--text-secondary)" : "var(--text-primary)",
                          opacity: !hasSelectedInputExercise ? 0.6 : 1,
                          cursor: !hasSelectedInputExercise ? "not-allowed" : "pointer",
                        }}
                      >
                        <span className="truncate">{selectedVariantLabel}</span>
                        <span className="ml-2 text-xs opacity-80">v</span>
                      </button>
                    ) : (
                      <select
                        value={workoutInput.variant}
                        onChange={(event) => handleWorkoutInputChange("variant", event.target.value)}
                        disabled={!hasSelectedInputExercise}
                        className={`training-log-mobile-control rounded outline-none font-medium ${isMobile ? "flex-1 px-3 py-2 text-sm" : "px-2 py-1 text-xs"}`}
                        style={{
                          backgroundColor: !hasSelectedInputExercise ? "color-mix(in srgb, var(--border) 14%, var(--surface))" : "var(--surface)",
                          borderColor: "var(--nyaa-table-grid)",
                          borderWidth: "1px",
                          borderStyle: "solid",
                          color: !hasSelectedInputExercise ? "var(--text-secondary)" : "var(--text-primary)",
                          opacity: !hasSelectedInputExercise ? 0.6 : 1,
                          cursor: !hasSelectedInputExercise ? "not-allowed" : "pointer",
                          boxShadow: hasSelectedInputExercise ? "inset 0 0 0 1px color-mix(in srgb, var(--border) 55%, transparent)" : undefined,
                          ...selectCaretStyle,
                        }}
                      >
                        <option value="" style={{ backgroundColor: "var(--surface)", color: "var(--text-primary)" }}>-</option>
                        {inputVariantOptions.map((variantName) => (
                          <option key={variantName} value={variantName} style={{ backgroundColor: "var(--surface)", color: "var(--text-primary)" }}>{variantName}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </>
              )}

              </div>

              <div
                className="surface-panel training-log-mobile-card flex flex-col gap-2 p-4"
                style={{
                  boxShadow: "var(--shadow-elev-1), 0 0 0 1px rgba(58,143,143,0.22) inset",
                }}
              >
                <p className="training-log-mobile-section-title text-xs text-jade-glow uppercase tracking-wider mb-1">
                  Input Mode
                </p>

              <div className={isMobile ? mobileFieldRowClass : "col-span-2 flex flex-col gap-1 min-w-[150px]"}>
                <label className={isMobile ? mobileFieldLabelClass : "hidden"}>{t("Mode", "normal")}</label>
                <div className={`grid grid-cols-2 gap-2 ${isMobile ? "flex-1" : ""}`}>
                  <button
                    type="button"
                    onClick={() => setInputValueMode("weight")}
                    className={inputModeOptionButtonClass}
                    style={{
                      borderColor: !isTimedInput ? "color-mix(in srgb, var(--accent) 40%, var(--border))" : "color-mix(in srgb, var(--border) 82%, transparent)",
                      color: !isTimedInput ? "var(--text-primary)" : "var(--text-secondary)",
                      backgroundColor: !isTimedInput
                        ? "color-mix(in srgb, var(--accent) 18%, transparent)"
                        : "var(--surface)",
                      boxShadow: !isTimedInput ? "0 0 0 1px rgba(58,143,143,0.18) inset" : "none",
                    }}
                  >
                    Weight
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputValueMode("timed")}
                    className={inputModeOptionButtonClass}
                    style={{
                      borderColor: isTimedInput ? "color-mix(in srgb, var(--timed-color) 40%, var(--border))" : "color-mix(in srgb, var(--border) 82%, transparent)",
                      color: isTimedInput ? "var(--timed-color)" : "var(--text-secondary)",
                      backgroundColor: isTimedInput
                        ? "color-mix(in srgb, var(--timed-color) 20%, transparent)"
                        : "var(--surface)",
                      boxShadow: isTimedInput ? "0 0 0 1px rgba(58,143,143,0.18) inset" : "none",
                    }}
                  >
                    Timed
                  </button>
                </div>
              </div>

              <div className={isMobile ? mobileFieldRowClass : "col-span-2 flex flex-col gap-1 min-w-[150px]"}>
                <label className={isMobile ? mobileFieldLabelClass : "hidden"}>{t("Unit", "normal")}</label>
                <div className={`grid grid-cols-2 gap-2 ${isMobile ? "flex-1" : ""}`}>
                  <button
                    type="button"
                    onClick={() => setInputWeightUnit("kg")}
                    disabled={isTimedInput}
                    className={inputModeOptionButtonClass}
                    style={{
                      borderColor: inputWeightUnit === "kg" ? "color-mix(in srgb, var(--accent) 40%, var(--border))" : "color-mix(in srgb, var(--border) 82%, transparent)",
                      color: inputWeightUnit === "kg" ? "var(--text-primary)" : "var(--text-secondary)",
                      backgroundColor: inputWeightUnit === "kg"
                        ? "color-mix(in srgb, var(--accent) 18%, transparent)"
                        : "var(--surface)",
                      boxShadow: inputWeightUnit === "kg" ? "0 0 0 1px rgba(58,143,143,0.18) inset" : "none",
                      opacity: isTimedInput ? 0.45 : 1,
                      cursor: isTimedInput ? "not-allowed" : "pointer",
                    }}
                  >
                    kg
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputWeightUnit("lbs")}
                    disabled={isTimedInput}
                    className={inputModeOptionButtonClass}
                    style={{
                      borderColor: inputWeightUnit === "lbs" ? "color-mix(in srgb, var(--accent) 40%, var(--border))" : "color-mix(in srgb, var(--border) 82%, transparent)",
                      color: inputWeightUnit === "lbs" ? "var(--text-primary)" : "var(--text-secondary)",
                      backgroundColor: inputWeightUnit === "lbs"
                        ? "color-mix(in srgb, var(--accent) 18%, transparent)"
                        : "var(--surface)",
                      boxShadow: inputWeightUnit === "lbs" ? "0 0 0 1px rgba(58,143,143,0.18) inset" : "none",
                      opacity: isTimedInput ? 0.45 : 1,
                      cursor: isTimedInput ? "not-allowed" : "pointer",
                    }}
                  >
                    lbs
                  </button>
                </div>
              </div>

              </div>

              <div
                className="surface-panel training-log-mobile-card flex flex-col gap-2 p-4"
                style={{
                  boxShadow: "var(--shadow-elev-1), 0 0 0 1px rgba(58,143,143,0.22) inset",
                }}
              >
                <p className="training-log-mobile-section-title text-xs text-jade-glow uppercase tracking-wider mb-1">
                  Sets And Notes
                </p>

              {[1, 2, 3].map((setNo) => (
                <div key={`set-${setNo}`} className={isMobile ? mobileFieldRowClass : "col-span-2 flex flex-col gap-1"}>
                  <label className={isMobile ? mobileFieldLabelClass : "hidden"}>{`Set ${setNo}`}</label>
                  <div className={`flex items-center gap-1 ${isMobile ? "flex-1 min-w-0" : ""}`}>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={workoutInput[`val${setNo}` as "val1" | "val2" | "val3"]}
                      onChange={(event) => handleWorkoutInputChange(`val${setNo}` as "val1" | "val2" | "val3", event.target.value)}
                      placeholder={setValuePlaceholder}
                      disabled={!canSubmitWorkoutInput}
                      className={`training-log-mobile-control rounded-md outline-none text-center ${isMobile ? "flex-1 min-w-0 px-2 py-2 text-sm" : "w-[74px] px-2 py-1 text-xs"}`}
                      style={{
                        backgroundColor: !canSubmitWorkoutInput ? "color-mix(in srgb, var(--border) 14%, var(--surface))" : "var(--surface)",
                        borderColor: "color-mix(in srgb, var(--border) 82%, transparent)",
                        border: "1px solid",
                        color: !canSubmitWorkoutInput ? "var(--text-secondary)" : "var(--text-primary)",
                        opacity: !canSubmitWorkoutInput ? 0.6 : 1,
                        cursor: !canSubmitWorkoutInput ? "not-allowed" : "text",
                      }}
                    />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={workoutInput[`reps${setNo}` as "reps1" | "reps2" | "reps3"]}
                      onChange={(event) => handleWorkoutInputChange(`reps${setNo}` as "reps1" | "reps2" | "reps3", event.target.value)}
                      placeholder={isMobile ? "reps" : ""}
                      disabled={!canSubmitWorkoutInput}
                      className={`training-log-mobile-control rounded-md outline-none text-center ${isMobile ? "flex-1 min-w-0 px-2 py-2 text-sm" : "w-[50px] px-2 py-1 text-xs"}`}
                      style={{
                        backgroundColor: !canSubmitWorkoutInput ? "color-mix(in srgb, var(--border) 14%, var(--surface))" : "var(--surface)",
                        borderColor: "color-mix(in srgb, var(--border) 82%, transparent)",
                        border: "1px solid",
                        color: !canSubmitWorkoutInput ? "var(--text-secondary)" : "var(--text-primary)",
                        opacity: !canSubmitWorkoutInput ? 0.6 : 1,
                        cursor: !canSubmitWorkoutInput ? "not-allowed" : "text",
                      }}
                    />
                  </div>
                </div>
              ))}

              {inputMode === "existing" && (
              <div className={isMobile ? mobileFieldRowClass : "col-span-2 flex flex-col gap-1 min-w-[150px]"}>
                {isMobile ? (
                  <>
                    <label className={mobileFieldLabelClass}>{t("Mod", "normal")}</label>
                    <button
                      type="button"
                      onClick={() => setMobileInputPicker({ field: "modifierKg", title: t("Mod", "normal") })}
                      disabled={!hasSelectedInputExercise}
                      className="training-log-mobile-picker flex flex-1 items-center justify-between rounded-md px-3 py-2 text-sm"
                      style={{
                        backgroundColor: !hasSelectedInputExercise ? "color-mix(in srgb, var(--border) 14%, var(--surface))" : "var(--surface)",
                        borderColor: "color-mix(in srgb, var(--border) 82%, transparent)",
                        border: "1px solid",
                        color: !hasSelectedInputExercise ? "var(--text-secondary)" : "var(--gold)",
                        opacity: !hasSelectedInputExercise ? 0.6 : 1,
                        cursor: !hasSelectedInputExercise ? "not-allowed" : "pointer",
                      }}
                    >
                      <span className="truncate">{selectedModifierLabel}</span>
                      <span className="ml-2 text-xs opacity-80">v</span>
                    </button>
                  </>
                ) : (
                  <>
                    <label className="hidden" style={{ color: "var(--text-secondary)" }}>{t("Modifier", "normal")}</label>
                    <select
                      value={workoutInput.modifierKg}
                      onChange={(event) => handleWorkoutInputChange("modifierKg", event.target.value)}
                      disabled={!hasSelectedInputExercise}
                      className="training-log-mobile-control rounded outline-none px-2 py-1 text-xs"
                      style={{
                        backgroundColor: !hasSelectedInputExercise ? "color-mix(in srgb, var(--border) 14%, var(--surface))" : "var(--surface)",
                        borderColor: "var(--nyaa-table-grid)",
                        border: "1px solid",
                        color: !hasSelectedInputExercise ? "var(--text-secondary)" : "var(--gold)",
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
                  </>
                )}
              </div>
              )}

              {inputMode === "existing" && (
              <div className={isMobile ? mobileFieldRowClass : "col-span-4 flex flex-col gap-1 min-w-[220px]"}>
                <label className={isMobile ? mobileFieldLabelClass : "hidden"}>{t("Notes", "normal")}</label>
                <input
                  type="text"
                  value={workoutInput.notes}
                  onChange={(event) => handleWorkoutInputChange("notes", event.target.value)}
                  placeholder=""
                  disabled={!hasSelectedInputExercise}
                  className={`training-log-mobile-control rounded-md outline-none ${isMobile ? "flex-1 px-3 py-2 text-sm" : "px-2 py-1 text-xs"}`}
                  style={{
                    backgroundColor: !hasSelectedInputExercise ? "color-mix(in srgb, var(--border) 14%, var(--surface))" : "var(--surface)",
                    borderColor: "color-mix(in srgb, var(--border) 82%, transparent)",
                    border: "1px solid",
                    color: !hasSelectedInputExercise ? "var(--text-secondary)" : "var(--text-primary)",
                    opacity: !hasSelectedInputExercise ? 0.6 : 1,
                    cursor: !hasSelectedInputExercise ? "not-allowed" : "text",
                  }}
                />
              </div>
              )}

              {inputMode === "new" && (
              <div className={isMobile ? mobileFieldRowClass : "col-span-4 flex flex-col gap-1 min-w-[220px]"}>
                <label className={isMobile ? mobileFieldLabelClass : "hidden"}>{t("Notes", "normal")}</label>
                <input
                  type="text"
                  value={workoutInput.notes}
                  onChange={(event) => handleWorkoutInputChange("notes", event.target.value)}
                  placeholder=""
                  className={`training-log-mobile-control rounded-md outline-none ${isMobile ? "flex-1 px-3 py-2 text-sm" : "px-2 py-1 text-xs"}`}
                  style={{
                    backgroundColor: "var(--surface)",
                    borderColor: "color-mix(in srgb, var(--border) 82%, transparent)",
                    border: "1px solid",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
              )}
              </div>
              </div>

              <div
                className={`training-log-input-actions flex gap-2 ${isMobile ? "training-log-input-actions-mobile mx-auto w-full max-w-[760px] items-stretch px-2 sm:px-3 pt-3 pb-2" : "col-span-2 items-end justify-end pr-1"}`}
              >
                <GlowButton
                  variant="jade"
                  size={isMobile ? "md" : "sm"}
                  onClick={handleAddWorkoutLog}
                  disabled={isSaving || !canSubmitWorkoutInput}
                  className={`training-log-input-action-btn training-log-input-action-primary ${isMobile ? "order-2 flex-1" : ""} ${!canSubmitWorkoutInput ? "opacity-50 cursor-not-allowed" : ""}`}
                  style={inputActionPrimaryStyle}
                >
                  {isSaving ? t("Saving...", "normal") : `+ ${t("Add", "normal")}`}
                </GlowButton>
                <GlowButton
                  variant="ghost"
                  size={isMobile ? "md" : "sm"}
                  onClick={resetWorkoutInput}
                  className={`training-log-input-action-btn training-log-input-action-secondary ${isMobile ? "order-1 flex-1" : ""}`}
                  style={inputActionSecondaryStyle}
                >
                  {t("Reset", "normal")}
                </GlowButton>
              </div>
              </div>
              )}
            </div>
          </div>
        )}

        {!forceMobileInputOpen && (
        <div
          className="w-full rounded-2xl relative overflow-hidden surface-panel surface-panel-strong training-log-modern-shell"
        >
          <div className="relative">
          {/* Edit header bar */}
            <div
              className="flex items-center justify-between gap-2 px-3 py-2.5 border-b"
              style={{
                borderColor: "color-mix(in srgb, var(--jade-glow) 30%, var(--border))",
                backgroundColor: "color-mix(in srgb, var(--jade-glow) 9%, var(--ink-dark))",
              }}
            >
              <div className="flex items-center gap-2">
                  <span
                    className="text-[11px] font-semibold uppercase tracking-[0.09em] shrink-0"
                    style={{ color: "var(--jade-light)" }}
                    title={tHint("Training Log", "normal") ?? undefined}
                  >
                    {trainingLogTitle}
                  </span>
                {isMobile && entries.length > 0 && (
                  <MobileFocusTrigger onClick={() => setTrainingLogFocusMode(true)} />
                )}
                {saveMessage && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-md border px-2 py-0.5 text-[11px] font-medium"
                    style={{
                      color: saveMessage.type === "success" ? "var(--accent)" : "var(--danger)",
                      borderColor: saveMessage.type === "success"
                        ? "color-mix(in srgb, var(--accent) 45%, transparent)"
                        : "color-mix(in srgb, var(--danger) 45%, transparent)",
                      backgroundColor: saveMessage.type === "success"
                        ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                        : "color-mix(in srgb, var(--danger) 12%, transparent)",
                    }}
                  >
                    {saveMessage.text}
                  </motion.span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {canEditTrainingLogs && entries.length > 0 && (
                  <button
                    type="button"
                    onClick={handleEditModeToggle}
                    className={toolbarButtonClass}
                    style={{
                      borderColor: isEditMode
                        ? "color-mix(in srgb, var(--gold) 45%, var(--border))"
                        : "color-mix(in srgb, var(--jade-glow) 28%, var(--border))",
                      color: isEditMode ? "var(--gold)" : "var(--cloud-white)",
                      backgroundColor: isEditMode
                        ? "color-mix(in srgb, var(--gold) 14%, var(--ink-deep))"
                        : "color-mix(in srgb, var(--jade-glow) 12%, var(--ink-deep))",
                    }}
                    title={isEditMode ? tHint("Exit edit mode", "normal") ?? undefined : tHint("Edit training log", "normal") ?? undefined}
                  >
                    <span>{isEditMode ? t("Done", "normal") : t("Edit", "normal")}</span>
                  </button>
                )}
                {!isMobile && entries.length > 0 && !forceSimpleViewOnly && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={effectiveSimpleView}
                    onClick={() => setIsSimpleView((prev) => !prev)}
                    className={toolbarButtonClass}
                    style={{
                      borderColor: "color-mix(in srgb, var(--jade-glow) 25%, var(--border))",
                      color: "var(--text-secondary)",
                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 84%, var(--ink-deep))",
                    }}
                    title={tHint("Simple view", "normal") ?? undefined}
                  >
                    <span>{t("Simple View", "normal")}</span>
                    <span
                      className="relative inline-flex h-4 w-8 items-center rounded-full transition-colors"
                      style={{
                        backgroundColor: effectiveSimpleView
                          ? "color-mix(in srgb, var(--jade-glow) 35%, transparent)"
                          : "color-mix(in srgb, var(--border) 55%, transparent)",
                      }}
                    >
                      <span
                        className="absolute h-3 w-3 rounded-full transition-all"
                        style={{
                          left: effectiveSimpleView ? "16px" : "2px",
                          backgroundColor: effectiveSimpleView ? "var(--jade-light)" : "var(--text-muted)",
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
                    className={toolbarButtonClass}
                    style={{
                      borderColor: "color-mix(in srgb, var(--jade-glow) 25%, var(--border))",
                      color: "var(--text-secondary)",
                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 84%, var(--ink-deep))",
                    }}
                    title={
                      isOpenedTableMode
                        ? (tHint("Full-page table", "normal") ?? undefined)
                        : (tHint("Fit-to-screen table", "normal") ?? undefined)
                    }
                  >
                    <span>{t("Open", "normal")}</span>
                    <span
                      className="relative inline-flex h-4 w-8 items-center rounded-full transition-colors"
                      style={{
                        backgroundColor: isOpenedTableMode
                          ? "color-mix(in srgb, var(--jade-glow) 35%, transparent)"
                          : "color-mix(in srgb, var(--border) 55%, transparent)",
                      }}
                    >
                      <span
                        className="absolute h-3 w-3 rounded-full transition-all"
                        style={{
                          left: isOpenedTableMode ? "16px" : "2px",
                          backgroundColor: isOpenedTableMode ? "var(--jade-light)" : "var(--text-muted)",
                        }}
                      />
                    </span>
                  </button>
                )}
              </div>
            </div>

          {useMobileCardView ? (
            <div
              ref={tableScrollRef}
              className="overflow-y-auto px-2 py-2 space-y-2 scrollbar-hide"
              style={{
                WebkitOverflowScrolling: "touch",
                backgroundColor: "color-mix(in srgb, var(--ink-deep) 88%, var(--surface) 12%)",
                height: `${tableViewportHeight}px`,
                maxHeight: `${tableViewportHeight}px`,
              }}
            >
              {entries.length === 0 ? (
                <div className="rounded-lg border px-3 py-4 text-center text-xs" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--text-muted)" }}>
                  {t("No training data logged yet.", "normal")}
                </div>
              ) : (
                entries.map((entry) => {
                  const ex = exerciseLookup.get(entry.exerciseId);
                  const exerciseMeta = ex ? exerciseMetaById.get(ex.id) : undefined;
                  const entryDisplayName = ex
                    ? (exerciseMeta?.displayName ?? stripBwPercentHint(getExerciseDisplayName(ex, displayTerminologyMode, settings.showExerciseForeignLanguage)))
                    : stripBwPercentHint(entry.exerciseName);
                  const isDeletedEntry = entryDisplayName.toLowerCase().startsWith("deleted exercise");
                  const typeLabel = exerciseMeta?.categoryLabel ?? getExerciseCategoryLabel(ex);
                  const formattedEntryDate = formattedDateByLogId.get(entry.logId) ?? formatDate(entry.date, dateFormat);

                  return (
                    <TrainingLogMobileCard
                      key={entry.logId}
                      entry={entry}
                      entryDisplayName={entryDisplayName}
                      typeLabel={typeLabel}
                      formattedEntryDate={formattedEntryDate}
                      weightUnit={weightUnit}
                      timedUnit={timedUnit}
                      onOpenExerciseHistory={() => openExerciseHistoryFromMobileCard(entry)}
                    />
                  );
                })
              )}
            </div>
          ) : (
          <div
            ref={tableScrollRef}
            onScroll={(event) => {
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
            className={`training-log-grid-scroll overflow-auto w-full ${useMobileTableStyling ? "scrollbar-hide" : ""}`}
            style={{
              WebkitOverflowScrolling: "touch",
              height: `${effectiveViewportHeight}px`,
              maxHeight: `${effectiveViewportHeight}px`,
            }}
          >
          <table
            className="training-log-grid-table text-xs w-full border-collapse"
            style={{ whiteSpace: "nowrap", minWidth: tableMinWidth, backgroundColor: "transparent", tableLayout: "fixed" }}
          >
            <thead
              className="training-log-grid-head sticky top-0 z-10"
            >
              <tr
                className="training-log-grid-head-row border-b"
                style={{
                  borderColor: "color-mix(in srgb, var(--jade-glow) 25%, var(--border))",
                  color: trainingLogHeaderTextColor,
                }}
              >
                {orderedColumnIds.map((columnId) => {
                  const isSortedColumn = sortState?.columnId === columnId;
                  const sortArrow = isSortedColumn ? (sortState?.direction === "asc" ? "↑" : "↓") : null;
                  const renderHeaderLabel = (label: string, align: "left" | "center" = "center") => (
                    <span
                      className={`training-log-grid-head-chip inline-flex w-full items-center gap-1 ${align === "left" ? "justify-start" : "justify-center"}`}
                    >
                      <span className="font-semibold uppercase tracking-[0.08em]">{label}</span>
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
                      backgroundColor: "transparent",
                      boxShadow: undefined,
                      transition: "background-color 140ms ease, box-shadow 140ms ease, opacity 140ms ease",
                    } as React.CSSProperties,
                  };

                  if (columnId === "date") {
                    return (
                      <th key={sharedKey} {...sharedProps} className={`${sharedProps.className} tl-col-date text-center`}>
                        {renderHeaderLabel("Date")}
                      </th>
                    );
                  }
                  if (columnId === "category") {
                    return (
                      <th key={sharedKey} {...sharedProps} className={`${sharedProps.className} tl-col-category text-center`}>
                        {renderHeaderLabel("Category")}
                      </th>
                    );
                  }
                  if (columnId === "exercise") {
                    return (
                      <th key={sharedKey} {...sharedProps} className={`${sharedProps.className} tl-col-exercise text-left`}>
                        {renderHeaderLabel("Exercise", "left")}
                      </th>
                    );
                  }
                  if (columnId === "progression") {
                    return (
                      <th key={sharedKey} {...sharedProps} className={`${sharedProps.className} tl-col-progression text-left`}>
                        {renderHeaderLabel("Progression", "left")}
                      </th>
                    );
                  }
                  if (columnId === "modifier") {
                    return (
                      <th key={sharedKey} {...sharedProps} className={`${sharedProps.className} tl-col-modifier text-center text-gold`}>
                        {renderHeaderLabel("Mod")}
                      </th>
                    );
                  }
                  if (columnId === "band") {
                    return (
                      <th key={sharedKey} {...sharedProps} className={`${sharedProps.className} tl-col-band text-center text-mountain-blue-glow`}>
                        {renderHeaderLabel("Band")}
                      </th>
                    );
                  }
                  if (columnId === "variant") {
                    return (
                      <th key={sharedKey} {...sharedProps} className={`${sharedProps.className} tl-col-variant text-left text-mountain-blue-glow`}>
                        {renderHeaderLabel("Variant", "left")}
                      </th>
                    );
                  }
                  if (columnId === "notes") {
                    return (
                      <th key={sharedKey} {...sharedProps} className={`${sharedProps.className} tl-col-notes text-center`}>
                        {renderHeaderLabel("Notes")}
                      </th>
                    );
                  }
                  if (columnId === "next") {
                    return (
                      <th key={sharedKey} {...sharedProps} className={`${sharedProps.className} tl-col-next text-center text-difficulty-green`}>
                        {renderHeaderLabel("Next")}
                      </th>
                    );
                  }
                  if (columnId === "avg") {
                    return (
                      <th key={sharedKey} {...sharedProps} className={`${sharedProps.className} tl-col-avg text-center text-difficulty-cyan`}>
                        {renderHeaderLabel("Avg")}
                      </th>
                    );
                  }
                  if (columnId === "actions") {
                    return (
                      <th
                        key={sharedKey}
                        {...sharedProps}
                        className={`${sharedProps.className} tl-col-actions text-center align-middle`}
                        style={{ ...(sharedProps.style ?? {}), color: "var(--text-muted)" }}
                      >
                        {isEditMode ? "⋮" : ""}
                      </th>
                    );
                  }

                  const dataIdx = parseDataColumnIndex(columnId);
                  if (dataIdx == null) return null;
                  const summaryHeaderLabel = useMobileAverageSummary
                    ? (dataIdx === summaryValueDataIdx ? "Avg W" : (dataIdx === summaryRepsDataIdx ? "Avg R" : headerLabels[dataIdx]))
                    : headerLabels[dataIdx];
                  return (
                    <th
                      key={sharedKey}
                      {...sharedProps}
                      className={`${sharedProps.className} tl-col-data text-center tabular-nums`}
                      style={{
                        ...(sharedProps.style ?? {}),
                        ...(columnColors ? { color: headerTypes[dataIdx] === "value" ? "var(--col-weight)" : "var(--col-reps)" } : {}),
                      }}
                    >
                      {renderHeaderLabel(summaryHeaderLabel)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody style={{ backgroundColor: "transparent" }}>
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
                    const categoryTone = getCategoryTone(categoryLabel);
                    const isOlderThan7Days = staleEntryByLogId.get(entry.logId) ?? false;
                    const activeBand = entry.resistanceBandKg;
                    const activeModifierKg = isRowEditing
                      ? parseModifierDisplayToSignedKg(editData.modifier)
                      : parseModifierDisplayToSignedKg(entry.modifier);
                    const entryDisplayName = ex
                      ? (exerciseMeta?.displayName ?? stripBwPercentHint(getExerciseDisplayName(ex, displayTerminologyMode, settings.showExerciseForeignLanguage)))
                      : stripBwPercentHint(entry.exerciseName);
                    const isDeletedEntry = entryDisplayName.toLowerCase().startsWith("deleted exercise");
                    const exerciseVariantOptions = exerciseMeta?.variationOptions ?? [];
                    const selectedVariantValue = editData?.variant ?? "";
                    const variantSelectOptions =
                      selectedVariantValue && !exerciseVariantOptions.includes(selectedVariantValue)
                        ? [...exerciseVariantOptions, selectedVariantValue]
                        : exerciseVariantOptions;
                    const progressionTierOptions = ex ? (sortedProgressionTiersByExerciseId.get(ex.id) ?? []) : [];
                    const selectedProgressionLevel = editData?.level ?? entry.levelNameLevel;
                    const progressionSelectOptions =
                      progressionTierOptions.some((tier) => tier.level === selectedProgressionLevel)
                        ? progressionTierOptions
                        : [
                            ...progressionTierOptions,
                            {
                              id: `fallback-${selectedProgressionLevel}`,
                              level: selectedProgressionLevel,
                              name: "Unassigned progression",
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
                    const progressionLabelForExercise = getProgressionTierLabel(ex, displayLevel);
                    const variantLabelForExercise = ((isRowEditing && editData ? editData.variant : entry.variant) ?? "").trim();
                    const showSimpleProgressionLabel = effectiveSimpleView && progressionLabelForExercise.trim().length > 0;
                    const showSimpleVariantLabel = effectiveSimpleView && variantLabelForExercise.length > 0;
                    const progressionTone = getSimpleLabelTone("progression");
                    const variantTone = getSimpleLabelTone("variant");

                    // Determine per-row value display style
                    const isTimedEntry = entry.exerciseType === "timed";

                    return (
                      <tr
                        key={entry.logId}
                        data-log-row="true"
                        data-log-id={entry.logId}
                        className={`training-log-grid-row border-b transition-all ${isEditMode ? "cursor-pointer" : ""}`}
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
                          borderColor: "color-mix(in srgb, var(--jade-glow) 20%, var(--border))",
                          backgroundColor: isRowEditing
                            ? "color-mix(in srgb, var(--accent) 11%, var(--ink-mid))"
                            : isEditMode && hoveredEditLogId === entry.logId
                              ? "color-mix(in srgb, var(--accent) 7%, var(--ink-mid))"
                            : "color-mix(in srgb, var(--surface) 86%, var(--ink-mid) 14%)",
                          boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--jade-glow) 10%, transparent)",
                          opacity: isEditMode && isOlderThan7Days ? 0.62 : 1,
                        }}
                      >
                        {orderedColumnIds.map((columnId) => {
                          if (columnId === "date") {
                            return (
                              <td key={`${entry.logId}-date`} className={`${cellPadStandard} tl-col-date text-center text-xs align-middle whitespace-nowrap`} style={{ color: "var(--text-secondary)" }}>
                                {formattedEntryDate}
                              </td>
                            );
                          }

                          if (columnId === "category") {
                            return (
                              <td key={`${entry.logId}-category`} className={`${cellPadStandard} tl-col-category text-center align-middle`}>
                                <span
                                  className="inline-block px-2 py-1 border rounded text-[10px] leading-none font-semibold"
                                  style={{
                                    color: categoryTone.color,
                                    borderColor: categoryTone.borderColor,
                                    backgroundColor: categoryTone.backgroundColor,
                                  }}
                                >
                                  {categoryLabel}
                                </span>
                              </td>
                            );
                          }

                          if (columnId === "exercise") {
                            return (
                              <td
                                key={`${entry.logId}-exercise`}
                                className={`${cellPadStandard} align-middle whitespace-nowrap overflow-hidden text-ellipsis transition-colors`}
                                style={{ minWidth: "120px", maxWidth: "8rem" }}
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
                                    {historyTargetUserId ? (
                                      <span
                                        className={`text-xs truncate ${enableMobileTapToPreview ? "cursor-pointer" : ""}`}
                                        title={entryDisplayName}
                                        style={{ color: isDeletedEntry ? "var(--crimson-light)" : "var(--text-primary)", textDecoration: "none" }}
                                        onClick={() => openMobileTextPreview(t("Exercise", "normal"), entryDisplayName)}
                                      >
                                        {entryDisplayName}
                                      </span>
                                    ) : (
                                      <Link
                                        href={`/dashboard/workout-history/input/${entry.logId}`}
                                        className="text-xs truncate underline-offset-2 hover:underline"
                                        title={`Edit ${entryDisplayName}`}
                                        style={{ color: isDeletedEntry ? "var(--crimson-light)" : "var(--text-primary)", textDecoration: "none" }}
                                        onClick={(event) => event.stopPropagation()}
                                      >
                                        {entryDisplayName}
                                      </Link>
                                    )}
                                    {(showSimpleProgressionLabel || showSimpleVariantLabel) && (
                                      <div className="flex flex-wrap items-center gap-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                                        {showSimpleProgressionLabel && (
                                          <span
                                            className="inline-block max-w-full whitespace-normal break-words rounded border px-1 py-0.5"
                                            style={{
                                              color: progressionTone.color,
                                              borderColor: progressionTone.borderColor,
                                              backgroundColor: progressionTone.backgroundColor,
                                            }}
                                            onClick={() => openMobileTextPreview(t("Progression", "normal"), progressionLabelForExercise)}
                                          >
                                            {progressionLabelForExercise}
                                          </span>
                                        )}
                                        {showSimpleVariantLabel && (
                                          <span
                                            className="inline-block max-w-full whitespace-normal break-words rounded border px-1 py-0.5"
                                            style={{
                                              color: variantTone.color,
                                              borderColor: variantTone.borderColor,
                                              backgroundColor: variantTone.backgroundColor,
                                            }}
                                            onClick={() => openMobileTextPreview(t("Variant", "normal"), variantLabelForExercise)}
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
                                      href={(() => {
                                        const params = new URLSearchParams();
                                        if (historyTargetUserId) params.set("targetUserId", historyTargetUserId);
                                        if (exerciseDetailSource) params.set("from", exerciseDetailSource);
                                        const query = params.toString();
                                        const base = `/dashboard/train/${entry.exerciseId}`;
                                        return query ? `${base}?${query}` : base;
                                      })()}
                                      className="text-xs training-log-exercise-link truncate"
                                      title={entryDisplayName}
                                      style={{ color: isDeletedEntry ? "var(--crimson-light)" : "var(--text-primary)" }}
                                      onClick={(e) => {
                                        // Prevent navigation when in edit mode
                                        if (isEditMode) e.preventDefault();
                                      }}
                                    >
                                      {entryDisplayName}
                                    </Link>
                                    {(showSimpleProgressionLabel || showSimpleVariantLabel) && (
                                      <div className="flex flex-wrap items-center gap-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                                        {showSimpleProgressionLabel && (
                                          <span
                                            className="inline-block max-w-full whitespace-normal break-words rounded border px-1 py-0.5"
                                            style={{
                                              color: progressionTone.color,
                                              borderColor: progressionTone.borderColor,
                                              backgroundColor: progressionTone.backgroundColor,
                                            }}
                                          >
                                            {progressionLabelForExercise}
                                          </span>
                                        )}
                                        {showSimpleVariantLabel && (
                                          <span
                                            className="inline-block max-w-full whitespace-normal break-words rounded border px-1 py-0.5"
                                            style={{
                                              color: variantTone.color,
                                              borderColor: variantTone.borderColor,
                                              backgroundColor: variantTone.backgroundColor,
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
                            const progressionLabel = getProgressionTierLabel(ex, displayLevel);
                            return isRowEditing && editData ? (
                              <td key={`${entry.logId}-progression`} className={`${cellPadStandard} tl-col-progression overflow-hidden text-left align-middle [contain:paint]`}>
                                <select
                                  value={String(editData.level)}
                                  onChange={(e) => handleEditChange(entry.logId, "level", parseInt(e.target.value, 10))}
                                  className="block w-full min-w-0 max-w-full rounded px-2 py-1 text-left text-xs outline-none transition-all duration-200"
                                  style={{
                                    backgroundColor: "var(--surface)",
                                    borderColor: "var(--border)",
                                    border: "1px solid",
                                    color: "var(--text-primary)"
                                  }}
                                >
                                  {progressionSelectOptions.map((tier) => (
                                    <option
                                      key={`${entry.logId}-tier-${tier.level}`}
                                      value={String(tier.level)}
                                      style={{ backgroundColor: "var(--surface)", color: "var(--text-primary)" }}
                                    >
                                      {stripBwPercentHint(tier.name || "Unassigned progression")}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            ) : (
                              <td
                                key={`${entry.logId}-progression`}
                                className={`${cellPadStandard} tl-col-progression text-left text-xs align-middle`}
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
                              <td key={`${entry.logId}-modifier`} className={`${cellPadStandard} tl-col-modifier overflow-hidden text-center align-middle [contain:paint]`}>
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
                                className={`${cellPadStandard} tl-col-modifier text-center text-gold text-xs whitespace-nowrap align-middle`}
                                title={entry.modifier || ""}
                              >
                                {entry.modifier || "—"}
                              </td>
                            );
                          }

                          if (columnId === "variant") {
                            return isRowEditing && editData ? (
                              <td key={`${entry.logId}-variant`} className={`${cellPadStandard} tl-col-variant overflow-hidden text-left align-middle [contain:paint]`}>
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
                                className={`${cellPadStandard} tl-col-variant text-left text-mountain-blue-glow text-xs align-middle`}
                                title={entry.variant || ""}
                              >
                                <span className="block whitespace-normal break-words leading-tight">
                                  {entry.variant ? entry.variant : "—"}
                                </span>
                              </td>
                            );
                          }

                          if (columnId === "notes") {
                            return isRowEditing && editData ? (
                              <td key={`${entry.logId}-notes`} className={`${cellPadStandard} tl-col-notes overflow-hidden align-middle [contain:paint]`}>
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
                                className={`${cellPadStandard} tl-col-notes text-mist-light text-xs align-middle`}
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
                                className={`${cellPadStandard} tl-col-next text-center text-difficulty-green text-xs tabular-nums align-middle`}
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
                                className={`${cellPadStandard} tl-col-avg text-center text-difficulty-cyan text-xs tabular-nums align-middle`}
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
                                className={`${cellPadStandard} tl-col-actions text-center align-middle`}
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
                                        setDeleteConfirmText("");
                                        setDeleteConfirmAcknowledge(false);
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
                              <td key={`${entry.logId}-data-${dataIdx}`} className={`${cellPadStandard} tl-col-data text-center align-middle overflow-hidden [contain:paint]`}>
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
                          const summaryDisplay = (() => {
                            if (!useMobileAverageSummary) return null;
                            if (dataIdx === summaryValueDataIdx) {
                              const values = [entry.val1, entry.val2, entry.val3].filter(
                                (value): value is number => value != null && Number.isFinite(value),
                              );
                              const averageValue = values.length > 0
                                ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
                                : null;
                              return {
                                raw: averageValue,
                                text: averageValue != null ? formatSetValue(averageValue, entry.exerciseType, weightUnit, undefined, timedUnit) : "—",
                                type: "value" as const,
                              };
                            }

                            if (dataIdx === summaryRepsDataIdx) {
                              const reps = [entry.reps1, entry.reps2, entry.reps3].filter(
                                (value): value is number => value != null && Number.isFinite(value),
                              );
                              const averageReps = reps.length > 0
                                ? Math.round((reps.reduce((sum, value) => sum + value, 0) / reps.length) * 10) / 10
                                : null;
                              return {
                                raw: averageReps,
                                text: averageReps != null ? formatSetReps(averageReps, entry.exerciseType) : "—",
                                type: "reps" as const,
                              };
                            }

                            return null;
                          })();
                          const displayText = summaryDisplay ? summaryDisplay.text : renderCellValue(entry, colType, fieldIndex);
                          const effectiveRawValue = summaryDisplay ? summaryDisplay.raw : rawValue;
                          const effectiveColType = summaryDisplay ? summaryDisplay.type : colType;
                          const valueColor = isTimedEntry && colType === "value" ? "var(--timed-color)" : undefined;

                          return (
                            <td
                              key={`${entry.logId}-data-${dataIdx}`}
                              className={`${cellPadStandard} tl-col-data text-center text-xs leading-tight align-middle whitespace-nowrap overflow-hidden [contain:paint]`}
                              style={{
                                color: !valueColor ? "var(--text-primary)" : valueColor,
                                ...getZeroValueStyle(effectiveRawValue, effectiveColType, entry.exerciseType),
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
        )}
      </div>

      {isMobile && (
        <MobileFocusOverlay
          isOpen={trainingLogFocusMode}
          onDismiss={() => setTrainingLogFocusMode(false)}
          label={trainingLogTitle}
        >
          <div className="space-y-2">
            {entries.length === 0 ? (
              <div className="rounded-lg border px-3 py-4 text-center text-xs" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--text-muted)" }}>
                {t("No training data logged yet.", "normal")}
              </div>
            ) : (
              entries.map((entry) => {
                const ex = exerciseLookup.get(entry.exerciseId);
                const exerciseMeta = ex ? exerciseMetaById.get(ex.id) : undefined;
                const entryDisplayName = ex
                  ? (exerciseMeta?.displayName ?? stripBwPercentHint(getExerciseDisplayName(ex, displayTerminologyMode, settings.showExerciseForeignLanguage)))
                  : stripBwPercentHint(entry.exerciseName);
                const typeLabel = exerciseMeta?.categoryLabel ?? getExerciseCategoryLabel(ex);
                const formattedEntryDate = formattedDateByLogId.get(entry.logId) ?? formatDate(entry.date, dateFormat);

                return (
                  <TrainingLogMobileCard
                    key={`focus-${entry.logId}`}
                    entry={entry}
                    entryDisplayName={entryDisplayName}
                    typeLabel={typeLabel}
                    formattedEntryDate={formattedEntryDate}
                    weightUnit={weightUnit}
                    timedUnit={timedUnit}
                    onOpenExerciseHistory={() => openExerciseHistoryFromMobileCard(entry)}
                  />
                );
              })
            )}
          </div>
        </MobileFocusOverlay>
      )}

      {isMobile && !shouldDisableInputSection && !mobileInputOpen && !forceMobileInputOpen && (
        <button
          type="button"
          aria-label={t("Open training log input", "normal")}
          onClick={() => router.push(`/dashboard/train/input/${Date.now()}`)}
          className="training-log-mobile-fab fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4rem)] right-4 z-[70] h-14 w-14 rounded-full border text-3xl leading-none shadow-lg transition-transform duration-150 active:scale-95"
          style={{
            borderColor: "var(--accent)",
            color: "var(--cloud-white)",
            backgroundColor: "color-mix(in srgb, var(--accent) 70%, var(--ink-deep))",
            boxShadow: "0 10px 24px color-mix(in srgb, var(--accent) 35%, transparent)",
          }}
        >
          +
        </button>
      )}

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
                  className="fixed inset-0 z-40 bg-black/70"
                  onClick={() => {
                    if (isDeleting) return;
                    setDeleteConfirm(null);
                    setDeleteConfirmText("");
                    setDeleteConfirmAcknowledge(false);
                  }}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="training-log-delete-modal fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[390px] max-w-[92vw] rounded-xl shadow-2xl p-5"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", border: "1px solid", boxShadow: "var(--danger-modal-glow)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="mb-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ borderColor: "color-mix(in srgb, var(--danger) 45%, var(--border))", color: "var(--danger)", backgroundColor: "color-mix(in srgb, var(--danger) 12%, transparent)" }}>
                    {t("Danger Zone", "normal")}
                  </p>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--danger)" }}>{t("Delete Training Record", "normal")}</h3>
                  <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {t("Are you sure you want to permanently delete the log record for", "normal")}{" "}
                    <span className="font-medium" style={{ color: "var(--accent)" }}>{deleteConfirm.exerciseName}</span>? This action
                    {" "}{t("cannot be undone.", "normal")}
                  </p>

                  <div className="mb-3 rounded-lg border px-3 py-2 text-[11px]" style={{ borderColor: "color-mix(in srgb, var(--danger) 30%, var(--border))", backgroundColor: "color-mix(in srgb, var(--danger) 7%, var(--surface))" }}>
                    <div className="flex items-center justify-between gap-2">
                      <span style={{ color: "var(--text-secondary)" }}>{t("Exercise", "normal")}</span>
                      <span className="font-semibold text-right" style={{ color: "var(--cloud-white)" }}>{deleteConfirm.exerciseName}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span style={{ color: "var(--text-secondary)" }}>{t("Date", "normal")}</span>
                      <span className="font-medium" style={{ color: "var(--text-primary)" }}>{deleteTargetDate}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span style={{ color: "var(--text-secondary)" }}>{t("Sets", "normal")}</span>
                      <span className="font-medium" style={{ color: "var(--text-primary)" }}>{deleteTargetSetCount}</span>
                    </div>
                  </div>

                  <label className="mb-2 flex items-start gap-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    <input
                      type="checkbox"
                      checked={deleteConfirmAcknowledge}
                      disabled={isDeleting}
                      onChange={(event) => setDeleteConfirmAcknowledge(event.target.checked)}
                      className="mt-0.5"
                    />
                    <span>{t("I understand this permanently removes this log and cannot be undone.", "normal")}</span>
                  </label>

                  <div className="mb-4">
                    <p className="mb-1 text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--text-secondary)" }}>
                      {t("Type DELETE to confirm", "normal")}
                    </p>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(event) => setDeleteConfirmText(event.target.value)}
                      disabled={isDeleting}
                      className="w-full rounded-md border px-2.5 py-2 text-xs outline-none"
                      style={{
                        borderColor: "color-mix(in srgb, var(--danger) 35%, var(--border))",
                        backgroundColor: "color-mix(in srgb, var(--surface) 94%, var(--ink-deep))",
                        color: "var(--text-primary)",
                      }}
                      placeholder="DELETE"
                    />
                  </div>

                  <div className="flex gap-3">
                    <motion.button
                      onClick={() => handleDeleteLog(deleteConfirm.logId)}
                      disabled={isDeleting || !isDeleteConfirmationReady}
                      className="flex-1 px-4 py-2 text-xs font-semibold rounded-lg border transition-[transform] duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                      style={{
                        backgroundColor: "color-mix(in srgb, var(--danger) 10%, transparent)",
                        borderColor: "var(--danger)",
                        color: "var(--danger)"
                      }}
                    >
                      {isDeleting ? t("Deleting...", "normal") : t("Delete Record", "normal")}
                    </motion.button>
                    <motion.button
                      onClick={() => {
                        setDeleteConfirm(null);
                        setDeleteConfirmText("");
                        setDeleteConfirmAcknowledge(false);
                      }}
                      disabled={isDeleting}
                      className="flex-1 px-4 py-2 text-xs font-semibold rounded-lg border transition-[transform] duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--text-secondary)"
                      }}
                    >
                      {t("Keep Record", "normal")}
                    </motion.button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}

      {/* Mobile full-text preview for filtered exercise history cells */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {mobileTextPreview && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 bg-black/60"
                  onClick={() => setMobileTextPreview(null)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 14 }}
                  className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border p-4 shadow-2xl"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-secondary)" }}>
                    {mobileTextPreview.label}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed break-words" style={{ color: "var(--text-primary)" }}>
                    {mobileTextPreview.value}
                  </p>
                  <button
                    type="button"
                    onClick={() => setMobileTextPreview(null)}
                    className="mt-4 w-full rounded border px-3 py-2 text-xs font-medium"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--surface-hover)" }}
                  >
                    {t("Close", "normal")}
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}

      {/* Mobile input picker (replaces native select popups) */}
      {isMobile && typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {mobileInputPicker && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[95] bg-black/65"
                  onClick={() => setMobileInputPicker(null)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.98 }}
                  className="fixed left-1/2 top-1/2 z-[96] max-h-[72vh] w-[min(82vw,30rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-none border"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", boxShadow: "var(--shadow-elev-2)" }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-primary)" }}>
                      {mobileInputPicker.title}
                    </p>
                    <button
                      type="button"
                      onClick={() => setMobileInputPicker(null)}
                      className="rounded border px-2.5 py-1 text-[11px]"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--surface-hover)" }}
                    >
                      {t("Close", "normal")}
                    </button>
                  </div>

                  <div className="relative px-3 pb-3 pt-2">
                    <div
                      className="pointer-events-none absolute left-3 right-3 top-1/2 h-11 -translate-y-1/2 border"
                      style={{ borderColor: "var(--accent)", backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)" }}
                    />
                    <div
                      ref={modifierWheelScrollRef}
                      className="h-56 overflow-y-auto snap-y snap-mandatory"
                      style={{
                        paddingTop: "90px",
                        paddingBottom: "90px",
                        scrollbarWidth: "none",
                      }}
                    >
                      {mobileInputPickerOptions.map((option) => {
                        const isActive = option.value === mobileInputPickerCurrentValue;
                        return (
                          <button
                            key={`${mobileInputPicker.field}-wheel-${option.value || "empty"}`}
                            type="button"
                            onClick={() => {
                              if (mobileInputPicker.field === "modifierKg") {
                                handleWorkoutInputChange("modifierKg", option.value === "0" ? "" : option.value);
                              } else {
                                handleWorkoutInputChange(mobileInputPicker.field, option.value);
                              }
                              setMobileInputPicker(null);
                            }}
                            className="flex h-11 w-full snap-center items-center justify-center text-sm"
                            style={{
                              color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                              fontWeight: isActive ? 700 : 500,
                            }}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    {mobilePickerCanScrollDown && (
                      <>
                        <div
                          className="pointer-events-none absolute bottom-3 left-3 right-3 h-10"
                          style={{
                            background: "linear-gradient(to bottom, color-mix(in srgb, var(--surface) 0%, transparent), color-mix(in srgb, var(--surface) 92%, transparent))",
                          }}
                        />
                        <motion.div
                          className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2"
                          animate={{ y: [0, 4, 0], opacity: [0.65, 1, 0.65] }}
                          transition={{ duration: 1.15, ease: "easeInOut", repeat: Infinity }}
                          style={{ color: "var(--text-secondary)" }}
                        >
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden>
                            <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </motion.div>
                      </>
                    )}
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
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--nyaa-table-head-bg)" }}
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-primary)" }}>
                      {t("Exercise History", "normal")}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>
                      {selectedInputExercise
                        ? stripBwPercentHint(getExerciseDisplayName(selectedInputExercise, displayTerminologyMode, settings.showExerciseForeignLanguage))
                        : t("Select an exercise in Training Log Input", "normal")}
                    </p>
                  </div>
                  <div className="ml-3 flex items-center gap-1">
                    {selectedInputExercise?.id ? (
                      <Link
                        href={(() => {
                          const params = new URLSearchParams();
                          if (historyTargetUserId) params.set("targetUserId", historyTargetUserId);
                          if (exerciseDetailSource) params.set("from", exerciseDetailSource);
                          const query = params.toString();
                          const base = `${DASHBOARD_ROUTES.workoutHistory}/${encodeURIComponent(selectedInputExercise.id)}`;
                          return query ? `${base}?${query}` : base;
                        })()}
                        aria-label="Open full exercise history"
                        title={t("Open full history", "normal")}
                        className={panelIconButtonClass}
                        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                      >
                        ↗
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      aria-label={t("Minimize exercise history", "normal")}
                      title={t("Minimize", "normal")}
                      onClick={() => setHistoryDockOpen(false)}
                      className={panelIconButtonClass}
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    >
                      _
                    </button>
                    <button
                      type="button"
                      aria-label={historyDockExpanded ? t("Collapse exercise history", "normal") : t("Expand exercise history", "normal")}
                      title={historyDockExpanded ? t("Collapse", "normal") : t("Expand", "normal")}
                      onClick={() => setHistoryDockExpanded((prev) => !prev)}
                      className={panelIconButtonClass}
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    >
                      {historyDockExpanded ? "↔" : "⤢"}
                    </button>
                    <button
                      type="button"
                      aria-label={t("Close exercise history", "normal")}
                      title={t("Close", "normal")}
                      onClick={() => setHistoryDockOpen(false)}
                      className={panelIconButtonClass}
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    >
                      x
                    </button>
                  </div>
                </div>

                <div className="max-h-[320px] overflow-auto sidebar-scroll">
                  {!selectedInputExercise ? (
                    <p className="text-xs px-2 py-3" style={{ color: "var(--text-muted)" }}>
                      {t("Choose an exercise from the input section to view its history.", "normal")}
                    </p>
                  ) : historyLoading ? (
                    <p className="text-xs px-2 py-3" style={{ color: "var(--text-muted)" }}>
                      {t("Loading history...", "normal")}
                    </p>
                  ) : historyData.length === 0 ? (
                    <p className="text-xs px-2 py-3" style={{ color: "var(--text-muted)" }}>
                      {t("No history found for this exercise yet.", "normal")}
                    </p>
                  ) : (
                    <>
                    <table className="w-full text-[11px] border-collapse whitespace-nowrap">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                          <th className="text-center px-2 py-1 font-semibold" style={{ color: "var(--text-secondary)", backgroundColor: "var(--nyaa-table-head-bg)" }}>{t("Date", "normal")}</th>
                          <th className="text-center px-2 py-1 font-semibold" style={{ color: "var(--accent)", backgroundColor: "var(--nyaa-table-head-bg)" }}>
                            {historyDockExpanded ? t("Progression", "normal") : "P"}
                          </th>
                          <th className="text-center px-2 py-1 font-semibold" style={{ color: "var(--col-weight)", backgroundColor: "var(--nyaa-table-head-bg)" }}>
                            {historyDockExpanded ? t("Average Weight", "normal") : t("Avg W", "normal")}
                          </th>
                          <th className="text-center px-2 py-1 font-semibold" style={{ color: "var(--col-reps)", backgroundColor: "var(--nyaa-table-head-bg)" }}>
                            {historyDockExpanded ? t("Average Reps", "normal") : t("Avg R", "normal")}
                          </th>
                          <th className="text-center px-2 py-1 font-semibold" style={{ color: "var(--gold)", backgroundColor: "var(--nyaa-table-head-bg)" }}>
                            {historyDockExpanded ? t("Modifier", "normal") : t("Mod", "normal")}
                          </th>
                          <th className="text-center px-2 py-1 font-semibold" style={{ color: "var(--text-secondary)", backgroundColor: "var(--nyaa-table-head-bg)" }}>
                            {historyDockExpanded ? t("Variant", "normal") : t("Var", "normal")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.map((entry) => {
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
                            ? getProgressionTierLabel(selectedInputExercise, progressionLevel)
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
                          const weightBreakdown = [
                            entry.weight1 != null ? `W1:${entry.weight1}` : null,
                            entry.weight2 != null ? `W2:${entry.weight2}` : null,
                            entry.weight3 != null ? `W3:${entry.weight3}` : null,
                          ].filter(Boolean).join(" ");
                          const repsBreakdown = [
                            entry.reps1 != null ? `R1:${entry.reps1}` : null,
                            entry.reps2 != null ? `R2:${entry.reps2}` : null,
                            entry.reps3 != null ? `R3:${entry.reps3}` : null,
                          ].filter(Boolean).join(" ");
                          const avgWeightTitle = [weightBreakdown || "No weight recorded", modifierText !== "-" ? `Mod: ${modifierText}` : null]
                            .filter(Boolean)
                            .join(" | ");
                          const avgRepsTitle = [repsBreakdown || "No reps recorded", modifierText !== "-" ? `Mod: ${modifierText}` : null]
                            .filter(Boolean)
                            .join(" | ");

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
                    {(historyNextCursor || historyLoadingMore) && (
                      <div className="px-2 py-2 border-t" style={{ borderColor: "color-mix(in srgb, var(--border) 55%, transparent)" }}>
                        <button
                          type="button"
                          onClick={handleLoadMoreHistory}
                          disabled={historyLoadingMore}
                          className="w-full rounded-md border px-2 py-1 text-[11px] font-semibold transition-all duration-150 disabled:opacity-60"
                          style={{
                            borderColor: "var(--border)",
                            color: "var(--text-secondary)",
                            backgroundColor: "var(--surface)",
                            cursor: historyLoadingMore ? "wait" : "pointer",
                          }}
                        >
                          {historyLoadingMore ? t("Loading more...", "normal") : t("Load more history", "normal")}
                        </button>
                      </div>
                    )}
                    </>
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
                {t("History", "normal")}
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
            className="fixed z-[320] overflow-y-auto rounded border shadow-lg"
            style={{
              top: exerciseDropdownRect.top + 4,
              left: exerciseDropdownRect.left,
              width: exerciseDropdownRect.width,
              maxWidth: "calc(100vw - 1rem)",
              maxHeight: "min(14rem, calc(100dvh - 1rem))",
              overscrollBehavior: "contain",
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            {filteredInputExercises.length === 0 ? (
              <p className="px-2 py-2 text-xs" style={{ color: "var(--text-muted)" }}>{t("No exercises found", "normal")}</p>
            ) : (
              filteredInputExercises.map((result, idx) => {
                const isHighlighted = idx === exerciseHighlightIndex;
                const isCustomOption = result.mode === "custom";
                return (
                  <button
                    key={`${result.mode || "exercise"}:${result.exercise?.id || "custom"}:${result.prefillLevel || ""}:${result.prefillVariant || ""}:${idx}`}
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
                    className={`block w-full px-2 py-1.5 text-left text-xs transition-none hover:bg-ink-mid/25 ${isCustomOption ? "font-semibold" : "truncate"}`}
                    style={{
                      color: isCustomOption ? "var(--cloud-white)" : "var(--text-primary)",
                      backgroundColor: isCustomOption
                        ? (isHighlighted ? "color-mix(in srgb, var(--forest) 30%, var(--ink-dark))" : "color-mix(in srgb, var(--forest) 18%, var(--ink-dark))")
                        : (isHighlighted ? "color-mix(in srgb, var(--accent) 18%, transparent)" : undefined),
                      borderBottom: isCustomOption ? "1px solid color-mix(in srgb, var(--forest) 30%, transparent)" : undefined,
                    }}
                    title={isCustomOption ? "Create a custom exercise and send it to pending review" : result.displayLabel}
                  >
                    {isCustomOption ? `+ ${result.displayLabel}` : result.displayLabel}
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

