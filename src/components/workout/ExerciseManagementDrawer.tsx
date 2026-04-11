"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import ExerciseImageBox from "@/components/exercise/ExerciseImageBox";
import { getDifficultyColorClass, getDifficultyGlowStyle } from "@/lib/difficulty-styles";
import { getTypeColor } from "@/lib/constants";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { getExerciseDisplayName, getExerciseSearchText, matchesLooseSearch, getTypeDisplayName, getDifficultyDisplayName, getDifficultyColorKey, getTypeColorKey } from "@/lib/exercise-name";
import {
  DAYS_OF_WEEK,
  DAY_ABBREVIATIONS,
  DAY_LETTERS,
  parseDayAssignments,
  toggleDayAssignment,
  isDayAssigned
} from "@/lib/constants";

interface Exercise {
  id: string;
  name: string;
  wuxiaName?: string;
  difficulty: string;
  wuxiaDifficulty?: string;
  type: string;
  wuxiaType?: string;
  targetGroup?: string;
  assignedDays?: string;
  story?: string;
}

interface ExerciseManagementDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  exercises: Exercise[];
  onUpdateDayAssignments: (exerciseId: string, assignedDays: string) => Promise<void>;
  onReorderExercises?: (orderedIds: string[]) => void;
  selectedDayFilter?: number | null;
}

// --- Technique Row (redesigned: no lore, tips top-right, CultivateOS dark theme) ---

interface TechniqueRowProps {
  exercise: Exercise;
  onUpdateDayAssignments: (exerciseId: string, assignedDays: string) => Promise<void>;
  focusedDay?: number | null;
  isCompact?: boolean;
}

