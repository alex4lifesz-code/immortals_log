"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import GlowCard from "@/components/ui/GlowCard";
import SearchField from "@/components/ui/SearchField";
import TrainDayRail from "@/components/navigation/TrainDayRail";
import { MemoTrainingLogTable } from "@/components/workout/TrainingLogTable";
import ExerciseManagementDrawer from "@/components/workout/ExerciseManagementDrawer";
import { useAuth } from "@/context/AuthContext";
import { useAppContext } from "@/context/AppContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { api } from "@/lib/api-client";
import { getDeletedExerciseLabel } from "@/lib/exercise-name";
import { rankExerciseSearchResults } from "@/lib/exercise-search";
import { translateEnglishToLanguage } from "@/lib/language";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import { isDeletedExerciseDescription } from "@/lib/pending-exercises";
import { t } from "@/lib/terminology";
import { DEFAULT_USER_PHYSIQUE, loadUserPhysique } from "@/lib/user-physique";
import { PROGRESSION_EXERCISES_UPDATED_EVENT } from "@/lib/progression-events";
import { DAYS_OF_WEEK, formatDateWithPreference, parseDayAssignmentDetailsList, parseDayAssignments } from "@/lib/constants";
import { formatSetValue, type TimedUnitPref, type WeightUnit } from "@/lib/unit-conversion";
import type { UserPhysiqueSettings } from "@/lib/user-physique";
import type { ProgressionExercise, ProgressionLog } from "../workout/types";

type WorkoutMetricRow = { weight: string; reps: string };
type TrainExerciseRow = {
  rowKey: string;
  exerciseId: string;
  exerciseName: string;
  date: string | null;
  logId: string | null;
  progression: string;
  variant: string;
  category: string;
  isDeleted: boolean;
  recent24hCount: number;
  assignedDays: string;
  assignedProgression?: string;
  assignedVariant?: string;
  assignedLevel?: number;
  showAssignedContext?: boolean;
  isCompleted?: boolean;
  completionDate?: string | null;
};

function getWorkoutMetricRows(log: ProgressionLog, displayUnit: WeightUnit = "kg", timedUnit: TimedUnitPref = "seconds"): WorkoutMetricRow[] {
  const hasHold = log.holdTime != null || log.holdTime2 != null || log.holdTime3 != null;
  const primaryRows = (hasHold
    ? [log.holdTime, log.holdTime2, log.holdTime3]
    : [log.weight1, log.weight2, log.weight3]
  ).map((metric, index) => {
    const reps = [log.reps1, log.reps2, log.reps3][index];
    if (metric == null && reps == null) return null;
    return {
      weight: metric == null ? "-" : formatSetValue(metric, hasHold ? "timed" : "weighted", displayUnit, undefined, timedUnit),
      reps: reps == null ? "-" : String(reps),
    };
  }).filter((row): row is WorkoutMetricRow => Boolean(row));

  const extraRows = Array.isArray(log.dynamicSetRows) ? log.dynamicSetRows : [];
  const rows = [...primaryRows, ...extraRows].filter((row) => row.weight !== "-" || row.reps !== "-");
  return rows.length > 0 ? rows : [{ weight: "-", reps: "-" }];
}

function formatWorkoutValueChips(log: ProgressionLog, displayUnit: WeightUnit = "kg", timedUnit: TimedUnitPref = "seconds"): string[] {
  const chips = getWorkoutMetricRows(log, displayUnit, timedUnit)
    .map((row) => (row.reps !== "-" ? `${row.weight} x ${row.reps}` : row.weight))
    .filter(Boolean);

  if (chips.length === 0 && log.reps != null) {
    return [`${log.reps} reps`];
  }

  return chips;
}

function compareLogRecency(a: Pick<ProgressionLog, "id" | "createdAt">, b: Pick<ProgressionLog, "id" | "createdAt">): number {
  const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  if (timeDiff !== 0) return timeDiff;
  return b.id.localeCompare(a.id);
}

function formatRelativeRecentDate(
  dateLike: string,
  dateFormat: "dd-mm-yyyy" | "dd-mmm-yyyy" | "dd-mm-yy" | "dd-mmm-yy" = "dd-mmm-yyyy",
  timeZone?: string,
): string {
  const timestamp = new Date(dateLike).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) {
    return formatDateWithPreference(new Date(timestamp), dateFormat, timeZone);
  }

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const fourteenDaysMs = 14 * dayMs;

  if (diffMs < hourMs) {
    const mins = Math.max(1, Math.floor(diffMs / minuteMs));
    return `${mins}m ago`;
  }

  if (diffMs < dayMs) {
    const hours = Math.max(1, Math.floor(diffMs / hourMs));
    return `${hours}h ago`;
  }

  if (diffMs < fourteenDaysMs) {
    const days = Math.max(1, Math.floor(diffMs / dayMs));
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  return formatDateWithPreference(new Date(timestamp), dateFormat, timeZone);
}

function getRecentExerciseTextColor(dateLike: string | null | undefined, isSelected = false): string {
  const defaultColor = isSelected ? "var(--cloud-white)" : "var(--text-muted)";
  if (!dateLike) return defaultColor;

  const timestamp = new Date(dateLike).getTime();
  if (!Number.isFinite(timestamp)) return defaultColor;

  const diffMs = Math.max(0, Date.now() - timestamp);
  const dayMs = 24 * 60 * 60 * 1000;

  if (diffMs <= 7 * dayMs) {
    return isSelected
      ? "color-mix(in srgb, var(--accent) 60%, var(--cloud-white) 40%)"
      : "color-mix(in srgb, var(--accent) 72%, var(--cloud-white) 28%)";
  }

  return defaultColor;
}

function TrainExerciseListRow({
  row,
  isSelected,
  onActivate,
  dateFormat,
  timeZone,
}: {
  row: TrainExerciseRow;
  isSelected: boolean;
  onActivate: (row: TrainExerciseRow) => void;
  dateFormat: "dd-mm-yyyy" | "dd-mmm-yyyy" | "dd-mm-yy" | "dd-mmm-yy";
  timeZone?: string;
}) {
  return (
    <article
      className="mx-1 my-0.5 rounded-md px-3 py-2.5"
      style={{
        borderTop: "1px solid color-mix(in srgb, var(--ink-light) 72%, transparent)",
        border: isSelected ? "1px solid color-mix(in srgb, var(--accent) 62%, var(--ink-light))" : undefined,
        backgroundColor: isSelected ? "color-mix(in srgb, var(--accent) 14%, var(--ink-deep))" : "transparent",
        boxShadow: isSelected ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent), 0 0 14px color-mix(in srgb, var(--accent) 24%, transparent)" : "none",
        cursor: "pointer",
      }}
      role="button"
      tabIndex={0}
      onClick={() => onActivate(row)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActivate(row);
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <p
              className="min-w-0 text-sm font-semibold leading-tight"
              style={{ color: row.isDeleted ? "var(--crimson-light)" : getRecentExerciseTextColor(row.completionDate || row.date, isSelected) }}
            >
              {row.exerciseName}
              {row.recent24hCount >= 2 ? (
                <sup className="ml-0.5 text-[12px] font-bold leading-none" style={{ color: "var(--accent)" }}>
                  {row.recent24hCount}
                </sup>
              ) : null}
            </p>
          </div>
        </div>
        <span
          className="shrink-0 text-[11px]"
          style={{ color: row.showAssignedContext && row.isCompleted ? "var(--forest)" : "var(--text-muted)" }}
        >
          {row.showAssignedContext
            ? (row.isCompleted && row.completionDate ? formatRelativeRecentDate(row.completionDate, dateFormat, timeZone) : "")
            : (row.date ? formatRelativeRecentDate(row.date, dateFormat, timeZone) : "")}
        </span>
      </div>
      {row.showAssignedContext ? (
        <p className="mt-0.5 flex items-center gap-1 text-[11px] italic" style={{ color: row.isDeleted ? "var(--crimson-light)" : "var(--text-muted)" }}>
          <span>{`${t("Assigned", "normal")}: ${row.assignedVariant ? `${row.assignedVariant} ` : ""}${row.assignedProgression || row.progression} ${row.exerciseName}`}</span>
          {row.isCompleted ? (
            <span className="inline-flex shrink-0" style={{ color: "var(--forest)" }} aria-label={t("Completed today", "normal")}>
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          ) : null}
        </p>
      ) : (
        <p className="mt-0.5 text-[11px] italic" style={{ color: row.isDeleted ? "var(--crimson-light)" : "var(--text-muted)" }}>
          {`${t("Recent", "normal")}: ${row.variant ? `${row.variant} ` : ""}${row.progression} ${row.exerciseName}`}
        </p>
      )}
    </article>
  );
}

