"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo, useRef } from "react";
import type { ProgressionExercise } from "@/app/dashboard/workout/types";
import {
  parseCategoryTags,
  getEquipmentTags,
  isGymCategoryExercise,
  getWeightedDifficulty,
} from "@/app/dashboard/workout/utils";
import { EquipmentBadges } from "@/components/workout/EquipmentBadges";
import { getTierGlowFromLogs } from "@/components/workout/TierProgressBar";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { useAppContext } from "@/context/AppContext";
import GlowButton from "@/components/ui/GlowButton";
import { getTypeColor, DAY_ABBREVIATIONS, parseDayAssignments } from "@/lib/constants";
import { getExerciseDisplayName, matchesLooseSearchInFields, getTypeDisplayName, getTypeColorKey } from "@/lib/exercise-name";

export function ProgressionSidebar({
  exercises,
  selectedIds,
  onToggleExercise,
  onAddExercise,
  onSelectWithLevel,
  selectedTierIds,
  searchTerm,
  onSearch,
  filterCategory,
  setFilterCategory,
  filterType,
  setFilterType,
  filterEquipment,
  setFilterEquipment,
  categories,
  types,
  equipmentTypes,
  levelDefaults,
  autoLevelByExerciseId,
  selectedDayFilter,
  setSelectedDayFilter,
  onDrawerOpen,
  userBodyweightKg,
}: {
  exercises: ProgressionExercise[];
  selectedIds: Set<string>;
  onToggleExercise: (id: string) => void;
  onAddExercise: (id: string) => void;
  onSelectWithLevel: (exerciseId: string, level: number, tierId?: string) => void;
  selectedTierIds: Record<string, string>;
  searchTerm: string;
  onSearch: (term: string) => void;
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  filterEquipment: string;
  setFilterEquipment: (v: string) => void;
  categories: string[];
  types: string[];
  equipmentTypes: string[];
  levelDefaults: Record<string, number>;
  autoLevelByExerciseId: Record<string, number>;
  selectedDayFilter: number | null;
  setSelectedDayFilter: (v: number | null) => void;
  onDrawerOpen: () => void;
  userBodyweightKg: number | null;
}) {
  const { isMobile } = useAppContext();
  const { settings } = useDisplaySettings();
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved = localStorage.getItem("cultivateos-progression-sidebar-compact");
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try { localStorage.setItem("cultivateos-progression-sidebar-compact", String(isCompact)); } catch {}
  }, [isCompact]);

  const sidebarMountedRef = useRef(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => { sidebarMountedRef.current = true; });
    return () => cancelAnimationFrame(id);
  }, []);

  const [sortMode, setSortMode] = useState<string>(() => {
    if (typeof window === "undefined") return "a-z";
    try { return localStorage.getItem("cultivateos-progression-sidebar-sort") || "a-z"; } catch { return "a-z"; }
  });

  useEffect(() => {
    try { localStorage.setItem("cultivateos-progression-sidebar-sort", sortMode); } catch {}
  }, [sortMode]);

  const displayMode = settings.progressionSidebarMode ?? "name-illumination-realm";
  const cardStyle = settings.progressionSidebarStyle ?? "default";
  const glowIntensity = settings.glowIntensityProgressionSidebar ?? 100;
  const loreVisible = settings.progressionSidebarLoreVisible ?? true;

  const hiddenSidebarExerciseNames = new Set([
    "dumbbell bicep curl",
    "leg curl",
    "leg extension",
    "seated cable row",
  ]);

  const showIllumination = displayMode !== "name-only";
  const useThemeColor = settings.progressionSidebarUseThemeColor ?? false;
  const showRealm = displayMode === "name-illumination-realm" || displayMode === "name-illumination-realm-path";
  const showPath = displayMode === "name-illumination-realm-path";
  const isScrollStyle = cardStyle === "scroll-card";

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

  const [disciplineFilter, setDisciplineFilter] = useState<"all" | "gym" | "calisthenics" | "recent">("all");

  const filtered = exercises.filter((e) => {
    if (hiddenSidebarExerciseNames.has(String(e.name || "").trim().toLowerCase())) {
      return false;
    }

    if (disciplineFilter === "gym" && !isGymCategoryExercise(e)) return false;
    if (disciplineFilter === "calisthenics" && isGymCategoryExercise(e)) return false;
    if (disciplineFilter === "recent" && (e.userProgress[0]?.logs?.length ?? 0) === 0) return false;

    if (selectedDayFilter !== null) {
      if (!e.assignedDays || e.assignedDays.trim() === "") return false;
      const assignedDays = e.assignedDays.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
      if (!assignedDays.includes(selectedDayFilter)) return false;
    }
    if (filterCategory) {
      const tags = parseCategoryTags(e.category);
      if (!tags.includes(filterCategory)) return false;
    }
    if (filterType && e.type !== filterType) return false;
    if (filterEquipment) {
      const tags = getEquipmentTags(e);
      if (!tags.includes(filterEquipment)) return false;
    }
    if (searchTerm) {
      return matchesLooseSearchInFields(searchTerm, [
        e.name,
        e.wuxiaName,
        e.primaryMuscles,
        e.secondaryMuscles,
        e.category,
      ]);
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const nameA = getExerciseDisplayName(a, settings.terminologyMode);
    const nameB = getExerciseDisplayName(b, settings.terminologyMode);
    switch (sortMode) {
      case "a-z":
        return nameA.localeCompare(nameB);
      case "z-a":
        return nameB.localeCompare(nameA);
      case "recent": {
        const aLatest = a.userProgress[0]?.logs?.reduce((max, l) => {
          const t = new Date(l.createdAt).getTime();
          return t > max ? t : max;
        }, 0) ?? 0;
        const bLatest = b.userProgress[0]?.logs?.reduce((max, l) => {
          const t = new Date(l.createdAt).getTime();
          return t > max ? t : max;
        }, 0) ?? 0;
        return bLatest - aLatest;
      }
      case "most-logged": {
        const aCount = a.userProgress[0]?.logs?.length ?? 0;
        const bCount = b.userProgress[0]?.logs?.length ?? 0;
        return bCount - aCount;
      }
      case "selected": {
        const aS = selectedIds.has(a.id) ? 0 : 1;
        const bS = selectedIds.has(b.id) ? 0 : 1;
        if (aS !== bS) return aS - bS;
        return nameA.localeCompare(nameB);
      }
      default:
        return 0;
    }
  });

  const [showFilters, setShowFilters] = useState(false);

  const activeFiltersCount = (filterCategory ? 1 : 0) + (filterType ? 1 : 0) + (filterEquipment ? 1 : 0);
  const searchQuery = searchTerm.trim();
  const isSearchActive = searchQuery.length > 0;

  const searchGroupedByCategory = useMemo(() => {
    if (!isSearchActive) return null;
    const groups: { category: string; exercises: typeof sorted }[] = [];
    const categoryMap = new Map<string, typeof sorted>();
    for (const ex of sorted) {
      const cats = parseCategoryTags(ex.category);
      const categoryKey = cats.length > 0 ? cats[0] : "Uncategorised";
      if (!categoryMap.has(categoryKey)) categoryMap.set(categoryKey, []);
      categoryMap.get(categoryKey)!.push(ex);
    }
    for (const [category, exercises] of categoryMap) {
      groups.push({ category, exercises });
    }
    return groups;
  }, [isSearchActive, sorted]);

  const sortOptions = [
    { key: "a-z", label: "A–Z", icon: "↕" },
    { key: "z-a", label: "Z–A", icon: "↕" },
    { key: "recent", label: "Recent", icon: "◷" },
    { key: "most-logged", label: "Most Logged", icon: "▤" },
    { key: "selected", label: "Selected", icon: "✦" },
  ] as const;

  const compactEnabled = !isMobile && isCompact;
  const chipTextClass = isMobile ? "text-xs" : "text-[10px]";
  const labelTextClass = isMobile ? "text-[10px]" : "text-[9px]";

  return (
    <div className="h-full flex flex-col">
      {/* ── Toolbar ── */}
      <div className="px-3 pt-3 pb-2.5 shrink-0 space-y-2.5">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-mist-dark pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search exercises..."
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
            className={`w-full bg-ink-dark/80 border border-ink-light/50 rounded-lg pl-8 pr-8 ${isMobile ? "py-2.5 text-sm" : "py-1.5 text-[11px]"} text-cloud-white placeholder:text-mist-dark/70 outline-none transition-all duration-200 focus:border-jade-glow/60 focus:bg-ink-dark`}
          />
          {searchTerm && (
            <button
              onClick={() => onSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mist-dark hover:text-cloud-white transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Day Filter */}
        <div className="space-y-1">
          <div className="flex gap-1">
            <button
              onClick={() => setSelectedDayFilter(null)}
              className={`
                flex-1 ${isMobile ? "py-2 text-xs" : "py-1 text-[10px]"} font-semibold rounded-md transition-all duration-200 border
                ${selectedDayFilter === null
                  ? 'bg-jade-deep/60 text-jade-glow border-jade-glow/40 shadow-[inset_0_0_12px_rgba(58,143,143,0.15)]'
                  : 'bg-ink-dark/60 text-mist-dark border-ink-light/40 hover:text-mist-light hover:bg-ink-mid/40'
                }
              `}
            >
              All
              <span className="ml-1 text-[9px] opacity-70">({exercises.length})</span>
            </button>
            {selectedDayFilter !== null && (
              <GlowButton
                onClick={(e) => { e.stopPropagation(); onDrawerOpen(); }}
                variant="jade"
                size="sm"
                glow
                className={`${isMobile ? "!py-2 !text-xs" : "!py-1 !text-[10px]"} shrink-0`}
              >
                ⚙ Manage
              </GlowButton>
            )}
          </div>
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
                    flex-1 ${isMobile ? "py-2 text-xs" : "py-1 text-[10px]"} font-semibold transition-all duration-200 relative flex flex-col items-center gap-0.5
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

        {/* Action bar */}
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <button
              onClick={() => setDisciplineFilter((prev) => (prev === "gym" ? "all" : "gym"))}
              className={`${isMobile ? "px-2.5 h-9 text-xs" : "px-2 h-7 text-[10px]"} rounded-md flex items-center justify-center border font-semibold transition-all duration-150 ${
                disciplineFilter === "gym"
                  ? "bg-jade-deep/30 border-jade-glow/45 text-jade-light shadow-[0_0_8px_rgba(58,143,143,0.16)]"
                  : "border-ink-light/40 text-mist-dark hover:text-mist-light hover:border-ink-light/60"
              }`}
              title="Toggle Gym filter"
            >
              Gym
            </button>
            <button
              onClick={() => setDisciplineFilter((prev) => (prev === "calisthenics" ? "all" : "calisthenics"))}
              className={`${isMobile ? "px-2.5 h-9 text-xs" : "px-2 h-7 text-[10px]"} rounded-md flex items-center justify-center border font-semibold transition-all duration-150 ${
                disciplineFilter === "calisthenics"
                  ? "bg-jade-deep/30 border-jade-glow/45 text-jade-light shadow-[0_0_8px_rgba(58,143,143,0.16)]"
                  : "border-ink-light/40 text-mist-dark hover:text-mist-light hover:border-ink-light/60"
              }`}
              title="Toggle Calisthenics filter"
            >
              Cali
            </button>
            <button
              onClick={() => setDisciplineFilter((prev) => (prev === "recent" ? "all" : "recent"))}
              className={`${isMobile ? "px-2.5 h-9 text-xs" : "px-2 h-7 text-[10px]"} rounded-md flex items-center justify-center border font-semibold transition-all duration-150 ${
                disciplineFilter === "recent"
                  ? "bg-jade-deep/30 border-jade-glow/45 text-jade-light shadow-[0_0_8px_rgba(58,143,143,0.16)]"
                  : "border-ink-light/40 text-mist-dark hover:text-mist-light hover:border-ink-light/60"
              }`}
              title="Show exercises with training logs"
            >
              Recent
            </button>
          </div>
          <div className="flex-1" />

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`${isMobile ? "w-9 h-9" : "w-7 h-7"} rounded-md flex items-center justify-center border transition-all duration-150 ${
              showFilters
                ? 'bg-jade-deep/25 border-jade/40 text-jade-glow'
                : 'border-ink-light/40 text-mist-dark hover:text-mist-light hover:border-ink-light/60'
            }`}
            title={showFilters ? "Hide filters" : "Show filters"}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          </button>
          <button
            onClick={() => setIsCompact(!isCompact)}
            disabled={isMobile}
            className={`${isMobile ? "w-9 h-9" : "w-7 h-7"} rounded-md flex items-center justify-center border transition-all duration-150 ${
              compactEnabled
                ? 'bg-jade-deep/25 border-jade/40 text-jade-glow'
                : `border-ink-light/40 text-mist-dark ${isMobile ? "opacity-40 cursor-not-allowed" : "hover:text-mist-light hover:border-ink-light/60"}`
            }`}
            title={isMobile ? "Compact mode is disabled on mobile" : (compactEnabled ? "Expanded view" : "Compact view")}
          >
            {compactEnabled ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Collapsible Filters + Sort ── */}
      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden shrink-0"
          >
            <div className="px-3 pb-2 space-y-2">
              {categories.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`${labelTextClass} text-mist-dark/80 uppercase tracking-widest font-medium`}>Category</span>
                    {filterCategory && (
                      <button onClick={() => setFilterCategory("")} className={`${labelTextClass} text-jade-glow/70 hover:text-jade-glow transition-colors`}>clear</button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setFilterCategory("")}
                      className={`${chipTextClass} px-2 py-1 rounded-md transition-all duration-150 border ${
                        !filterCategory
                          ? "bg-jade-deep/40 text-jade-glow border-jade/40 shadow-[0_0_6px_rgba(58,143,143,0.15)]"
                          : "bg-transparent text-mist-dark border-ink-light/30 hover:text-mist-light hover:border-ink-light/50"
                      }`}
                    >
                      All
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setFilterCategory(filterCategory === cat ? "" : cat)}
                        className={`${chipTextClass} px-2 py-1 rounded-md transition-all duration-150 border ${
                          filterCategory === cat
                            ? "bg-jade-deep/40 text-jade-glow border-jade/40 shadow-[0_0_6px_rgba(58,143,143,0.15)]"
                            : "bg-transparent text-mist-dark border-ink-light/30 hover:text-mist-light hover:border-ink-light/50"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {types.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`${labelTextClass} text-mist-dark/80 uppercase tracking-widest font-medium`}>Type</span>
                    {filterType && (
                      <button onClick={() => setFilterType("")} className={`${labelTextClass} text-jade-glow/70 hover:text-jade-glow transition-colors`}>clear</button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setFilterType("")}
                      className={`${chipTextClass} px-2 py-1 rounded-md transition-all duration-150 border ${
                        !filterType
                          ? "bg-jade-deep/40 text-jade-glow border-jade/40 shadow-[0_0_6px_rgba(58,143,143,0.15)]"
                          : "bg-transparent text-mist-dark border-ink-light/30 hover:text-mist-light hover:border-ink-light/50"
                      }`}
                    >
                      All
                    </button>
                    {types.map((t) => (
                      <button
                        key={t}
                        onClick={() => setFilterType(filterType === t ? "" : t)}
                        className={`${chipTextClass} px-2 py-1 rounded-md transition-all duration-150 border ${
                          filterType === t
                            ? "bg-jade-deep/40 text-jade-glow border-jade/40 shadow-[0_0_6px_rgba(58,143,143,0.15)]"
                            : "bg-transparent text-mist-dark border-ink-light/30 hover:text-mist-light hover:border-ink-light/50"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {equipmentTypes.length > 1 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`${labelTextClass} text-mist-dark/80 uppercase tracking-widest font-medium`}>Equipment</span>
                    {filterEquipment && (
                      <button onClick={() => setFilterEquipment("")} className={`${labelTextClass} text-jade-glow/70 hover:text-jade-glow transition-colors`}>clear</button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {equipmentTypes.map((eq) => (
                      <button
                        key={eq}
                        onClick={() => setFilterEquipment(filterEquipment === eq ? "" : eq)}
                        className={`${chipTextClass} px-2 py-1 rounded-md transition-all duration-150 border ${
                          filterEquipment === eq
                            ? "bg-jade-deep/40 text-jade-glow border-jade/40 shadow-[0_0_6px_rgba(58,143,143,0.15)]"
                            : "bg-transparent text-mist-dark border-ink-light/30 hover:text-mist-light hover:border-ink-light/50"
                        }`}
                      >
                        {eq}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <span className={`${labelTextClass} text-mist-dark/80 uppercase tracking-widest font-medium block mb-1`}>Sort By</span>
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value)}
                  className={`w-full bg-ink-dark/80 border border-ink-light/40 rounded-md px-2 ${isMobile ? "py-2 text-sm" : "py-1 text-[11px]"} text-cloud-white outline-none transition-all duration-150 focus:border-jade-glow/50 appearance-none cursor-pointer`}
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 6px center', backgroundRepeat: 'no-repeat', backgroundSize: '16px', paddingRight: '28px' }}
                >
                  {sortOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.icon} {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Divider with stats ── */}
      <div className="px-3 py-1.5 border-y border-ink-light/20 bg-ink-dark/30 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-mist-light/90 font-medium">
              {sorted.length} exercise{sorted.length !== 1 ? "s" : ""}
            </span>
            {activeFiltersCount > 0 && (
              <span className="text-[9px] text-jade-glow/80 bg-jade-deep/20 px-1.5 py-0 rounded-full border border-jade/20">
                {activeFiltersCount} filter{activeFiltersCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {selectedIds.size > 0 && (
            <button
              onClick={() => {
                for (const id of [...selectedIds]) onToggleExercise(id);
              }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-crimson/40 bg-crimson-deep/20 text-crimson-light hover:bg-crimson-deep/35 hover:border-crimson/60 transition-all duration-150 text-[10px] font-semibold"
              title="Unselect all"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              {selectedIds.size} selected
            </button>
          )}
        </div>
      </div>

      {/* ── Exercise list ── */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5 scrollbar-thin">
        {sorted.length === 0 ? (
          selectedDayFilter !== null && exercises.length > 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="text-4xl opacity-40">📋</div>
              <p className="text-xs text-mist-dark text-center">
                No exercises assigned to <span className="text-mist-light font-medium">{DAY_ABBREVIATIONS[selectedDayFilter]}</span>
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
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="text-2xl opacity-30 mb-2">{exercises.length === 0 ? "📂" : "🔍"}</div>
              <p className="text-[11px] text-mist-dark">
                {exercises.length === 0
                  ? "Upload a JSON file to add exercises"
                  : isSearchActive
                    ? `No exercises found for "${searchQuery}"`
                    : "No exercises match current filters"
                }
              </p>
              {isSearchActive ? (
                <button
                  onClick={() => onSearch("")}
                  className="mt-2 text-[10px] text-jade-glow/70 hover:text-jade-glow transition-colors"
                >
                  Clear search
                </button>
              ) : activeFiltersCount > 0 && (
                <button
                  onClick={() => { setFilterCategory(""); setFilterType(""); setFilterEquipment(""); }}
                  className="mt-2 text-[10px] text-jade-glow/70 hover:text-jade-glow transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )
        ) : (
          <div className={`${compactEnabled ? 'space-y-px' : 'space-y-1.5'}`}>
            {(() => {
              const renderList = isSearchActive && searchGroupedByCategory
                ? searchGroupedByCategory.flatMap(g => g.exercises)
                : sorted;
              let lastCategoryKey = '';
              const elements: React.ReactNode[] = [];
              renderList.forEach((exercise) => {
                if (isSearchActive) {
                  const primaryCategory = parseCategoryTags(exercise.category)[0] || 'Uncategorised';
                  if (primaryCategory !== lastCategoryKey) {
                    lastCategoryKey = primaryCategory;
                    const groupCount = searchGroupedByCategory?.find(g => g.category === primaryCategory)?.exercises.length ?? 0;
                    elements.push(
                      <div key={`cat-${primaryCategory}`} className="sticky top-0 z-10 px-1.5 py-1 mt-2 first:mt-0 mb-0.5 bg-ink-dark/90 backdrop-blur-sm border-b border-ink-light/20">
                        <span className="text-[10px] font-semibold text-mist-light/70 uppercase tracking-wider">{primaryCategory}</span>
                        <span className="ml-1.5 text-[9px] text-mist-dark/60">({groupCount})</span>
                      </div>
                    );
                  }
                }

              const isActive = selectedIds.has(exercise.id);
              const currentLevel = exercise.userProgress[0]?.currentLevel ?? 1;
              const effectiveLevel = levelDefaults[exercise.id] || autoLevelByExerciseId[exercise.id] || currentLevel;
              const typeColor = getTypeColor(getTypeColorKey(exercise));
              const displayName = getExerciseDisplayName(exercise, settings.terminologyMode);
              const sidebarTierInfo = getTierGlowFromLogs(exercise, userBodyweightKg);
              const levelDifficultyDisplay = sidebarTierInfo.tierName;
              const levelDiffColor = '';
              const glowStyle = {};
              const logCount = exercise.userProgress[0]?.logs?.length ?? 0;
              const isSearchMatch = isSearchActive && matchesLooseSearchInFields(searchQuery, [
                exercise.name,
                exercise.wuxiaName,
              ]);

              const _selectButton = (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleExercise(exercise.id); }}
                  className={`shrink-0 w-5 h-5 rounded flex items-center justify-center border transition-all duration-150 ${
                    isActive
                      ? 'bg-jade-glow/20 border-jade/50 text-jade-glow hover:bg-crimson-deep/20 hover:border-crimson/40 hover:text-crimson-light'
                      : 'border-ink-light/40 text-mist-dark hover:bg-jade-deep/20 hover:border-jade/40 hover:text-jade-glow'
                  }`}
                  title={isActive ? "Remove from training" : "Add to training"}
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    {isActive
                      ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      : <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    }
                  </svg>
                </button>
              );

              const handleRowClick = () => {
                if (isActive) {
                  onToggleExercise(exercise.id);
                  return;
                }
                onAddExercise(exercise.id);
              };

              /* ═══ Compact mode ═══ */
              if (compactEnabled) {
                elements.push(
                  <div key={exercise.id}>
                    <div
                      className={`
                        relative flex items-center gap-1.5 px-2.5 py-[5px] rounded-md cursor-pointer transition-all duration-150
                        group border
                        ${isActive
                          ? 'bg-jade-deep/28 border-jade-glow/55 shadow-[0_0_10px_rgba(58,143,143,0.2)]'
                          : isSearchMatch
                            ? 'bg-jade-deep/10 border-jade-glow/45 shadow-[0_0_10px_rgba(58,143,143,0.16)] hover:bg-jade-deep/18 hover:shadow-[0_0_14px_rgba(58,143,143,0.22)]'
                            : 'bg-ink-dark/40 border-ink-light/50 hover:bg-ink-mid/30 hover:border-jade-glow/30 hover:shadow-[0_2px_10px_rgba(0,0,0,0.25)] hover:-translate-y-[1px]'
                        }
                      `}
                      style={showIllumination && isActive ? glowStyle as React.CSSProperties : undefined}
                      onClick={handleRowClick}
                    >
                      <div className={`w-1 h-4 rounded-full shrink-0 transition-all duration-200 ${isActive ? 'bg-jade-glow' : 'bg-transparent group-hover:bg-jade-glow/40'}`} />
                      <span className={`text-[11px] truncate flex-1 transition-colors duration-150 ${isActive ? 'text-cloud-white' : 'text-mist-light group-hover:text-cloud-white/90'}`} style={showIllumination && !useThemeColor ? { color: sidebarTierInfo.glowColor } : undefined} title={displayName}>
                        {displayName}
                      </span>
                      {logCount > 0 && (
                        <span className="text-[8px] text-mist-dark/70 font-mono shrink-0">{logCount}</span>
                      )}
                      <span className={`shrink-0 text-[8px] font-medium px-1 py-0 rounded ${useThemeColor ? 'text-jade-glow' : ''}`} style={!useThemeColor ? { color: sidebarTierInfo.glowColor } : undefined}>
                        {levelDifficultyDisplay}
                      </span>
                    </div>
                  </div>
                );
                return;
              }

              /* ═══ Scroll-Card Style ═══ */
              if (isScrollStyle) {
                elements.push(
                  <motion.div
                    key={exercise.id}
                    initial={sidebarMountedRef.current ? { opacity: 0, y: 4 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div
                      className={`
                        relative p-2.5 rounded-lg border cursor-pointer transition-all duration-200 group
                        ${isActive
                          ? 'bg-jade-deep/24 border-jade-glow/55 shadow-[0_0_14px_rgba(58,143,143,0.2)]'
                          : isSearchMatch
                            ? 'bg-jade-deep/10 border-jade-glow/45 shadow-[0_0_10px_rgba(58,143,143,0.16)] hover:bg-jade-deep/18 hover:shadow-[0_0_16px_rgba(58,143,143,0.24)]'
                            : 'bg-ink-dark/45 border-ink-light/50 hover:border-jade-glow/30 hover:bg-ink-mid/25 hover:shadow-[0_3px_12px_rgba(0,0,0,0.3)] hover:-translate-y-[1px]'
                        }
                      `}
                      style={showIllumination && glowIntensity > 0 ? glowStyle as React.CSSProperties : undefined}
                      onClick={handleRowClick}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className={`w-1 h-4 rounded-full shrink-0 transition-all duration-200 ${isActive ? 'bg-jade-glow' : 'bg-transparent group-hover:bg-jade-glow/40'}`} />
                            <h3 className={`text-[11px] font-semibold ${showIllumination && !useThemeColor ? '' : showIllumination && useThemeColor ? 'text-jade-glow' : 'text-cloud-white'} truncate flex-1`} style={showIllumination && !useThemeColor ? { color: sidebarTierInfo.glowColor } : undefined} title={displayName}>
                              {displayName}
                            </h3>
                            {logCount > 0 && (
                              <span className="text-[8px] text-mist-dark/70 font-mono shrink-0">{logCount}</span>
                            )}
                          </div>

                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded bg-ink-dark/55 border border-current/20 ${useThemeColor ? 'text-jade-glow' : ''}`} style={!useThemeColor ? { color: sidebarTierInfo.glowColor } : undefined}>
                              {levelDifficultyDisplay}
                            </span>
                            {showPath && (
                              <span className={`text-[8px] px-1.5 py-0.5 rounded ${typeColor} bg-ink-dark/40 border border-current/15 opacity-75`}>
                                {getTypeDisplayName(exercise, settings.terminologyMode)}
                              </span>
                            )}
                            <EquipmentBadges exercise={exercise} />
                            {showRealm && exercise.category && (
                              <span className="text-[8px] text-mist-dark/70">{exercise.category}</span>
                            )}
                          </div>

                          {loreVisible && showPath && exercise.story && (
                            <p className="mt-1.5 pt-1 border-t border-ink-light/20 text-[9px] text-mist-mid/70 leading-relaxed line-clamp-1">
                              {exercise.story}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
                return;
              }

              /* ═══ Default Style ═══ */
              elements.push(
                <motion.div
                  key={exercise.id}
                  initial={sidebarMountedRef.current ? { opacity: 0, y: 4 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div
                    className={`
                      relative p-2.5 rounded-lg border cursor-pointer transition-all duration-200 group
                      ${isActive
                        ? 'bg-jade-deep/24 border-jade-glow/55 shadow-[0_0_12px_rgba(58,143,143,0.2)]'
                        : isSearchMatch
                          ? 'bg-jade-deep/10 border-jade-glow/45 shadow-[0_0_10px_rgba(58,143,143,0.16)] hover:bg-jade-deep/18 hover:shadow-[0_0_16px_rgba(58,143,143,0.24)]'
                          : 'bg-ink-dark/45 border-ink-light/50 hover:border-jade-glow/30 hover:bg-ink-mid/25 hover:shadow-[0_3px_12px_rgba(0,0,0,0.3)] hover:-translate-y-[1px]'
                      }
                    `}
                    style={showIllumination ? glowStyle as React.CSSProperties : undefined}
                    onClick={handleRowClick}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1 h-4 rounded-full shrink-0 transition-all duration-200 ${isActive ? 'bg-jade-glow' : 'bg-transparent group-hover:bg-jade-glow/40'}`} />
                      <div className={`text-[11px] font-semibold ${useThemeColor && showIllumination ? 'text-jade-glow' : isActive ? 'text-cloud-white' : 'text-mist-light group-hover:text-cloud-white/90'} transition-colors duration-150 truncate flex-1`} style={showIllumination && !useThemeColor ? { color: sidebarTierInfo.glowColor } : undefined} title={displayName}>
                        {displayName}
                      </div>
                      {logCount > 0 && (
                        <span className="text-[8px] text-mist-dark/70 font-mono shrink-0">{logCount}</span>
                      )}
                      <span className={`shrink-0 text-[8px] font-medium px-1.5 py-0 rounded bg-ink-dark/30 border border-current/15 ${useThemeColor ? 'text-jade-glow' : ''}`} style={!useThemeColor ? { color: sidebarTierInfo.glowColor } : undefined}>
                        {levelDifficultyDisplay}
                      </span>
                    </div>
                    {(showRealm || showPath) && (
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {showPath && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] ${typeColor} opacity-75 bg-ink-dark/35 border border-current/15`}>
                            {getTypeDisplayName(exercise, settings.terminologyMode)}
                          </span>
                        )}
                        <EquipmentBadges exercise={exercise} />
                        {showRealm && exercise.category && (
                          <span className="text-[8px] text-mist-dark/70">{exercise.category}</span>
                        )}
                      </div>
                    )}
                    {loreVisible && showPath && exercise.story && (
                      <p className="text-[9px] text-mist-mid/70 leading-relaxed line-clamp-1 mt-1.5 pt-1 border-t border-ink-light/20">
                        {exercise.story}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
              });
              return elements;
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
