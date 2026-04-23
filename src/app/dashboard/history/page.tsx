"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import GlowCard from "@/components/ui/GlowCard";
import SearchField from "@/components/ui/SearchField";
import { MemoTrainingLogTable } from "@/components/workout/TrainingLogTable";
import { useAuth } from "@/context/AuthContext";
import { useAppContext } from "@/context/AppContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { api } from "@/lib/api-client";
import { getDeletedExerciseLabel } from "@/lib/exercise-name";
import { rankExerciseSearchResults } from "@/lib/exercise-search";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import { isDeletedExerciseDescription } from "@/lib/pending-exercises";
import { DEFAULT_USER_PHYSIQUE, loadUserPhysique } from "@/lib/user-physique";
import { PROGRESSION_EXERCISES_UPDATED_EVENT } from "@/lib/progression-events";
import { formatDateWithPreference } from "@/lib/constants";
import { formatSetValue, type WeightUnit } from "@/lib/unit-conversion";
import type { UserPhysiqueSettings } from "@/lib/user-physique";
import type { ProgressionExercise, ProgressionLog } from "../workout/types";

type WorkoutMetricRow = { weight: string; reps: string };

function getWorkoutMetricRows(log: ProgressionLog, displayUnit: WeightUnit = "kg"): WorkoutMetricRow[] {
  const hasHold = log.holdTime != null || log.holdTime2 != null || log.holdTime3 != null;
  const primaryRows = (hasHold
    ? [log.holdTime, log.holdTime2, log.holdTime3]
    : [log.weight1, log.weight2, log.weight3]
  ).map((metric, index) => {
    const reps = [log.reps1, log.reps2, log.reps3][index];
    if (metric == null && reps == null) return null;
    return {
      weight: metric == null ? "-" : formatSetValue(metric, hasHold ? "timed" : "weighted", displayUnit),
      reps: reps == null ? "-" : String(reps),
    };
  }).filter((row): row is WorkoutMetricRow => Boolean(row));

  const extraRows = Array.isArray(log.dynamicSetRows) ? log.dynamicSetRows : [];
  const rows = [...primaryRows, ...extraRows].filter((row) => row.weight !== "-" || row.reps !== "-");
  return rows.length > 0 ? rows : [{ weight: "-", reps: "-" }];
}

function formatWorkoutValueChips(log: ProgressionLog, displayUnit: WeightUnit = "kg"): string[] {
  const chips = getWorkoutMetricRows(log, displayUnit)
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
      ? "color-mix(in srgb, var(--cultivator-amber) 58%, white 42%)"
      : "color-mix(in srgb, var(--cultivator-amber) 68%, white 32%)";
  }

  if (diffMs <= 14 * dayMs) {
    return isSelected
      ? "color-mix(in srgb, var(--cultivator-amber) 68%, var(--mist-light) 32%)"
      : "color-mix(in srgb, var(--cultivator-amber) 58%, var(--mist-dark) 42%)";
  }

  return defaultColor;
}

