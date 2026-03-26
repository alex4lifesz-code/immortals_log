"use client";

import { useState, useEffect, useMemo } from "react";
import type { ProgressionExercise } from "@/app/dashboard/workout/types";
import {
  parseCategoryTags,
  getEquipmentTags,
  isGymCategoryExercise,
  getWeightedDifficulty,
} from "@/app/dashboard/workout/utils";
import { EquipmentBadges } from "@/components/workout/EquipmentBadges";
import { getTierGlowFromLogs } from "@/components/workout/TierProgressBar";
import { useDisplaySettings, DISPLAY_DEFAULTS } from "@/context/DisplaySettingsContext";
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

  const [sortMode, setSortMode] = useState<string>(() => {
    if (typeof window === "undefined") return "a-z";
    try { return localStorage.getItem("cultivateos-progression-sidebar-sort") || "a-z"; } catch { return "a-z"; }
  });

  useEffect(() => {
    try { localStorage.setItem("cultivateos-progression-sidebar-sort", sortMode); } catch {}
  }, [sortMode]);

  const displayMode = DISPLAY_DEFAULTS.progressionSidebarMode;
  const cardStyle = DISPLAY_DEFAULTS.progressionSidebarStyle;
  const glowIntensity = DISPLAY_DEFAULTS.glowIntensityProgressionSidebar;
  const loreVisible = DISPLAY_DEFAULTS.progressionSidebarLoreVisible;

  const hiddenSidebarExerciseNames = useMemo(
    () =>
      new Set([
        "dumbbell bicep curl",
        "leg curl",
        "leg extension",
        "seated cable row",
      ]),
    []
  );

  const showIllumination = displayMode !== "name-only";
  const useThemeColor = DISPLAY_DEFAULTS.progressionSidebarUseThemeColor;
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

  const searchQuery = searchTerm.trim();
  const isSearchActive = searchQuery.length > 0;

  const exerciseDerived = useMemo(() => {
    const map = new Map<
      string,
      {
        categoryTags: string[];
        equipmentTags: string[];
        isGym: boolean;
        displayName: string;
        primaryCategory: string;
        logCount: number;
        latestLogTs: number;
      }
    >();

    for (const ex of exercises) {
      const categoryTags = parseCategoryTags(ex.category);
      const equipmentTags = getEquipmentTags(ex);
      const logs = ex.userProgress[0]?.logs ?? [];
      const latestLogTs = logs.reduce((max, log) => {
        const ts = new Date(log.createdAt).getTime();
        return ts > max ? ts : max;
      }, 0);

      map.set(ex.id, {
        categoryTags,
        equipmentTags,
        isGym: isGymCategoryExercise(ex),
        displayName: getExerciseDisplayName(ex, settings.terminologyMode),
        primaryCategory: categoryTags[0] || "Uncategorised",
        logCount: logs.length,
        latestLogTs,
      });
    }

    return map;
  }, [exercises, settings.terminologyMode]);

  const filtered = useMemo(
    () =>
      exercises.filter((e) => {
        const derived = exerciseDerived.get(e.id);
        if (!derived) return false;

        if (hiddenSidebarExerciseNames.has(String(e.name || "").trim().toLowerCase())) {
          return false;
        }

        if (disciplineFilter === "gym" && !derived.isGym) return false;
        if (disciplineFilter === "calisthenics" && derived.isGym) return false;
        if (disciplineFilter === "recent" && derived.logCount === 0) return false;

        if (selectedDayFilter !== null) {
          if (!e.assignedDays || e.assignedDays.trim() === "") return false;
          const assignedDays = e.assignedDays.split(",").map((d) => parseInt(d.trim())).filter((d) => !isNaN(d));
          if (!assignedDays.includes(selectedDayFilter)) return false;
        }
        if (filterCategory && !derived.categoryTags.includes(filterCategory)) return false;
        if (filterType && e.type !== filterType) return false;
        if (filterEquipment && !derived.equipmentTags.includes(filterEquipment)) return false;
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
      }),
    [
      disciplineFilter,
      exerciseDerived,
      exercises,
      filterCategory,
      filterEquipment,
      filterType,
      hiddenSidebarExerciseNames,
      searchTerm,
      selectedDayFilter,
    ]
  );

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const aDerived = exerciseDerived.get(a.id);
        const bDerived = exerciseDerived.get(b.id);
        const nameA = aDerived?.displayName ?? getExerciseDisplayName(a, settings.terminologyMode);
        const nameB = bDerived?.displayName ?? getExerciseDisplayName(b, settings.terminologyMode);

        switch (sortMode) {
          case "a-z":
            return nameA.localeCompare(nameB);
          case "z-a":
            return nameB.localeCompare(nameA);
          case "recent":
            return (bDerived?.latestLogTs ?? 0) - (aDerived?.latestLogTs ?? 0);
          case "most-logged":
            return (bDerived?.logCount ?? 0) - (aDerived?.logCount ?? 0);
          case "selected": {
            const aS = selectedIds.has(a.id) ? 0 : 1;
            const bS = selectedIds.has(b.id) ? 0 : 1;
            if (aS !== bS) return aS - bS;
            return nameA.localeCompare(nameB);
          }
          default:
            return 0;
        }
      }),
    [exerciseDerived, filtered, selectedIds, settings.terminologyMode, sortMode]
  );

  const [showFilters, setShowFilters] = useState(false);

  const activeFiltersCount = (filterCategory ? 1 : 0) + (filterType ? 1 : 0) + (filterEquipment ? 1 : 0);

  const searchGroupedByCategory = useMemo(() => {
    if (!isSearchActive) return null;
    const groups: { category: string; exercises: typeof sorted }[] = [];
    const categoryMap = new Map<string, typeof sorted>();
    for (const ex of sorted) {
      const categoryKey = exerciseDerived.get(ex.id)?.primaryCategory || "Uncategorised";
      if (!categoryMap.has(categoryKey)) categoryMap.set(categoryKey, []);
      categoryMap.get(categoryKey)!.push(ex);
    }
    for (const [category, exercises] of categoryMap) {
      groups.push({ category, exercises });
    }
    return groups;
  }, [exerciseDerived, isSearchActive, sorted]);

  const searchGroupCountByCategory = useMemo(() => {
    if (!searchGroupedByCategory) return new Map<string, number>();
    return new Map(searchGroupedByCategory.map((group) => [group.category, group.exercises.length]));
  }, [searchGroupedByCategory]);

  const searchNameMatchById = useMemo(() => {
    if (!isSearchActive) return new Map<string, boolean>();
    const map = new Map<string, boolean>();
    for (const exercise of sorted) {
      map.set(
        exercise.id,
        matchesLooseSearchInFields(searchQuery, [exercise.name, exercise.wuxiaName])
      );
    }
    return map;
  }, [isSearchActive, searchQuery, sorted]);

  const tierInfoByExerciseId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getTierGlowFromLogs>>();
    for (const exercise of sorted) {
      map.set(exercise.id, getTierGlowFromLogs(exercise, userBodyweightKg));
    }
    return map;
  }, [sorted, userBodyweightKg]);

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
    <div className="dashboard-sidebar-shell">
      {/* ── Primary Controls (MapleRanks-style simple flow) ── */}
      <div className="px-2 py-2 shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[10px] font-medium uppercase tracking-[0.08em] text-mist-dark">Exercise Library</h3>
          <div className="flex items-center gap-1">
            {selectedDayFilter !== null && (
              <GlowButton
                onClick={(e) => { e.stopPropagation(); onDrawerOpen(); }}
                variant="jade"
                size="sm"
                glow
                className={`${isMobile ? "!py-2 !text-xs" : "!py-1 !text-[10px]"} shrink-0`}
              >
                Manage
              </GlowButton>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`${isMobile ? "h-9 px-2.5 text-xs" : "h-7 px-2 text-[10px]"} rounded-md border font-medium transition-all duration-150 ${
                showFilters
                  ? "bg-ink-mid/25 border-ink-light/55 text-mist-light"
                  : "border-ink-light/40 text-mist-dark hover:text-mist-light hover:border-ink-light/60"
              }`}
              title={showFilters ? "Hide advanced controls" : "Show advanced controls"}
            >
              {showFilters ? "Basic" : "Advanced"}
            </button>
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder=""
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
            className={`w-full bg-ink-dark/70 border border-ink-light/45 rounded-md pl-3 pr-8 ${isMobile ? "py-2.5 text-sm" : "py-1.5 text-[11px]"} text-cloud-white placeholder:text-mist-dark/70 outline-none transition-colors duration-150 focus:border-ink-light/70`}
          />
          {searchTerm ? (
            <button
              onClick={() => onSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mist-dark hover:text-cloud-white transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-mist-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="M16.5 16.5l4 4" />
            </svg>
          )}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1">
          <select
            value={selectedDayFilter === null ? "" : String(selectedDayFilter)}
            onChange={(e) => setSelectedDayFilter(e.target.value === "" ? null : Number(e.target.value))}
            className={`${isMobile ? "h-9 text-sm" : "h-7 text-[11px]"} rounded-md border border-ink-light/40 bg-ink-dark/65 px-2 text-cloud-white outline-none transition-colors duration-150 focus:border-ink-light/70`}
          >
            <option value="">All Days ({exercises.length})</option>
            {DAY_ABBREVIATIONS.map((day, index) => (
              <option key={day} value={index}>
                {day} ({dayCounts[index]})
              </option>
            ))}
          </select>

          <select
            value={disciplineFilter}
            onChange={(e) => setDisciplineFilter(e.target.value as "all" | "gym" | "calisthenics" | "recent")}
            className={`${isMobile ? "h-9 text-sm" : "h-7 text-[11px]"} rounded-md border border-ink-light/40 bg-ink-dark/65 px-2 text-cloud-white outline-none transition-colors duration-150 focus:border-ink-light/70`}
          >
            <option value="all">All Types</option>
            <option value="gym">Gym</option>
            <option value="calisthenics">Calisthenics</option>
            <option value="recent">Recent</option>
          </select>

          <button
            onClick={() => {
              onSearch("");
              setSelectedDayFilter(null);
              setDisciplineFilter("all");
              setFilterCategory("");
              setFilterType("");
              setFilterEquipment("");
            }}
            className={`${isMobile ? "h-9 px-2.5 text-xs" : "h-7 px-2 text-[10px]"} rounded-md border border-ink-light/40 text-mist-light hover:text-cloud-white hover:border-ink-light/60 transition-colors duration-150`}
            title="Reset all filters"
          >
            Reset
          </button>
        </div>
      </div>

      {/* ── Collapsible Filters + Sort ── */}
      {showFilters && (
          <div className="overflow-hidden shrink-0">
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
                          ? "bg-ink-mid/25 text-cloud-white border-ink-light/60"
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
                            ? "bg-ink-mid/25 text-cloud-white border-ink-light/60"
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
                          ? "bg-ink-mid/25 text-cloud-white border-ink-light/60"
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
                            ? "bg-ink-mid/25 text-cloud-white border-ink-light/60"
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
                            ? "bg-ink-mid/25 text-cloud-white border-ink-light/60"
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
                  className={`w-full bg-ink-dark/75 border border-ink-light/40 rounded-md px-2 ${isMobile ? "py-2 text-sm" : "py-1 text-[11px]"} text-cloud-white outline-none transition-colors duration-150 focus:border-ink-light/70 appearance-none cursor-pointer`}
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 6px center', backgroundRepeat: 'no-repeat', backgroundSize: '16px', paddingRight: '28px' }}
                >
                  {sortOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.icon} {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-1 border-t border-ink-light/20 flex items-center justify-between gap-2">
                <span className={`${labelTextClass} text-mist-dark/80 uppercase tracking-widest font-medium`}>Density</span>
                <button
                  onClick={() => setIsCompact(!isCompact)}
                  disabled={isMobile}
                  className={`${isMobile ? "h-9 px-2.5 text-xs" : "h-7 px-2 text-[10px]"} rounded-md border font-semibold transition-all duration-150 ${
                    compactEnabled
                      ? "bg-jade-deep/25 border-jade/40 text-jade-glow"
                      : `border-ink-light/40 text-mist-dark ${isMobile ? "opacity-40 cursor-not-allowed" : "hover:text-mist-light hover:border-ink-light/60"}`
                  }`}
                  title={isMobile ? "Compact mode is disabled on mobile" : (compactEnabled ? "Expanded view" : "Compact view")}
                >
                  {compactEnabled ? "Compact" : "Comfortable"}
                </button>
              </div>
            </div>
          </div>
      )}

      {/* ── Divider with stats ── */}
      <div className="px-2 py-2 border-y border-ink-light/20 bg-ink-dark/20 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-mist-light/90 font-medium">
              {sorted.length} exercise{sorted.length !== 1 ? "s" : ""}
            </span>
            {activeFiltersCount > 0 && (
              <span className="text-[9px] text-mist-light bg-ink-mid/25 px-1.5 py-0 rounded-full border border-ink-light/40">
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
      <div className="dashboard-sidebar-scroll overflow-y-auto px-2 py-1.5 scrollbar-thin">
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
                  const primaryCategory = exerciseDerived.get(exercise.id)?.primaryCategory || 'Uncategorised';
                  if (primaryCategory !== lastCategoryKey) {
                    lastCategoryKey = primaryCategory;
                    const groupCount = searchGroupCountByCategory.get(primaryCategory) ?? 0;
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
              const typeColor = getTypeColor(getTypeColorKey(exercise));
              const displayName = exerciseDerived.get(exercise.id)?.displayName ?? getExerciseDisplayName(exercise, settings.terminologyMode);
              const sidebarTierInfo = tierInfoByExerciseId.get(exercise.id) ?? getTierGlowFromLogs(exercise, userBodyweightKg);
              const glowStyle = {};
              const logCount = exerciseDerived.get(exercise.id)?.logCount ?? 0;
              const isSearchMatch = isSearchActive && (searchNameMatchById.get(exercise.id) ?? false);

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
                        relative flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors duration-150
                        group border
                        ${isActive
                          ? 'bg-ink-mid/30 border-ink-light/65'
                          : isSearchMatch
                            ? 'bg-ink-dark/55 border-ink-light/55 hover:bg-ink-mid/35'
                            : 'bg-ink-dark/40 border-ink-light/45 hover:bg-ink-mid/25 hover:border-ink-light/60'
                        }
                      `}
                      style={showIllumination && isActive ? glowStyle as React.CSSProperties : undefined}
                      onClick={handleRowClick}
                    >
                      <div className={`w-1 h-4 rounded-full shrink-0 transition-all duration-200 ${isActive ? 'bg-jade-glow' : 'bg-transparent group-hover:bg-jade-glow/40'}`} />
                      <span className={`text-[12px] truncate flex-1 transition-colors duration-150 ${isActive ? 'text-cloud-white' : 'text-mist-light group-hover:text-cloud-white/90'}`} style={showIllumination && !useThemeColor ? { color: sidebarTierInfo.glowColor } : undefined} title={displayName}>
                        {displayName}
                      </span>
                      {logCount > 0 && (
                        <span className="text-[9px] text-mist-dark/70 font-mono shrink-0">{logCount}</span>
                      )}
                    </div>
                  </div>
                );
                return;
              }

              /* ═══ Scroll-Card Style ═══ */
              if (isScrollStyle) {
                elements.push(
                  <div key={exercise.id}>
                    <div
                      className={`
                        relative p-2 rounded-lg border cursor-pointer transition-colors duration-150 group
                        ${isActive
                          ? 'bg-ink-mid/30 border-ink-light/65'
                          : isSearchMatch
                            ? 'bg-ink-dark/55 border-ink-light/55 hover:bg-ink-mid/35'
                            : 'bg-ink-dark/45 border-ink-light/50 hover:border-ink-light/65 hover:bg-ink-mid/25'
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
                  </div>
                );
                return;
              }

              /* ═══ Default Style ═══ */
              elements.push(
                <div key={exercise.id}>
                  <div
                      className={`
                      relative p-2 rounded-lg border cursor-pointer transition-colors duration-150 group
                      ${isActive
                        ? 'bg-ink-mid/30 border-ink-light/65'
                        : isSearchMatch
                          ? 'bg-ink-dark/55 border-ink-light/55 hover:bg-ink-mid/35'
                          : 'bg-ink-dark/45 border-ink-light/50 hover:border-ink-light/65 hover:bg-ink-mid/25'
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
                </div>
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