function TechniqueRow({ exercise, onUpdateDayAssignments, focusedDay, isCompact = false }: TechniqueRowProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const { settings } = useDisplaySettings();
  const displayName = getExerciseDisplayName(exercise, settings.terminologyMode, settings.showExerciseForeignLanguage);
  const difficultyColorClass = getDifficultyColorClass(getDifficultyColorKey(exercise));
  const typeColor = getTypeColor(getTypeColorKey(exercise));
  const glowStyle = getDifficultyGlowStyle(getDifficultyColorKey(exercise));

  const handleDayToggle = async (dayIndex: number) => {
    setIsUpdating(true);
    try {
      const newAssignments = toggleDayAssignment(exercise.assignedDays || "", dayIndex);
      await onUpdateDayAssignments(exercise.id, newAssignments);
    } catch (error) {
      console.error("Failed to update day assignments:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const assignedDayNumbers = parseDayAssignments(exercise.assignedDays || "");

  return (
    <div
      className={`relative border border-ink-light rounded-lg bg-ink-dark hover:bg-ink-dark/80 transition-all duration-200 group ${isCompact ? 'p-2.5' : 'p-4'}`}
      style={glowStyle as React.CSSProperties}
    >
      {/* Drag handle indicator */}
      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 transition-opacity pointer-events-none">
        <svg className="w-4 h-4 text-mist-dark" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
        </svg>
      </div>

      {/* Tips icon — top right corner */}
      {exercise.story && (
        <div className="absolute top-2 right-2 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); setShowTip(!showTip); }}
            className="p-1 rounded text-mist-dark hover:text-jade-glow hover:bg-jade-deep/20 transition-all duration-200"
            title="View tips"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <AnimatePresence>
            {showTip && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                className="absolute right-0 top-full mt-1 w-56 p-2.5 bg-ink-deep border border-ink-light rounded-lg shadow-xl z-20"
              >
                <p className="text-[11px] text-mist-light leading-relaxed">{exercise.story}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Main Content */}
      <div className={`flex gap-2 ${isCompact ? 'space-y-1.5' : 'space-y-3'} pl-4`}>
        <ExerciseImageBox className={isCompact ? "h-9 w-9 mt-0.5" : "h-11 w-11 mt-0.5"} compact={isCompact} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between pr-8">
            <div className={`flex-1 ${isCompact ? 'space-y-0.5' : 'space-y-1.5'}`}>
            <h4 className={`${isCompact ? 'text-xs' : 'text-sm'} font-semibold ${difficultyColorClass} group-hover:brightness-110 transition-all duration-200`}>
              {displayName}
            </h4>
            
            {/* Realm + Path badges (realm first, then path) */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded ${isCompact ? 'text-[9px]' : 'text-[10px]'} font-medium ${difficultyColorClass} border border-current/20`}>
                {getDifficultyDisplayName(exercise, settings.terminologyMode)}
              </span>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded ${isCompact ? 'text-[9px]' : 'text-[10px]'} font-medium ${typeColor} border border-current/20 opacity-80`}>
                {getTypeDisplayName(exercise, settings.terminologyMode)}
              </span>
              {exercise.targetGroup && (
                <span className={`${isCompact ? 'text-[9px]' : 'text-[10px]'} text-mist-dark`}>
                  {exercise.targetGroup}
                </span>
              )}
            </div>
          </div>
          
            {isUpdating && (
              <div className="text-xs text-jade-glow flex items-center gap-1.5">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-3 h-3 border-2 border-jade-glow border-t-transparent rounded-full"
                />
              </div>
            )}
          </div>

          {/* Day Assignment Controls */}
          <div className={`${isCompact ? 'space-y-1' : 'space-y-2'}`}>
            {!isCompact && (
              <p className="text-[10px] font-semibold text-mist-dark uppercase tracking-wider">
                Training Days
              </p>
            )}
            <div className="flex gap-1.5">
              {DAYS_OF_WEEK.map((day, index) => {
                const isAssigned = isDayAssigned(exercise.assignedDays || "", index);
                const isFocused = focusedDay === index;

                return (
                  <button
                    key={day}
                    onClick={(e) => { e.stopPropagation(); handleDayToggle(index); }}
                    disabled={isUpdating}
                    className={`
                    ${isCompact ? 'text-[10px] px-1.5 py-1' : 'text-xs px-2 py-1.5'} rounded transition-all duration-200 font-medium
                    border disabled:opacity-50 disabled:cursor-not-allowed
                    ${isAssigned
                        ? 'bg-jade-deep/60 text-jade-glow border-jade-glow/40 shadow-[0_0_6px_color-mix(in_srgb,var(--accent)_20%,transparent)]'
                        : 'bg-ink-deep text-mist-dark border-ink-light hover:border-jade/30 hover:text-mist-light'
                      }
                    ${isFocused ? 'ring-1 ring-jade-glow/50' : ''}
                  `}
                  >
                    {DAY_LETTERS[index]}
                  </button>
                );
              })}
            </div>
            {assignedDayNumbers.length > 0 && !isCompact && (
              <div className="text-[11px] text-jade-light/70">
                {assignedDayNumbers.map(d => DAY_ABBREVIATIONS[d]).join(", ")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main Drawer ---

// Long-press gated Reorder.Item wrapper
function LongPressReorderItem({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  const controls = useDragControls();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragEnabled, setDragEnabled] = useState(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      setDragEnabled(true);
      controls.start(e.nativeEvent);
    }, 400);
  }, [controls, clearTimer]);

  const handlePointerUp = useCallback(() => {
    clearTimer();
    setDragEnabled(false);
  }, [clearTimer]);

  return (
    <Reorder.Item
      value={value}
      dragListener={false}
      dragControls={controls}
      className={dragEnabled ? "cursor-grabbing" : "cursor-default"}
      animate={dragEnabled ? {
        scale: 1.02,
        boxShadow: "0 0 12px color-mix(in srgb, var(--accent) 30%, transparent), 0 0 4px color-mix(in srgb, var(--accent) 15%, transparent)",
      } : {
        scale: 1,
        boxShadow: "0 0 0 transparent",
      }}
      whileDrag={{
        scale: 1.04,
        boxShadow: "0 8px 30px color-mix(in srgb, black 40%, transparent), 0 0 15px color-mix(in srgb, var(--accent) 30%, transparent)",
        zIndex: 50,
      }}
      transition={{ duration: 0.2 }}
      onDragEnd={() => setDragEnabled(false)}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ touchAction: dragEnabled ? "none" : "auto" }}
        className={dragEnabled ? "ring-1 ring-jade-glow/40 rounded-lg" : ""}
      >
        {children}
      </div>
    </Reorder.Item>
  );
}

export default function ExerciseManagementDrawer({
  isOpen,
  onClose,
  exercises,
  onUpdateDayAssignments,
  onReorderExercises,
  selectedDayFilter = null
}: ExerciseManagementDrawerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [dayFilter, setDayFilter] = useState<number | null>(selectedDayFilter);
  const [pathFilter, setPathFilter] = useState("");
  const [realmFilter, setRealmFilter] = useState(""); 
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [isCompactView, setIsCompactView] = useState(false);

  // Dynamic filter options derived from actual exercises data
  const availableRealms = useMemo(() => {
    const seen = new Set<string>();
    for (const ex of exercises) {
      const d = (ex.difficulty || "").trim();
      if (d) seen.add(d);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [exercises]);

  const availablePaths = useMemo(() => {
    const seen = new Set<string>();
    for (const ex of exercises) {
      const t = (ex.type || "").trim();
      if (t) seen.add(t);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [exercises]);

  // Update day filter when selectedDayFilter prop changes
  useEffect(() => {
    setDayFilter(selectedDayFilter);
  }, [selectedDayFilter]);

  // Initialize ordered IDs from exercises
  useEffect(() => {
    setOrderedIds(exercises.map(e => e.id));
  }, [exercises]);

  // Enhanced filter logic
  const filteredExercises = exercises.filter((exercise) => {
    const matchesSearch = matchesLooseSearch(getExerciseSearchText(exercise), searchTerm);
    const matchesDay = dayFilter === null || isDayAssigned(exercise.assignedDays || "", dayFilter);
    const matchesPath = !pathFilter || exercise.type === pathFilter;
    const matchesRealm = !realmFilter || exercise.difficulty === realmFilter;
    return matchesSearch && matchesDay && matchesPath && matchesRealm;
  });

  // Sort filtered exercises by drag order
  const sortedFilteredExercises = [...filteredExercises].sort((a, b) => {
    const indexA = orderedIds.indexOf(a.id);
    const indexB = orderedIds.indexOf(b.id);
    return indexA - indexB;
  });

  const handleReorder = (newOrder: string[]) => {
    // Merge reordered subset back into full ordered IDs
    const filteredIdSet = new Set(filteredExercises.map(e => e.id));
    const result: string[] = [];
    let reorderIdx = 0;

    for (const id of orderedIds) {
      if (filteredIdSet.has(id)) {
        result.push(newOrder[reorderIdx]);
        reorderIdx++;
      } else {
        result.push(id);
      }
    }

    setOrderedIds(result);
    onReorderExercises?.(result);
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setDayFilter(null);
    setPathFilter("");
    setRealmFilter("");
  };

  const hasActiveFilters = searchTerm || dayFilter !== null || pathFilter || realmFilter;

  // Compute technique counts per day for badge display
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

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70"
            onClick={onClose}
          />
        
          {/* Drawer panel — CultivateOS dark theme */}
          <motion.div
            key="drawer-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-50 flex flex-col max-w-full w-full md:w-[61.8%] pt-[max(env(safe-area-inset-top,0px),12px)] pb-[max(env(safe-area-inset-bottom,0px),10px)] pr-[max(env(safe-area-inset-right,0px),0px)]"
            style={{
              background: "linear-gradient(180deg, color-mix(in srgb, var(--ink-deep) 95%, black) 0%, color-mix(in srgb, var(--ink-dark) 95%, black) 100%)",
              borderLeft: "1px solid color-mix(in srgb, var(--accent) 15%, transparent)",
              boxShadow: "-4px 0 30px color-mix(in srgb, black 50%, transparent), -2px 0 10px color-mix(in srgb, var(--accent) 8%, transparent)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — gradient treatment */}
            <div
              className="p-5 space-y-4 shrink-0"
              style={{
                background: "linear-gradient(180deg, color-mix(in srgb, var(--ink-mid) 90%, transparent) 0%, color-mix(in srgb, var(--ink-deep) 0%, transparent) 100%)",
                borderBottom: "1px solid color-mix(in srgb, var(--accent) 12%, transparent)",
              }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-jade-glow uppercase tracking-wider">
                  Manage Techniques
                </h2>
                <div className="flex items-center gap-2">
                  {/* Compact/Expanded toggle */}
                  <button
                    onClick={() => setIsCompactView(!isCompactView)}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider border transition-all duration-200 ${
                      isCompactView
                        ? "bg-jade-deep/30 border-jade-glow/40 text-jade-glow"
                        : "border-ink-light text-mist-dark hover:text-mist-light hover:border-mist-dark"
                    }`}
                    title={isCompactView ? "Switch to expanded view" : "Switch to compact view"}
                  >
                    {isCompactView ? (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                        Expand
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                        Compact
                      </span>
                    )}
                  </button>
                  <button
                    onClick={onClose}
                    className="text-mist-dark hover:text-cloud-white p-2 rounded-lg hover:bg-white/5 transition-all duration-200 hover:shadow-[0_0_8px_color-mix(in_srgb,var(--accent)_20%,transparent)]"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Search — dark themed with icon prefix and glow focus */}
              <div className="relative">
                <input
                  type="text"
                  placeholder=""
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-ink-deep border border-ink-light rounded-lg pl-10 pr-8 py-2.5 text-sm text-cloud-white placeholder:text-mist-dark outline-none transition-all duration-200 focus:border-jade-glow/50 focus:shadow-[0_0_12px_color-mix(in_srgb,var(--accent)_15%,transparent)]"
                />
                <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mist-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <circle cx="11" cy="11" r="7" />
                  <path strokeLinecap="round" d="M16.5 16.5l4 4" />
                </svg>
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold leading-none text-mist-dark transition-colors hover:text-cloud-white"
                    aria-label="Clear search"
                  >
                    x
                  </button>
                ) : null}
              </div>

              {/* Filter Controls — dynamic selects derived from actual exercise data */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={realmFilter}
                  onChange={(e) => setRealmFilter(e.target.value)}
                  className="bg-ink-deep border border-ink-light rounded-lg px-3 py-2 text-xs text-cloud-white outline-none transition-all duration-200 focus:border-jade-glow/50 focus:shadow-[0_0_8px_color-mix(in_srgb,var(--accent)_15%,transparent)] cursor-pointer"
                >
                  <option value="">All Realms</option>
                  {availableRealms.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                
                <select
                  value={pathFilter}
                  onChange={(e) => setPathFilter(e.target.value)}
                  className="bg-ink-deep border border-ink-light rounded-lg px-3 py-2 text-xs text-cloud-white outline-none transition-all duration-200 focus:border-jade-glow/50 focus:shadow-[0_0_8px_color-mix(in_srgb,var(--accent)_15%,transparent)] cursor-pointer"
                >
                  <option value="">All Paths</option>
                  {availablePaths.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Day of Week Filter — cohesive button group with count badges */}
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg overflow-hidden border border-ink-light/40 flex-1">
                  <button
                    onClick={() => setDayFilter(null)}
                    className={`
                      px-3 py-1.5 text-xs font-semibold transition-all duration-200 relative border-r border-ink-light/30
                      ${dayFilter === null 
                        ? 'bg-jade-deep/60 text-jade-glow shadow-[inset_0_0_12px_color-mix(in_srgb,var(--accent)_15%,transparent)]' 
                        : 'bg-ink-dark/60 text-mist-dark hover:text-mist-light hover:bg-ink-mid/40'
                      }
                    `}
                  >
                    All
                    {dayFilter === null && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-jade-glow rounded-full" />}
                  </button>
                  {DAYS_OF_WEEK.map((day, index) => {
                    const count = dayCounts[index];
                    const hasExercises = count > 0;
                    return (
                      <button
                        key={day}
                        onClick={() => setDayFilter(index)}
                        className={`
                          flex-1 px-2 py-1.5 text-xs font-semibold transition-all duration-200 relative flex flex-col items-center gap-0.5
                          ${index < DAYS_OF_WEEK.length - 1 ? 'border-r border-ink-light/30' : ''}
                          ${dayFilter === index 
                            ? 'bg-jade-deep/60 text-jade-glow shadow-[inset_0_0_12px_color-mix(in_srgb,var(--accent)_15%,transparent)]' 
                            : hasExercises
                              ? 'bg-ink-dark/60 text-jade-light/80 hover:text-jade-light hover:bg-ink-mid/40'
                              : 'bg-ink-dark/60 text-mist-dark hover:text-mist-light hover:bg-ink-mid/40'
                          }
                        `}
                      >
                        <span>{DAY_ABBREVIATIONS[index]}</span>
                        {hasExercises && (
                          <span className={`
                            text-[8px] leading-none rounded-full min-w-[14px] px-1 py-[1px] font-bold
                            ${dayFilter === index
                              ? 'bg-jade-glow/30 text-jade-light'
                              : 'bg-ink-light/60 text-mist-light'
                            }
                          `}>
                            {count}
                          </span>
                        )}
                        {dayFilter === index && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-jade-glow rounded-full" />}
                      </button>
                    );
                  })}
                </div>
                
                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="px-3 py-1.5 text-xs rounded-md font-medium border border-crimson/30 text-crimson-light/70 hover:text-crimson-light hover:border-crimson/50 transition-all duration-200 shrink-0"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Content — scrollable with top shadow indicator */}
            <div className="flex-1 overflow-y-auto" style={{ scrollBehavior: "smooth" }}>
              <div className="relative">
                {/* Top scroll shadow */}
                <div className="sticky top-0 z-10 h-3 bg-gradient-to-b from-ink-deep/80 to-transparent pointer-events-none" />
                
                <div className="px-5 pb-5 space-y-3">
                  {/* Info bar */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-mist-dark font-medium">
                      {dayFilter !== null 
                        ? `${DAYS_OF_WEEK[dayFilter]} Techniques`
                        : `All Techniques`
                      } — {sortedFilteredExercises.length} found
                    </span>
                    {dayFilter !== null && (
                      <span className="text-jade-glow/80 bg-jade-deep/20 px-2 py-0.5 rounded text-[10px] font-medium border border-jade-glow/10">
                        Editing {DAY_ABBREVIATIONS[dayFilter]} assignments
                      </span>
                    )}
                  </div>

                  {/* Technique List — drag-reorderable */}
                  {sortedFilteredExercises.length === 0 ? (
                    <div className="text-center text-mist-dark py-16">
                      {dayFilter !== null ? (
                        <div className="space-y-3">
                          <div className="text-4xl opacity-40">📋</div>
                          <div>
                            <p className="text-sm text-mist-light/60">No techniques assigned to {DAYS_OF_WEEK[dayFilter]}</p>
                            <p className="text-xs mt-1 text-mist-dark">Select &ldquo;All&rdquo; and assign techniques to this day</p>
                          </div>
                        </div>
                      ) : searchTerm ? (
                        <div className="space-y-3">
                          <div className="text-4xl opacity-40">🔍</div>
                          <p className="text-sm text-mist-light/60">No techniques match your search</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="text-4xl opacity-40">📜</div>
                          <p className="text-sm text-mist-light/60">No techniques available</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Reorder.Group
                      axis="y"
                      values={sortedFilteredExercises.map(e => e.id)}
                      onReorder={handleReorder}
                      className={isCompactView ? "space-y-1.5" : "space-y-3"}
                    >
                      {sortedFilteredExercises.map((exercise) => (
                        <LongPressReorderItem
                          key={exercise.id}
                          value={exercise.id}
                        >
                          <TechniqueRow
                            exercise={exercise}
                            onUpdateDayAssignments={onUpdateDayAssignments}
                            focusedDay={dayFilter}
                            isCompact={isCompactView}
                          />
                        </LongPressReorderItem>
                      ))}
                    </Reorder.Group>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              className="px-5 py-3 shrink-0"
              style={{
                background: "linear-gradient(0deg, color-mix(in srgb, var(--ink-deep) 95%, black) 0%, color-mix(in srgb, var(--ink-deep) 80%, transparent) 100%)",
                borderTop: "1px solid color-mix(in srgb, var(--accent) 10%, transparent)",
              }}
            >
              <div className="flex items-center gap-4 text-[11px] text-mist-dark">
                <span>
                  <span className="text-jade-glow/60">↕</span> Hold &amp; drag to reorder
                </span>
                <span>
                  <span className="text-jade-glow/60">ⓘ</span> Click info for tips
                </span>
                <span>
                  <span className="text-jade-glow/60">◉</span> Toggle day letters
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