export default function HistoryPage() {
  const { user } = useAuth();
  const { themeStyle } = useAppContext();
  const { settings } = useDisplaySettings();
  const weightUnit = settings.defaultWeightUnit ?? "kg";
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
  const [mobileLogFabOpen, setMobileLogFabOpen] = useState(false);
  const [mobileLogFabSearchQuery, setMobileLogFabSearchQuery] = useState("");
  const [mobileLogFabCategory, setMobileLogFabCategory] = useState("all");
  const [mobileLogFabSort, setMobileLogFabSort] = useState<"recent" | "oldest" | "name-az" | "relevant">("recent");
  const mobileDrawerSearchInputRef = useRef<HTMLInputElement | null>(null);
  const mobileHistorySortPreferenceRef = useRef<"recent" | "oldest" | "name-az">("recent");
  const mobileLogFabSortPreferenceRef = useRef<"recent" | "oldest" | "name-az">("recent");

  const userId = user?.id ?? "";
  const targetUserId = searchParams.get("targetUserId") || "";
  const rawFriendView = searchParams.get("friendView") || "history";
  const friendView = rawFriendView === "chart" || rawFriendView === "checkin" ? rawFriendView : "history";
  const activeUserId = targetUserId || userId;
  const prefillExerciseId = searchParams.get("prefillExerciseId");
  const prefillExerciseName = searchParams.get("prefillExercise");
  const prefillProgression = searchParams.get("prefillProgression");
  const prefillVariant = searchParams.get("prefillVariant");

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
      const params = new URLSearchParams({ logLimit: "200" });
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

    const selfEntry = visibleUsers.find((u) => u.id === userId) ?? {
      id: userId,
      name: user?.name || "Me",
      username: user?.username || "",
    };
    const others = visibleUsers.filter((u) => u.id !== userId);
    return [selfEntry, ...others];
  }, [user?.name, user?.username, userId, visibleUsers]);

  const targetUserDisplayName = useMemo(() => {
    if (!targetUserId) return undefined;
    const target = orderedVisibleUsers.find((u) => u.id === targetUserId);
    if (!target) return undefined;
    return (target.name || target.username || "").trim() || undefined;
  }, [orderedVisibleUsers, targetUserId]);

  const activeUserProfile = useMemo(() => {
    const fallbackName = user?.name || user?.username || "Me";
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
    : "Train";
  const trainQuickNavItems = [
    { label: "Community Feed", href: DASHBOARD_ROUTES.community },
    { label: "Completionist", href: DASHBOARD_ROUTES.rankUp },
    { label: "Exercise Library", href: DASHBOARD_ROUTES.exercises },
  ] as const;
  const subtitle = targetUserDisplayName
    ? `Review ${targetUserDisplayName}'s training logs and cultivation entries`
    : "Review your training logs and cultivation entries";
  const isFriendTrainOverlay = Boolean(targetUserId);
  const friendRailWidthPx = 64;

  const handleUserScopeChange = (nextUserId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!nextUserId || nextUserId === userId) {
      params.delete("targetUserId");
    } else {
      params.set("targetUserId", nextUserId);
    }
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  const mobileExerciseRows = useMemo(() => {
    const rows: Array<{
      exerciseId: string;
      exerciseName: string;
      date: string;
      logId: string;
      progression: string;
      variant: string;
      category: string;
      isDeleted: boolean;
    }> = [];

    for (const exercise of exercises) {
      const logs = exercise.userProgress?.[0]?.logs ?? [];
      if (logs.length === 0) continue;

      const latestLog = [...logs].sort(compareLogRecency)[0];
      const tierName = exercise.tiers.find((tier) => tier.level === latestLog.level)?.name ?? `Progression ${latestLog.level}`;

      const deletedExercise = isDeletedExerciseDescription(exercise.story);

      rows.push({
        exerciseId: exercise.id,
        exerciseName: deletedExercise ? getDeletedExerciseLabel(exercise) : exercise.name,
        date: latestLog.createdAt,
        logId: latestLog.id,
        progression: tierName,
        variant: latestLog.variant?.trim() || "",
        category: (exercise.category || "Uncategorized").trim() || "Uncategorized",
        isDeleted: deletedExercise,
      });
    }

    rows.sort((a, b) => {
      const timeDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.logId.localeCompare(a.logId);
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

      let matchesRecency = true;
      if (mobileHistoryRecency === "7d") {
        matchesRecency = now - new Date(row.date).getTime() <= 7 * dayMs;
      } else if (mobileHistoryRecency === "30d") {
        matchesRecency = now - new Date(row.date).getTime() <= 30 * dayMs;
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
      sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else if (mobileHistorySort === "name-az") {
      sorted.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
    } else {
      sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
    }> = [];

    for (const exercise of exercises) {
      const logs = exercise.userProgress?.[0]?.logs ?? [];
      const latestLog = logs.length > 0
        ? [...logs].sort(compareLogRecency)[0]
        : null;

      const progressionLevel = latestLog?.level ?? exercise.userProgress?.[0]?.currentLevel ?? exercise.tiers[0]?.level ?? 1;
      const progressionName = exercise.tiers.find((tier) => tier.level === progressionLevel)?.name ?? `Progression ${progressionLevel}`;
      const deletedExercise = isDeletedExerciseDescription(exercise.story);

      rows.push({
        exerciseId: exercise.id,
        exerciseName: deletedExercise ? getDeletedExerciseLabel(exercise) : exercise.name,
        date: latestLog?.createdAt ?? null,
        logId: latestLog?.id ?? null,
        progression: progressionName,
        variant: latestLog?.variant?.trim() || "",
        category: (exercise.category || "Uncategorized").trim() || "Uncategorized",
        isDeleted: deletedExercise,
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
      const metricRows = getWorkoutMetricRows(log, weightUnit);
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

    const isOpen = Boolean(mobileExerciseDrawerExerciseId);
    window.dispatchEvent(new CustomEvent("train-exercise-history-visibility", { detail: { open: isOpen } }));

    return () => {
      window.dispatchEvent(new CustomEvent("train-exercise-history-visibility", { detail: { open: false } }));
    };
  }, [mobileExerciseDrawerExerciseId]);

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

      if (targetUserId || searchParams.get("friendView")) {
        router.replace(DASHBOARD_ROUTES.workoutHistory, { scroll: false });
      }
    };

    window.addEventListener("train-reset-view", onTrainReset);
    return () => {
      window.removeEventListener("train-reset-view", onTrainReset);
    };
  }, [router, searchParams, targetUserId]);

  return (
    <>
      <PageLayout
        title={trainPageTitle}
        subtitle={isFriendTrainOverlay ? undefined : subtitle}
        mobileContentPaddingClass={isFriendTrainOverlay ? "p-0 pb-0" : "p-2 pb-0"}
        mobileScrollContainerEnabled={!isFriendTrainOverlay}
      >
      <div className={`nyaa-history-page px-0 ${isFriendTrainOverlay ? "space-y-0" : "space-y-4"}`}>
        {loading ? (
          <GlowCard glow="jade" hoverable={false}>
            <p className="text-sm text-mist-dark text-center py-4">Loading history...</p>
          </GlowCard>
        ) : (
          <>
            <motion.section
                  key={isFriendTrainOverlay ? `friend-train-${targetUserId}` : "self-train"}
                  initial={isFriendTrainOverlay ? { x: "100%" } : false}
                  animate={isFriendTrainOverlay ? { x: "0%" } : { x: 0 }}
                  transition={isFriendTrainOverlay ? { duration: 0.24, ease: [0.22, 1, 0.36, 1] } : undefined}
                  className={isFriendTrainOverlay ? "fixed inset-y-0 right-0 z-[71] border-l overflow-hidden safe-area-top safe-area-bottom safe-area-right" : "flex h-[calc(var(--app-viewport-height)-2rem)] min-h-[calc(var(--app-viewport-height)-2rem)] flex-col"}
                  style={isFriendTrainOverlay ? { left: `${friendRailWidthPx}px`, borderLeftColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)", backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))", minHeight: "var(--app-viewport-height)" } : undefined}
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
                      className={`${isFriendTrainOverlay ? "h-app safe-area-top safe-area-bottom overflow-y-auto scrollbar-hide" : "flex min-h-0 flex-1 flex-col overflow-hidden"}`}
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
                                aria-label="Back to my train history"
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                              </button>
                            ) : null}
                            <h2 className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--mist-light)" }}>
                              {trainPageTitle}
                            </h2>
                          </div>

                          {friendView === "history" && (
                            <>
                              <div className="mt-2 flex items-center gap-2">
                                <SearchField
                                  value={mobileSearchQuery}
                                  onChange={setMobileSearchQuery}
                                  placeholder="Search exercises"
                                  aria-label="Search exercises"
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
                                  aria-label="Open filters"
                                >
                                  <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M6 12h12m-9 7h6" />
                                  </svg>
                                  {(mobileHistoryCategory !== "all" || mobileHistorySort !== "recent" || mobileHistoryRecency !== "all") ? (
                                    <span className="absolute right-0.5 top-1 h-2 w-2 rounded-full" style={{ backgroundColor: "var(--accent)" }} />
                                  ) : null}
                                </button>
                              </div>

                              {!isFriendTrainOverlay ? (
                                <div className="mt-2 -mx-0.5 overflow-x-auto scrollbar-hide">
                                  <div className="flex min-w-max items-center gap-2">
                                    {trainQuickNavItems.map((item) => {
                                      const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                                      return (
                                        <button
                                          key={item.href}
                                          type="button"
                                          onClick={() => router.push(item.href)}
                                          className="rounded-md border px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-[border-color,background-color,color]"
                                          style={{
                                            minWidth: "fit-content",
                                            borderColor: isActive
                                              ? "color-mix(in srgb, var(--accent) 20%, var(--border))"
                                              : "var(--border)",
                                            backgroundColor: isActive
                                              ? "color-mix(in srgb, var(--surface) 72%, var(--surface-hover))"
                                              : "var(--surface-hover)",
                                            color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                                            boxShadow: "none",
                                          }}
                                          aria-current={isActive ? "page" : undefined}
                                        >
                                          {item.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                        <div className="h-px" style={{ backgroundColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)" }} />
                      </div>

                      {friendView === "history" ? (
                      <div
                        data-mobile-scroll-container={isFriendTrainOverlay ? "true" : "true"}
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
                            No exercises match your search.
                          </div>
                        ) : (
                          filteredMobileExerciseRows.map((row) => {
                            const isPreviouslySelected = row.exerciseId === mobileLastSelectedExerciseId;
                            return (
                            <article
                              key={`mobile-train-row-${row.exerciseId}`}
                              className="mx-1 my-0.5 rounded-md px-3 py-2.5"
                              style={{
                                borderTop: "1px solid color-mix(in srgb, var(--ink-light) 72%, transparent)",
                                border: isPreviouslySelected ? "1px solid color-mix(in srgb, var(--jade-glow) 62%, var(--ink-light))" : undefined,
                                backgroundColor: isPreviouslySelected ? "color-mix(in srgb, var(--jade-glow) 14%, var(--ink-deep))" : "transparent",
                                boxShadow: isPreviouslySelected ? "inset 0 0 0 1px color-mix(in srgb, var(--jade-glow) 20%, transparent), 0 0 14px color-mix(in srgb, var(--jade-glow) 24%, transparent)" : "none",
                                cursor: "pointer",
                              }}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setMobileLastSelectedExerciseId(row.exerciseId);
                                setMobileExerciseDrawerExerciseId(row.exerciseId);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setMobileLastSelectedExerciseId(row.exerciseId);
                                  setMobileExerciseDrawerExerciseId(row.exerciseId);
                                }
                              }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p
                                  className="text-sm font-semibold leading-tight"
                                  style={{ color: row.isDeleted ? "var(--crimson-light)" : getRecentExerciseTextColor(row.date, isPreviouslySelected) }}
                                >
                                  {row.exerciseName}
                                </p>
                                  <span className="shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>
                                    {formatRelativeRecentDate(row.date, settings.dateFormat || "dd-mmm-yyyy", settings.timeZone)}
                                  </span>
                              </div>
                              <p className="mt-0.5 text-[11px] italic" style={{ color: row.isDeleted ? "var(--crimson-light)" : "var(--text-muted)" }}>
                                {`Recent: ${row.variant ? `${row.variant} ` : ""}${row.progression} ${row.exerciseName}`}
                              </p>
                            </article>
                            );
                          })
                        )}
                      </div>
                      ) : (
                        <div className="px-3 py-5">
                          <div className="rounded-2xl border border-[#3b3f48] bg-[#232428] p-4">
                            <p className="text-sm font-semibold text-[#f2f3f5]">
                              {friendView === "chart" ? "Chart" : "Check-in"} coming soon
                            </p>
                            <p className="mt-1 text-xs text-[#949ba4]">
                              UI placeholder ready. Functionality will be added in the next step.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
              </motion.section>
          </>
        )}
      </div>
      </PageLayout>

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
                borderColor: "color-mix(in srgb, var(--jade-glow) 18%, var(--ink-light))",
                background: "linear-gradient(180deg, color-mix(in srgb, var(--ink-dark) 98%, transparent) 0%, color-mix(in srgb, var(--ink-mid) 92%, transparent) 100%)",
                boxShadow: "0 18px 56px rgba(0, 0, 0, 0.45)",
              }}
            >
              <div className="shrink-0 border-b px-4 pb-3 pt-[max(env(safe-area-inset-top,0px),1rem)]" style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 55%, transparent)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#949ba4]">Filters</p>
                    <h2 className="mt-1 text-base font-semibold text-[#f2f3f5]">Train History</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileHistoryFilterOpen(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-[#b5bac1] transition hover:text-[#f2f3f5]"
                    style={{
                      borderColor: "color-mix(in srgb, var(--ink-light) 55%, transparent)",
                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 88%, var(--ink-deep))",
                    }}
                    aria-label="Close exercise filters"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" style={{ WebkitOverflowScrolling: "touch" }}>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[#949ba4]">Category</label>
                    <select
                      value={mobileHistoryCategory}
                      onChange={(event) => setMobileHistoryCategory(event.target.value)}
                      className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                      style={{
                        borderColor: "#3b3f48",
                        backgroundColor: "#232428",
                        color: "#f2f3f5",
                      }}
                    >
                      {mobileHistoryCategoryOptions.map((category) => (
                        <option key={`history-category-${category}`} value={category}>
                          {category === "all" ? "All categories" : category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[#949ba4]">Sort by</label>
                    <select
                      value={mobileHistorySort}
                      onChange={(event) => setMobileHistorySort(event.target.value as "recent" | "oldest" | "name-az" | "relevant")}
                      className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                      style={{
                        borderColor: "#3b3f48",
                        backgroundColor: "#232428",
                        color: "#f2f3f5",
                      }}
                    >
                      <option value="relevant">Relevant</option>
                      <option value="recent">Recent first</option>
                      <option value="oldest">Oldest first</option>
                      <option value="name-az">Name A-Z</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[#949ba4]">Updated</label>
                    <select
                      value={mobileHistoryRecency}
                      onChange={(event) => setMobileHistoryRecency(event.target.value as "all" | "7d" | "30d")}
                      className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                      style={{
                        borderColor: "#3b3f48",
                        backgroundColor: "#232428",
                        color: "#f2f3f5",
                      }}
                    >
                      <option value="all">All time</option>
                      <option value="7d">Last 7 days</option>
                      <option value="30d">Last 30 days</option>
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
                      className="h-11 rounded-xl border px-3 text-sm font-medium text-[#f2f3f5] transition-colors"
                      style={{ borderColor: "#3b3f48", backgroundColor: "#232428" }}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileHistoryFilterOpen(false)}
                      className="h-11 rounded-xl border px-3 text-sm font-semibold text-[#08120c] transition-colors"
                      style={{ borderColor: "rgba(87, 242, 135, 0.42)", backgroundColor: "#57f287" }}
                    >
                      Done
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
              className="fixed inset-0 z-[236]"
              style={{ backgroundColor: "color-mix(in srgb, var(--void-black) 74%, transparent)" }}
              onClick={() => setMobileLogFabOpen(false)}
            />
            <motion.aside
              key="train-log-fab-sheet"
              initial={{ y: "100%" }}
              animate={{ y: "0%" }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-x-0 bottom-0 z-[238] rounded-t-3xl border-t border-x overflow-hidden safe-area-left safe-area-right safe-area-top safe-area-bottom"
              style={{
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
                        New Workout Log
                      </h2>
                      <button
                        type="button"
                        onClick={() => setMobileLogFabOpen(false)}
                        className="h-8 w-8 rounded-md border text-sm"
                        style={{
                          borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                          color: "var(--mist-light)",
                          backgroundColor: "color-mix(in srgb, var(--ink-mid) 88%, var(--ink-deep))",
                        }}
                        aria-label="Close workout logger chooser"
                      >
                        x
                      </button>
                    </div>
                  </div>
                  <div className="px-3 py-2.5 border-t" style={{ borderTopColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)" }}>
                    <SearchField
                      value={mobileLogFabSearchQuery}
                      onChange={setMobileLogFabSearchQuery}
                      placeholder="Search exercises"
                      aria-label="Search exercises"
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
                        aria-label="Filter by category"
                      >
                        {mobileFabCategoryOptions.map((category) => (
                          <option key={`mobile-fab-category-${category}`} value={category}>
                            {category === "all" ? "All categories" : category}
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
                        aria-label="Sort exercises"
                      >
                        <option value="relevant">Relevant</option>
                        <option value="recent">Recent first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="name-az">Name A-Z</option>
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
                      setMobileLogFabOpen(false);
                      router.push(`/dashboard/train/input/new?${params.toString()}`);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-tight" style={{ color: "color-mix(in srgb, var(--forest) 72%, black 28%)" }}>
                        + New Custom Exercise
                      </p>
                    </div>
                    <p className="mt-0.5 text-[11px] italic" style={{ color: "var(--text-muted)" }}>
                      Create a new exercise name and send it to review.
                    </p>
                  </button>

                  {filteredMobileLogFabRows.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                      No exercises match your search or filters.
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
                          setMobileLogFabOpen(false);
                          router.push(href);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-tight" style={{ color: row.isDeleted ? "var(--crimson-light)" : getRecentExerciseTextColor(row.date) }}>
                            {row.exerciseName}
                          </p>
                          <span className="shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {row.date ? formatRelativeRecentDate(row.date, settings.dateFormat || "dd-mmm-yyyy", settings.timeZone) : "Never"}
                          </span>
                        </div>
                        {row.date ? (
                          <p className="mt-0.5 text-[11px] italic" style={{ color: "var(--text-muted)" }}>
                            {`Recent: ${row.variant ? `${row.variant} ` : ""}${row.progression} ${row.exerciseName}`}
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
                      aria-label="Back to exercise list"
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
                        {selectedMobileExercise?.name || "Exercise"}
                      </h3>
                      <p className="mt-0.5 text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--mist-light)" }}>
                        Workout History
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
                        className="inline-flex h-8 items-center justify-center text-[#b5bac1] transition-colors hover:text-[#f2f3f5]"
                        aria-label="Log a session for this exercise"
                        title="Log a session"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobileDrawerSearchOpen((prev) => !prev)}
                        className="inline-flex h-8 items-center justify-center text-[#b5bac1] transition-colors hover:text-[#f2f3f5]"
                        aria-label={mobileDrawerSearchOpen ? "Close log search" : "Open log search"}
                        aria-expanded={mobileDrawerSearchOpen}
                      >
                        <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobileDrawerFilterOpen(true)}
                        className="relative inline-flex h-8 items-center justify-center text-[#b5bac1] transition-colors hover:text-[#f2f3f5]"
                        aria-label="Open log filters"
                      >
                        <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M6 12h12m-9 7h6" />
                        </svg>
                        {(mobileDrawerLevelFilter !== "all" || mobileDrawerVariantFilter !== "all" || mobileDrawerWeightFilter !== "all" || mobileDrawerRepsFilter !== "all" || mobileDrawerSort !== "recent") ? (
                          <span className="absolute right-0.5 top-1 h-2 w-2 rounded-full bg-[#5865f2]" />
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
                          placeholder="Search logs"
                          aria-label="Search logs"
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
                          borderColor: "color-mix(in srgb, var(--jade-glow) 18%, var(--ink-light))",
                          background: "linear-gradient(180deg, color-mix(in srgb, var(--ink-dark) 98%, transparent) 0%, color-mix(in srgb, var(--ink-mid) 92%, transparent) 100%)",
                          boxShadow: "0 18px 56px rgba(0, 0, 0, 0.45)",
                        }}
                      >
                        <div className="shrink-0 border-b px-4 pb-3 pt-[max(env(safe-area-inset-top,0px),1rem)]" style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 55%, transparent)" }}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.14em] text-[#949ba4]">Filters</p>
                              <h2 className="mt-1 text-base font-semibold text-[#f2f3f5]">Log Filters</h2>
                            </div>
                            <button
                              type="button"
                              onClick={() => setMobileDrawerFilterOpen(false)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-[#b5bac1] transition hover:text-[#f2f3f5]"
                              style={{
                                borderColor: "color-mix(in srgb, var(--ink-light) 55%, transparent)",
                                backgroundColor: "color-mix(in srgb, var(--ink-mid) 88%, var(--ink-deep))",
                              }}
                              aria-label="Close log filters"
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
                          <div className="space-y-4">
                            <div>
                              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[#949ba4]">Progression</label>
                              <select
                                value={mobileDrawerLevelFilter}
                                onChange={(event) => setMobileDrawerLevelFilter(event.target.value)}
                                className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                                style={{
                                  borderColor: "#3b3f48",
                                  backgroundColor: "#232428",
                                  color: "#f2f3f5",
                                }}
                              >
                                <option value="all">All progressions</option>
                                {mobileDrawerLevelOptions.map((progressionName) => (
                                  <option key={`drawer-progression-${progressionName}`} value={progressionName}>{progressionName}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[#949ba4]">Variation</label>
                              <select
                                value={mobileDrawerVariantFilter}
                                onChange={(event) => setMobileDrawerVariantFilter(event.target.value)}
                                className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                                style={{
                                  borderColor: "#3b3f48",
                                  backgroundColor: "#232428",
                                  color: "#f2f3f5",
                                }}
                              >
                                <option value="all">All variations</option>
                                {mobileDrawerVariantOptions.map((variant) => (
                                  <option key={`drawer-variant-${variant}`} value={variant}>{variant === "-" ? "No variation" : variant}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[#949ba4]">Weight</label>
                              <select
                                value={mobileDrawerWeightFilter}
                                onChange={(event) => setMobileDrawerWeightFilter(event.target.value as "all" | "weighted" | "bodyweight")}
                                className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                                style={{
                                  borderColor: "#3b3f48",
                                  backgroundColor: "#232428",
                                  color: "#f2f3f5",
                                }}
                              >
                                <option value="all">All loads</option>
                                <option value="weighted">Weighted</option>
                                <option value="bodyweight">Bodyweight</option>
                              </select>
                            </div>

                            <div>
                              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[#949ba4]">Reps</label>
                              <select
                                value={mobileDrawerRepsFilter}
                                onChange={(event) => setMobileDrawerRepsFilter(event.target.value as "all" | "1-5" | "6-10" | "11+")}
                                className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                                style={{
                                  borderColor: "#3b3f48",
                                  backgroundColor: "#232428",
                                  color: "#f2f3f5",
                                }}
                              >
                                <option value="all">All rep ranges</option>
                                <option value="1-5">1–5 reps</option>
                                <option value="6-10">6–10 reps</option>
                                <option value="11+">11+ reps</option>
                              </select>
                            </div>

                            <div>
                              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[#949ba4]">Sort by</label>
                              <select
                                value={mobileDrawerSort}
                                onChange={(event) => setMobileDrawerSort(event.target.value as "recent" | "oldest" | "progression-asc" | "progression-desc")}
                                className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                                style={{
                                  borderColor: "#3b3f48",
                                  backgroundColor: "#232428",
                                  color: "#f2f3f5",
                                }}
                              >
                                <option value="recent">Recent first</option>
                                <option value="oldest">Oldest first</option>
                                <option value="progression-asc">Progression ascending</option>
                                <option value="progression-desc">Progression descending</option>
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
                                className="h-11 rounded-xl border px-3 text-sm font-medium text-[#f2f3f5] transition-colors"
                                style={{ borderColor: "#3b3f48", backgroundColor: "#232428" }}
                              >
                                Reset
                              </button>
                              <button
                                type="button"
                                onClick={() => setMobileDrawerFilterOpen(false)}
                                className="h-11 rounded-xl border px-3 text-sm font-semibold text-[#08120c] transition-colors"
                                style={{ borderColor: "rgba(87, 242, 135, 0.42)", backgroundColor: "#57f287" }}
                              >
                                Done
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
                      Loading...
                    </div>
                  ) : filteredSelectedMobileExerciseLogs.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                      {selectedMobileExerciseLogs.length === 0 ? "No workout history for this exercise yet." : "No logs match your search or filters."}
                    </div>
                  ) : (
                    <>
                      {filteredSelectedMobileExerciseLogs.map((log) => {
                      const tierName = selectedMobileExercise?.tiers.find((tier) => tier.level === log.level)?.name ?? `Progression ${log.level}`;
                      const variationValue = log.variant?.trim() || "-";
                      const modValue = log.modifier?.trim() || "-";
                      const notesValue = log.notes?.trim() || "-";
                      const alignedMetricRows = getWorkoutMetricRows(log, weightUnit);
                      const openEditorField = (step: string, field: string) => {
                        const params = new URLSearchParams({ step, field });
                        router.push(`/dashboard/workout-history/input/${log.id}?${params.toString()}`);
                      };
                      const leftDetailRows = [
                        { label: "Variation:", value: variationValue, valueColor: "var(--mountain-blue-glow)", step: "details", field: "variation" },
                        { label: "Mod:", value: modValue, valueColor: "var(--gold-glow)", step: "session", field: "modifier" },
                        { label: "Notes:", value: notesValue, valueColor: "var(--text-secondary)", step: "notes", field: "notes" },
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
                                          <span style={{ color: "var(--text-muted)" }}>Weight:</span> {metric.weight}
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
                                          <span style={{ color: "var(--text-muted)" }}>Weight:</span> {metric.weight}
                                        </button>
                                      )
                                    ) : (
                                      <span aria-hidden="true" />
                                    )}
                                    {metric.reps !== "-" ? (
                                      targetUserId ? (
                                        <span className="truncate" style={{ color: "var(--forest)" }}>
                                          <span style={{ color: "var(--text-muted)" }}>Reps:</span> {metric.reps}
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
                                          <span style={{ color: "var(--text-muted)" }}>Reps:</span> {metric.reps}
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

      {!mobileExerciseDrawerExerciseId && !mobileLogFabOpen ? (
        <motion.button
          key="train-log-fab"
          type="button"
          onClick={() => setMobileLogFabOpen(true)}
          initial={{ opacity: 0, y: 18, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.92 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="fixed right-[max(env(safe-area-inset-right,0px),0.95rem)] z-[210] flex h-12 w-12 items-center justify-center rounded-2xl border backdrop-blur-sm"
          style={{
            bottom: "var(--mobile-nav-offset, calc(env(safe-area-inset-bottom,0px) + 4.85rem))",
            borderColor: "color-mix(in srgb, var(--accent) 32%, var(--ink-light))",
            backgroundColor: "color-mix(in srgb, var(--accent) 40%, var(--ink-mid))",
            color: "var(--cloud-white)",
            boxShadow: "0 8px 18px color-mix(in srgb, var(--accent) 18%, transparent)",
          }}
          aria-label="Log workout"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.9}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
        </motion.button>
      ) : null}
    </>
  );
}
