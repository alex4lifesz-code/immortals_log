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
  onFilterChange: (mode: FilterMode, selectedFilter: string) => void;
}

export default function ExerciseStatsCarousel({
  exercises,
  communityLogs,
  currentUserId,
  onFilterChange,
}: ExerciseStatsCarouselProps) {
  const [filterMode, setFilterMode] = useState<FilterMode>("category");
  const [selectedFilter, setSelectedFilter] = useState<string>("");
  const [railHasScrolled, setRailHasScrolled] = useState(false);
  const [railCanScroll, setRailCanScroll] = useState(false);
  const [railHintDirection, setRailHintDirection] = useState<"left" | "right">("right");
  const railScrollRef = useRef<HTMLDivElement | null>(null);
  const railLastScrollLeftRef = useRef(0);

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
    const previous = railLastScrollLeftRef.current;

    if (el.scrollLeft === 0) {
      setRailHasScrolled(false);
      setRailHintDirection("right");
    } else {
      setRailHasScrolled(true);
      if (el.scrollLeft > previous + 0.5) setRailHintDirection("right");
      if (el.scrollLeft < previous - 0.5) setRailHintDirection("left");
    }

    railLastScrollLeftRef.current = el.scrollLeft;
  };

  const handleRailWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!railScrollRef.current) return;
    e.preventDefault();
    railScrollRef.current.scrollLeft += e.deltaY;
  };

  useEffect(() => {
    const el = railScrollRef.current;
    if (!el) return;

    const updateCanScroll = () => {
      setRailCanScroll(el.scrollWidth > el.clientWidth);
    };

    updateCanScroll();
    window.addEventListener("resize", updateCanScroll);
    return () => window.removeEventListener("resize", updateCanScroll);
  }, [filterOptions]);

  const handleRailHintClick = () => {
    if (!railScrollRef.current) return;
    const delta = railHintDirection === "right" ? 168 : -168;
    railScrollRef.current.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <div className="sticky top-0 z-40 -mx-3 -mt-3 flex flex-col bg-ink-deep/50 border-b border-jade-glow/10">
      {/* Filter toggle */}
      <div className="flex items-center justify-end px-3 py-2">
        <div className="flex gap-2 rounded-lg border border-jade-glow/20 bg-ink-dark/30 p-1.5">
          {["category", "muscle-group"].map((mode) => (
            <button
              key={mode}
              onClick={() => handleFilterModeChange(mode as FilterMode)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                filterMode === mode
                  ? "bg-jade-glow/20 text-jade-light border border-jade-glow/40"
                  : "text-mist-light/70 hover:text-mist-light border border-transparent hover:border-jade-glow/20"
              }`}
            >
              {mode === "category" ? "Category" : "Muscle"}
            </button>
          ))}
        </div>
      </div>

      {/* Carousel - no rounded corners on container */}
      <div className="relative px-3">
        {/* Left gradient overlay */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-ink-deep/50 to-transparent" />
        
        {/* Right gradient overlay */}
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-ink-deep/50 to-transparent" />

        {/* Scroll hint button */}
        {railCanScroll && (
          <button
            type="button"
            onClick={handleRailHintClick}
            aria-label={railHintDirection === "right" ? "Scroll carousel right" : "Scroll carousel left"}
            className={`absolute inset-y-0 z-20 flex items-center px-1.5 transition-opacity duration-150 ${
              railHintDirection === "right" ? "right-1" : "left-1"
            } ${railHasScrolled ? "opacity-70" : "opacity-100"}`}
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

        {/* Carousel container - reaches side borders */}
        <div
          ref={railScrollRef}
          onScroll={handleRailScroll}
          onWheelCapture={handleRailWheel}
          onWheel={handleRailWheel}
          className="overflow-x-auto scrollbar-hide pb-1.5 scroll-smooth"
          style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", touchAction: "pan-x" }}
        >
          <div className="flex min-w-max gap-2 px-1.5 snap-x snap-mandatory [scroll-padding-inline:.5rem]">
            {/* All filter button */}
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => handleFilterSelect("")}
              className={`snap-start flex h-20 min-w-[140px] max-w-[140px] flex-col items-center justify-center rounded-lg border transition-all duration-200 ${
                selectedFilter === ""
                  ? "border-jade-glow/40 bg-jade-glow/10"
                  : "border-jade-glow/15 bg-ink-dark/40 hover:border-jade-glow/25"
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide text-jade-light">All</span>
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
                      ? "border-jade-glow/40 bg-jade-glow/10"
                      : "border-jade-glow/15 bg-ink-dark/40 hover:border-jade-glow/25"
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
