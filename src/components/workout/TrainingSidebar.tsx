"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import GlowButton from "@/components/ui/GlowButton";
import { getDifficultyColorClass, getDifficultyGlowStyleScaled } from "@/lib/difficulty-styles";
import { getTypeColor, getDifficultyColor, getDifficultyGlow, getTargetGroupColor, parseDayAssignments } from "@/lib/constants";
import { DAY_ABBREVIATIONS } from "@/lib/constants";
import { useDisplaySettings, TechniqueDisplayMode, ActiveCardStyle } from "@/context/DisplaySettingsContext";
import { useAuth } from "@/context/AuthContext";
import {
  getExerciseDisplayName,
  getExerciseNameTooltip,
  getExerciseSearchText,
  matchesLooseSearch,
  getTypeDisplayName,
  getDifficultyDisplayName,
  getDifficultyColorKey,
  getTypeColorKey,
} from "@/lib/exercise-name";

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

interface TrainingSidebarProps {
  exercises: Exercise[];
  selectedTechniques: string[];
  onSelectTechnique: (exerciseId: string) => void;
  isLoadingExercises: boolean;
  isMobile: boolean;
  onDrawerOpen: () => void;
  refreshTrigger?: number;
}

interface TechniqueCardProps {
  exercise: Exercise;
  isSelected: boolean;
  onSelect: (exerciseId: string) => void;
  delay: number;
  displayMode: TechniqueDisplayMode;
}

interface TechniqueCardExtendedProps extends TechniqueCardProps {
  compact?: boolean;
  cardStyle?: ActiveCardStyle;
}

type SidebarSortMode = "custom" | "recent" | "popular" | "name-asc";

interface WorkoutSummary {
  id: string;
  date: string;
  simplifiedExercises: {
    exercise: {
      id: string;
    };
  }[];
}