export default function HistoryPage() {
  const { user } = useAuth();
  const { themeStyle } = useAppContext();
  const { settings } = useDisplaySettings();
  const lt = (text: string) => translateEnglishToLanguage(text, settings.languageMode);
  const weightUnit = settings.defaultWeightUnit ?? "kg";
  const timedUnit: TimedUnitPref = settings.defaultTimedUnit ?? "seconds";
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [exercises, setExercises] = useState<ProgressionExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [physique, setPhysique] = useState<UserPhysiqueSettings>(DEFAULT_USER_PHYSIQUE);
  const [visibleUsers, setVisibleUsers] = useState<Array<{ id: string; name: string; username: string }>>([]);
  const [mobileSearchQuery, setMobileSearchQuery] = useState("");
  const [mobileHistoryFilterOpen, setMobileHistoryFilterOpen] = useState(false);
  const [mobileHistoryCategory, setMobileHistoryCategory] = useState("all");
  const [mobileHistorySort, setMobileHistorySort] = useState<"recent" | "oldest" | "name-az" | "relevant">("recent");
  const [mobileHistoryRecency, setMobileHistoryRecency] = useState<"all" | "7d" | "30d">("all");
  const [mobileDrawerSearchOpen, setMobileDrawerSearchOpen] = useState(false);
  const [mobileDrawerSearchQuery, setMobileDrawerSearchQuery] = useState("");
  const [mobileDrawerFilterOpen, setMobileDrawerFilterOpen] = useState(false);
  const [mobileDrawerLevelFilter, setMobileDrawerLevelFilter] = useState("all");
  const [mobileDrawerVariantFilter, setMobileDrawerVariantFilter] = useState("all");
  const [mobileDrawerWeightFilter, setMobileDrawerWeightFilter] = useState<"all" | "weighted" | "bodyweight">("all");
  const [mobileDrawerRepsFilter, setMobileDrawerRepsFilter] = useState<"all" | "1-5" | "6-10" | "11+">("all");
  const [mobileDrawerSort, setMobileDrawerSort] = useState<"recent" | "oldest" | "progression-asc" | "progression-desc">("recent");
  const [mobileExerciseDrawerExerciseId, setMobileExerciseDrawerExerciseId] = useState<string | null>(null);
  const [mobileDrawerAnimReady, setMobileDrawerAnimReady] = useState(false);
  const [mobileLastSelectedExerciseId, setMobileLastSelectedExerciseId] = useState<string | null>(null);
  const [dayDrawerLastSelectedRowKey, setDayDrawerLastSelectedRowKey] = useState<string | null>(null);
  const [mobileLogFabOpen, setMobileLogFabOpen] = useState(false);
  const [mobileQuickCheckinOpen, setMobileQuickCheckinOpen] = useState(false);
  const [mobileQuickCheckinWeight, setMobileQuickCheckinWeight] = useState("");
  const [mobileQuickCheckinNote, setMobileQuickCheckinNote] = useState("");
  const [mobileQuickCheckinLatestWeight, setMobileQuickCheckinLatestWeight] = useState<number | null>(null);
  const [mobileQuickCheckinTodayWeight, setMobileQuickCheckinTodayWeight] = useState<number | null>(null);
  const [mobileQuickCheckinTodayNote, setMobileQuickCheckinTodayNote] = useState("");
  const [mobileQuickCheckinLoading, setMobileQuickCheckinLoading] = useState(false);
  const [mobileQuickCheckinSaving, setMobileQuickCheckinSaving] = useState(false);
  const [mobileQuickCheckinMessage, setMobileQuickCheckinMessage] = useState<string | null>(null);
  const [showWeightHintThankYou, setShowWeightHintThankYou] = useState(false);
  const [mobileLogFabSearchQuery, setMobileLogFabSearchQuery] = useState("");
  const [mobileLogFabCategory, setMobileLogFabCategory] = useState("all");
  const [mobileLogFabSort, setMobileLogFabSort] = useState<"recent" | "oldest" | "name-az" | "relevant">("recent");
  const [trainDayFilter, setTrainDayFilter] = useState<number | null>(null);
  const [trainDayDrawerOpen, setTrainDayDrawerOpen] = useState(false);
  const [trainRailOverviewOpen, setTrainRailOverviewOpen] = useState(false);
  const [exerciseManagementOpen, setExerciseManagementOpen] = useState(false);
  const [hideEmptyTrainDays, setHideEmptyTrainDays] = useState(true);
  const hideEmptyTrainDaysLoadedKeyRef = useRef<string | null>(null);
  const hideEmptyTrainDaysRemoteReadyRef = useRef(false);
  const hideEmptyTrainDaysSyncedUserIdRef = useRef<string | null>(null);
  const mobileDrawerSearchInputRef = useRef<HTMLInputElement | null>(null);
  const mobileHistorySortPreferenceRef = useRef<"recent" | "oldest" | "name-az">("recent");
  const mobileLogFabSortPreferenceRef = useRef<"recent" | "oldest" | "name-az">("recent");

  const userId = user?.id ?? "";
  const targetUserId = searchParams.get("targetUserId") || "";
  const rawFriendView = searchParams.get("friendView") || "history";
  const friendView = rawFriendView === "chart" || rawFriendView === "checkin" ? rawFriendView : "history";
  const activeUserId = targetUserId || userId;
  const hideEmptyTrainDaysStorageKey = useMemo(
    () => (userId ? `cultivateos-history-hide-empty-days:${userId}` : null),
    [userId],
  );
  const prefillExerciseId = searchParams.get("prefillExerciseId");
  const prefillExerciseName = searchParams.get("prefillExercise");
  const prefillProgression = searchParams.get("prefillProgression");
  const prefillVariant = searchParams.get("prefillVariant");
  const librarySheetRequested = searchParams.get("library") === "1" && !targetUserId && !searchParams.get("friendView");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hideEmptyTrainDaysStorageKey) {
      hideEmptyTrainDaysLoadedKeyRef.current = null;
      hideEmptyTrainDaysSyncedUserIdRef.current = null;
      hideEmptyTrainDaysRemoteReadyRef.current = false;
      setHideEmptyTrainDays(true);
      return;
    }

    let nextValue = true;
    try {
      const raw = window.localStorage.getItem(hideEmptyTrainDaysStorageKey);
      if (raw === "false") nextValue = false;
      if (raw === "true") nextValue = true;
    } catch {}

    setHideEmptyTrainDays(nextValue);
    hideEmptyTrainDaysLoadedKeyRef.current = hideEmptyTrainDaysStorageKey;
  }, [hideEmptyTrainDaysStorageKey]);

  useEffect(() => {
    if (!userId) {
      hideEmptyTrainDaysSyncedUserIdRef.current = null;
      hideEmptyTrainDaysRemoteReadyRef.current = false;
      return;
    }

    let cancelled = false;
    hideEmptyTrainDaysRemoteReadyRef.current = false;

    const hydrateRemoteHideEmptyDays = async () => {
      try {
        const payload = await api.get<{ appPrefs?: Record<string, unknown> }>("/api/users/preferences", { cache: "no-store" });
        if (cancelled) return;

        const appPrefs = payload?.appPrefs && typeof payload.appPrefs === "object" ? payload.appPrefs : null;
        const remoteValue = appPrefs?.historyHideEmptyTrainDays;
        if (typeof remoteValue === "boolean") {
          setHideEmptyTrainDays(remoteValue);
          if (hideEmptyTrainDaysStorageKey) {
            try {
              window.localStorage.setItem(hideEmptyTrainDaysStorageKey, remoteValue ? "true" : "false");
            } catch {}
          }
        }
      } catch {
        // Keep local fallback when remote preferences cannot be reached.
      } finally {
        if (!cancelled) {
          hideEmptyTrainDaysSyncedUserIdRef.current = userId;
          hideEmptyTrainDaysRemoteReadyRef.current = true;
        }
      }
    };

    hydrateRemoteHideEmptyDays();

    return () => {
      cancelled = true;
    };
  }, [hideEmptyTrainDaysStorageKey, userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hideEmptyTrainDaysStorageKey) return;
    if (hideEmptyTrainDaysLoadedKeyRef.current !== hideEmptyTrainDaysStorageKey) return;

    try {
      window.localStorage.setItem(hideEmptyTrainDaysStorageKey, hideEmptyTrainDays ? "true" : "false");
    } catch {}
  }, [hideEmptyTrainDays, hideEmptyTrainDaysStorageKey]);

  useEffect(() => {
    if (!userId) return;
    if (!hideEmptyTrainDaysRemoteReadyRef.current) return;
    if (hideEmptyTrainDaysSyncedUserIdRef.current !== userId) return;

    const timer = window.setTimeout(() => {
      api.put("/api/users/preferences", {
        appPrefs: {
          historyHideEmptyTrainDays: hideEmptyTrainDays,
        },
      }).catch(() => {
        // Ignore remote save failures; local storage remains the fallback.
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [hideEmptyTrainDays, userId]);

  const setLibrarySheetOpen = useCallback((open: boolean) => {
    setMobileLogFabOpen(open);
    if (open) {
      setMobileQuickCheckinOpen(false);
    }
  }, []);

  const setQuickCheckinOpen = useCallback((open: boolean) => {
    setMobileQuickCheckinOpen(open);
    if (open) {
      setMobileLogFabOpen(false);
      setMobileQuickCheckinMessage(null);
    }
  }, []);

  const getTodayDateKey = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const handleSaveQuickCheckin = useCallback(async () => {
    if (!userId || mobileQuickCheckinSaving) return;

    const weightLocked = mobileQuickCheckinTodayWeight != null;
    const noteLocked = Boolean(mobileQuickCheckinTodayNote.trim());
    if (weightLocked && noteLocked) {
      setMobileQuickCheckinMessage(lt("Already saved today"));
      return;
    }

    const trimmedWeight = mobileQuickCheckinWeight.trim();
    const trimmedNote = mobileQuickCheckinNote.trim();

    const parsedWeight = trimmedWeight === "" ? null : Number.parseFloat(trimmedWeight);
    const payloadWeight = parsedWeight != null && Number.isFinite(parsedWeight) && parsedWeight >= 0 ? parsedWeight : null;
    const effectiveWeight = weightLocked ? mobileQuickCheckinTodayWeight : payloadWeight;
    const effectiveNote = noteLocked ? mobileQuickCheckinTodayNote.trim() : trimmedNote;

    try {
      setMobileQuickCheckinSaving(true);
      await api.post("/api/checkins", {
        date: getTodayDateKey(),
        entries: {
          [userId]: {
            weight: effectiveWeight,
            comment: effectiveNote || null,
          },
        },
      });
      setMobileQuickCheckinMessage(lt("Saved"));
      setMobileQuickCheckinOpen(false);
      setMobileQuickCheckinTodayWeight(effectiveWeight ?? null);
      setMobileQuickCheckinTodayNote(effectiveNote);
      if (!weightLocked && effectiveWeight != null) {
        setShowWeightHintThankYou(true);
      }
      setMobileQuickCheckinWeight("");
      setMobileQuickCheckinNote("");
    } catch {
      setMobileQuickCheckinMessage(lt("Unable to save"));
    } finally {
      setMobileQuickCheckinSaving(false);
    }
  }, [getTodayDateKey, mobileQuickCheckinNote, mobileQuickCheckinSaving, mobileQuickCheckinTodayNote, mobileQuickCheckinTodayWeight, mobileQuickCheckinWeight, userId]);

  useEffect(() => {
    if (!showWeightHintThankYou) return;
    const timer = window.setTimeout(() => {
      setShowWeightHintThankYou(false);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [showWeightHintThankYou]);

  useEffect(() => {
    if (!userId || targetUserId) return;

    let cancelled = false;
    const loadTodayCheckinState = async () => {
      try {
        const todayKey = getTodayDateKey();
        const [latestWeightPayload, checkinsPayload] = await Promise.all([
          api.get<{ weight: number | null; date: string | null }>("/api/checkins/latest-weight"),
          api.get<{ checkins: Array<{ userId: string; date: string; weight?: number | null; comment?: string | null }> }>("/api/checkins"),
        ]);

        if (cancelled) return;

        const latestWeight = typeof latestWeightPayload.weight === "number" ? latestWeightPayload.weight : null;
        const todayEntry = (checkinsPayload.checkins || []).find((entry) => {
          if (!entry || entry.userId !== userId || !entry.date) return false;
          const entryKey = String(entry.date).slice(0, 10);
          return entryKey === todayKey;
        });

        const todayWeight = todayEntry && typeof todayEntry.weight === "number" ? todayEntry.weight : null;
        const todayNote = todayEntry?.comment ? String(todayEntry.comment) : "";

        setMobileQuickCheckinLatestWeight(latestWeight);
        setMobileQuickCheckinTodayWeight(todayWeight);
        setMobileQuickCheckinTodayNote(todayNote);
      } catch {
        if (!cancelled) {
          setMobileQuickCheckinLatestWeight(null);
          setMobileQuickCheckinTodayWeight(null);
          setMobileQuickCheckinTodayNote("");
        }
      }
    };

    void loadTodayCheckinState();
    return () => {
      cancelled = true;
    };
  }, [getTodayDateKey, targetUserId, userId]);

  useEffect(() => {
    if (!mobileQuickCheckinOpen || !userId) return;

    let cancelled = false;
    const loadQuickCheckinDefaults = async () => {
      try {
        setMobileQuickCheckinLoading(true);
        const todayKey = getTodayDateKey();
        const [latestWeightPayload, checkinsPayload] = await Promise.all([
          api.get<{ weight: number | null; date: string | null }>("/api/checkins/latest-weight"),
          api.get<{ checkins: Array<{ userId: string; date: string; weight?: number | null; comment?: string | null }> }>("/api/checkins"),
        ]);

        if (cancelled) return;

        const latestWeight = typeof latestWeightPayload.weight === "number" ? latestWeightPayload.weight : null;
        const todayEntry = (checkinsPayload.checkins || []).find((entry) => {
          if (!entry || entry.userId !== userId || !entry.date) return false;
          const entryKey = String(entry.date).slice(0, 10);
          return entryKey === todayKey;
        });

        const todayWeight = todayEntry && typeof todayEntry.weight === "number" ? todayEntry.weight : null;
        const todayNote = todayEntry?.comment ? String(todayEntry.comment) : "";

        setMobileQuickCheckinLatestWeight(latestWeight);
        setMobileQuickCheckinTodayWeight(todayWeight);
        setMobileQuickCheckinTodayNote(todayNote);
        setMobileQuickCheckinWeight(todayWeight != null ? String(todayWeight) : "");
        setMobileQuickCheckinNote(todayNote);
      } catch {
        if (!cancelled) {
          setMobileQuickCheckinLatestWeight(null);
          setMobileQuickCheckinTodayWeight(null);
          setMobileQuickCheckinTodayNote("");
          setMobileQuickCheckinWeight("");
          setMobileQuickCheckinNote("");
        }
      } finally {
        if (!cancelled) {
          setMobileQuickCheckinLoading(false);
        }
      }
    };

    void loadQuickCheckinDefaults();
    return () => {
      cancelled = true;
    };
  }, [getTodayDateKey, mobileQuickCheckinOpen, userId]);

  useEffect(() => {
    if (librarySheetRequested) {
      setMobileLogFabOpen(true);
    }
  }, [librarySheetRequested]);

  useEffect(() => {
    if (typeof window === "undefined" || !mobileDrawerSearchOpen) return;
    const frame = window.requestAnimationFrame(() => {
      mobileDrawerSearchInputRef.current?.focus();
      mobileDrawerSearchInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mobileDrawerSearchOpen]);

  useEffect(() => {
    if (mobileHistorySort !== "relevant") {
      mobileHistorySortPreferenceRef.current = mobileHistorySort;
    }
  }, [mobileHistorySort]);

  useEffect(() => {
    if (mobileLogFabSort !== "relevant") {
      mobileLogFabSortPreferenceRef.current = mobileLogFabSort;
    }
  }, [mobileLogFabSort]);

  useEffect(() => {
    const hasQuery = mobileSearchQuery.trim().length > 0;
    if (hasQuery) {
      if (mobileHistorySort !== "relevant") setMobileHistorySort("relevant");
    } else if (mobileHistorySort === "relevant") {
      setMobileHistorySort(mobileHistorySortPreferenceRef.current);
    }
  }, [mobileHistorySort, mobileSearchQuery]);

  useEffect(() => {
    const hasQuery = mobileLogFabSearchQuery.trim().length > 0;
    if (hasQuery) {
      if (mobileLogFabSort !== "relevant") setMobileLogFabSort("relevant");
    } else if (mobileLogFabSort === "relevant") {
      setMobileLogFabSort(mobileLogFabSortPreferenceRef.current);
    }
  }, [mobileLogFabSearchQuery, mobileLogFabSort]);

  useEffect(() => {
    const hasPrefill = Boolean(prefillExerciseId || prefillExerciseName || prefillProgression || prefillVariant);
    if (!hasPrefill) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("prefillExerciseId");
    params.delete("prefillExercise");
    params.delete("prefillProgression");
    params.delete("prefillVariant");

    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [pathname, prefillExerciseId, prefillExerciseName, prefillProgression, prefillVariant, router, searchParams]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const loadUsers = async () => {
      try {
        const data = await api.get<{ users: Array<{ id: string; name: string; username: string }> }>("/api/users/public?scope=community");
        if (!cancelled) {
          setVisibleUsers(Array.isArray(data.users) ? data.users : []);
        }
      } catch {
        if (!cancelled) {
          setVisibleUsers([]);
        }
      }
    };
    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setPhysique(DEFAULT_USER_PHYSIQUE);
      return;
    }
    setPhysique(loadUserPhysique(activeUserId || userId));
  }, [activeUserId, userId]);

  const fetchExercises = useCallback(async () => {
    if (!userId) return;
    try {
      const params = new URLSearchParams({ logLimit: "200", exerciseLimit: "5000" });
      if (targetUserId) params.set("targetUserId", targetUserId);
      const data = await api.get<{ exercises: ProgressionExercise[] }>(`/api/progressions/history?${params.toString()}`);
      setExercises(data.exercises || []);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, userId]);

  useEffect(() => {
    setLoading(true);
    void fetchExercises();
  }, [fetchExercises, themeStyle]);

  useEffect(() => {
    const handleProgressionUpdate = () => {
      setLoading(true);
      void fetchExercises();
    };

    window.addEventListener(PROGRESSION_EXERCISES_UPDATED_EVENT, handleProgressionUpdate);
    return () => {
      window.removeEventListener(PROGRESSION_EXERCISES_UPDATED_EVENT, handleProgressionUpdate);
    };
  }, [fetchExercises]);

  const orderedVisibleUsers = useMemo(() => {
    if (!userId) return visibleUsers;

    const selfEntry = {
      id: userId,
      name: lt("Me"),
      username: user?.username || "",
    };
    const others = visibleUsers.filter((u) => u.id !== userId);
    return [selfEntry, ...others];
  }, [user?.username, userId, visibleUsers]);

  const targetUserDisplayName = useMemo(() => {
    if (!targetUserId) return undefined;
    if (targetUserId === userId) return lt("Me");
    const target = orderedVisibleUsers.find((u) => u.id === targetUserId);
    if (!target) return undefined;
    return (target.name || target.username || "").trim() || undefined;
  }, [orderedVisibleUsers, targetUserId, userId]);

  const activeUserProfile = useMemo(() => {
    const fallbackName = user?.name || user?.username || lt("Me");
    const fallbackUsername = user?.username || "me";
    const selected = orderedVisibleUsers.find((u) => u.id === activeUserId)
      ?? (userId ? orderedVisibleUsers.find((u) => u.id === userId) : undefined);

    return {
      id: selected?.id || userId || "",
      name: selected?.name || fallbackName,
      username: selected?.username || fallbackUsername,
    };
  }, [activeUserId, orderedVisibleUsers, user?.name, user?.username, userId]);

  const trainPageTitle = targetUserDisplayName
    ? `${targetUserDisplayName} Train ${friendView === "history" ? "History" : friendView === "chart" ? "Chart" : "Check-in"}`
    : lt("Train");
  const subtitle = targetUserDisplayName
    ? `Review ${targetUserDisplayName}'s training logs and cultivation entries`
    : lt("Review your training logs and cultivation entries");
  const isFriendTrainOverlay = Boolean(targetUserId);
  const shouldShowWeightSwipeHint = !isFriendTrainOverlay && mobileQuickCheckinTodayWeight == null && !showWeightHintThankYou;
  const shouldShowWeightThankYou = !isFriendTrainOverlay && showWeightHintThankYou;
  const friendRailWidthPx = 64;
  const trainRailWidthPx = 64;

  const dayAssignmentSummary = useMemo(() => {
    const rowsByDay: TrainExerciseRow[][] = Array.from({ length: 7 }, () => []);
    const assignedCounts = [0, 0, 0, 0, 0, 0, 0];
    const remainingCounts = [0, 0, 0, 0, 0, 0, 0];
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const exercise of exercises) {
      const hasProgress = (exercise.userProgress?.length ?? 0) > 0;
      const hasDayAssignment = parseDayAssignments(exercise.assignedDays || "").length > 0;
      if (!hasProgress && !hasDayAssignment) continue;
      const deletedExercise = isDeletedExerciseDescription(exercise.story);
      const exerciseName = deletedExercise ? getDeletedExerciseLabel(exercise) : exercise.name;
      const category = (exercise.category || "Uncategorized").trim() || "Uncategorized";
      const logs = [...(exercise.userProgress?.[0]?.logs ?? [])].sort(compareLogRecency);
      const latestLog = logs[0] ?? null;
      const assignmentDetailsByDay = parseDayAssignmentDetailsList(exercise.assignedDays || "");

      for (const day of parseDayAssignments(exercise.assignedDays || "")) {
        if (day < 0 || day > 6) continue;

        const details = assignmentDetailsByDay[day];
        const normalizedDetails = details && details.length > 0 ? details : [undefined];
        const matchesAssignedSetup = (log: ProgressionLog, assignedLevel?: number, assignedVariant?: string) => {
          if (assignedLevel != null && log.level !== assignedLevel) return false;
          if (assignedVariant && (log.variant || "").trim().toLowerCase() !== assignedVariant.toLowerCase()) return false;
          return true;
        };

        // Track which recent logs (past 24 h) have already been claimed by a sibling row
        // so one log cannot tick multiple assigned setups.
        const recentLogs = logs.filter((log) => {
          const ts = new Date(log.createdAt).getTime();
          return Number.isFinite(ts) && now - ts <= dayMs;
        });
        const remainingRecentLogs = [...recentLogs];

        const allocatedRecentLogByIndex = new Map<number, ProgressionLog>();
        const candidateOrder = normalizedDetails
          .map((detail, index) => {
            const assignedTier = detail?.progression
              ? exercise.tiers.find((tier) => String(tier.level) === detail.progression || tier.name === detail.progression)
              : undefined;
            const assignedVariant = detail?.variant?.trim() || undefined;

            return {
              index,
              assignedLevel: assignedTier?.level,
              assignedVariant,
              specificity: (assignedVariant ? 2 : 0) + (assignedTier?.level != null ? 1 : 0),
            };
          })
          .sort((left, right) => {
            if (right.specificity !== left.specificity) return right.specificity - left.specificity;
            return left.index - right.index;
          });

        for (const candidate of candidateOrder) {
          const matchIndex = remainingRecentLogs.findIndex((log) =>
            matchesAssignedSetup(log, candidate.assignedLevel, candidate.assignedVariant),
          );
          if (matchIndex === -1) continue;
          const [matchedLog] = remainingRecentLogs.splice(matchIndex, 1);
          if (matchedLog) {
            allocatedRecentLogByIndex.set(candidate.index, matchedLog);
          }
        }

        normalizedDetails.forEach((detail, index) => {
          const assignedTier = detail?.progression
            ? exercise.tiers.find((tier) => String(tier.level) === detail.progression || tier.name === detail.progression)
            : undefined;
          const assignedProgression = assignedTier?.name || detail?.progression;
          const assignedLevel = assignedTier?.level;
          const assignedVariant = detail?.variant?.trim() || undefined;

          const matchingLogs = logs.filter((log) => matchesAssignedSetup(log, assignedLevel, assignedVariant));
          const latestMatchingLog = matchingLogs[0] ?? null;
          const doneLog = allocatedRecentLogByIndex.get(index) ?? null;
          const referenceLog = latestMatchingLog ?? latestLog;
          const progression = assignedProgression
            || (referenceLog ? exercise.tiers.find((tier) => tier.level === referenceLog.level)?.name : undefined)
            || `Progression ${exercise.userProgress?.[0]?.currentLevel ?? exercise.tiers[0]?.level ?? 1}`;
          const variant = assignedVariant || latestMatchingLog?.variant?.trim() || "";
          const recent24hCount = matchingLogs.reduce((count, log) => {
            const ts = new Date(log.createdAt).getTime();
            return Number.isFinite(ts) && now - ts <= dayMs ? count + 1 : count;
          }, 0);

          const row: TrainExerciseRow = {
            rowKey: `${exercise.id}:${day}:${assignedProgression || "base"}:${assignedVariant || "base"}:${index}`,
            exerciseId: exercise.id,
            exerciseName,
            date: referenceLog?.createdAt ?? null,
            logId: referenceLog?.id ?? null,
            progression,
            variant,
            category,
            isDeleted: deletedExercise,
            recent24hCount,
            assignedDays: exercise.assignedDays || "",
            assignedProgression,
            assignedVariant,
            assignedLevel,
            showAssignedContext: true,
            isCompleted: Boolean(doneLog),
            completionDate: doneLog?.createdAt ?? null,
          };

          rowsByDay[day].push(row);
          assignedCounts[day] += 1;
          if (!doneLog) {
            remainingCounts[day] += 1;
          }
        });
      }
    }

    for (const rows of rowsByDay) {
      rows.sort((left, right) => {
        if (Boolean(left.isCompleted) !== Boolean(right.isCompleted)) {
          return left.isCompleted ? 1 : -1;
        }

        const leftTime = new Date(left.completionDate || left.date || 0).getTime();
        const rightTime = new Date(right.completionDate || right.date || 0).getTime();
        if (rightTime !== leftTime) return rightTime - leftTime;

        const nameCompare = left.exerciseName.localeCompare(right.exerciseName);
        if (nameCompare !== 0) return nameCompare;

        return left.rowKey.localeCompare(right.rowKey);
      });
    }

    return { rowsByDay, assignedCounts, remainingCounts };
  }, [exercises]);

  const handleUpdateDayAssignments = useCallback(async (exerciseId: string, assignedDays: string) => {
    const response = await api.patch<{ exercise?: ProgressionExercise }>(`/api/progressions/${exerciseId}`, { assignedDays });
    const returnedExercise = response.exercise;

    setExercises((prev) => {
      const index = prev.findIndex((exercise) => exercise.id === exerciseId);
      if (index === -1) return prev;

      const next = [...prev];

      if (!returnedExercise) {
        next[index] = { ...next[index], assignedDays };
        return next;
      }

      const duplicateIndex = next.findIndex((exercise) => exercise.id === returnedExercise.id);
      if (duplicateIndex !== -1 && duplicateIndex !== index) {
        next.splice(duplicateIndex, 1);
      }

      next[index] = returnedExercise;
      return next;
    });
  }, []);

  const handleUserScopeChange = (nextUserId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!nextUserId || nextUserId === userId) {
      params.delete("targetUserId");
    } else {
      params.set("targetUserId", nextUserId);
      params.set("friendView", "history");
    }
    const current = searchParams.toString();
    const next = params.toString();
    if (next === current) return;
    router.push(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  const handleOpenTrainOverview = useCallback(() => {
    setLibrarySheetOpen(false);
    setTrainRailOverviewOpen(true);
    setTrainDayDrawerOpen(false);
    setTrainDayFilter(null);
    setExerciseManagementOpen(false);
  }, [setLibrarySheetOpen]);

  const handleSelectTrainDay = useCallback((dayIndex: number | null) => {
    setTrainDayFilter(dayIndex);
    setTrainRailOverviewOpen(false);
    setTrainDayDrawerOpen(dayIndex != null);
    setExerciseManagementOpen(false);
  }, []);

  const mobileExerciseRows = useMemo(() => {
    const rows: TrainExerciseRow[] = [];

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (const exercise of exercises) {
      const logs = exercise.userProgress?.[0]?.logs ?? [];
      if (logs.length === 0) continue;

      const latestLog = [...logs].sort(compareLogRecency)[0];
      const tierName = exercise.tiers.find((tier) => tier.level === latestLog.level)?.name ?? `Progression ${latestLog.level}`;

      const deletedExercise = isDeletedExerciseDescription(exercise.story);

      const recent24hCount = logs.reduce((count, log) => {
        const ts = new Date(log.createdAt).getTime();
        return Number.isFinite(ts) && now - ts <= dayMs ? count + 1 : count;
      }, 0);

      rows.push({
        rowKey: `history-${exercise.id}`,
        exerciseId: exercise.id,
        exerciseName: deletedExercise ? getDeletedExerciseLabel(exercise) : exercise.name,
        date: latestLog.createdAt,
        logId: latestLog.id,
        progression: tierName,
        variant: latestLog.variant?.trim() || "",
        category: (exercise.category || "Uncategorized").trim() || "Uncategorized",
        isDeleted: deletedExercise,
        recent24hCount,
        assignedDays: exercise.assignedDays || "",
      });
    }

    rows.sort((a, b) => {
      const timeDiff = new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
      if (timeDiff !== 0) return timeDiff;
      return (b.logId || "").localeCompare(a.logId || "");
    });
    return rows;
  }, [exercises]);

  const mobileHistoryCategoryOptions = useMemo(() => {
    const categories = Array.from(new Set(mobileExerciseRows.map((row) => row.category).filter(Boolean)));
    categories.sort((a, b) => a.localeCompare(b));
    return ["all", ...categories];
  }, [mobileExerciseRows]);

  const filteredMobileExerciseRows = useMemo(() => {
    const query = mobileSearchQuery.trim().toLowerCase();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const filtered = mobileExerciseRows.filter((row) => {
      const matchesQuery = !query || `${row.exerciseName} ${row.progression} ${row.variant} ${row.category}`.toLowerCase().includes(query);
      const matchesCategory = mobileHistoryCategory === "all" || row.category === mobileHistoryCategory;
      const rowTimestamp = row.date ? new Date(row.date).getTime() : Number.NEGATIVE_INFINITY;

      let matchesRecency = true;
      if (mobileHistoryRecency === "7d") {
        matchesRecency = Number.isFinite(rowTimestamp) && now - rowTimestamp <= 7 * dayMs;
      } else if (mobileHistoryRecency === "30d") {
        matchesRecency = Number.isFinite(rowTimestamp) && now - rowTimestamp <= 30 * dayMs;
      }

      return matchesQuery && matchesCategory && matchesRecency;
    });

    if (mobileHistorySort === "relevant" && query) {
      return rankExerciseSearchResults(
        filtered.map((row) => ({
          ...row,
          exerciseId: row.exerciseId,
          displayLabel: row.exerciseName,
          canonicalName: row.exerciseName,
          searchLabel: `${row.exerciseName} ${row.progression} ${row.variant} ${row.category}`,
          hasHistory: true,
          lastLoggedAt: row.date,
          matchSource: "name" as const,
        })),
        query,
      );
    }

    const sorted = [...filtered];
    if (mobileHistorySort === "oldest") {
      sorted.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
    } else if (mobileHistorySort === "name-az") {
      sorted.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
    } else {
      sorted.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    }

    return sorted;
  }, [mobileExerciseRows, mobileHistoryCategory, mobileHistoryRecency, mobileHistorySort, mobileSearchQuery]);

  const mobileLogFabRows = useMemo(() => {
    const rows: Array<{
      exerciseId: string;
      exerciseName: string;
      date: string | null;
      logId: string | null;
      progression: string;
      variant: string;
      category: string;
      isDeleted: boolean;
      recent24hCount: number;
    }> = [];

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (const exercise of exercises) {
      const logs = exercise.userProgress?.[0]?.logs ?? [];
      const latestLog = logs.length > 0
        ? [...logs].sort(compareLogRecency)[0]
        : null;

      const progressionLevel = latestLog?.level ?? exercise.userProgress?.[0]?.currentLevel ?? exercise.tiers[0]?.level ?? 1;
      const progressionName = exercise.tiers.find((tier) => tier.level === progressionLevel)?.name ?? `Progression ${progressionLevel}`;
      const deletedExercise = isDeletedExerciseDescription(exercise.story);

      const recent24hCount = logs.reduce((count, log) => {
        const ts = new Date(log.createdAt).getTime();
        return Number.isFinite(ts) && now - ts <= dayMs ? count + 1 : count;
      }, 0);

      rows.push({
        exerciseId: exercise.id,
        exerciseName: deletedExercise ? getDeletedExerciseLabel(exercise) : exercise.name,
        date: latestLog?.createdAt ?? null,
        logId: latestLog?.id ?? null,
        progression: progressionName,
        variant: latestLog?.variant?.trim() || "",
        category: (exercise.category || "Uncategorized").trim() || "Uncategorized",
        isDeleted: deletedExercise,
        recent24hCount,
      });
    }

    return rows;
  }, [exercises]);

  const mobileFabCategoryOptions = useMemo(() => {
    const categories = Array.from(new Set(mobileLogFabRows.map((row) => row.category).filter(Boolean)));
    categories.sort((a, b) => a.localeCompare(b));
    return ["all", ...categories];
  }, [mobileLogFabRows]);

  const filteredMobileLogFabRows = useMemo(() => {
    const query = mobileLogFabSearchQuery.trim().toLowerCase();
    const filtered = mobileLogFabRows.filter((row) => {
      const matchesCategory = mobileLogFabCategory === "all" || row.category === mobileLogFabCategory;
      if (!matchesCategory) return false;
      if (!query) return true;
      const haystack = `${row.exerciseName} ${row.progression} ${row.variant} ${row.category}`.toLowerCase();
      return haystack.includes(query);
    });

    if (mobileLogFabSort === "relevant" && query) {
      return rankExerciseSearchResults(
        filtered.map((row) => ({
          ...row,
          exerciseId: row.exerciseId,
          displayLabel: row.exerciseName,
          canonicalName: row.exerciseName,
          searchLabel: `${row.exerciseName} ${row.progression} ${row.variant} ${row.category}`,
          hasHistory: Boolean(row.date),
          lastLoggedAt: row.date,
          matchSource: "name" as const,
        })),
        query,
      );
    }

    const sorted = [...filtered];
    if (mobileLogFabSort === "oldest") {
      sorted.sort((a, b) => {
        const left = a.date ? new Date(a.date).getTime() : Number.POSITIVE_INFINITY;
        const right = b.date ? new Date(b.date).getTime() : Number.POSITIVE_INFINITY;
        if (left === right) return a.exerciseName.localeCompare(b.exerciseName);
        return left - right;
      });
    } else if (mobileLogFabSort === "name-az") {
      sorted.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
    } else {
      sorted.sort((a, b) => {
        const left = a.date ? new Date(a.date).getTime() : Number.NEGATIVE_INFINITY;
        const right = b.date ? new Date(b.date).getTime() : Number.NEGATIVE_INFINITY;
        if (left === right) {
          const idCompare = (b.logId ?? "").localeCompare(a.logId ?? "");
          if (idCompare !== 0) return idCompare;
          return a.exerciseName.localeCompare(b.exerciseName);
        }
        return right - left;
      });
    }
    return sorted;
  }, [mobileLogFabRows, mobileLogFabCategory, mobileLogFabSearchQuery, mobileLogFabSort]);

  const dayExerciseCounts = dayAssignmentSummary.remainingCounts;
  const dayAssignmentCounts = dayAssignmentSummary.assignedCounts;

  const selectedDayExerciseRows = useMemo(() => {
    if (trainDayFilter == null) return [];
    return dayAssignmentSummary.rowsByDay[trainDayFilter] || [];
  }, [dayAssignmentSummary.rowsByDay, trainDayFilter]);

  const selectedMobileExercise = useMemo(() => {
    if (!mobileExerciseDrawerExerciseId) return null;
    return exercises.find((exercise) => exercise.id === mobileExerciseDrawerExerciseId) ?? null;
  }, [exercises, mobileExerciseDrawerExerciseId]);

  const selectedMobileExerciseLogs = useMemo(() => {
    if (!selectedMobileExercise) return [];
    const logs = selectedMobileExercise.userProgress?.[0]?.logs ?? [];
    return [...logs].sort(compareLogRecency);
  }, [selectedMobileExercise]);

  const mobileDrawerLevelOptions = useMemo(() => {
    return Array.from(
      new Set(
        selectedMobileExerciseLogs.map((log) => selectedMobileExercise?.tiers.find((tier) => tier.level === log.level)?.name ?? `Progression ${log.level}`),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [selectedMobileExercise, selectedMobileExerciseLogs]);

  const mobileDrawerVariantOptions = useMemo(() => {
    return Array.from(new Set(selectedMobileExerciseLogs.map((log) => log.variant?.trim() || "-"))).sort((a, b) => a.localeCompare(b));
  }, [selectedMobileExerciseLogs]);

  const filteredSelectedMobileExerciseLogs = useMemo(() => {
    const query = mobileDrawerSearchQuery.trim().toLowerCase();
    const filtered = selectedMobileExerciseLogs.filter((log) => {
      const progressionName = selectedMobileExercise?.tiers.find((tier) => tier.level === log.level)?.name ?? `Progression ${log.level}`;
      const variationValue = log.variant?.trim() || "-";
      const metricRows = getWorkoutMetricRows(log, weightUnit, timedUnit);
      const hasWeightedValue = metricRows.some((row) => row.weight !== "-" && !row.weight.endsWith("s"));
      const reps = metricRows
        .map((row) => Number.parseInt(row.reps, 10))
        .filter((value): value is number => Number.isFinite(value) && value > 0);
      const maxReps = reps.length > 0 ? Math.max(...reps) : null;

      const matchesQuery = !query || `${progressionName} ${variationValue} ${log.modifier || ""} ${log.notes || ""}`.toLowerCase().includes(query);
      const matchesProgression = mobileDrawerLevelFilter === "all" || progressionName === mobileDrawerLevelFilter;
      const matchesVariant = mobileDrawerVariantFilter === "all" || variationValue === mobileDrawerVariantFilter;
      const matchesWeight = mobileDrawerWeightFilter === "all"
        || (mobileDrawerWeightFilter === "weighted" && hasWeightedValue)
        || (mobileDrawerWeightFilter === "bodyweight" && !hasWeightedValue);
      const matchesReps = mobileDrawerRepsFilter === "all"
        || (mobileDrawerRepsFilter === "1-5" && maxReps != null && maxReps >= 1 && maxReps <= 5)
        || (mobileDrawerRepsFilter === "6-10" && maxReps != null && maxReps >= 6 && maxReps <= 10)
        || (mobileDrawerRepsFilter === "11+" && maxReps != null && maxReps >= 11);

      return matchesQuery && matchesProgression && matchesVariant && matchesWeight && matchesReps;
    });

    const sorted = [...filtered];
    if (mobileDrawerSort === "oldest") {
      sorted.sort((a, b) => compareLogRecency(b, a));
    } else if (mobileDrawerSort === "progression-asc") {
      sorted.sort((a, b) => a.level - b.level || compareLogRecency(a, b));
    } else if (mobileDrawerSort === "progression-desc") {
      sorted.sort((a, b) => b.level - a.level || compareLogRecency(a, b));
    } else {
      sorted.sort(compareLogRecency);
    }

    return sorted;
  }, [mobileDrawerLevelFilter, mobileDrawerRepsFilter, mobileDrawerSearchQuery, mobileDrawerSort, mobileDrawerVariantFilter, mobileDrawerWeightFilter, selectedMobileExercise, selectedMobileExerciseLogs, weightUnit]);

  useEffect(() => {
    setMobileDrawerSearchOpen(false);
    setMobileDrawerSearchQuery("");
    setMobileDrawerFilterOpen(false);
    setMobileDrawerLevelFilter("all");
    setMobileDrawerVariantFilter("all");
    setMobileDrawerWeightFilter("all");
    setMobileDrawerRepsFilter("all");
    setMobileDrawerSort("recent");
  }, [mobileExerciseDrawerExerciseId]);

  useEffect(() => {
    if (!mobileExerciseDrawerExerciseId) {
      setMobileDrawerAnimReady(false);
    }
  }, [mobileExerciseDrawerExerciseId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isOpen = Boolean(mobileExerciseDrawerExerciseId || mobileLogFabOpen);
    window.dispatchEvent(new CustomEvent("train-exercise-history-visibility", { detail: { open: isOpen } }));

    return () => {
      window.dispatchEvent(new CustomEvent("train-exercise-history-visibility", { detail: { open: false } }));
    };
  }, [mobileExerciseDrawerExerciseId, mobileLogFabOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onTrainReset = () => {
      setMobileExerciseDrawerExerciseId(null);
      setMobileLogFabOpen(false);
      setMobileSearchQuery("");
      setMobileHistoryFilterOpen(false);
      setMobileHistoryCategory("all");
      setMobileHistorySort("recent");
      setMobileHistoryRecency("all");
      setMobileDrawerSearchOpen(false);
      setMobileDrawerSearchQuery("");
      setMobileDrawerFilterOpen(false);
      setMobileDrawerLevelFilter("all");
      setMobileDrawerVariantFilter("all");
      setMobileDrawerWeightFilter("all");
      setMobileDrawerRepsFilter("all");
      setMobileDrawerSort("recent");
      setMobileLogFabSearchQuery("");
      setMobileLogFabCategory("all");
      setMobileLogFabSort("recent");
      setTrainDayDrawerOpen(false);
      setTrainDayFilter(null);
      setTrainRailOverviewOpen(false);
      setExerciseManagementOpen(false);

    };

    window.addEventListener("train-reset-view", onTrainReset);
    return () => {
      window.removeEventListener("train-reset-view", onTrainReset);
    };
  }, []);

  useEffect(() => {
    if (isFriendTrainOverlay) {
      setTrainRailOverviewOpen(false);
      setExerciseManagementOpen(false);
      setTrainDayFilter(null);
      setTrainDayDrawerOpen(false);
    }
  }, [isFriendTrainOverlay]);

  return (
    <>
      <PageLayout
        title={trainPageTitle}
        subtitle={isFriendTrainOverlay ? undefined : subtitle}
        mobileContentPaddingClass={isFriendTrainOverlay ? "p-0 pb-0" : "p-0 pt-4 pb-0"}
        mobileScrollContainerEnabled={false}
      >
      <div
        className="nyaa-history-page flex min-h-0 min-w-0 flex-1 flex-col px-0"
        style={{ maxWidth: "none", margin: 0, width: "100%" }}
      >
        {loading ? (
          <GlowCard glow="jade" hoverable={false}>
            <p className="text-sm text-mist-dark text-center py-4">{lt("Loading history...")}</p>
          </GlowCard>
        ) : (
          <>
            <div className="flex flex-1 min-h-0">
              {!isFriendTrainOverlay && (
                <div className="flex shrink-0">
                  <TrainDayRail
                    selectedDayFilter={trainDayFilter}
                    dayExerciseCounts={dayExerciseCounts}
                    dayAssignmentCounts={dayAssignmentCounts}
                    hideEmptyDays={hideEmptyTrainDays}
                    highContrastMonochrome={themeStyle === "ying-yang"}
                    calendarWeekStart={settings.calendarWeekStart}
                    timeZone={settings.timeZone}
                    overviewOpen={trainRailOverviewOpen}
                    onOpenOverview={handleOpenTrainOverview}
                    onSelectDay={handleSelectTrainDay}
                  />
                </div>
              )}
            <motion.section
                  key={isFriendTrainOverlay ? `friend-train-${targetUserId}` : "self-train"}
                  initial={isFriendTrainOverlay ? { x: "100%" } : false}
                  animate={isFriendTrainOverlay ? { x: "0%" } : { x: 0 }}
                  transition={isFriendTrainOverlay ? { duration: 0.24, ease: [0.22, 1, 0.36, 1] } : undefined}
                  className={isFriendTrainOverlay ? "fixed inset-y-0 right-0 z-[71] border-l overflow-hidden safe-area-top safe-area-bottom safe-area-right" : "flex min-w-0 flex-1 min-h-0 flex-col"}
                  style={isFriendTrainOverlay ? { left: `${friendRailWidthPx}px`, borderLeftColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)", backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))", minHeight: "100dvh" } : undefined}
                >
                  <div
                    className={`border overflow-hidden flex min-h-0 flex-1 flex-col ${isFriendTrainOverlay ? "rounded-none h-full" : "rounded-tl-2xl"}`}
                    style={{
                      borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 20%, var(--ink-deep))",
                    }}
                  >
                    <div
                      data-mobile-scroll-container={isFriendTrainOverlay ? "true" : undefined}
                      className={`${isFriendTrainOverlay ? "h-[100dvh] safe-area-top safe-area-bottom overflow-y-auto scrollbar-hide" : "flex min-h-0 flex-1 flex-col overflow-hidden"}`}
                      style={isFriendTrainOverlay ? { WebkitOverflowScrolling: "touch", overscrollBehaviorY: "auto", touchAction: "pan-y" } : undefined}
                    >
                      <div className={`sticky top-0 z-20 shrink-0 ${isFriendTrainOverlay ? "safe-area-top" : ""}`} style={{ backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))" }}>
                        <div
                          className="px-3 py-2.5"
                          style={{
                            backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))",
                          }}
                        >
                          <div className="flex items-center gap-2">
                            {isFriendTrainOverlay ? (
                              <button
                                type="button"
                                onClick={() => handleUserScopeChange(userId)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md"
                                style={{
                                  color: "var(--mist-light)",
                                  backgroundColor: "transparent",
                                }}
                                aria-label={lt("Back to my train history")}
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                              </button>
                            ) : null}
                            <div>
                              <p className="text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>{lt("Training")}</p>
                              <h2 className="mt-0.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
                                {trainPageTitle}
                              </h2>
                            </div>
                          </div>

                          {friendView === "history" && (
                            <>
                              <div className="mt-2 flex items-center gap-2">
                                <SearchField
                                  value={mobileSearchQuery}
                                  onChange={setMobileSearchQuery}
                                  placeholder={lt("Search exercises")}
                                  aria-label={lt("Search exercises")}
                                  wrapperClassName="min-w-0 flex-1"
                                  className="h-8 min-w-0 text-sm"
                                  style={{
                                    borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                                    backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                                    color: "var(--cloud-white)",
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => setMobileHistoryFilterOpen(true)}
                                  className="theme-control-btn relative inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors"
                                  aria-label={lt("Open filters")}
                                >
                                  <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M6 12h12m-9 7h6" />
                                  </svg>
                                  {(mobileHistoryCategory !== "all" || mobileHistorySort !== "recent" || mobileHistoryRecency !== "all") ? (
                                    <span className="absolute right-0.5 top-1 h-2 w-2 rounded-full" style={{ backgroundColor: "var(--accent)" }} />
                                  ) : null}
                                </button>
                              </div>


                            </>
                          )}
                        </div>
                        <div className="h-px" style={{ backgroundColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)" }} />
                      </div>

                      {friendView === "history" ? (
                      <div
                        data-mobile-scroll-container="true"
                        className={isFriendTrainOverlay ? "flex-1 pb-[calc(var(--mobile-nav-offset)+0.5rem)]" : "min-h-0 flex-1 overflow-y-auto scrollbar-hide pb-[calc(var(--mobile-nav-offset)+0.75rem)]"}
                        style={isFriendTrainOverlay ? undefined : { WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain", touchAction: "pan-y" }}
                      >
                        {filteredMobileExerciseRows.length === 0 ? (
                          <div
                            className="px-3 py-4 text-center text-xs"
                            style={{
                              color: "var(--text-muted)",
                            }}
                          >
                            {lt("No exercises match your search.")}
                          </div>
                        ) : (
                          filteredMobileExerciseRows.map((row) => {
                            const isPreviouslySelected = row.exerciseId === mobileLastSelectedExerciseId;
                            return (
                            <TrainExerciseListRow
                              key={`mobile-train-row-${row.exerciseId}`}
                              row={row}
                              isSelected={isPreviouslySelected}
                              dateFormat={settings.dateFormat || "dd-mmm-yyyy"}
                              timeZone={settings.timeZone}
                              onActivate={(selectedRow) => {
                                setMobileLastSelectedExerciseId(selectedRow.exerciseId);
                                setMobileExerciseDrawerExerciseId(selectedRow.exerciseId);
                              }}
                            />
                            );
                          })
                        )}
                      </div>
                      ) : (
                        <div className="px-3 py-5">
                          <div className="rounded-2xl border border-[var(--border)] bg-[var(--void-black)] p-4">
                            <p className="text-sm font-semibold text-[var(--text-primary)]">
                              {friendView === "chart" ? lt("Chart") : lt("Check-in")} {lt("coming soon")}
                            </p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                              {lt("UI placeholder ready. Functionality will be added in the next step.")}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
              </motion.section>
            </div>
          </>
        )}
      </div>
      </PageLayout>

      <AnimatePresence>
        {!isFriendTrainOverlay && trainRailOverviewOpen ? (
          <>
            <motion.div
              key="train-day-rail-overview-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-y-0 right-0 z-[180]"
              style={{
                left: `${trainRailWidthPx}px`,
                backgroundColor: "color-mix(in srgb, var(--void-black) 76%, transparent)",
              }}
              onClick={() => setTrainRailOverviewOpen(false)}
            />

            <motion.aside
              key="train-day-rail-overview-panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 right-0 z-[181] overflow-hidden border-l safe-area-top safe-area-bottom safe-area-right"
              style={{
                left: `${trainRailWidthPx}px`,
                borderLeftColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
              }}
            >
              <div className="h-full overflow-hidden">
                <div
                  data-mobile-scroll-container="true"
                  className="h-full overflow-y-auto scrollbar-hide"
                  style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain" }}
                >
                  <div className="sticky top-0 z-20" style={{ backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))" }}>
                    <div className="px-3 pt-[calc(env(safe-area-inset-top,0px)+10px)] pb-2.5" style={{ backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))" }}>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setTrainRailOverviewOpen(false)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md"
                          style={{ color: "var(--mist-light)", backgroundColor: "transparent" }}
                          aria-label={lt("Close day overview")}
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <h2 className="truncate text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--mist-light)" }}>
                          {lt("Manage Training Days")}
                        </h2>
                      </div>
                    </div>
                    <div className="h-px" style={{ backgroundColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)" }} />
                  </div>

                  <div>
                    <article
                      className="mx-1 my-0.5 rounded-md px-3 py-2.5"
                      style={{ cursor: "pointer" }}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setExerciseManagementOpen(true);
                        setTrainRailOverviewOpen(false);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setExerciseManagementOpen(true);
                          setTrainRailOverviewOpen(false);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
                          {lt("Manage day allocations")}
                        </p>
                      </div>
                      <p className="mt-0.5 text-[11px] italic" style={{ color: "var(--text-muted)" }}>
                        {lt("Assign exercises to specific training days.")}
                      </p>
                    </article>

                    <article className="mx-1 my-0.5 rounded-md px-3 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
                            {lt("Show empty days")}
                          </p>
                          <p className="mt-0.5 text-[11px] italic" style={{ color: "var(--text-muted)" }}>
                            {lt("Toggle on to show days without assigned exercises in the day rail.")}
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={!hideEmptyTrainDays}
                          aria-label={lt("Toggle empty day visibility")}
                          onClick={() => setHideEmptyTrainDays((prev) => !prev)}
                          className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors"
                          style={{
                            borderColor: !hideEmptyTrainDays
                              ? "color-mix(in srgb, var(--accent) 62%, transparent)"
                              : "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                            backgroundColor: !hideEmptyTrainDays
                              ? "color-mix(in srgb, var(--accent) 26%, var(--ink-deep))"
                              : "color-mix(in srgb, var(--ink-mid) 86%, var(--ink-deep))",
                          }}
                        >
                          <span
                            className="absolute h-4 w-4 rounded-full transition-transform"
                            style={{
                              transform: !hideEmptyTrainDays ? "translateX(21px)" : "translateX(3px)",
                              backgroundColor: !hideEmptyTrainDays ? "var(--accent)" : "var(--mist-mid)",
                            }}
                          />
                        </button>
                      </div>
                    </article>
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {!isFriendTrainOverlay && trainDayDrawerOpen && trainDayFilter != null ? (
          <>
            <motion.div
              key="train-day-drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-y-0 right-0 z-[190]"
              style={{
                left: `${trainRailWidthPx}px`,
                backgroundColor: "color-mix(in srgb, var(--void-black) 76%, transparent)",
              }}
              onClick={() => {
                setTrainDayDrawerOpen(false);
                setTrainDayFilter(null);
              }}
            />

            <motion.aside
              key="train-day-drawer-panel"
              initial={{ x: "100%" }}
              animate={{ x: "0%" }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 right-0 z-[191] overflow-hidden safe-area-top safe-area-bottom safe-area-right"
              style={{
                left: `${trainRailWidthPx}px`,
                backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
              }}
            >
              <div
                className="h-full overflow-hidden"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--ink-mid) 20%, var(--ink-deep))",
                }}
              >
                <div
                  data-mobile-scroll-container="true"
                  className="h-full overflow-y-auto scrollbar-hide pb-[calc(var(--mobile-nav-offset)+max(env(safe-area-inset-bottom,0px),12px))]"
                  style={{ overscrollBehavior: "contain" }}
                >
                  <div className="sticky top-0 z-20" style={{ backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))" }}>
                    <div className="px-3 pt-[calc(env(safe-area-inset-top,0px)+10px)] pb-2.5" style={{ backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))" }}>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setTrainDayDrawerOpen(false);
                            setTrainDayFilter(null);
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md"
                          style={{ color: "var(--mist-light)", backgroundColor: "transparent" }}
                          aria-label={lt("Close day exercises")}
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <h2 className="truncate text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--mist-light)" }}>
                          {`${DAYS_OF_WEEK[trainDayFilter]} Exercises`}
                        </h2>
                      </div>
                    </div>
                    <div className="h-px" style={{ backgroundColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)" }} />
                  </div>

                  {selectedDayExerciseRows.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                      {`${lt("No exercises assigned to")} ${DAYS_OF_WEEK[trainDayFilter]}.`}
                    </div>
                  ) : (
                    selectedDayExerciseRows.map((row) => {
                      const isPreviouslySelected = row.rowKey === dayDrawerLastSelectedRowKey;
                      return (
                        <TrainExerciseListRow
                          key={`day-drawer-row-${row.rowKey}`}
                          row={row}
                          isSelected={isPreviouslySelected}
                          dateFormat={settings.dateFormat || "dd-mmm-yyyy"}
                          timeZone={settings.timeZone}
                          onActivate={(selectedRow) => {
                            const progressionParam = selectedRow.assignedLevel != null
                              ? String(selectedRow.assignedLevel)
                              : (selectedRow.assignedProgression || selectedRow.progression);
                            const variant = selectedRow.assignedVariant || selectedRow.variant || "";
                            const pathId = `${selectedRow.exerciseId}-quick`;
                            const href = `/dashboard/train/input/${encodeURIComponent(pathId)}?prefillExerciseId=${encodeURIComponent(selectedRow.exerciseId)}&prefillExercise=${encodeURIComponent(selectedRow.exerciseName)}&prefillProgression=${encodeURIComponent(progressionParam)}&prefillVariant=${encodeURIComponent(variant)}&assignedDay=${encodeURIComponent(trainDayFilter ?? "")}`;
                            setDayDrawerLastSelectedRowKey(selectedRow.rowKey);
                            setTrainDayDrawerOpen(false);
                            router.push(href);
                          }}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <ExerciseManagementDrawer
        isOpen={!isFriendTrainOverlay && exerciseManagementOpen}
        onClose={() => setExerciseManagementOpen(false)}
        exercises={exercises}
        onUpdateDayAssignments={handleUpdateDayAssignments}
        selectedDayFilter={trainDayFilter}
      />

      <AnimatePresence>
        {friendView === "history" && mobileHistoryFilterOpen ? (
          <>
            <motion.div
              key="mobile-history-filter-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-0 z-[250]"
              style={{ backgroundColor: "color-mix(in srgb, var(--void-black) 74%, transparent)" }}
              onClick={() => setMobileHistoryFilterOpen(false)}
            />
            <motion.aside
              key="mobile-history-filter-drawer"
              initial={{ x: "100%", opacity: 0.98 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 right-0 z-[260] flex h-[100dvh] max-h-[100dvh] w-[min(22rem,92vw)] flex-col overflow-hidden border-l shadow-2xl safe-area-top safe-area-bottom safe-area-right sm:my-3 sm:mr-3 sm:h-[calc(100dvh-1.5rem)] sm:max-h-[52rem] sm:rounded-2xl sm:border"
              style={{
                borderColor: "color-mix(in srgb, var(--accent) 18%, var(--ink-light))",
                background: "linear-gradient(180deg, color-mix(in srgb, var(--ink-dark) 98%, transparent) 0%, color-mix(in srgb, var(--ink-mid) 92%, transparent) 100%)",
                boxShadow: "0 18px 56px rgba(0, 0, 0, 0.45)",
              }}
            >
              <div className="shrink-0 border-b px-4 pb-3 pt-[max(env(safe-area-inset-top,0px),1rem)]" style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 55%, transparent)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">{lt("Filters")}</p>
                    <h2 className="mt-1 text-base font-semibold text-[var(--text-primary)]">{lt("Train History")}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileHistoryFilterOpen(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-[var(--mist-mid)] transition hover:text-[var(--text-primary)]"
                    style={{
                      borderColor: "color-mix(in srgb, var(--ink-light) 55%, transparent)",
                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 88%, var(--ink-deep))",
                    }}
                    aria-label={lt("Close exercise filters")}
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" style={{ WebkitOverflowScrolling: "touch" }}>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{lt("Category")}</label>
                    <select
                      value={mobileHistoryCategory}
                      onChange={(event) => setMobileHistoryCategory(event.target.value)}
                      className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                      style={{
                        borderColor: "var(--border)",
                        backgroundColor: "var(--void-black)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {mobileHistoryCategoryOptions.map((category) => (
                        <option key={`history-category-${category}`} value={category}>
                          {category === "all" ? lt("All categories") : category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{lt("Sort by")}</label>
                    <select
                      value={mobileHistorySort}
                      onChange={(event) => setMobileHistorySort(event.target.value as "recent" | "oldest" | "name-az" | "relevant")}
                      className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                      style={{
                        borderColor: "var(--border)",
                        backgroundColor: "var(--void-black)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <option value="relevant">{lt("Relevant")}</option>
                      <option value="recent">{lt("Recent first")}</option>
                      <option value="oldest">{lt("Oldest first")}</option>
                      <option value="name-az">{lt("Name A-Z")}</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{lt("Updated")}</label>
                    <select
                      value={mobileHistoryRecency}
                      onChange={(event) => setMobileHistoryRecency(event.target.value as "all" | "7d" | "30d")}
                      className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                      style={{
                        borderColor: "var(--border)",
                        backgroundColor: "var(--void-black)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <option value="all">{lt("All time")}</option>
                      <option value="7d">{lt("Last 7 days")}</option>
                      <option value="30d">{lt("Last 30 days")}</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileHistoryCategory("all");
                        setMobileHistorySort("recent");
                        setMobileHistoryRecency("all");
                      }}
                      className="h-11 rounded-xl border px-3 text-sm font-medium text-[var(--text-primary)] transition-colors"
                      style={{ borderColor: "var(--border)", backgroundColor: "var(--void-black)" }}
                    >
                      {lt("Reset")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileHistoryFilterOpen(false)}
                      className="h-11 rounded-xl border px-3 text-sm font-semibold text-[var(--void-black)] transition-colors"
                      style={{ borderColor: "color-mix(in srgb, var(--forest) 42%, transparent)", backgroundColor: "var(--forest)" }}
                    >
                      {lt("Done")}
                    </button>
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {mobileLogFabOpen ? (
          <>
            <motion.div
              key="train-log-fab-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 right-0 z-[236]"
              style={{
                left: `${trainRailWidthPx}px`,
                backgroundColor: "color-mix(in srgb, var(--void-black) 74%, transparent)",
              }}
              onClick={() => setLibrarySheetOpen(false)}
            />
            <motion.aside
              key="train-log-fab-sheet"
              initial={{ y: "100%" }}
              animate={{ y: "0%" }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="fixed bottom-0 right-0 z-[238] rounded-t-3xl border-t border-x overflow-hidden safe-area-left safe-area-right safe-area-top safe-area-bottom"
              style={{
                left: `${trainRailWidthPx}px`,
                top: "max(env(safe-area-inset-top,0px),0.5rem)",
                borderColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--ink-deep) 97%, var(--ink-mid))",
              }}
            >
              <div className="h-full min-h-0 flex flex-col overflow-hidden">
                <div className="sticky top-0 z-10 border-b safe-area-top" style={{
                  "--safe-area-top-offset": "10px",
                  borderBottomColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                  backgroundColor: "color-mix(in srgb, var(--ink-deep) 97%, var(--ink-mid))",
                } as React.CSSProperties}>
                  <div className="px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--mist-light)" }}>
                        {lt("New Workout Log")}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setLibrarySheetOpen(false)}
                        className="h-8 w-8 rounded-md border text-sm"
                        style={{
                          borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                          color: "var(--mist-light)",
                          backgroundColor: "color-mix(in srgb, var(--ink-mid) 88%, var(--ink-deep))",
                        }}
                        aria-label={lt("Close workout logger chooser")}
                      >
                        x
                      </button>
                    </div>
                  </div>
                  <div className="px-3 py-2.5 border-t" style={{ borderTopColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)" }}>
                    <SearchField
                      value={mobileLogFabSearchQuery}
                      onChange={setMobileLogFabSearchQuery}
                      placeholder={lt("Search exercises")}
                      aria-label={lt("Search exercises")}
                      className="h-8 text-sm"
                      style={{
                        borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                        color: "var(--cloud-white)",
                      }}
                    />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <select
                        value={mobileLogFabCategory}
                        onChange={(event) => setMobileLogFabCategory(event.target.value)}
                        className="h-8 rounded-md border px-2 text-xs outline-none"
                        style={{
                          borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                          backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                          color: "var(--cloud-white)",
                        }}
                        aria-label={lt("Filter by category")}
                      >
                        {mobileFabCategoryOptions.map((category) => (
                          <option key={`mobile-fab-category-${category}`} value={category}>
                            {category === "all" ? lt("All categories") : category}
                          </option>
                        ))}
                      </select>
                      <select
                        value={mobileLogFabSort}
                        onChange={(event) => setMobileLogFabSort(event.target.value as "recent" | "oldest" | "name-az" | "relevant")}
                        className="h-8 rounded-md border px-2 text-xs outline-none"
                        style={{
                          borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                          backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                          color: "var(--cloud-white)",
                        }}
                        aria-label={lt("Sort exercises")}
                      >
                        <option value="relevant">{lt("Relevant")}</option>
                        <option value="recent">{lt("Recent first")}</option>
                        <option value="oldest">{lt("Oldest first")}</option>
                        <option value="name-az">{lt("Name A-Z")}</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div
                  data-mobile-scroll-container="true"
                  className="min-h-0 flex-1 overflow-y-auto scrollbar-hide overflow-x-hidden px-2 pb-[calc(env(safe-area-inset-bottom,0px)+5rem)]"
                  style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorY: "auto", touchAction: "pan-y" }}
                >
                  <button
                    type="button"
                    className="mx-1 my-0.5 block w-[calc(100%-0.5rem)] rounded-md px-3 py-2.5 text-left"
                    style={{
                      backgroundColor: "transparent",
                    }}
                    onClick={() => {
                      const params = new URLSearchParams();
                      params.set("custom", "1");
                      const customName = mobileLogFabSearchQuery.trim();
                      if (customName) {
                        params.set("prefillExercise", customName);
                      }
                      setLibrarySheetOpen(false);
                      router.push(`/dashboard/train/input/new?${params.toString()}`);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-tight" style={{ color: "color-mix(in srgb, var(--forest) 72%, black 28%)" }}>
                        + {lt("New Custom Exercise")}
                      </p>
                    </div>
                    <p className="mt-0.5 text-[11px] italic" style={{ color: "var(--text-muted)" }}>
                      {lt("Create a new exercise name and send it to review.")}
                    </p>
                  </button>

                  {filteredMobileLogFabRows.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                      {lt("No exercises match your search or filters.")}
                    </div>
                  ) : (
                    filteredMobileLogFabRows.map((row) => (
                      <button
                        key={`mobile-log-fab-row-${row.exerciseId}`}
                        type="button"
                        className="mx-1 my-0.5 block w-[calc(100%-0.5rem)] rounded-md px-3 py-2.5 text-left"
                        style={{
                          backgroundColor: "transparent",
                        }}
                        onClick={() => {
                          const pathId = `${row.exerciseId}-quick`;
                          const href = `/dashboard/train/input/${encodeURIComponent(pathId)}?prefillExerciseId=${encodeURIComponent(row.exerciseId)}&prefillExercise=${encodeURIComponent(row.exerciseName)}&prefillProgression=${encodeURIComponent(row.progression)}&prefillVariant=${encodeURIComponent(row.variant || "")}`;
                          setLibrarySheetOpen(false);
                          router.push(href);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-tight" style={{ color: row.isDeleted ? "var(--crimson-light)" : getRecentExerciseTextColor(row.date) }}>
                            {row.exerciseName}
                            {row.recent24hCount >= 2 ? (
                              <sup className="ml-0.5 text-[12px] font-bold leading-none" style={{ color: "var(--accent)" }}>
                                {row.recent24hCount}
                              </sup>
                            ) : null}
                          </p>
                          <span className="shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {row.date ? formatRelativeRecentDate(row.date, settings.dateFormat || "dd-mmm-yyyy", settings.timeZone) : lt("Never")}
                          </span>
                        </div>
                        {row.date ? (
                          <p className="mt-0.5 text-[11px] italic" style={{ color: "var(--text-muted)" }}>
                            {`${lt("Recent")}: ${row.variant ? `${row.variant} ` : ""}${row.progression} ${row.exerciseName}`}
                          </p>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {mobileExerciseDrawerExerciseId ? (
          <>
            <motion.div
              key="mobile-exercise-drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-0 z-[235]"
              style={{ backgroundColor: "color-mix(in srgb, var(--void-black) 76%, transparent)" }}
              onClick={() => setMobileExerciseDrawerExerciseId(null)}
            />
            <motion.aside
              key="mobile-exercise-drawer-panel"
              initial={{ x: "100%" }}
              animate={mobileDrawerAnimReady ? { x: 0 } : { x: "0%" }}
              exit={{ x: "100%" }}
              transition={mobileDrawerAnimReady ? { duration: 0 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              onAnimationComplete={(definition) => {
                if (typeof definition === "object" && definition !== null && "x" in (definition as Record<string, unknown>)) {
                  const target = (definition as { x?: string | number }).x;
                  if (target === "0%" || target === 0) {
                    setMobileDrawerAnimReady(true);
                  }
                }
              }}
              className="fixed inset-y-0 right-0 z-[240] w-full border-l overflow-hidden safe-area-top safe-area-bottom safe-area-right"
              style={{
                borderLeftColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
                willChange: mobileDrawerAnimReady ? "auto" : "transform",
                transform: mobileDrawerAnimReady ? "none" : undefined,
              }}
            >
              <div
                data-mobile-scroll-container="true"
                className="relative h-full overflow-y-auto scrollbar-hide overflow-x-hidden pb-[calc(env(safe-area-inset-bottom,0px)+5rem)]"
                style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorY: "auto", touchAction: "pan-y" }}
              >
                <div className="sticky top-0 z-10 border-b px-3 py-2.5 safe-area-top" style={{
                  "--safe-area-top-offset": "10px",
                  borderBottomColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                  backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
                } as React.CSSProperties}>
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => setMobileExerciseDrawerExerciseId(null)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md"
                      style={{
                        color: "var(--mist-light)",
                        backgroundColor: "transparent",
                      }}
                      aria-label={lt("Back to exercise list")}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <div className="min-w-0 flex-1">
                      <h3
                        className="truncate text-sm font-semibold"
                        style={{ color: getRecentExerciseTextColor(selectedMobileExerciseLogs[0]?.createdAt, true) }}
                      >
                        {selectedMobileExercise?.name || lt("Exercise")}
                      </h3>
                      <p className="mt-0.5 text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--mist-light)" }}>
                        {lt("Workout History")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedMobileExercise) return;
                          const recent = selectedMobileExerciseLogs[0];
                          const progressionName = recent
                            ? selectedMobileExercise.tiers.find((tier) => tier.level === recent.level)?.name ?? ""
                            : "";
                          const variant = recent?.variant?.trim() ?? "";
                          const pathId = `${selectedMobileExercise.id}-quick`;
                          const params = new URLSearchParams();
                          params.set("prefillExerciseId", selectedMobileExercise.id);
                          params.set("prefillExercise", selectedMobileExercise.name);
                          if (progressionName) params.set("prefillProgression", progressionName);
                          if (variant) params.set("prefillVariant", variant);
                          router.push(`/dashboard/train/input/${encodeURIComponent(pathId)}?${params.toString()}`);
                        }}
                        className="inline-flex h-8 items-center justify-center text-[var(--mist-mid)] transition-colors hover:text-[var(--text-primary)]"
                        aria-label={lt("Log a session for this exercise")}
                        title={lt("Log a session")}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobileDrawerSearchOpen((prev) => !prev)}
                        className="inline-flex h-8 items-center justify-center text-[var(--mist-mid)] transition-colors hover:text-[var(--text-primary)]"
                        aria-label={mobileDrawerSearchOpen ? lt("Close log search") : lt("Open log search")}
                        aria-expanded={mobileDrawerSearchOpen}
                      >
                        <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobileDrawerFilterOpen(true)}
                        className="relative inline-flex h-8 items-center justify-center text-[var(--mist-mid)] transition-colors hover:text-[var(--text-primary)]"
                        aria-label={lt("Open log filters")}
                      >
                        <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M6 12h12m-9 7h6" />
                        </svg>
                        {(mobileDrawerLevelFilter !== "all" || mobileDrawerVariantFilter !== "all" || mobileDrawerWeightFilter !== "all" || mobileDrawerRepsFilter !== "all" || mobileDrawerSort !== "recent") ? (
                          <span className="absolute right-0.5 top-1 h-2 w-2 rounded-full bg-[var(--accent)]" />
                        ) : null}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {mobileDrawerSearchOpen ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0, y: -6 }}
                        animate={{ height: "auto", opacity: 1, y: 0 }}
                        exit={{ height: 0, opacity: 0, y: -6 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <SearchField
                          ref={mobileDrawerSearchInputRef}
                          autoFocus
                          value={mobileDrawerSearchQuery}
                          onChange={setMobileDrawerSearchQuery}
                          placeholder={lt("Search logs")}
                          aria-label={lt("Search logs")}
                          wrapperClassName="mt-2"
                          className="h-8 text-sm"
                          style={{
                            borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                            backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                            color: "var(--cloud-white)",
                          }}
                        />
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                <AnimatePresence>
                  {mobileDrawerFilterOpen ? (
                    <>
                      <motion.div
                        key="mobile-inner-log-filter-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        className="fixed inset-0 z-[245]"
                        style={{ backgroundColor: "color-mix(in srgb, var(--void-black) 72%, transparent)" }}
                        onClick={() => setMobileDrawerFilterOpen(false)}
                      />
                      <motion.aside
                        key="mobile-inner-log-filter-drawer"
                        initial={{ x: "100%", opacity: 0.98 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: "100%", opacity: 0.98 }}
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        className="fixed inset-y-0 right-0 z-[250] flex max-h-[100dvh] w-[min(22rem,92vw)] flex-col overflow-hidden border-l shadow-2xl safe-area-top safe-area-bottom safe-area-right"
                        style={{
                          borderColor: "color-mix(in srgb, var(--accent) 18%, var(--ink-light))",
                          background: "linear-gradient(180deg, color-mix(in srgb, var(--ink-dark) 98%, transparent) 0%, color-mix(in srgb, var(--ink-mid) 92%, transparent) 100%)",
                          boxShadow: "0 18px 56px rgba(0, 0, 0, 0.45)",
                        }}
                      >
                        <div className="shrink-0 border-b px-4 pb-3 pt-[max(env(safe-area-inset-top,0px),1rem)]" style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 55%, transparent)" }}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">{lt("Filters")}</p>
                              <h2 className="mt-1 text-base font-semibold text-[var(--text-primary)]">{lt("Log Filters")}</h2>
                            </div>
                            <button
                              type="button"
                              onClick={() => setMobileDrawerFilterOpen(false)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-[var(--mist-mid)] transition hover:text-[var(--text-primary)]"
                              style={{
                                borderColor: "color-mix(in srgb, var(--ink-light) 55%, transparent)",
                                backgroundColor: "color-mix(in srgb, var(--ink-mid) 88%, var(--ink-deep))",
                              }}
                              aria-label={lt("Close log filters")}
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
                          <div className="space-y-4">
                            <div>
                              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{lt("Progression")}</label>
                              <select
                                value={mobileDrawerLevelFilter}
                                onChange={(event) => setMobileDrawerLevelFilter(event.target.value)}
                                className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                                style={{
                                  borderColor: "var(--border)",
                                  backgroundColor: "var(--void-black)",
                                  color: "var(--text-primary)",
                                }}
                              >
                                <option value="all">{lt("All progressions")}</option>
                                {mobileDrawerLevelOptions.map((progressionName) => (
                                  <option key={`drawer-progression-${progressionName}`} value={progressionName}>{progressionName}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{lt("Variation")}</label>
                              <select
                                value={mobileDrawerVariantFilter}
                                onChange={(event) => setMobileDrawerVariantFilter(event.target.value)}
                                className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                                style={{
                                  borderColor: "var(--border)",
                                  backgroundColor: "var(--void-black)",
                                  color: "var(--text-primary)",
                                }}
                              >
                                <option value="all">{lt("All variations")}</option>
                                {mobileDrawerVariantOptions.map((variant) => (
                                  <option key={`drawer-variant-${variant}`} value={variant}>{variant === "-" ? lt("No variation") : variant}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{lt("Weight")}</label>
                              <select
                                value={mobileDrawerWeightFilter}
                                onChange={(event) => setMobileDrawerWeightFilter(event.target.value as "all" | "weighted" | "bodyweight")}
                                className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                                style={{
                                  borderColor: "var(--border)",
                                  backgroundColor: "var(--void-black)",
                                  color: "var(--text-primary)",
                                }}
                              >
                                <option value="all">{lt("All loads")}</option>
                                <option value="weighted">{lt("Weighted")}</option>
                                <option value="bodyweight">{lt("Bodyweight")}</option>
                              </select>
                            </div>

                            <div>
                              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{lt("Reps")}</label>
                              <select
                                value={mobileDrawerRepsFilter}
                                onChange={(event) => setMobileDrawerRepsFilter(event.target.value as "all" | "1-5" | "6-10" | "11+")}
                                className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                                style={{
                                  borderColor: "var(--border)",
                                  backgroundColor: "var(--void-black)",
                                  color: "var(--text-primary)",
                                }}
                              >
                                <option value="all">{lt("All rep ranges")}</option>
                                <option value="1-5">{lt("1–5 reps")}</option>
                                <option value="6-10">{lt("6–10 reps")}</option>
                                <option value="11+">{lt("11+ reps")}</option>
                              </select>
                            </div>

                            <div>
                              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{lt("Sort by")}</label>
                              <select
                                value={mobileDrawerSort}
                                onChange={(event) => setMobileDrawerSort(event.target.value as "recent" | "oldest" | "progression-asc" | "progression-desc")}
                                className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                                style={{
                                  borderColor: "var(--border)",
                                  backgroundColor: "var(--void-black)",
                                  color: "var(--text-primary)",
                                }}
                              >
                                <option value="recent">{lt("Recent first")}</option>
                                <option value="oldest">{lt("Oldest first")}</option>
                                <option value="progression-asc">{lt("Progression ascending")}</option>
                                <option value="progression-desc">{lt("Progression descending")}</option>
                              </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setMobileDrawerLevelFilter("all");
                                  setMobileDrawerVariantFilter("all");
                                  setMobileDrawerWeightFilter("all");
                                  setMobileDrawerRepsFilter("all");
                                  setMobileDrawerSort("recent");
                                }}
                                className="h-11 rounded-xl border px-3 text-sm font-medium text-[var(--text-primary)] transition-colors"
                                style={{ borderColor: "var(--border)", backgroundColor: "var(--void-black)" }}
                              >
                                {lt("Reset")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setMobileDrawerFilterOpen(false)}
                                className="h-11 rounded-xl border px-3 text-sm font-semibold text-[var(--void-black)] transition-colors"
                                style={{ borderColor: "color-mix(in srgb, var(--forest) 42%, transparent)", backgroundColor: "var(--forest)" }}
                              >
                                {lt("Done")}
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.aside>
                    </>
                  ) : null}
                </AnimatePresence>

                <div>
                  {!mobileDrawerAnimReady ? (
                    <div className="px-3 py-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                      {lt("Loading...")}
                    </div>
                  ) : filteredSelectedMobileExerciseLogs.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                      {selectedMobileExerciseLogs.length === 0 ? lt("No workout history for this exercise yet.") : lt("No logs match your search or filters.")}
                    </div>
                  ) : (
                    <>
                      {filteredSelectedMobileExerciseLogs.map((log) => {
                      const tierName = selectedMobileExercise?.tiers.find((tier) => tier.level === log.level)?.name ?? `Progression ${log.level}`;
                      const variationValue = log.variant?.trim() || "-";
                      const modValue = log.modifier?.trim() || "-";
                      const notesValue = log.notes?.trim() || "-";
                      const alignedMetricRows = getWorkoutMetricRows(log, weightUnit, timedUnit);
                      const openEditorField = (step: string, field: string) => {
                        const params = new URLSearchParams({ step, field });
                        router.push(`/dashboard/workout-history/input/${log.id}?${params.toString()}`);
                      };
                      const leftDetailRows = [
                        { label: `${lt("Variation")}:`, value: variationValue, valueColor: "var(--mountain-blue-glow)", step: "details", field: "variation" },
                        { label: `${lt("Mod")}:`, value: modValue, valueColor: "var(--gold-glow)", step: "session", field: "modifier" },
                        { label: `${lt("Notes")}:`, value: notesValue, valueColor: "var(--text-secondary)", step: "notes", field: "notes" },
                      ];
                      const alignedDetailRowCount = Math.max(leftDetailRows.length, alignedMetricRows.length);
                      return (
                        <article
                          key={`mobile-drawer-log-${log.id}`}
                          className="px-3 py-2.5"
                          style={{
                            borderTop: "1px solid color-mix(in srgb, var(--ink-light) 72%, transparent)",
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            {targetUserId ? (
                              <p className="text-sm font-semibold leading-tight" style={{ color: "var(--jade-light)" }}>
                                {tierName}
                              </p>
                            ) : (
                              <button
                                type="button"
                                onClick={() => router.push(`/dashboard/workout-history/input/${log.id}`)}
                                className="cursor-pointer text-left text-sm font-semibold leading-tight transition-colors hover:opacity-90"
                                style={{ color: "var(--jade-light)" }}
                              >
                                {tierName}
                              </button>
                            )}
                            <span className="shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>
                              {formatRelativeRecentDate(log.createdAt, settings.dateFormat || "dd-mmm-yyyy", settings.timeZone)}
                            </span>
                          </div>
                          <div className="mt-1.5 space-y-0.5 text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                            {Array.from({ length: alignedDetailRowCount }, (_, index) => {
                              const left = leftDetailRows[index];
                              const metric = alignedMetricRows[index] ?? { weight: "-", reps: "-" };
                              return (
                                <div key={`detail-row-${log.id}-${index}`} className="grid grid-cols-2 gap-x-3">
                                  <div className="min-w-0">
                                    {left ? (
                                      targetUserId ? (
                                        <div className="truncate">
                                          <span style={{ color: "var(--text-muted)" }}>{left.label}</span>{" "}
                                          <span style={{ color: left.valueColor }}>{left.value}</span>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            openEditorField(left.step, left.field);
                                          }}
                                          className="flex w-full min-w-0 items-baseline gap-1 text-left hover:opacity-90 cursor-pointer"
                                        >
                                          <span className="shrink-0" style={{ color: "var(--text-muted)" }}>{left.label}</span>
                                          <span className="min-w-0 truncate" style={{ color: left.valueColor }}>
                                            {left.value}
                                          </span>
                                        </button>
                                      )
                                    ) : (
                                      <span aria-hidden="true">&nbsp;</span>
                                    )}
                                  </div>
                                  <div className="min-w-0 grid grid-cols-2 gap-x-3">
                                    {metric.weight !== "-" ? (
                                      targetUserId ? (
                                        <span className="truncate" style={{ color: "var(--mountain-blue-glow)" }}>
                                          <span style={{ color: "var(--text-muted)" }}>{lt("Weight")}: </span>{metric.weight}
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            openEditorField("session", `set-${Math.min(index + 1, 3)}`);
                                          }}
                                          className="cursor-pointer truncate text-left hover:opacity-90"
                                          style={{ color: "var(--mountain-blue-glow)" }}
                                        >
                                          <span style={{ color: "var(--text-muted)" }}>{lt("Weight")}: </span>{metric.weight}
                                        </button>
                                      )
                                    ) : (
                                      <span aria-hidden="true" />
                                    )}
                                    {metric.reps !== "-" ? (
                                      targetUserId ? (
                                        <span className="truncate" style={{ color: "var(--forest)" }}>
                                          <span style={{ color: "var(--text-muted)" }}>{lt("Reps")}: </span>{metric.reps}
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            openEditorField("session", `set-${Math.min(index + 1, 3)}`);
                                          }}
                                          className="cursor-pointer truncate text-left hover:opacity-90"
                                          style={{ color: "var(--forest)" }}
                                        >
                                          <span style={{ color: "var(--text-muted)" }}>{lt("Reps")}: </span>{metric.reps}
                                        </button>
                                      )
                                    ) : (
                                      <span aria-hidden="true" />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </article>
                      );
                      })}
                    </>
                  )}
                </div>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {mobileQuickCheckinOpen ? (
          <>
            <motion.div
              key="train-quick-checkin-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-0 z-[236]"
              style={{ backgroundColor: "color-mix(in srgb, var(--void-black) 72%, transparent)" }}
              onClick={() => setQuickCheckinOpen(false)}
            />
            <motion.div
              key="train-quick-checkin-panel-wrap"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-0 z-[238] flex items-center justify-center px-3"
            >
              <motion.section
                initial={{ x: -120, opacity: 0, scale: 0.98 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={{ x: -120, opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-sm rounded-2xl border p-3"
                style={{
                  borderColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                  backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
                }}
              >
                {mobileQuickCheckinLoading ? (
                  <div className="mb-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {lt("Loading latest check-in data...")}
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--mist-light)" }}>
                    {lt("Quick Weight / Note")}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setQuickCheckinOpen(false)}
                    className="h-8 w-8 rounded-md border text-sm"
                    style={{
                      borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                      color: "var(--mist-light)",
                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 88%, var(--ink-deep))",
                    }}
                    aria-label={lt("Close quick check-in drawer")}
                  >
                    x
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  <label className="block">
                    <span className="mb-1 block text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                      {lt("Weight")} ({weightUnit})
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.1"
                      value={mobileQuickCheckinWeight}
                      onChange={(event) => setMobileQuickCheckinWeight(event.target.value)}
                      placeholder={
                        mobileQuickCheckinLatestWeight != null
                          ? String(mobileQuickCheckinLatestWeight)
                          : (weightUnit === "lbs" ? lt("e.g. 165") : lt("e.g. 75"))
                      }
                      disabled={mobileQuickCheckinTodayWeight != null}
                      className="h-10 w-full rounded-md border px-3 text-sm outline-none"
                      style={{
                        borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                        color: "var(--cloud-white)",
                        opacity: mobileQuickCheckinTodayWeight != null ? 0.7 : 1,
                      }}
                    />
                    {mobileQuickCheckinTodayWeight != null ? (
                      <span className="mt-1 block text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {lt("Weight already recorded today")}
                      </span>
                    ) : null}
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                      {lt("Note")}
                    </span>
                    <textarea
                      value={mobileQuickCheckinNote}
                      onChange={(event) => setMobileQuickCheckinNote(event.target.value)}
                      placeholder={lt("How are you feeling today?")}
                      rows={4}
                      disabled={Boolean(mobileQuickCheckinTodayNote.trim())}
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                      style={{
                        borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                        color: "var(--cloud-white)",
                        opacity: mobileQuickCheckinTodayNote.trim() ? 0.7 : 1,
                      }}
                    />
                    {mobileQuickCheckinTodayNote.trim() ? (
                      <span className="mt-1 block text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {lt("Note already recorded today")}
                      </span>
                    ) : null}
                  </label>
                </div>

                {mobileQuickCheckinMessage ? (
                  <p className="mt-2 text-[11px]" style={{ color: mobileQuickCheckinMessage === "Saved" ? "var(--forest)" : "var(--danger)" }}>
                    {mobileQuickCheckinMessage}
                  </p>
                ) : null}

                <div className="mt-3 flex items-center justify-end gap-2">
                  {(mobileQuickCheckinTodayWeight != null || Boolean(mobileQuickCheckinTodayNote.trim())) ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuickCheckinOpen(false);
                        router.push(DASHBOARD_ROUTES.checkIn);
                      }}
                      className="mr-auto h-9 rounded-md border px-3 text-sm"
                      style={{
                        borderColor: "color-mix(in srgb, var(--accent) 46%, transparent)",
                        color: "var(--mist-light)",
                        backgroundColor: "color-mix(in srgb, var(--accent) 16%, var(--ink-deep))",
                      }}
                    >
                      {lt("Go to Check-In")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setQuickCheckinOpen(false)}
                    className="h-9 rounded-md border px-3 text-sm"
                    style={{
                      borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                      color: "var(--mist-light)",
                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 88%, var(--ink-deep))",
                    }}
                  >
                    {lt("Cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveQuickCheckin()}
                    disabled={mobileQuickCheckinSaving || (mobileQuickCheckinTodayWeight != null && Boolean(mobileQuickCheckinTodayNote.trim()))}
                    className="h-9 rounded-md border px-3 text-sm font-semibold"
                    style={{
                      borderColor: "color-mix(in srgb, var(--forest) 42%, transparent)",
                      color: "var(--void-black)",
                      backgroundColor: "var(--forest)",
                      opacity: mobileQuickCheckinSaving || (mobileQuickCheckinTodayWeight != null && Boolean(mobileQuickCheckinTodayNote.trim())) ? 0.7 : 1,
                    }}
                  >
                    {mobileQuickCheckinSaving ? lt("Saving...") : lt("Save")}
                  </button>
                </div>
              </motion.section>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      {!mobileExerciseDrawerExerciseId && !mobileLogFabOpen && !mobileQuickCheckinOpen && !exerciseManagementOpen ? (
        <motion.button
          key="train-log-fab"
          type="button"
          onClick={() => setLibrarySheetOpen(true)}
          drag
          dragMomentum={false}
          dragElastic={0.16}
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          onDragEnd={(_, info) => {
            const x = info.offset.x;
            const y = info.offset.y;

            // Slide up to open workout logger
            if (y <= -56 && Math.abs(y) >= Math.abs(x)) {
              setLibrarySheetOpen(true);
              return;
            }

            // Slide left to open quick weight/note drawer
            if (x <= -56 && Math.abs(x) >= Math.abs(y)) {
              setQuickCheckinOpen(true);
              return;
            }
          }}
          initial={{ opacity: 0, y: 18, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.92 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="fixed right-4 z-[210] inline-flex h-14 w-14 items-center justify-center rounded-full border text-3xl font-semibold leading-none"
          style={{
            bottom: "calc(var(--mobile-nav-offset, calc(env(safe-area-inset-bottom,0px) + 4.85rem)) + 0.5rem)",
            borderColor: themeStyle === "ying-yang"
              ? "color-mix(in srgb, var(--void-black) 42%, var(--accent))"
              : "color-mix(in srgb, var(--accent) 48%, transparent)",
            backgroundColor: "var(--accent)",
            color: themeStyle === "ying-yang" ? "var(--void-black)" : "var(--cloud-white)",
            boxShadow: "0 10px 28px color-mix(in srgb, var(--accent) 35%, transparent)",
          }}
          aria-label={lt("Slide up for workout log or left for quick weight and note")}
          title={lt("Slide up: workout log, slide left: quick weight/note")}
        >
          {shouldShowWeightSwipeHint || shouldShowWeightThankYou ? (
            <motion.span
              className="pointer-events-none absolute right-[calc(100%+0.45rem)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-medium"
              style={{
                borderColor: "color-mix(in srgb, var(--accent) 46%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--ink-mid) 92%, var(--ink-deep))",
                color: "var(--text-primary)",
              }}
              initial={{ opacity: 0, x: 4 }}
              animate={shouldShowWeightThankYou ? { opacity: 1, x: 0 } : { opacity: [0.72, 1, 0.72], x: [0, -6, 0] }}
              transition={shouldShowWeightThankYou ? { duration: 0.2 } : { duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
            >
              {shouldShowWeightThankYou ? lt("Thank you!") : lt("Log your weight!")}
            </motion.span>
          ) : null}
          <motion.span
            aria-hidden="true"
            animate={shouldShowWeightSwipeHint ? { x: [0, -8, 0] } : { x: 0 }}
            transition={shouldShowWeightSwipeHint ? { duration: 1.05, repeat: Infinity, ease: "easeInOut" } : undefined}
          >
            +
          </motion.span>
        </motion.button>
      ) : null}
    </>
  );
}
