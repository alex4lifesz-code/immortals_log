"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ExerciseImageBox from "@/components/exercise/ExerciseImageBox";
import SearchField from "@/components/ui/SearchField";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import {
  DAY_ABBREVIATIONS,
  DAY_LETTERS,
  DAYS_OF_WEEK,
  isDayAssigned,
  parseDayAssignmentDetailsList,
  parseDayAssignments,
  serializeDayAssignmentPayload,
} from "@/lib/constants";
import {
  getDifficultyDisplayName,
  getExerciseDisplayName,
  getExerciseSearchText,
  getTypeDisplayName,
  matchesLooseSearch,
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
  tiers?: Array<{ level: number; name: string }>;
  variations?: Array<{ id: string; name: string }>;
}

interface ExerciseManagementDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  exercises: Exercise[];
  onUpdateDayAssignments: (exerciseId: string, assignedDays: string) => Promise<void>;
  selectedDayFilter?: number | null;
}

function ExerciseAllocationRow({
  exercise,
  focusedDay,
  expanded,
  onToggleExpand,
  onApplyAssignmentPayload,
  isUpdating,
}: {
  exercise: Exercise;
  focusedDay: number | null;
  expanded: boolean;
  onToggleExpand: () => void;
  onApplyAssignmentPayload: (exerciseId: string, assignedDaysPayload: string) => Promise<void>;
  isUpdating: boolean;
}) {
  const { settings } = useDisplaySettings();
  const displayName = getExerciseDisplayName(exercise, settings.terminologyMode, settings.showExerciseForeignLanguage);
  const [selectedProgression, setSelectedProgression] = useState("");
  const [selectedVariant, setSelectedVariant] = useState("");
  const [selectedDay, setSelectedDay] = useState<string>(focusedDay == null ? "" : String(focusedDay));
  const assigned = parseDayAssignments(exercise.assignedDays || "");
  const isAllocated = assigned.length > 0;
  const assignmentDetails = useMemo(() => parseDayAssignmentDetailsList(exercise.assignedDays || ""), [exercise.assignedDays]);

  useEffect(() => {
    if (focusedDay != null) {
      setSelectedDay(String(focusedDay));
    }
  }, [focusedDay]);

  const progressionOptions = useMemo(() => {
    const tiers = Array.isArray(exercise.tiers) ? exercise.tiers : [];
    if (tiers.length === 0) {
      return [{ value: "1", label: "Progression 1" }];
    }

    return [...tiers]
      .sort((a, b) => a.level - b.level)
      .map((tier) => ({ value: String(tier.level), label: tier.name || `Progression ${tier.level}` }));
  }, [exercise.tiers]);

  const variantOptions = useMemo(() => {
    const variations = Array.isArray(exercise.variations) ? exercise.variations : [];
    return variations.map((variation) => ({ value: variation.name, label: variation.name }));
  }, [exercise.variations]);

  const resolveProgressionOption = (rawProgression?: string) => {
    if (!rawProgression) return null;
    return progressionOptions.find((option) => option.value === rawProgression || option.label === rawProgression) || null;
  };

  const getProgressionValue = (rawProgression?: string) => {
    const matched = resolveProgressionOption(rawProgression);
    return matched?.value || (rawProgression || "");
  };

  const getProgressionLabel = (rawProgression?: string) => {
    const matched = resolveProgressionOption(rawProgression);
    return matched?.label || (rawProgression || "");
  };

  const selectedDayNumber = selectedDay === "" ? null : Number(selectedDay);
  const selectedAssignmentsForDay = selectedDayNumber == null ? [] : (assignmentDetails[selectedDayNumber] || []);
  const selectedProgressionValue = selectedProgression || "";
  const selectedCombinationAssigned = selectedAssignmentsForDay.some(
    (entry) => getProgressionValue(entry.progression) === selectedProgressionValue && (entry.variant || "") === (selectedVariant || ""),
  );

  useEffect(() => {
    if (selectedDayNumber == null) {
      setSelectedProgression("");
      setSelectedVariant("");
      return;
    }

    const detail = assignmentDetails[selectedDayNumber];
    if (!detail || detail.length === 0) {
      setSelectedProgression("");
      setSelectedVariant("");
      return;
    }

    const firstDetail = detail[0];

    if (firstDetail.progression) {
      const matched = progressionOptions.find((option) => option.label === firstDetail.progression || option.value === firstDetail.progression);
      setSelectedProgression(matched?.value || "");
    } else {
      setSelectedProgression("");
    }

    if (typeof firstDetail.variant === "string" && firstDetail.variant.length > 0) {
      setSelectedVariant(firstDetail.variant);
    } else {
      setSelectedVariant("");
    }
  }, [assignmentDetails, progressionOptions, selectedDayNumber]);

  const handleApply = async () => {
    if (selectedDayNumber == null) return;
    const shouldAssign = !selectedCombinationAssigned;

    const progressionLabel = progressionOptions.find((option) => option.value === selectedProgression)?.label || undefined;
    const selectedProgressionForCompare = selectedProgression || "";
    const selectedEntry = {
      progression: progressionLabel,
      variant: selectedVariant || undefined,
    };

    if (!shouldAssign) {
      const confirmed = window.confirm(
        `Remove ${displayName} (${selectedVariant || "Default"}${progressionLabel ? `, ${progressionLabel}` : ""}) from ${DAYS_OF_WEEK[selectedDayNumber]}?`,
      );
      if (!confirmed) return;
    }

    const days = new Set(parseDayAssignments(exercise.assignedDays || ""));
    const details = parseDayAssignmentDetailsList(exercise.assignedDays || "");
    const dayEntries = [...(details[selectedDayNumber] || [])];

    if (shouldAssign) {
      days.add(selectedDayNumber);
      dayEntries.push(selectedEntry);
      details[selectedDayNumber] = dayEntries;
    } else {
      const nextEntries = dayEntries.filter(
        (entry) => !(getProgressionValue(entry.progression) === selectedProgressionForCompare && (entry.variant || "") === (selectedEntry.variant || "")),
      );

      if (nextEntries.length === 0) {
        days.delete(selectedDayNumber);
        delete details[selectedDayNumber];
      } else {
        details[selectedDayNumber] = nextEntries;
      }
    }

    const payload = serializeDayAssignmentPayload(Array.from(days), details);
    await onApplyAssignmentPayload(exercise.id, payload);
  };

  return (
    <article
      className="mx-1 my-0.5 rounded-md px-3 py-2.5"
      style={{ borderTop: "none" }}
    >
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center justify-between gap-2 text-left"
        style={{ color: isAllocated ? "var(--jade-light)" : "var(--text-primary)" }}
        aria-expanded={expanded}
      >
        <span className="truncate text-sm font-semibold leading-tight">{displayName}</span>
        <svg
          className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : "rotate-0"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-2">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                  Progression
                </label>
                <select
                  value={selectedProgression}
                  onChange={(event) => setSelectedProgression(event.target.value)}
                  className="h-9 w-full rounded-md border px-2 text-xs outline-none"
                  style={{
                    borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                    backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                    color: "var(--cloud-white)",
                  }}
                >
                  <option value="">Choose progression</option>
                  {progressionOptions.map((option) => (
                    <option key={`${exercise.id}-progression-${option.value}`} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                  Variant
                </label>
                <select
                  value={selectedVariant}
                  onChange={(event) => setSelectedVariant(event.target.value)}
                  className="h-9 w-full rounded-md border px-2 text-xs outline-none"
                  style={{
                    borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                    backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                    color: "var(--cloud-white)",
                  }}
                >
                  <option value="">Choose variant</option>
                  {variantOptions.map((variant) => (
                    <option key={`${exercise.id}-variant-${variant.value || "default"}`} value={variant.value}>
                      {variant.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                  Training day
                </label>
                <select
                  value={selectedDay}
                  onChange={(event) => setSelectedDay(event.target.value)}
                  className="h-9 w-full rounded-md border px-2 text-xs outline-none"
                  style={{
                    borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                    backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                    color: "var(--cloud-white)",
                  }}
                >
                  <option value="">Choose a day</option>
                  {DAYS_OF_WEEK.map((day, dayIndex) => {
                    const isAssignedToDay = assigned.includes(dayIndex);
                    return (
                      <option key={`${exercise.id}-day-${day}`} value={dayIndex}>
                        {`${day}${isAssignedToDay ? " (assigned)" : ""}`}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  Assigned: {assigned.length > 0 ? assigned.map((index) => DAY_ABBREVIATIONS[index]).join(", ") : "None"}
                </p>

                <button
                  type="button"
                  onClick={() => void handleApply()}
                  disabled={isUpdating || selectedDayNumber == null}
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border px-3 text-xs font-semibold transition-colors disabled:opacity-60"
                  style={{
                    borderColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                    backgroundColor: selectedCombinationAssigned
                      ? "color-mix(in srgb, var(--danger) 22%, var(--ink-deep))"
                      : "color-mix(in srgb, var(--accent) 24%, var(--ink-deep))",
                    color: "var(--cloud-white)",
                  }}
                >
                  {isUpdating ? "Saving..." : selectedCombinationAssigned ? "Remove" : "Add"}
                </button>
              </div>

              {selectedDayNumber != null && selectedAssignmentsForDay.length > 0 ? (
                <div className="rounded-md border px-2 py-1.5" style={{ borderColor: "color-mix(in srgb, var(--ink-light) 60%, transparent)" }}>
                  <p className="mb-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                    Assigned setups for {DAYS_OF_WEEK[selectedDayNumber]}:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedAssignmentsForDay.map((entry, index) => {
                      const progressionLabel = getProgressionLabel(entry.progression);
                      const label = `${entry.variant || "Default"}${progressionLabel ? ` • ${progressionLabel}` : ""}`;
                      const isActive = getProgressionValue(entry.progression) === selectedProgressionValue
                        && (entry.variant || "") === (selectedVariant || "");
                      return (
                        <button
                          key={`${exercise.id}-assigned-entry-${selectedDayNumber}-${index}`}
                          type="button"
                          onClick={() => {
                            const matched = resolveProgressionOption(entry.progression);
                            setSelectedProgression(matched?.value || "");
                            setSelectedVariant(entry.variant || "");
                          }}
                          className="inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-medium"
                          style={{
                            borderColor: isActive
                              ? "color-mix(in srgb, var(--accent) 55%, transparent)"
                              : "color-mix(in srgb, var(--ink-light) 62%, transparent)",
                            backgroundColor: isActive
                              ? "color-mix(in srgb, var(--accent) 20%, var(--ink-deep))"
                              : "color-mix(in srgb, var(--ink-mid) 86%, var(--ink-deep))",
                            color: isActive ? "var(--cloud-white)" : "var(--text-muted)",
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </article>
  );
}

export default function ExerciseManagementDrawer({
  isOpen,
  onClose,
  exercises,
  onUpdateDayAssignments,
  selectedDayFilter: _selectedDayFilter = null,
}: ExerciseManagementDrawerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [sortBy, setSortBy] = useState<"name-az" | "name-za" | "realm-az" | "path-az" | "custom">("name-az");
  const [sortManuallySelected, setSortManuallySelected] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [updatingExerciseId, setUpdatingExerciseId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [isOpen, onClose]);

  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    for (const exercise of exercises) {
      const value = (exercise.type || "").trim();
      if (value) set.add(value);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [exercises]);

  const availableDifficulties = useMemo(() => {
    const set = new Set<string>();
    for (const exercise of exercises) {
      const value = (exercise.difficulty || "").trim();
      if (value) set.add(value);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [exercises]);

  const dayCounts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const exercise of exercises) {
      const assigned = parseDayAssignments(exercise.assignedDays || "");
      for (const day of assigned) {
        if (day >= 0 && day <= 6) counts[day] += 1;
      }
    }
    return counts;
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    return exercises.filter((exercise) => {
      const matchesSearch = matchesLooseSearch(getExerciseSearchText(exercise), searchTerm);
      const matchesDay = dayFilter == null || isDayAssigned(exercise.assignedDays || "", dayFilter);
      const matchesType = !typeFilter || exercise.type === typeFilter;
      const matchesDifficulty = !difficultyFilter || exercise.difficulty === difficultyFilter;
      return matchesSearch && matchesDay && matchesType && matchesDifficulty;
    });
  }, [dayFilter, difficultyFilter, exercises, searchTerm, typeFilter]);

  const sortedFilteredExercises = useMemo(() => {
    const list = [...filteredExercises];

    const compareAssignedFirst = (left: Exercise, right: Exercise): number => {
      const leftAssigned = parseDayAssignments(left.assignedDays || "").length > 0;
      const rightAssigned = parseDayAssignments(right.assignedDays || "").length > 0;
      if (leftAssigned === rightAssigned) return 0;
      return leftAssigned ? -1 : 1;
    };

    if (!sortManuallySelected) {
      return list.sort((left, right) => {
        const assignedCompare = compareAssignedFirst(left, right);
        if (assignedCompare !== 0) return assignedCompare;
        return left.name.localeCompare(right.name);
      });
    }

    if (sortBy === "custom") {
      return list.sort((left, right) => left.name.localeCompare(right.name));
    }

    if (sortBy === "name-za") {
      return list.sort((left, right) => right.name.localeCompare(left.name));
    }

    if (sortBy === "realm-az") {
      return list.sort((left, right) => {
        const realmCompare = (left.difficulty || "").localeCompare(right.difficulty || "");
        if (realmCompare !== 0) return realmCompare;
        return left.name.localeCompare(right.name);
      });
    }

    if (sortBy === "path-az") {
      return list.sort((left, right) => {
        const pathCompare = (left.type || "").localeCompare(right.type || "");
        if (pathCompare !== 0) return pathCompare;
        return left.name.localeCompare(right.name);
      });
    }

    return list.sort((left, right) => left.name.localeCompare(right.name));
  }, [filteredExercises, sortBy, sortManuallySelected]);

  const clearFilters = () => {
    setSearchTerm("");
    setDayFilter(null);
    setTypeFilter("");
    setDifficultyFilter("");
    setSortBy("name-az");
    setSortManuallySelected(false);
  };

  const hasActiveFilters = Boolean(dayFilter != null || typeFilter || difficultyFilter || sortBy !== "name-az" || sortManuallySelected);

  const handleApplyAssignmentPayload = async (exerciseId: string, assignedDaysPayload: string) => {
    setUpdatingExerciseId(exerciseId);
    try {
      await onUpdateDayAssignments(exerciseId, assignedDaysPayload);
    } finally {
      setUpdatingExerciseId(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            key="exercise-management-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-y-0 right-0 z-[200]"
            style={{
              left: "64px",
              backgroundColor: "color-mix(in srgb, var(--void-black) 76%, transparent)",
            }}
            onClick={onClose}
          />

          <motion.aside
            key="exercise-management-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-y-0 right-0 z-[201] overflow-hidden border-l safe-area-top safe-area-bottom safe-area-right"
            style={{
              left: "64px",
              borderLeftColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
            }}
          >
            <div className="h-full overflow-hidden" style={{ backgroundColor: "color-mix(in srgb, var(--ink-mid) 20%, var(--ink-deep))" }}>
              <div data-mobile-scroll-container="true" className="h-full overflow-y-auto scrollbar-hide" style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain" }}>
                <div className="sticky top-0 z-20" style={{ backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))" }}>
                  <div className="px-3 pt-[calc(env(safe-area-inset-top,0px)+10px)] pb-2.5" style={{ backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))" }}>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md"
                        style={{ color: "var(--mist-light)", backgroundColor: "transparent" }}
                        aria-label="Close day allocation drawer"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <h2 className="truncate text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--mist-light)" }}>
                        Edit Day Allocations
                      </h2>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <SearchField
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Search exercises"
                        aria-label="Search exercises"
                        wrapperClassName="min-w-0 flex-1"
                        className="h-8 min-w-0 text-sm"
                        style={{
                          borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                          backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                          color: "var(--cloud-white)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setFilterOpen(true)}
                        className="theme-control-btn relative inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors"
                        aria-label="Open allocation filters"
                      >
                        <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M6 12h12m-9 7h6" />
                        </svg>
                        {hasActiveFilters ? (
                          <span className="absolute right-0.5 top-1 h-2 w-2 rounded-full" style={{ backgroundColor: "var(--accent)" }} />
                        ) : null}
                      </button>
                    </div>
                  </div>
                  <div className="h-px" style={{ backgroundColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)" }} />
                </div>

                <AnimatePresence>
                  {filterOpen ? (
                    <>
                      <motion.div
                        key="allocation-filter-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        className="fixed inset-0 z-[245]"
                        style={{ backgroundColor: "color-mix(in srgb, var(--void-black) 72%, transparent)" }}
                        onClick={() => setFilterOpen(false)}
                      />
                      <motion.aside
                        key="allocation-filter-drawer"
                        initial={{ x: "100%", opacity: 0.98 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: "100%", opacity: 0.98 }}
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        className="fixed inset-y-0 right-0 z-[250] flex max-h-[100dvh] w-[min(22rem,92vw)] flex-col overflow-hidden border-l shadow-2xl safe-area-top safe-area-bottom safe-area-right"
                        style={{
                          borderColor: "color-mix(in srgb, var(--jade-glow) 18%, var(--ink-light))",
                          background: "linear-gradient(180deg, color-mix(in srgb, var(--ink-dark) 98%, transparent) 0%, color-mix(in srgb, var(--ink-mid) 92%, transparent) 100%)",
                          boxShadow: "0 18px 56px rgba(0, 0, 0, 0.45)",
                        }}
                      >
                        <div className="shrink-0 border-b px-4 pb-3 pt-[max(env(safe-area-inset-top,0px),1rem)]" style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 55%, transparent)" }}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Filters</p>
                              <h2 className="mt-1 text-base font-semibold text-[var(--text-primary)]">Refine Allocation Results</h2>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFilterOpen(false)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-[var(--mist-mid)] transition hover:text-[var(--text-primary)]"
                              style={{
                                borderColor: "color-mix(in srgb, var(--ink-light) 55%, transparent)",
                                backgroundColor: "color-mix(in srgb, var(--ink-mid) 88%, var(--ink-deep))",
                              }}
                              aria-label="Close allocation filters"
                            >
                              x
                            </button>
                          </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
                          <div className="space-y-4">
                            <div>
                              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">Training day</label>
                              <select
                                value={dayFilter == null ? "all" : String(dayFilter)}
                                onChange={(event) => setDayFilter(event.target.value === "all" ? null : Number(event.target.value))}
                                className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                                style={{
                                  borderColor: "var(--border)",
                                  backgroundColor: "var(--void-black)",
                                  color: "var(--text-primary)",
                                }}
                              >
                                <option value="all">All training days</option>
                                {DAYS_OF_WEEK.map((day, dayIndex) => (
                                  <option key={`allocation-day-${day}`} value={dayIndex}>
                                    {`${day} (${dayCounts[dayIndex]})`}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">Difficulty level</label>
                              <select
                                value={difficultyFilter}
                                onChange={(event) => setDifficultyFilter(event.target.value)}
                                className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                                style={{
                                  borderColor: "var(--border)",
                                  backgroundColor: "var(--void-black)",
                                  color: "var(--text-primary)",
                                }}
                              >
                                <option value="">All difficulty levels</option>
                                {availableDifficulties.map((difficulty) => (
                                  <option key={difficulty} value={difficulty}>{difficulty}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">Exercise type</label>
                              <select
                                value={typeFilter}
                                onChange={(event) => setTypeFilter(event.target.value)}
                                className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                                style={{
                                  borderColor: "var(--border)",
                                  backgroundColor: "var(--void-black)",
                                  color: "var(--text-primary)",
                                }}
                              >
                                <option value="">All exercise types</option>
                                {availableTypes.map((type) => (
                                  <option key={type} value={type}>{type}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">Sort order</label>
                              <select
                                value={sortBy}
                                onChange={(event) => {
                                  setSortManuallySelected(true);
                                  setSortBy(event.target.value as "name-az" | "name-za" | "realm-az" | "path-az" | "custom");
                                }}
                                className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                                style={{
                                  borderColor: "var(--border)",
                                  backgroundColor: "var(--void-black)",
                                  color: "var(--text-primary)",
                                }}
                              >
                                <option value="name-az">Exercise name (A to Z)</option>
                                <option value="name-za">Exercise name (Z to A)</option>
                                <option value="realm-az">Difficulty level (A to Z)</option>
                                <option value="path-az">Exercise type (A to Z)</option>
                                <option value="custom">Manual order (drag and drop)</option>
                              </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <button
                                type="button"
                                onClick={clearFilters}
                                className="h-11 rounded-xl border px-3 text-sm font-medium text-[var(--text-primary)] transition-colors"
                                style={{ borderColor: "var(--border)", backgroundColor: "var(--void-black)" }}
                              >
                                Reset
                              </button>
                              <button
                                type="button"
                                onClick={() => setFilterOpen(false)}
                                className="h-11 rounded-xl border px-3 text-sm font-semibold text-[var(--void-black)] transition-colors"
                                style={{ borderColor: "color-mix(in srgb, var(--forest) 42%, transparent)", backgroundColor: "var(--forest)" }}
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.aside>
                    </>
                  ) : null}
                </AnimatePresence>

                {sortedFilteredExercises.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                    No exercises match your current filters.
                  </div>
                ) : (
                  <div>
                    {sortedFilteredExercises.map((exercise) => (
                      <ExerciseAllocationRow
                        key={exercise.id}
                        exercise={exercise}
                        focusedDay={dayFilter}
                        expanded={expandedExerciseId === exercise.id}
                        onToggleExpand={() => setExpandedExerciseId((prev) => (prev === exercise.id ? null : exercise.id))}
                        isUpdating={updatingExerciseId === exercise.id}
                        onApplyAssignmentPayload={handleApplyAssignmentPayload}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
