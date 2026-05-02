"use client";

import { motion } from "framer-motion";
import { memo, useMemo } from "react";
import type { CalendarWeekStartOption } from "@/context/DisplaySettingsContext";
import {
  DAY_ABBREVIATIONS,
  DAY_LETTERS,
  DAYS_OF_WEEK,
  resolveCalendarWeekStartsOn,
} from "@/lib/constants";

type TrainDayRailProps = {
  selectedDayFilter: number | null;
  dayExerciseCounts: number[];
  dayAssignmentCounts?: number[];
  hideEmptyDays?: boolean;
  calendarWeekStart?: CalendarWeekStartOption;
  timeZone?: string;
  onSelectDay: (dayIndex: number | null) => void;
  onOpenOverview: () => void;
  overviewOpen: boolean;
};

function TrainDayRail({
  selectedDayFilter,
  dayExerciseCounts,
  dayAssignmentCounts,
  hideEmptyDays = false,
  calendarWeekStart = "sunday",
  timeZone,
  onSelectDay,
  onOpenOverview,
  overviewOpen,
}: TrainDayRailProps) {
  const orderedDayIndexes = useMemo(() => {
    const weekStartsOn = resolveCalendarWeekStartsOn(calendarWeekStart, timeZone);
    if (weekStartsOn === 1) return [1, 2, 3, 4, 5, 6, 0];
    return [0, 1, 2, 3, 4, 5, 6];
  }, [calendarWeekStart, timeZone]);

  const visibleDayIndexes = useMemo(() => {
    if (!hideEmptyDays) return orderedDayIndexes;
    const sourceCounts = dayAssignmentCounts ?? dayExerciseCounts;
    const filtered = orderedDayIndexes.filter((dayIndex) => (sourceCounts[dayIndex] || 0) > 0);
    if (selectedDayFilter != null && !filtered.includes(selectedDayFilter)) {
      return [selectedDayFilter, ...filtered.filter((dayIndex) => dayIndex !== selectedDayFilter)];
    }
    return filtered;
  }, [dayAssignmentCounts, dayExerciseCounts, hideEmptyDays, orderedDayIndexes, selectedDayFilter]);

  const isOverviewActive = overviewOpen;

  return (
    <aside
      className="flex h-full w-[64px] md:w-[76px] shrink-0"
      style={{
        borderRightWidth: 0,
        borderRightColor: "transparent",
        background: "var(--sidebar-canvas-bg)",
      }}
    >
      <div className="flex h-full w-full -translate-x-px flex-col items-center gap-3 px-2 pt-[calc(env(safe-area-inset-top,0px)+2.25rem)] pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] md:pt-[calc(env(safe-area-inset-top,0px)+2.5rem)] md:pb-3">
        <div className="flex w-full items-center justify-center">
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              onSelectDay(null);
              onOpenOverview();
            }}
            aria-current={isOverviewActive ? "page" : undefined}
            aria-label="Open day assignment overview"
            className="relative mx-auto flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-2xl border transition-colors duration-150"
            style={{
              borderColor: isOverviewActive
                ? "color-mix(in srgb, var(--accent) 62%, transparent)"
                : "transparent",
              backgroundColor: isOverviewActive
                ? "var(--jade)"
                : "color-mix(in srgb, var(--surface-hover) 92%, var(--surface))",
              color: isOverviewActive ? "var(--pure-white)" : "var(--mist-light)",
              boxShadow: isOverviewActive
                ? "0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent), 0 10px 22px color-mix(in srgb, var(--accent) 28%, transparent)"
                : "none",
            }}
            title="Overview"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.9}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
            </svg>

            {isOverviewActive && (
              <span
                className="pointer-events-none absolute -left-1.5 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full"
                style={{ backgroundColor: "var(--cloud-white)" }}
              />
            )}

          </motion.button>
        </div>

        <div className="flex w-full items-center justify-center">
          <div className="h-px w-8" style={{ backgroundColor: "color-mix(in srgb, var(--sidebar-canvas-border) 88%, transparent)" }} />
        </div>

        <div data-mobile-scroll-container="true" className="scrollbar-hide flex w-full min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto">
          {visibleDayIndexes.map((dayIndex) => {
            const isSelected = selectedDayFilter === dayIndex;
            const count = dayExerciseCounts[dayIndex] || 0;
            const dayLabel = DAYS_OF_WEEK[dayIndex];
            return (
              <button
                key={dayLabel}
                type="button"
                onClick={() => onSelectDay(dayIndex)}
                className="group relative mx-auto flex h-12 w-12 items-center justify-center text-center transition-all duration-150 md:h-14 md:w-14"
                style={{
                  borderColor: "transparent",
                  backgroundColor: "transparent",
                  boxShadow: "none",
                }}
                title={`${DAY_ABBREVIATIONS[dayIndex]} (${count})`}
                aria-label={`View ${dayLabel} exercises`}
                aria-pressed={isSelected}
              >
                {isSelected && (
                  <span
                    className="pointer-events-none absolute -left-1.5 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full"
                    style={{ backgroundColor: "var(--cloud-white)" }}
                  />
                )}

                <span
                  className="relative mx-auto flex h-10 w-10 items-center justify-center rounded-full border font-semibold transition-all duration-150 md:h-11 md:w-11"
                  style={{
                    color: "var(--cloud-white)",
                    fontSize: "10px",
                    transform: count > 0 ? "translateX(-1px)" : "translateX(0)",
                    borderColor: isSelected
                      ? "color-mix(in srgb, var(--accent) 72%, transparent)"
                      : "transparent",
                    backgroundColor: isSelected
                      ? "color-mix(in srgb, var(--accent) 30%, var(--surface))"
                      : "color-mix(in srgb, var(--surface-hover) 92%, var(--surface))",
                    boxShadow: isSelected
                      ? "0 0 0 2px color-mix(in srgb, var(--accent) 22%, transparent)"
                      : "none",
                  }}
                >
                  {DAY_LETTERS[dayIndex]}
                  {count > 0 && (
                    <span
                      className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
                      style={{
                        backgroundColor: "var(--danger)",
                        color: "var(--pure-white)",
                      }}
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

export default memo(TrainDayRail);
