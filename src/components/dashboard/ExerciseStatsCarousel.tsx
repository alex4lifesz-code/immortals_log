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

  return (
    <div className="flex flex-col bg-transparent">
      {/* Filter toggle */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between px-4 py-3">
        <div className="inline-flex items-center rounded-lg border border-ink-light/30 bg-ink-dark/40 p-0.5">
          <button
            onClick={() => onScopeChange("friends")}
            className={`px-2.5 py-1 text-xs rounded transition-all ${
              scope === "friends"
                ? "bg-ink-dark border border-jade-glow/45 text-jade-glow"
                : "text-mist-light hover:text-jade-glow"
            }`}
          >
            Friends
          </button>
          <button
            onClick={() => onScopeChange("community")}
            className={`px-2.5 py-1 text-xs rounded transition-all ${
              scope === "community"
                ? "bg-ink-dark border border-jade-glow/45 text-jade-glow"
                : "text-mist-light hover:text-jade-glow"
            }`}
          >
            Community
          </button>
        </div>

        <div className="inline-flex items-center rounded-lg border border-ink-light/30 bg-ink-dark/40 p-0.5">
          {["category", "muscle-group"].map((mode) => (
            <button
              key={mode}
              onClick={() => handleFilterModeChange(mode as FilterMode)}
              className={`px-2.5 py-1 text-xs rounded transition-all ${
                filterMode === mode
                  ? "bg-ink-dark border border-jade-glow/45 text-jade-glow"
                  : "text-mist-light hover:text-jade-glow"
              }`}
            >
              {mode === "category" ? "Category" : "Muscle"}
            </button>
          ))}
        </div>
      </div>

      {/* Carousel - no rounded corners on container */}
      <div className="relative px-4">
        {/* Left gradient overlay */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-transparent to-transparent" />
        
        {/* Right gradient overlay */}
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-transparent to-transparent" />

        {/* Scroll hint buttons */}
        {railCanScroll && railCanScrollLeft && (
          <button
            type="button"
            onClick={() => handleRailHintClick("left")}
            aria-label="Scroll carousel left"
            className="absolute inset-y-0 left-1 z-20 flex items-center px-1.5 transition-opacity duration-150 opacity-90"
          >
            <svg
              className="h-5 w-5 text-mist-light/70"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        )}

        {railCanScroll && railCanScrollRight && (
          <button
            type="button"
            onClick={() => handleRailHintClick("right")}
            aria-label="Scroll carousel right"
            className="absolute inset-y-0 right-1 z-20 flex items-center px-1.5 transition-opacity duration-150 opacity-90"
          >
            <svg
              className="h-5 w-5 text-mist-light/70 animate-[swipe-hint_1.2s_ease-in-out_infinite]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Carousel container - reaches side borders */}
        <div
          ref={railScrollRef}
          onScroll={handleRailScroll}
          className="overflow-x-auto scrollbar-hide pb-1.5 scroll-smooth"
          style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", touchAction: "pan-x" }}
        >
          <div className="flex min-w-max gap-2.5 px-1.5 snap-x snap-mandatory [scroll-padding-inline:.5rem]">
            {/* All filter button */}
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => handleFilterSelect("")}
              className={`snap-start flex h-20 min-w-[140px] max-w-[140px] flex-col items-center justify-center rounded-lg border transition-all duration-200 ${
                selectedFilter === ""
                  ? "border-jade-glow/45 bg-ink-dark"
                  : "border-ink-light/30 bg-ink-dark/40 hover:border-ink-light/50"
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-jade-glow">All</span>
              <span className="mt-1 text-[11px] text-mist-light">{communityLogsWithoutUser.length}</span>
            </motion.button>

            {/* Filter options */}
            {filterOptions.map((option, idx) => {
              const matchingLogs = communityLogsWithoutUser.filter((log) => {
                const exercise = exerciseMap[log.exerciseName];
                if (!exercise) return false;
                return (filterMode === "category" ? exercise.category : exercise.primaryMuscles) === option;
              });
              
              return (
                <motion.button
                  key={option}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => handleFilterSelect(option)}
                  className={`snap-start flex h-20 min-w-[140px] max-w-[140px] flex-col items-center justify-center rounded-lg border transition-all duration-200 ${
                    selectedFilter === option
                      ? "border-jade-glow/45 bg-ink-dark"
                      : "border-ink-light/30 bg-ink-dark/40 hover:border-ink-light/50"
                  }`}
                >
                  <span className="line-clamp-1 text-center text-[10px] font-semibold uppercase tracking-wide text-cloud-white px-1">
                    {option}
                  </span>
                  <span className="mt-1 text-[11px] text-mist-light">{matchingLogs.length}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