function TechniqueCard({ exercise, isSelected, onSelect, delay, displayMode, compact = false, cardStyle = "default" }: TechniqueCardExtendedProps) {
  const [showConventionalName, setShowConventionalName] = useState(false);
  const compactRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (compactRef.current && !compactRef.current.contains(e.target as Node)) {
      setShowConventionalName(false);
    }
  }, []);

  useEffect(() => {
    if (showConventionalName) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showConventionalName, handleClickOutside]);

  const difficultyColorClass = getDifficultyColorClass(getDifficultyColorKey(exercise));
  const typeColor = getTypeColor(getTypeColorKey(exercise));
  const { settings: dsSettings } = useDisplaySettings();
  const displayName = getExerciseDisplayName(exercise, dsSettings.terminologyMode);
  const exerciseTooltip = getExerciseNameTooltip(exercise, dsSettings.terminologyMode, exercise.story);
  const glowIntensity = dsSettings.glowIntensitySidebar ?? 100;
  const loreVisible = dsSettings.sidebarLoreVisible ?? true;
  const glowStyle = getDifficultyGlowStyleScaled(getDifficultyColorKey(exercise), glowIntensity);

  const showIllumination = displayMode !== "name-only";
  const showRealm = displayMode === "name-illumination-realm" || displayMode === "name-illumination-realm-path";
  const showPath = displayMode === "name-illumination-realm-path";

  const isScrollStyle = cardStyle === "scroll-card";
  const typeKey = getTypeColorKey(exercise);
  const typeEmoji =
    typeKey === "Upper Heaven" ? "☁️"
    : typeKey === "Lower Realms" ? "🔥"
    : typeKey === "Heart Meridian" ? "💚"
    : "⭐";

  if (compact) {
    return (
      <div ref={compactRef} className="relative">
        <div
          className={`
            relative flex items-center gap-2 px-2.5 py-1.5 rounded-md border cursor-pointer transition-all duration-150
            hover:brightness-110 group
            ${showConventionalName ? 'rounded-b-none' : ''}
            ${isSelected
              ? 'bg-jade-deep/30 border-jade-glow/50'
              : 'bg-ink-dark border-ink-light/60 hover:border-jade/30 hover:bg-ink-mid/40'
            }
          `}
          style={showIllumination ? glowStyle as React.CSSProperties : undefined}
          onClick={() => onSelect(exercise.id)}
          title={exerciseTooltip}
        >
          {/* Selected check */}
          {isSelected && (
            <div className="w-4 h-4 shrink-0 bg-jade-glow rounded-full flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-ink-deep" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {isScrollStyle && <span className="text-sm opacity-80 shrink-0">{typeEmoji}</span>}
          {/* Name */}
          <span className={`text-xs font-normal truncate flex-1 ${showIllumination ? difficultyColorClass : 'text-cloud-white'}`} title={displayName}>
            {displayName}
          </span>
          {dsSettings.terminologyMode === "fantasy" && exercise.name && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowConventionalName(!showConventionalName); }}
              className={`shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold transition-all duration-200 ${showConventionalName ? 'bg-jade-glow/20 text-jade-glow border border-jade-glow/40' : 'bg-ink-light/30 text-mist-dark hover:text-mist-light hover:bg-ink-light/50 border border-ink-light/40'}`}
              title={showConventionalName ? exercise.name : "Show conventional name"}
            >
              i
            </button>
          )}
          {/* Inline badges */}
          {showRealm && (
            <span className={`shrink-0 text-[9px] font-normal ${difficultyColorClass} opacity-70`}>
              {getDifficultyDisplayName(exercise, dsSettings.terminologyMode)}
            </span>
          )}
          {showPath && (
            <span className={`shrink-0 text-[9px] font-normal ${typeColor} opacity-60`}>
              {getTypeDisplayName(exercise, dsSettings.terminologyMode)}
            </span>
          )}
        </div>
        {showConventionalName && dsSettings.terminologyMode === "fantasy" && exercise.name && (
          <div
            className={`px-2.5 py-1 rounded-b-md border border-t-0 text-[9px] text-mist-mid truncate ${
              isSelected ? 'bg-jade-deep/20 border-jade-glow/50' : 'bg-ink-dark/80 border-ink-light/60'
            }`}
          >
            Conventional: {exercise.name}
          </div>
        )}
      </div>
    );
  }

  /* ═══════════════ Scroll-Card Style (expanded) ═══════════════ */
  if (isScrollStyle) {
    return (
      <motion.div
        ref={compactRef}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay }}
        className="relative"
      >
        <div
          className={`
            relative p-3 rounded-xl border cursor-pointer transition-all duration-300
            hover:scale-[1.02] hover:shadow-2xl group shadow-[0_0_12px_rgba(58,143,143,0.2)]
            ${showConventionalName ? 'rounded-b-none' : ''}
            ${isSelected
              ? 'bg-jade-deep/30 border-jade-glow/50 shadow-lg shadow-jade-glow/10'
              : `bg-ink-dark border-ink-light hover:border-jade/30 hover:shadow-[0_0_20px_rgba(58,143,143,0.4)] ${showIllumination && glowIntensity >= 100 ? getDifficultyGlow(getDifficultyColorKey(exercise)) : ''}`
            }
          `}
          style={!isSelected && showIllumination && glowIntensity > 0 && glowIntensity < 100 ? { boxShadow: `0 0 12px rgba(58,143,143,0.2), ${glowStyle.boxShadow || ''}` } : undefined}
          onClick={() => onSelect(exercise.id)}
          title={exerciseTooltip}
        >
          <div className="flex items-start gap-2.5">
            <span className="text-lg pt-0.5 opacity-80 shrink-0">{typeEmoji}</span>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className={`text-xs font-normal ${showIllumination ? difficultyColorClass : 'text-cloud-white'} truncate leading-snug tracking-wide flex-1`} title={displayName}>
                  {displayName}
                </h3>
                {dsSettings.terminologyMode === "fantasy" && exercise.name && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowConventionalName(!showConventionalName); }}
                    className={`shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold transition-all duration-200 ${showConventionalName ? 'bg-jade-glow/20 text-jade-glow border border-jade-glow/40' : 'bg-ink-light/30 text-mist-dark hover:text-mist-light hover:bg-ink-light/50 border border-ink-light/40'}`}
                    title={showConventionalName ? exercise.name : "Show conventional name"}
                  >
                    i
                  </button>
                )}
              </div>
              {(showRealm || showPath) && (
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  {showRealm && (
                    <span className={`text-[9px] font-normal px-1.5 py-0.5 rounded-full ${getDifficultyColor(getDifficultyColorKey(exercise))} bg-ink-dark/40 whitespace-nowrap border border-current/15`}>
                      {getDifficultyDisplayName(exercise, dsSettings.terminologyMode)}
                    </span>
                  )}
                  {showPath && (
                    <span className={`text-[9px] font-normal px-1.5 py-0.5 rounded-full ${getTypeColor(getTypeColorKey(exercise))} bg-ink-dark/40 whitespace-nowrap border border-current/15`}>
                      {getTypeDisplayName(exercise, dsSettings.terminologyMode)}
                    </span>
                  )}
                  {showPath && exercise.targetGroup && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${getTargetGroupColor(exercise.targetGroup)} bg-ink-dark/40 truncate border border-current/10`}>
                      {exercise.targetGroup}
                    </span>
                  )}
                </div>
              )}
              {loreVisible && showPath && exercise.story && (
                <p className="mt-1.5 text-[10px] text-mist-mid leading-relaxed line-clamp-2">
                  {exercise.story}
                </p>
              )}
            </div>
          </div>

          {/* Selected indicator */}
          {isSelected && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-jade-glow rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(58,143,143,0.5)]">
              <svg className="w-2.5 h-2.5 text-ink-deep" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
        {showConventionalName && dsSettings.terminologyMode === "fantasy" && exercise.name && (
          <div
            className={`px-3 py-1 rounded-b-xl border border-t-0 text-[9px] text-mist-mid truncate ${
              isSelected ? 'bg-jade-deep/20 border-jade-glow/50' : 'bg-ink-dark/80 border-ink-light'
            }`}
          >
            Conventional: {exercise.name}
          </div>
        )}
      </motion.div>
    );
  }

  /* ═══════════════ Default Style (expanded) ═══════════════ */
  return (
    <motion.div
      ref={compactRef}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="relative"
    >
      <div
        className={`
          relative p-2.5 rounded-lg border cursor-pointer transition-all duration-200
          hover:scale-[1.02] hover:shadow-2xl group
          ${showConventionalName ? 'rounded-b-none' : ''}
          ${isSelected 
            ? 'bg-jade-deep/30 border-jade-glow/50 shadow-lg shadow-jade-glow/10' 
            : 'bg-ink-dark border-ink-light hover:border-jade/30 hover:bg-ink-mid/40'
          }
        `}
        style={showIllumination ? glowStyle as React.CSSProperties : undefined}
        onClick={() => onSelect(exercise.id)}
        title={exerciseTooltip}
      >
        {/* Technique Name */}
        <div className="flex items-center gap-1.5">
          <div className={`text-xs font-normal ${showIllumination ? difficultyColorClass : 'text-cloud-white'} transition-all duration-200 truncate flex-1`} title={displayName}>
            {displayName}
          </div>
          {dsSettings.terminologyMode === "fantasy" && exercise.name && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowConventionalName(!showConventionalName); }}
              className={`shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold transition-all duration-200 ${showConventionalName ? 'bg-jade-glow/20 text-jade-glow border border-jade-glow/40' : 'bg-ink-light/30 text-mist-dark hover:text-mist-light hover:bg-ink-light/50 border border-ink-light/40'}`}
              title={showConventionalName ? exercise.name : "Show conventional name"}
            >
              i
            </button>
          )}
        </div>
        
        {/* Badges row */}
        {(showRealm || showPath) && (
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {showRealm && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-normal ${difficultyColorClass} border border-current/20 opacity-80`}>
                {getDifficultyDisplayName(exercise, dsSettings.terminologyMode)}
              </span>
            )}
            {showPath && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-normal ${typeColor} border border-current/20 opacity-70`}>
                {getTypeDisplayName(exercise, dsSettings.terminologyMode)}
              </span>
            )}
          </div>
        )}

        {/* Target Group */}
        {showRealm && exercise.targetGroup && (
          <div className="text-[9px] text-mist-dark mt-0.5">
            {exercise.targetGroup}
          </div>
        )}

        {/* Lore / Story */}
        {loreVisible && showPath && exercise.story && (
          <p className="text-[10px] text-mist-mid leading-relaxed line-clamp-2 mt-1">
            {exercise.story}
          </p>
        )}

        {/* Selected Indicator */}
        {isSelected && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-jade-glow rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(58,143,143,0.5)]">
            <svg className="w-2.5 h-2.5 text-ink-deep" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {/* Hover Glow Enhancement */}
        {showIllumination && glowIntensity > 0 && (
          <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            <div 
              className="absolute inset-0 rounded-lg"
              style={{
                background: `radial-gradient(circle at center, ${glowStyle?.boxShadow?.split(' ')[0] || 'rgba(59, 130, 246, 0.3)'} 0%, transparent 70%)`,
                filter: 'blur(8px)'
              }}
            />
          </div>
        )}
      </div>
      {showConventionalName && dsSettings.terminologyMode === "fantasy" && exercise.name && (
        <div
          className={`px-2.5 py-1 rounded-b-lg border border-t-0 text-[9px] text-mist-mid truncate ${
            isSelected ? 'bg-jade-deep/20 border-jade-glow/50' : 'bg-ink-dark/80 border-ink-light'
          }`}
        >
          Conventional: {exercise.name}
        </div>
      )}
    </motion.div>
  );
}

export default function TrainingSidebar({ 
  exercises, 
  selectedTechniques,
  onSelectTechnique, 
  isLoadingExercises, 
  isMobile: _isMobile,
  onDrawerOpen,
  refreshTrigger = 0,
}: TrainingSidebarProps) {
  const { user } = useAuth();
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<SidebarSortMode>("custom");
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSummary[]>([]);
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("cultivateos-sidebar-compact") === "true"; } catch { return false; }
  });
  const [filterFavourites, setFilterFavourites] = useState(false);
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());
  const { settings } = useDisplaySettings();

  // Load favourites from localStorage (shared with Technique Scroll)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cultivateos-favourite-techniques");
      if (saved) {
        const timer = window.setTimeout(() => {
          setFavouriteIds(new Set(JSON.parse(saved)));
        }, 0);
        return () => window.clearTimeout(timer);
      }
    } catch { /* ignore */ }
  }, []);

  // Persist compact state
  useEffect(() => {
    try { localStorage.setItem("cultivateos-sidebar-compact", String(isCompact)); } catch {}
  }, [isCompact]);

  useEffect(() => {
    async function fetchWorkoutHistory() {
      if (!user?.id) {
        setWorkoutHistory([]);
        return;
      }

      try {
        const response = await fetch(`/api/workouts?userId=${user.id}&showAll=true`);
        if (!response.ok) return;
        const data = await response.json();
        setWorkoutHistory(data.workouts || []);
      } catch {
        setWorkoutHistory([]);
      }
    }

    fetchWorkoutHistory();
  }, [user?.id, refreshTrigger]);

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

  const filteredExercises = exercises.filter(exercise => {
    if (filterFavourites && !favouriteIds.has(exercise.id)) return false;
    if (selectedDayFilter === null) return true;
    if (!exercise.assignedDays || exercise.assignedDays.trim() === "") return false;
    const assignedDays = exercise.assignedDays.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
    return assignedDays.includes(selectedDayFilter);
  });

  const showEmptyDayAction = selectedDayFilter !== null && filteredExercises.length === 0 && !isLoadingExercises && !filterFavourites;

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Apply search filter on top of day filter
  const searchFilteredExercises = filteredExercises.filter(exercise => {
    if (!searchQuery.trim()) return true;
    return matchesLooseSearch(getExerciseSearchText(exercise), searchQuery);
  });

  const workoutStatsByExercise = useMemo(() => {
    const stats = new Map<string, { count: number; lastTimestamp: number }>();

    for (const workout of workoutHistory) {
      const timestamp = new Date(workout.date).getTime();
      for (const item of workout.simplifiedExercises || []) {
        const exerciseId = item.exercise?.id;
        if (!exerciseId) continue;
        const prev = stats.get(exerciseId);
        if (!prev) {
          stats.set(exerciseId, { count: 1, lastTimestamp: timestamp });
          continue;
        }
        stats.set(exerciseId, {
          count: prev.count + 1,
          lastTimestamp: Math.max(prev.lastTimestamp, timestamp),
        });
      }
    }

    return stats;
  }, [workoutHistory]);

  const sortedExercises = useMemo(() => {
    const list = [...searchFilteredExercises];

    if (sortMode === "custom") {
      return list;
    }

    if (sortMode === "name-asc") {
      return list.sort((a, b) =>
        getExerciseSearchText(a).localeCompare(getExerciseSearchText(b), undefined, { sensitivity: "base" })
      );
    }

    if (sortMode === "popular") {
      return list.sort((a, b) => {
        const aCount = workoutStatsByExercise.get(a.id)?.count || 0;
        const bCount = workoutStatsByExercise.get(b.id)?.count || 0;
        if (bCount !== aCount) return bCount - aCount;
        return getExerciseSearchText(a).localeCompare(getExerciseSearchText(b), undefined, { sensitivity: "base" });
      });
    }

    return list.sort((a, b) => {
      const aLast = workoutStatsByExercise.get(a.id)?.lastTimestamp || 0;
      const bLast = workoutStatsByExercise.get(b.id)?.lastTimestamp || 0;
      if (bLast !== aLast) return bLast - aLast;
      return getExerciseSearchText(a).localeCompare(getExerciseSearchText(b), undefined, { sensitivity: "base" });
    });
  }, [searchFilteredExercises, sortMode, workoutStatsByExercise]);

  return (
    <div className="h-full flex flex-col">
      {/* Header controls row: manage + compact toggle */}
      <div className="px-2.5 pt-1 pb-1.5 shrink-0 flex items-center gap-1.5">
        {selectedDayFilter !== null && !showEmptyDayAction && (
          <GlowButton
            onClick={(e) => { e.stopPropagation(); onDrawerOpen(); }}
            variant="jade"
            size="sm"
            glow
            className="flex-1 !py-1 !text-[10px]"
          >
            ⚙ Manage
          </GlowButton>
        )}
        <button
          onClick={() => setIsCompact(!isCompact)}
          className={`ml-auto px-2 py-1 rounded-md text-[10px] font-semibold border transition-all duration-200 ${
            isCompact
              ? 'bg-jade-deep/30 border-jade-glow/40 text-jade-glow'
              : 'border-ink-light/60 text-mist-dark hover:text-mist-light hover:border-mist-dark'
          }`}
          title={isCompact ? "Expanded view" : "Compact view"}
        >
          {isCompact ? (
            <span className="flex items-center gap-1">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Expand
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
              Compact
            </span>
          )}
        </button>
      </div>

      {/* Day Filter — compact controls */}
      <div className="px-2.5 pb-2 border-b border-ink-light/30 shrink-0 space-y-1">
        {/* "All" + Favourites row */}
        <div className="flex gap-1">
          <button
            onClick={() => { setSelectedDayFilter(null); setFilterFavourites(false); }}
            className={`
              flex-1 py-1 text-[10px] font-semibold rounded-md transition-all duration-200 relative border
              ${selectedDayFilter === null && !filterFavourites
                ? 'bg-jade-deep/60 text-jade-glow border-jade-glow/40 shadow-[inset_0_0_12px_rgba(58,143,143,0.15)]'
                : 'bg-ink-dark/60 text-mist-dark border-ink-light/40 hover:text-mist-light hover:bg-ink-mid/40'
              }
            `}
          >
            All Techniques
            <span className="ml-1 text-[9px] opacity-70">({exercises.length})</span>
          </button>
          <button
            onClick={() => setFilterFavourites(!filterFavourites)}
            className={`
              px-2 py-1 text-[10px] font-semibold rounded-md transition-all duration-200 border shrink-0
              ${filterFavourites
                ? 'bg-gold-dim/20 text-gold border-gold/40 shadow-[inset_0_0_12px_rgba(212,168,67,0.15)]'
                : 'bg-ink-dark/60 text-mist-dark border-ink-light/40 hover:text-gold-dim hover:border-gold/30'
              }
            `}
            title={filterFavourites ? 'Show all techniques' : 'Show favourites only'}
          >
            {filterFavourites ? '★' : '☆'}
            {favouriteIds.size > 0 && <span className="ml-0.5 text-[8px] opacity-70">{favouriteIds.size}</span>}
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-mist-dark pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-ink-dark border border-ink-light rounded-md pl-7 pr-3 py-1 text-[11px] text-cloud-white placeholder:text-mist-dark outline-none transition-all duration-300 focus:border-jade-glow focus:shadow-[0_0_12px_rgba(58,143,143,0.3)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-mist-dark hover:text-cloud-white transition-colors"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-mist-dark shrink-0">Sort</span>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SidebarSortMode)}
            className="w-full bg-ink-dark border border-ink-light rounded-md px-2 py-1 text-[10px] text-cloud-white outline-none transition-all duration-200 focus:border-jade-glow focus:shadow-[0_0_10px_rgba(58,143,143,0.2)]"
          >
            <option value="custom">Custom order</option>
            <option value="recent">Most recent</option>
            <option value="popular">Most popular</option>
            <option value="name-asc">A-Z</option>
          </select>
        </div>

        {/* Individual day buttons row */}
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

      {/* Technique List — the only scrollable area */}
      <div className={`flex-1 overflow-y-auto px-2 py-1.5 sidebar-scroll ${isCompact ? 'space-y-0.5' : 'space-y-1.5'}`}>
        {isLoadingExercises ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-ink-dark rounded-lg animate-pulse" />
            ))}
          </div>
        ) : showEmptyDayAction ? (
          /* Empty day — prompt to use Manage drawer */
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="text-4xl opacity-40">📋</div>
            <p className="text-xs text-mist-dark text-center">
              No techniques assigned to <span className="text-mist-light font-medium">{DAY_ABBREVIATIONS[selectedDayFilter!]}</span>
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
        ) : sortedExercises.length === 0 ? (
          <div className="text-center text-mist-dark py-6">
            <p className="text-[11px]">{searchQuery ? "No matching techniques" : "No techniques found"}</p>
          </div>
        ) : (
          sortedExercises.map((exercise, index) => (
            <TechniqueCard
              key={exercise.id}
              exercise={exercise}
              isSelected={selectedTechniques.includes(exercise.id)}
              onSelect={onSelectTechnique}
              delay={isCompact ? 0 : index * 0.02}
              displayMode={settings.sidebarMode}
              compact={isCompact}
              cardStyle={settings.sidebarStyle}
            />
          ))
        )}
      </div>
    </div>
  );
}
