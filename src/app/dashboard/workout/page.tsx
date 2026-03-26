"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import PageLayout from "@/components/layout/PageLayout";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { useAppContext } from "@/context/AppContext";
import { getExerciseDisplayName } from "@/lib/exercise-name";
import { DEFAULT_USER_PHYSIQUE, loadUserPhysique } from "@/lib/user-physique";
import type { UserPhysiqueSettings } from "@/lib/user-physique";
import ExerciseManagementDrawer from "@/components/workout/ExerciseManagementDrawer";
import { MemoTrainingLogTable } from "@/components/workout/TrainingLogTable";
import { ExerciseInfoModal } from "@/components/workout/ExerciseInfoModal";
import { SetLoggerPanel } from "@/components/workout/SetLoggerPanel";
import { TrainingGroundsSidebar } from "@/components/workout/TrainingGroundsSidebar";
import { EmptyState } from "@/components/workout/TierColorLegend";
import { getTierGlowFromLogs } from "@/components/workout/TierProgressBar";
import { api } from "@/lib/api-client";

import type { ProgressionExercise, ProgressionLog, ReadyToLogQueueItem, LogTableFilter } from "./types";
import {
  stripBwPercentHint,
  createReadyToLogQueueItemId,
  formatResistanceBandLabel,
  getSelectedLevel,
  getAutoGymLevel,
  getAutoGymLevelFromSet,
  isGymCategoryExercise,
  parseCategoryTags,
  getEquipmentTags,
} from "./utils";

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
  const [filterMuscleGroup, setFilterMuscleGroup] = useState("");
  const [detailExercise, setDetailExercise] = useState<ProgressionExercise | null>(null);
  const [levelDefaults, setLevelDefaults] = useState<Record<string, number>>({});
  const [selectedTierIds, setSelectedTierIds] = useState<Record<string, string>>({});
  const [readyToLogQueueItems, setReadyToLogQueueItems] = useState<ReadyToLogQueueItem[]>([]);
  const [readyToLogQueueHydrated, setReadyToLogQueueHydrated] = useState(false);
  const [activeQueueItemId, setActiveQueueItemId] = useState<string | null>(null);
  const [selectedLogFilter, setSelectedLogFilter] = useState<LogTableFilter | null>(null);
  const [throwingQueueItemId, setThrowingQueueItemId] = useState<string | null>(null);
  const [hoveredQueueItemId, setHoveredQueueItemId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | null>(null);
  const [mobileRailOpenMenu, setMobileRailOpenMenu] = useState<"category" | "muscle" | "equipment" | null>(null);
  const [_exerciseOrder, setExerciseOrder] = useState<string[]>([]);
  const [physique, setPhysique] = useState<UserPhysiqueSettings>(DEFAULT_USER_PHYSIQUE);
  const mobileRailScrollRef = useRef<HTMLDivElement | null>(null);
  const [railHasScrolled, setRailHasScrolled] = useState(false);
  const [railCanScroll, setRailCanScroll] = useState(false);
  const [railHintDirection, setRailHintDirection] = useState<"left" | "right">("right");
  const railLastScrollLeftRef = useRef(0);
  const queuePressStartedAtRef = useRef<number>(0);
  const queuePressStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const queuePressMovedRef = useRef(false);
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
    try { sessionStorage.removeItem(draftKey); } catch { /* ignore */ }
  }, [getDraftStorageKey]);

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

  const [draftSummaryTick, setDraftSummaryTick] = useState(0);
  const draftSummaries = useMemo(() => {
    void draftSummaryTick;
    const summaries: Record<string, string | null> = {};
    for (const item of readyToLogQueueItems) {
      summaries[item.exerciseId] = getDraftSummary(item.exerciseId);
    }
    return summaries;
  }, [readyToLogQueueItems, getDraftSummary, draftSummaryTick]);

  useEffect(() => {
    if (!activeQueueItemId) setDraftSummaryTick((t) => t + 1);
  }, [activeQueueItemId]);

  useEffect(() => {
    if (!userId) { setPhysique(DEFAULT_USER_PHYSIQUE); return; }
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

  useEffect(() => {
    if (!userId) return;
    const stored = localStorage.getItem(`progression-levels-${userId}`);
    if (stored) { try { setLevelDefaults(JSON.parse(stored)); } catch { /* ignore */ } }
  }, [userId]);

  useEffect(() => {
    if (!readyToLogQueueStorageKey) {
      setReadyToLogQueueItems([]);
      setReadyToLogQueueHydrated(false);
      return;
    }
    try {
      const raw = localStorage.getItem(readyToLogQueueStorageKey);
      if (!raw) { setReadyToLogQueueItems([]); }
      else {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
          setReadyToLogQueueItems(
            parsed.filter((exerciseId): exerciseId is string => typeof exerciseId === "string")
              .map((exerciseId) => ({ id: createReadyToLogQueueItemId(), exerciseId }))
          );
        } else if (
          Array.isArray(parsed) &&
          parsed.every((item) => item && typeof item === "object" && typeof (item as ReadyToLogQueueItem).id === "string" && typeof (item as ReadyToLogQueueItem).exerciseId === "string")
        ) {
          setReadyToLogQueueItems(parsed as ReadyToLogQueueItem[]);
        } else {
          setReadyToLogQueueItems([]);
        }
      }
    } catch { setReadyToLogQueueItems([]); }
    finally { setReadyToLogQueueHydrated(true); }
  }, [readyToLogQueueStorageKey]);

  useEffect(() => {
    if (!readyToLogQueueStorageKey || !readyToLogQueueHydrated) return;
    try { localStorage.setItem(readyToLogQueueStorageKey, JSON.stringify(readyToLogQueueItems)); } catch { /* ignore */ }
  }, [readyToLogQueueStorageKey, readyToLogQueueHydrated, readyToLogQueueItems]);

  useEffect(() => {
    const el = mobileRailScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
      setRailCanScroll(maxScrollLeft > 8);
      if (el.scrollLeft > 10) setRailHasScrolled(true);

      if (maxScrollLeft <= 8) {
        setRailHintDirection("right");
        railLastScrollLeftRef.current = el.scrollLeft;
        return;
      }

      if (el.scrollLeft <= 8) {
        setRailHintDirection("right");
      } else if (el.scrollLeft >= maxScrollLeft - 8) {
        setRailHintDirection("left");
      } else {
        const previous = railLastScrollLeftRef.current;
        if (el.scrollLeft > previous + 0.5) setRailHintDirection("right");
        if (el.scrollLeft < previous - 0.5) setRailHintDirection("left");
      }
      railLastScrollLeftRef.current = el.scrollLeft;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

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
      const data = await api.get<{ exercises: ProgressionExercise[] }>("/api/progressions");
      if (data.exercises) setExercises(data.exercises);
    } catch (err) { console.error("Failed to fetch progressions:", err); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { fetchExercises(); }, [fetchExercises]);

  useEffect(() => {
    const handler = () => fetchExercises();
    window.addEventListener("progression-exercises-updated", handler);
    return () => window.removeEventListener("progression-exercises-updated", handler);
  }, [fetchExercises]);

  const addExercise = useCallback((exerciseId: string) => {
    setReadyToLogQueueItems((prev) => {
      if (prev.some((item) => item.exerciseId === exerciseId)) return prev;
      return [...prev, { id: createReadyToLogQueueItemId(), exerciseId }];
    });
  }, []);

  const selectedExerciseIds = useMemo(
    () => new Set(readyToLogQueueItems.map((item) => item.exerciseId)),
    [readyToLogQueueItems]
  );

  const toggleExercise = useCallback((exerciseId: string) => {
    const itemsToRemove = readyToLogQueueItems.filter((item) => item.exerciseId === exerciseId);
    if (itemsToRemove.length === 0) { addExercise(exerciseId); return; }
    const removedIds = new Set(itemsToRemove.map((item) => item.id));
    setReadyToLogQueueItems((prev) => prev.filter((item) => !removedIds.has(item.id)));
    for (const item of itemsToRemove) clearExerciseDraft(item.exerciseId);
    setActiveQueueItemId((prev) => (prev && removedIds.has(prev) ? null : prev));
  }, [addExercise, clearExerciseDraft, readyToLogQueueItems]);

  const dismissQueueItem = useCallback((queueItemId: string) => {
    const target = readyToLogQueueItems.find((item) => item.id === queueItemId);
    if (!target) return;
    setReadyToLogQueueItems((prev) => prev.filter((item) => item.id !== queueItemId));
    clearExerciseDraft(target.exerciseId);
    setActiveQueueItemId((prev) => (prev === queueItemId ? null : prev));
  }, [clearExerciseDraft, readyToLogQueueItems]);

  const handleUpdateDayAssignments = useCallback(async (exerciseId: string, assignedDays: string) => {
    if (!userId) return;
    const dayIndices = assignedDays ? assignedDays.split(',').map(d => parseInt(d)).filter(d => !isNaN(d)) : [];
    const { exercise } = await api.patch<{ exercise: { assignedDays: string } }>(`/api/progressions/${exerciseId}`, { assignedDays: dayIndices });
    setExercises(prev => prev.map(ex =>
      ex.id === exerciseId ? { ...ex, assignedDays: exercise.assignedDays } : ex
    ));
  }, [userId]);

  const handleReorderExercises = useCallback((orderedIds: string[]) => {
    setExerciseOrder(orderedIds);
    if (userId) localStorage.setItem(`cultivateos-progression-order-${userId}`, JSON.stringify(orderedIds));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    try {
      const stored = localStorage.getItem(`cultivateos-progression-order-${userId}`);
      if (stored) setExerciseOrder(JSON.parse(stored));
    } catch { /* ignore */ }
  }, [userId]);

  const handleDrawerOpen = useCallback(() => setIsDrawerOpen(true), []);
  const handleDrawerClose = useCallback(() => setIsDrawerOpen(false), []);

  const handleLog = async (queueItemId: string, exerciseId: string, level: number, data: {
    weight1?: number; reps1?: number;
    weight2?: number; reps2?: number;
    weight3?: number; reps3?: number;
    holdTime?: number; holdTime2?: number; holdTime3?: number; modifier?: string; resistanceBandKg?: number; variant?: string; notes?: string;
  }) => {
    if (!userId) return;
    const exercise = exercises.find((e) => e.id === exerciseId);
    const autoLevel = exercise
      ? getAutoGymLevelFromSet(exercise, physique, { weight1: data.weight1, weight2: data.weight2, weight3: data.weight3 }, data.modifier)
      : null;
    const effectiveLevel = exercise && isGymCategoryExercise(exercise) ? (autoLevel ?? level) : level;
    const { resistanceBandKg: _ignoredResistanceBand, ...logData } = data;
    await api.post(`/api/progressions/${exerciseId}/log`, { level: effectiveLevel, ...logData });
    await fetchExercises();
    dismissQueueItem(queueItemId);
  };

  const handleViewExercise = (exerciseId: string) => {
    const ex = exercises.find((e) => e.id === exerciseId);
    if (ex) setDetailExercise(ex);
  };

  const autoLevelByExerciseId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const ex of exercises) {
      const level = getAutoGymLevel(ex, physique);
      if (level != null) map[ex.id] = level;
    }
    return map;
  }, [exercises, physique]);

  const exerciseLookup = useMemo(
    () => new Map(exercises.map((exercise) => [exercise.id, exercise])),
    [exercises]
  );

  const categories = useMemo(
    () => [...new Set(exercises.flatMap((e) => parseCategoryTags(e.category)))].sort(),
    [exercises]
  );

  const types = useMemo(
    () => [...new Set(exercises.map((e) => e.type).filter((t): t is string => !!t && t.trim().length > 0))].sort(),
    [exercises]
  );

  const equipmentTypes = useMemo(
    () => [...new Set(exercises.flatMap(getEquipmentTags))].sort(),
    [exercises]
  );

  const muscleGroups = useMemo(() => {
    const tags = new Set<string>();
    for (const exercise of exercises) {
      const raw = [exercise.primaryMuscles, exercise.secondaryMuscles].filter(Boolean).join(",");
      if (!raw) continue;
      for (const token of raw.split(/[|,\/]/).map((part) => part.trim()).filter(Boolean)) {
        tags.add(token);
      }
    }
    return [...tags].sort();
  }, [exercises]);

  const selectedExercises = useMemo(
    () => readyToLogQueueItems
      .map((item) => {
        const exercise = exerciseLookup.get(item.exerciseId);
        if (!exercise) return null;
        return { queueItemId: item.id, exercise };
      })
      .filter((item): item is { queueItemId: string; exercise: ProgressionExercise } => Boolean(item)),
    [exerciseLookup, readyToLogQueueItems]
  );

  type HorizontalRailExercise = {
    exercise: ProgressionExercise;
    logs: ProgressionLog[];
    logCount: number;
    latestTs: number;
    displayName: string;
  };

  const horizontalSidebarExercises = useMemo(() => {
    const filtered = exercises.map((exercise) => {
      if (selectedExerciseIds.has(exercise.id)) return false;

      if (selectedDayFilter !== null) {
        if (!exercise.assignedDays || exercise.assignedDays.trim() === "") return false;
        const assignedDays = exercise.assignedDays
          .split(",")
          .map((d) => Number.parseInt(d.trim(), 10))
          .filter((d) => !Number.isNaN(d));
        if (!assignedDays.includes(selectedDayFilter)) return false;
      }

      const categoryTags = parseCategoryTags(exercise.category);
      const equipmentTags = getEquipmentTags(exercise);
      const muscleText = [exercise.primaryMuscles, exercise.secondaryMuscles].filter(Boolean).join(" ").toLowerCase();
      if (filterCategory && !categoryTags.includes(filterCategory)) return false;
      if (filterEquipment && !equipmentTags.includes(filterEquipment)) return false;
      if (filterMuscleGroup && !muscleText.includes(filterMuscleGroup.toLowerCase())) return false;

      if (searchTerm) {
        const normalized = searchTerm.trim().toLowerCase();
        if (normalized) {
          const fields = [exercise.name, exercise.wuxiaName, exercise.primaryMuscles, exercise.secondaryMuscles, exercise.category]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!fields.includes(normalized)) return false;
        }
      }

      const logs = exercise.userProgress?.[0]?.logs ?? [];
      const latestTs = logs.reduce((max, log) => {
          const ts = new Date(log.createdAt).getTime();
          return ts > max ? ts : max;
      }, 0);

      return {
        exercise,
        logs,
        logCount: logs.length,
        latestTs,
        displayName: stripBwPercentHint(getExerciseDisplayName(exercise, settings.terminologyMode)),
      };
    }).filter((item): item is HorizontalRailExercise => item !== false);

    return [...filtered]
      .sort((a, b) => {
        if (a.latestTs !== b.latestTs) return b.latestTs - a.latestTs;
        return b.logCount - a.logCount;
      })
      .slice(0, 30);
  }, [
    exercises,
    selectedExerciseIds,
    filterCategory,
    filterEquipment,
    filterMuscleGroup,
    searchTerm,
    selectedDayFilter,
    settings.terminologyMode,
  ]);

  const handleMobileRailWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const rail = event.currentTarget;
    if (!rail) return;
    if (rail.scrollWidth <= rail.clientWidth) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const useHorizontalDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const delta = useHorizontalDelta ? event.deltaX : event.deltaY;
    if (delta === 0) return;

    rail.scrollLeft += delta;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleRailHintClick = useCallback(() => {
    const rail = mobileRailScrollRef.current;
    if (!rail) return;
    const delta = railHintDirection === "right" ? 168 : -168;
    rail.scrollBy({ left: delta, behavior: "smooth" });
  }, [railHintDirection]);

  const loggerTargetQueueItemId = activeQueueItemId;
  const activeLoggerQueueItem = loggerTargetQueueItemId
    ? readyToLogQueueItems.find((item) => item.id === loggerTargetQueueItemId) ?? null
    : null;
  const activeLoggerExercise = activeLoggerQueueItem
    ? exerciseLookup.get(activeLoggerQueueItem.exerciseId) ?? null
    : null;

  useEffect(() => {
    if (activeQueueItemId && !readyToLogQueueItems.some((item) => item.id === activeQueueItemId)) {
      setActiveQueueItemId(null);
    }
  }, [activeQueueItemId, readyToLogQueueItems]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (activeQueueItemId) { event.preventDefault(); setActiveQueueItemId(null); loggerHistoryArmedRef.current = false; return; }
      if (!selectedLogFilter) return;
      event.preventDefault(); setSelectedLogFilter(null); filterHistoryArmedRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeQueueItemId, selectedLogFilter]);

  useEffect(() => {
    if (!activeQueueItemId) { loggerHistoryArmedRef.current = false; return; }
    if (loggerHistoryArmedRef.current) return;
    try { window.history.pushState({ workoutLogger: true, at: Date.now() }, "", window.location.href); loggerHistoryArmedRef.current = true; } catch { /* ignore */ }
  }, [activeQueueItemId]);

  useEffect(() => {
    if (!selectedLogFilter) { filterHistoryArmedRef.current = false; return; }
    if (filterHistoryArmedRef.current) return;
    try { window.history.pushState({ workoutTableFilter: true, at: Date.now() }, "", window.location.href); filterHistoryArmedRef.current = true; } catch { /* ignore */ }
  }, [selectedLogFilter]);

  useEffect(() => {
    const onPopState = () => {
      if (activeQueueItemId) { setActiveQueueItemId(null); loggerHistoryArmedRef.current = false; return; }
      if (!selectedLogFilter) return;
      setSelectedLogFilter(null); filterHistoryArmedRef.current = false;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [activeQueueItemId, selectedLogFilter]);

  useEffect(() => {
    const onBackButton = (event: Event) => {
      if (!activeQueueItemId && !selectedLogFilter) return;
      if (typeof (event as { preventDefault?: () => void }).preventDefault === "function") {
        (event as { preventDefault: () => void }).preventDefault();
      }
      if (activeQueueItemId) { setActiveQueueItemId(null); loggerHistoryArmedRef.current = false; return; }
      setSelectedLogFilter(null); filterHistoryArmedRef.current = false;
    };
    // Retained for compatibility with environments dispatching custom backbutton events.
    document.addEventListener("backbutton", onBackButton as EventListener);
    return () => document.removeEventListener("backbutton", onBackButton as EventListener);
  }, [activeQueueItemId, selectedLogFilter]);

  // ── Render ──

  const sidebar = (
    <TrainingGroundsSidebar
      exercises={exercises}
      selectedIds={selectedExerciseIds}
      onToggleExercise={toggleExercise}
      onAddExercise={addExercise}
      onSelectWithLevel={(exerciseId, level, tierId) => {
        if (!selectedExerciseIds.has(exerciseId)) addExercise(exerciseId);
        if (tierId) setSelectedTierIds((prev) => ({ ...prev, [exerciseId]: tierId }));
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
      <PageLayout sidebar={sidebar} title="Training Grounds" subtitle="Record your cultivation sessions" mobileContentPaddingClass="p-2 pb-24">
        <div className="flex items-center justify-center py-20">
          <p className="text-mist-mid text-sm animate-pulse">Loading exercises…</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout sidebar={sidebar} title="Training Grounds" subtitle="Record your cultivation sessions" mobileContentPaddingClass="p-2 pb-24">
      {exercises.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="px-0 py-2 sm:py-3 space-y-3 sm:space-y-4">
          {isMobile && (
            <section className="-mx-1 px-1">
              <div
                className="rounded-2xl border border-jade-glow/35 backdrop-blur-sm px-2.5 py-2 shadow-[var(--shadow-elev-1)]"
                style={{ background: "var(--surface-gradient-strong)" }}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-gold">Training Grounds</h3>
                    <p className="mt-0.5 text-[10px] text-mist-dark">Quick add lane for mobile logging</p>
                  </div>
                </div>

                <div className="mb-2 flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder=""
                      className="h-9 w-full rounded-lg border border-jade-glow/30 bg-ink-dark/70 pl-3 pr-8 text-[12px] text-cloud-white placeholder:text-mist-dark outline-none transition-colors focus:border-jade-glow/60"
                    />
                    <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-mist-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <circle cx="11" cy="11" r="7" />
                      <path strokeLinecap="round" d="M16.5 16.5l4 4" />
                    </svg>
                  </div>
                </div>

                <div
                  onWheelCapture={handleMobileRailWheel}
                  onWheel={handleMobileRailWheel}
                  className="mb-2 grid grid-cols-3 gap-2"
                >
                    <div className="relative min-w-0">
                      <button
                        type="button"
                        onClick={() => setMobileRailOpenMenu((prev) => (prev === "category" ? null : "category"))}
                        className="flex h-9 w-full items-center justify-between rounded-lg border border-ink-light/45 bg-ink-dark/70 px-3 text-left text-[12px] font-medium text-cloud-white"
                      >
                        <span className="truncate">{filterCategory || "All Categories"}</span>
                        <span className="ml-2 text-mist-dark">▾</span>
                      </button>
                      {mobileRailOpenMenu === "category" && (
                        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-44 overflow-y-auto rounded-lg border border-jade-glow/35 bg-ink-deep/95 p-1 shadow-[var(--shadow-elev-2)]">
                          <button type="button" onClick={() => { setFilterCategory(""); setMobileRailOpenMenu(null); }} className="mb-1 block w-full rounded-md px-2 py-2 text-left text-[12px] text-cloud-white hover:bg-ink-mid/60">All Categories</button>
                          {categories.map((category) => (
                            <button key={category} type="button" onClick={() => { setFilterCategory(category); setMobileRailOpenMenu(null); }} className="mb-1 block w-full rounded-md px-2 py-2 text-left text-[12px] text-cloud-white hover:bg-ink-mid/60">{category}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="relative min-w-0">
                      <button
                        type="button"
                        onClick={() => setMobileRailOpenMenu((prev) => (prev === "muscle" ? null : "muscle"))}
                        className="flex h-9 w-full items-center justify-between rounded-lg border border-ink-light/45 bg-ink-dark/70 px-3 text-left text-[12px] font-medium text-cloud-white"
                      >
                        <span className="truncate">{filterMuscleGroup || "Muscle Group"}</span>
                        <span className="ml-2 text-mist-dark">▾</span>
                      </button>
                      {mobileRailOpenMenu === "muscle" && (
                        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-44 overflow-y-auto rounded-lg border border-jade-glow/35 bg-ink-deep/95 p-1 shadow-[var(--shadow-elev-2)]">
                          <button type="button" onClick={() => { setFilterMuscleGroup(""); setMobileRailOpenMenu(null); }} className="mb-1 block w-full rounded-md px-2 py-2 text-left text-[12px] text-cloud-white hover:bg-ink-mid/60">All Muscle Groups</button>
                          {muscleGroups.map((muscle) => (
                            <button key={muscle} type="button" onClick={() => { setFilterMuscleGroup(muscle); setMobileRailOpenMenu(null); }} className="mb-1 block w-full rounded-md px-2 py-2 text-left text-[12px] text-cloud-white hover:bg-ink-mid/60">{muscle}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="relative min-w-0">
                      <button
                        type="button"
                        onClick={() => setMobileRailOpenMenu((prev) => (prev === "equipment" ? null : "equipment"))}
                        className="flex h-9 w-full items-center justify-between rounded-lg border border-ink-light/45 bg-ink-dark/70 px-3 text-left text-[12px] font-medium text-cloud-white"
                      >
                        <span className="truncate">{filterEquipment || "All Equipment"}</span>
                        <span className="ml-2 text-mist-dark">▾</span>
                      </button>
                      {mobileRailOpenMenu === "equipment" && (
                        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-44 overflow-y-auto rounded-lg border border-jade-glow/35 bg-ink-deep/95 p-1 shadow-[var(--shadow-elev-2)]">
                          <button type="button" onClick={() => { setFilterEquipment(""); setMobileRailOpenMenu(null); }} className="mb-1 block w-full rounded-md px-2 py-2 text-left text-[12px] text-cloud-white hover:bg-ink-mid/60">All Equipment</button>
                          {equipmentTypes.map((equipment) => (
                            <button key={equipment} type="button" onClick={() => { setFilterEquipment(equipment); setMobileRailOpenMenu(null); }} className="mb-1 block w-full rounded-md px-2 py-2 text-left text-[12px] text-cloud-white hover:bg-ink-mid/60">{equipment}</button>
                          ))}
                        </div>
                      )}
                    </div>
                </div>

                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-ink-deep/95 to-transparent" />
                  <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-ink-deep/95 via-ink-deep/60 to-transparent" />
                  {railCanScroll && (
                    <button
                      type="button"
                      onClick={handleRailHintClick}
                      aria-label={railHintDirection === "right" ? "Scroll carousel right" : "Scroll carousel left"}
                      className={`absolute inset-y-0 z-20 flex items-center px-1.5 transition-opacity duration-150 ${railHintDirection === "right" ? "right-1" : "left-1"} ${railHasScrolled ? "opacity-70" : "opacity-100"}`}
                    >
                      <svg
                        className="h-5 w-5 text-mist-light/70 animate-[swipe-hint_1.2s_ease-in-out_infinite]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                      >
                        {railHintDirection === "right"
                          ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          : <path strokeLinecap="round" strokeLinejoin="round" d="M15 5l-7 7 7 7" />
                        }
                      </svg>
                    </button>
                  )}

                  <div
                    ref={mobileRailScrollRef}
                    onWheelCapture={handleMobileRailWheel}
                    onWheel={handleMobileRailWheel}
                    className="overflow-x-auto scrollbar-hide pb-1.5 scroll-smooth"
                    style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", touchAction: "pan-x" }}
                  >
                    <div className="flex min-w-max gap-2 px-1.5 snap-x snap-mandatory [scroll-padding-inline:.5rem]">
                    {horizontalSidebarExercises.map((item) => {
                      const { exercise, logs, logCount, latestTs, displayName } = item;
                      const latestLabel = latestTs ? `${Math.max(1, Math.floor((Date.now() - latestTs) / 86400000))}d ago` : "No logs";

                      return (
                        <button
                          key={exercise.id}
                          type="button"
                          onClick={() => addExercise(exercise.id)}
                          className="snap-start min-w-[148px] max-w-[148px] rounded-xl border border-ink-light/40 bg-gradient-to-br from-ink-mid/88 via-ink-dark/94 to-ink-deep px-2 py-2 text-left transition-all duration-200 active:scale-[0.985] hover:border-jade-glow/40"
                        >
                          <div className="mb-2 h-14 rounded-lg border border-jade-glow/25 bg-gradient-to-r from-ink-mid/60 via-jade-deep/20 to-ink-mid/60" />
                          <div className="truncate text-[12px] font-semibold text-cloud-white">
                            {displayName}
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-mist-dark">
                            <span>{logCount} logs</span>
                            <span>{latestLabel}</span>
                          </div>
                        </button>
                      );
                    })}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {selectedExercises.length > 0 && (
            <section
              className="space-y-2 rounded-xl border border-jade-glow/25 backdrop-blur-sm px-2 py-1.5 shadow-[var(--shadow-elev-1)]"
              style={{ background: "var(--surface-gradient-strong)" }}
            >
              <div className="flex items-center justify-between gap-2 px-0">
                <div className="min-w-0">
                  <h3 className="text-xs text-mist-light uppercase tracking-wider">Ready To Log</h3>
                  <p className="mt-0.5 text-[10px] text-mist-dark">Tap a banner to open the logger popup.</p>
                </div>
                <button
                  onClick={() => {
                    for (const queuedItem of readyToLogQueueItems) clearExerciseDraft(queuedItem.exerciseId);
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
                  const isRowHovered = hoveredQueueItemId === queueItemId;
                  const level = getSelectedLevel(exercise, levelDefaults, autoLevelByExerciseId);
                  const queueFilterLevel = isGymCategoryExercise(exercise) ? null : level;
                  const isFilterActiveForRow =
                    selectedLogFilter?.exerciseId === exercise.id &&
                    selectedLogFilter?.levelNameLevel === queueFilterLevel;
                  const isRowHighlighted = isActiveLogger || isFilterActiveForRow || isRowHovered;
                  const rowTierGlow = getTierGlowFromLogs(exercise, physique.bodyWeightKg);
                  const difficultyStyle = { glowColor: rowTierGlow.glowColor, glowShadow: `0 0 8px ${rowTierGlow.glowColor}30, inset 0 0 8px ${rowTierGlow.glowColor}10` };
                  const conventionalDifficulty = rowTierGlow.tierName;
                  const displayName = stripBwPercentHint(getExerciseDisplayName(exercise, settings.terminologyMode));
                  const altName = settings.terminologyMode === "fantasy"
                    ? stripBwPercentHint(exercise.name || "")
                    : stripBwPercentHint(exercise.wuxiaName || "");
                  const showAltName = !!altName && altName !== displayName;
                  const draftSummary = draftSummaries[exercise.id];
                  const openLogger = () => setActiveQueueItemId(queueItemId);
                  return (
                    <div key={queueItemId} className="relative mb-1 overflow-hidden rounded-md">
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex w-28 items-center justify-center border-l border-crimson/40 bg-crimson-deep/35 text-[10px] font-semibold tracking-wide text-crimson-light">
                        Swipe left to remove
                      </div>
                      <motion.div
                        drag="x"
                        dragDirectionLock
                        dragConstraints={{ left: -320, right: 0 }}
                        dragElastic={0.05}
                        dragMomentum
                        dragTransition={{ power: 0.5, timeConstant: 180, modifyTarget: (target) => Math.min(0, target) }}
                        animate={throwingQueueItemId === queueItemId ? { x: -260, opacity: 0.2, scale: 0.98 } : { x: 0, opacity: 1, scale: 1 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                        dragListener={throwingQueueItemId !== queueItemId}
                        onDragEnd={(_, info) => {
                          if (throwingQueueItemId === queueItemId) return;
                          if (info.offset.x < -72 || info.velocity.x < -520) {
                            setThrowingQueueItemId(queueItemId);
                            window.setTimeout(() => {
                              dismissQueueItem(queueItemId);
                              setThrowingQueueItemId((prev) => (prev === queueItemId ? null : prev));
                            }, 150);
                          }
                        }}
                        className="relative flex items-center gap-2 rounded-md border px-2.5 py-2 cursor-pointer transform-gpu transition-[filter] duration-100 ease-out"
                        onMouseEnter={() => setHoveredQueueItemId(queueItemId)}
                        onMouseLeave={() => setHoveredQueueItemId((current) => (current === queueItemId ? null : current))}
                        onPointerDown={(event) => {
                          queuePressStartedAtRef.current = Date.now();
                          queuePressStartPointRef.current = { x: event.clientX, y: event.clientY };
                          queuePressMovedRef.current = false;
                        }}
                        onPointerMove={(event) => {
                          if (!queuePressStartPointRef.current) return;
                          const dx = Math.abs(event.clientX - queuePressStartPointRef.current.x);
                          const dy = Math.abs(event.clientY - queuePressStartPointRef.current.y);
                          if (dx > 8 || dy > 8) {
                            queuePressMovedRef.current = true;
                          }
                        }}
                        onPointerUp={(event) => {
                          if (throwingQueueItemId === queueItemId) return;
                          if (event.target instanceof Element && event.target.closest("button")) return;
                          const heldMs = Date.now() - queuePressStartedAtRef.current;
                          const isQuickTap = heldMs < 220 && !queuePressMovedRef.current;
                          if (isQuickTap) {
                            openLogger();
                          }
                          queuePressStartPointRef.current = null;
                          queuePressMovedRef.current = false;
                        }}
                        onPointerCancel={() => {
                          queuePressStartPointRef.current = null;
                          queuePressMovedRef.current = false;
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openLogger(); } }}
                        style={{
                          borderColor: difficultyStyle.glowColor,
                          boxShadow: isRowHighlighted
                            ? `${difficultyStyle.glowShadow}, 0 0 14px ${difficultyStyle.glowColor}, inset 0 0 0 1px ${difficultyStyle.glowColor}`
                            : `${difficultyStyle.glowShadow}, inset 0 0 0 1px ${difficultyStyle.glowColor}`,
                          background: isRowHighlighted
                            ? `linear-gradient(120deg, color-mix(in srgb, ${difficultyStyle.glowColor} 18%, var(--ink-mid)) 0%, color-mix(in srgb, ${difficultyStyle.glowColor} 8%, var(--ink-dark)) 100%)`
                            : `linear-gradient(120deg, color-mix(in srgb, ${difficultyStyle.glowColor} 10%, var(--ink-dark)) 0%, color-mix(in srgb, ${difficultyStyle.glowColor} 4%, var(--ink-deep)) 100%)`,
                          touchAction: "pan-y",
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
                          const sections = draftSummary.split(" · ");
                          const setSection = sections[0];
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
                            const nextFilter: LogTableFilter = { exerciseId: exercise.id, levelNameLevel: queueFilterLevel };
                            const isSameFilter = selectedLogFilter?.exerciseId === nextFilter.exerciseId && selectedLogFilter?.levelNameLevel === nextFilter.levelNameLevel;
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
                      </div>
                      </motion.div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="space-y-3 -mx-1 px-1 sm:mx-0 sm:px-0">
            <div className="mx-0">
              <MemoTrainingLogTable
                exercises={exercises}
                physique={physique}
                selectedLogFilter={selectedLogFilter}
                onSelectExercise={setSelectedLogFilter}
                onRefresh={fetchExercises}
                userId={userId || ''}
              />
            </div>
          </section>
        </div>
      )}

      <ExerciseInfoModal
        exercise={detailExercise}
        isOpen={detailExercise !== null}
        onClose={() => setDetailExercise(null)}
      />
      <ExerciseManagementDrawer
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

      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {activeLoggerExercise && activeLoggerQueueItem && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                className="fixed inset-0 z-[70] overflow-hidden antialiased [text-rendering:optimizeLegibility]"
                style={{ WebkitOverflowScrolling: "touch", WebkitFontSmoothing: "antialiased" }}
                aria-modal="true"
                role="dialog"
              >
                <div
                  className={isMobile
                    ? "h-[100dvh] w-full overflow-y-auto overscroll-contain bg-[var(--background)]"
                    : "h-full w-full overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_top,_color-mix(in_srgb,_var(--jade-glow)_16%,_transparent),_transparent_44%),_#0009] backdrop-blur-[4px] p-3 sm:p-8"
                  }
                >
                  <div className={isMobile ? "w-full" : "mx-auto w-full max-w-[980px]"}>
                    <SetLoggerPanel
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

