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
import TechniqueManagementDrawer from "@/components/workout/TechniqueManagementDrawer";
import { MemoUnifiedTrainingLogTable } from "@/components/workout/UnifiedTrainingLogTable";
import { ExerciseDetailModal } from "@/components/workout/ExerciseDetailModal";
import { InlineLogForm } from "@/components/workout/InlineLogForm";
import { ProgressionSidebar } from "@/components/workout/ProgressionSidebar";
import { CultivationColorGuide, EmptyState } from "@/components/workout/CultivationColorGuide";
import { getTierGlowFromLogs } from "@/components/workout/TierProgressBar";
import { api } from "@/lib/api-client";

import type { ProgressionExercise, ReadyToLogQueueItem, LogTableFilter, WeightStandardsMap } from "./types";
import type { WeightStandardRecord } from "@/lib/weight-standards";
import {
  stripBwPercentHint,
  createReadyToLogQueueItemId,
  formatResistanceBandLabel,
  getSelectedLevel,
  getWeightedDifficulty,
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

  const [weightStandards, setWeightStandards] = useState<WeightStandardsMap>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<{ standards: WeightStandardRecord[] }>("/api/weight-standards");
        if (cancelled) return;
        const map: WeightStandardsMap = {};
        for (const item of data.standards ?? []) {
          if (!map[item.exerciseId]) map[item.exerciseId] = { male: null, female: null };
          if (item.gender === "MALE") map[item.exerciseId].male = item;
          else if (item.gender === "FEMALE") map[item.exerciseId].female = item;
        }
        setWeightStandards(map);
      } catch { /* fall back to hardcoded */ }
    })();
    return () => { cancelled = true; };
  }, []);

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
      ? getAutoGymLevelFromSet(exercise, physique, { weight1: data.weight1, weight2: data.weight2, weight3: data.weight3 }, data.modifier, weightStandards)
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
      const level = getAutoGymLevel(ex, physique, weightStandards);
      if (level != null) map[ex.id] = level;
    }
    return map;
  }, [exercises, physique, weightStandards]);

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
    document.addEventListener("backbutton", onBackButton as EventListener);
    return () => document.removeEventListener("backbutton", onBackButton as EventListener);
  }, [activeQueueItemId, selectedLogFilter]);

  useEffect(() => {
    let handle: { remove: () => Promise<void> } | null = null;
    let cancelled = false;
    const register = async () => {
      try {
        const mod = await import("@capacitor/app");
        if (cancelled) return;
        const result = await mod.App.addListener("backButton", () => {
          if (activeQueueItemId) { setActiveQueueItemId(null); loggerHistoryArmedRef.current = false; return; }
          if (selectedLogFilter) { setSelectedLogFilter(null); filterHistoryArmedRef.current = false; }
        });
        if (cancelled) { void result.remove(); return; }
        handle = result;
      } catch { /* Capacitor App plugin unavailable outside native runtime */ }
    };
    void register();
    return () => { cancelled = true; if (!handle) return; void handle.remove(); };
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
          {selectedExercises.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-1 sm:px-0">
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
                  const level = getSelectedLevel(exercise, levelDefaults, autoLevelByExerciseId);
                  const queueFilterLevel = isGymCategoryExercise(exercise) ? null : level;
                  const isFilterActiveForRow =
                    selectedLogFilter?.exerciseId === exercise.id &&
                    selectedLogFilter?.levelNameLevel === queueFilterLevel;
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
                    <div
                      key={queueItemId}
                      className={`relative mb-1 flex items-center gap-2 rounded-md border px-2.5 py-2 cursor-pointer transform-gpu transition-[transform,background-color] duration-75 ease-out hover:-translate-y-0.5 ${
                        isActiveLogger ? "bg-ink-mid/45" : "bg-ink-dark/45 hover:bg-ink-mid/35"
                      }`}
                      onClick={openLogger}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openLogger(); } }}
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
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); dismissQueueItem(queueItemId); }}
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
            <div className="-mx-2 sm:mx-0">
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

      <ExerciseDetailModal
        exercise={detailExercise}
        isOpen={detailExercise !== null}
        onClose={() => setDetailExercise(null)}
      />

      <CultivationColorGuide isOpen={showColorGuide} onClose={() => setShowColorGuide(false)} />

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

