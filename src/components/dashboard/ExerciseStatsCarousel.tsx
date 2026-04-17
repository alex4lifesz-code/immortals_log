"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";

interface ExerciseData {
  id: string;
  name: string;
  category: string;
  primaryMuscles?: string;
  userProgress?: Array<{
    userId: string;
    logs: Array<{
      id: string;
      createdAt: string;
      weight1?: number;
      weight2?: number;
      weight3?: number;
      reps1?: number;
      reps2?: number;
      reps3?: number;
    }>;
  }>;
}

interface CommunityLog {
  exerciseName: string;
  userId: string;
}

type FilterMode = "category" | "muscle-group";

interface ExerciseStatsCarouselProps {
  exercises: ExerciseData[];
  communityLogs: CommunityLog[];
  currentUserId?: string;
  scope: "friends" | "community";
  onScopeChange: (scope: "friends" | "community") => void;
  onFilterChange: (mode: FilterMode, selectedFilter: string) => void;
}

export default function ExerciseStatsCarousel({
  exercises,
  communityLogs,
  currentUserId,
  scope,
  onScopeChange,
  onFilterChange,
}: ExerciseStatsCarouselProps) {
  const [filterMode, setFilterMode] = useState<FilterMode>("category");
  const [selectedFilter, setSelectedFilter] = useState<string>("");
  const [railCanScroll, setRailCanScroll] = useState(false);
  const [railCanScrollLeft, setRailCanScrollLeft] = useState(false);
  const [railCanScrollRight, setRailCanScrollRight] = useState(false);
  const railScrollRef = useRef<HTMLDivElement | null>(null);

  // Filter out current user's logs from community
  const communityLogsWithoutUser = useMemo(() => {
    if (!currentUserId) return communityLogs;
    return communityLogs.filter(log => log.userId !== currentUserId);
  }, [communityLogs, currentUserId]);

  // Build a map of exercise names to their categories/muscle groups
  const exerciseMap = useMemo(() => {
    const map: Record<string, { category: string; primaryMuscles?: string }> = {};
    for (const exercise of exercises) {
      map[exercise.name] = {
        category: exercise.category,
        primaryMuscles: exercise.primaryMuscles,
      };
    }
    return map;
  }, [exercises]);

  // Get all categories or muscle groups from exercises (not just community logs)
  const filterOptions = useMemo(() => {
    const options = new Set<string>();
    
    for (const exercise of exercises) {
      const value = filterMode === "category" 
        ? exercise.category 
        : exercise.primaryMuscles;
      
      if (value) {
        options.add(value);
      }
    }
    
    return Array.from(options).sort();
  }, [exercises, filterMode]);

  // Reset selected filter when mode changes
  useEffect(() => {
    setSelectedFilter("");
    onFilterChange(filterMode, "");
  }, [filterMode]);

  const handleFilterModeChange = (newMode: FilterMode) => {
    setFilterMode(newMode);
  };

  const handleFilterSelect = (filter: string) => {
    const newFilter = selectedFilter === filter ? "" : filter;
    setSelectedFilter(newFilter);
    onFilterChange(filterMode, newFilter);
  };

  const handleRailScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    setRailCanScrollLeft(el.scrollLeft > 8);
    setRailCanScrollRight(el.scrollLeft < maxScrollLeft - 8);
  };

  useEffect(() => {
    const el = railScrollRef.current;
    if (!el) return;

    const updateCanScroll = () => {
      const canScroll = el.scrollWidth > el.clientWidth;
      const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
      setRailCanScroll(canScroll);
      setRailCanScrollLeft(el.scrollLeft > 8);
      setRailCanScrollRight(el.scrollLeft < maxScrollLeft - 8);
    };

    updateCanScroll();
    window.addEventListener("resize", updateCanScroll);
    return () => window.removeEventListener("resize", updateCanScroll);
  }, [filterOptions]);

  const handleRailHintClick = (direction: "left" | "right") => {
    if (!railScrollRef.current) return;
    const delta = direction === "right" ? 168 : -168;
    railScrollRef.current.scrollBy({ left: delta, behavior: "smooth" });
  };

  const segmentButtonBase = "rounded-md border px-3 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors duration-150";
  const activeControlButton = `${segmentButtonBase} border-[#4e5058] bg-[#404249] text-[#ffffff]`;
  const inactiveControlButton = `${segmentButtonBase} border-transparent bg-transparent text-[#b5bac1] hover:bg-[#35373c] hover:text-[#ffffff]`;
  const chipButtonBase = "rounded-md border px-3 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors duration-150";
  const activeChipButton = `${chipButtonBase} border-[#4e5058] bg-[#404249] text-[#ffffff]`;
  const inactiveChipButton = `${chipButtonBase} border-[#32353b] bg-[#2b2d31] text-[#dbdee1] hover:bg-[#35373c] hover:text-[#ffffff]`;

  return (
    <div className="flex flex-col gap-3 bg-transparent px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex flex-col gap-2 border-b border-[#32353b] pb-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#949ba4]">
              Feed controls
            </p>
            <p className="mt-1 text-[12px] text-[#dbdee1]">
              {selectedFilter
                ? `Showing ${selectedFilter} activity in ${scope === "friends" ? "friends" : "community"}.`
                : scope === "friends"
                  ? "Browse recent activity from your circle."
                  : "Browse recent activity from the wider community."}
            </p>
          </div>

          <div className="text-[11px] text-[#949ba4] sm:text-right">
            {communityLogsWithoutUser.length} entries • {new Set(communityLogsWithoutUser.map((log) => log.userId)).size} athletes
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onScopeChange("friends")}
            className={scope === "friends" ? activeControlButton : inactiveControlButton}
          >
            Friends
          </button>
          <button
            type="button"
            onClick={() => onScopeChange("community")}
            className={scope === "community" ? activeControlButton : inactiveControlButton}
          >
            Community
          </button>
          <span className="mx-1 hidden h-4 w-px bg-[#3b3f48] sm:block" />
          {["category", "muscle-group"].map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleFilterModeChange(mode as FilterMode)}
              className={filterMode === mode ? activeControlButton : inactiveControlButton}
            >
              {mode === "category" ? "Category" : "Muscle"}
            </button>
          ))}
          {selectedFilter ? (
            <button
              type="button"
              onClick={() => handleFilterSelect("")}
              className={inactiveChipButton}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#949ba4]">
            {filterMode === "category" ? "Exercise categories" : "Primary muscles"}
          </span>
          <span className="text-[10px] text-[#949ba4]">{filterOptions.length} options</span>
        </div>

        <div className="relative">
          {railCanScroll && railCanScrollLeft && (
            <button
              type="button"
              onClick={() => handleRailHintClick("left")}
              aria-label="Scroll filters left"
              className="absolute inset-y-0 left-0 z-20 flex items-center px-1 text-[#b5bac1]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 5l-7 7 7 7" />
              </svg>
            </button>
          )}

          {railCanScroll && railCanScrollRight && (
            <button
              type="button"
              onClick={() => handleRailHintClick("right")}
              aria-label="Scroll filters right"
              className="absolute inset-y-0 right-0 z-20 flex items-center px-1 text-[#b5bac1]"
            >
              <svg className="h-4 w-4 animate-[swipe-hint_1.2s_ease-in-out_infinite]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          <div
            ref={railScrollRef}
            onScroll={handleRailScroll}
            className="overflow-x-auto scrollbar-hide scroll-smooth pb-1"
            style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", touchAction: "pan-x" }}
          >
            <div className="flex min-w-max gap-2 px-1">
              <motion.button
                type="button"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => handleFilterSelect("")}
                className={selectedFilter === "" ? activeChipButton : inactiveChipButton}
              >
                All activity <span className="ml-1 text-[#949ba4]">{communityLogsWithoutUser.length}</span>
              </motion.button>

              {filterOptions.map((option, idx) => {
                const matchingLogs = communityLogsWithoutUser.filter((log) => {
                  const exercise = exerciseMap[log.exerciseName];
                  if (!exercise) return false;
                  return (filterMode === "category" ? exercise.category : exercise.primaryMuscles) === option;
                });

                return (
                  <motion.button
                    key={option}
                    type="button"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    onClick={() => handleFilterSelect(option)}
                    className={selectedFilter === option ? activeChipButton : inactiveChipButton}
                  >
                    {option} <span className="ml-1 text-[#949ba4]">{matchingLogs.length}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
