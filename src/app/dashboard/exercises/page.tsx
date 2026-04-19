"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import PageLayout from "@/components/layout/PageLayout";
import SearchField from "@/components/ui/SearchField";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { api } from "@/lib/api-client";
import { getExerciseDisplayName, matchesLooseSearchInFields } from "@/lib/exercise-name";
import { rankExerciseSearchResults } from "@/lib/exercise-search";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import { isDeletedExerciseDescription } from "@/lib/pending-exercises";
import type { ProgressionExercise, ProgressionLog } from "../workout/types";

type ProgressionsResponse = {
  exercises?: ProgressionExercise[];
};

type CategoryFilter = "all" | string;
type ActivityFilter = "all" | "logged" | "unlogged";
type SortBy = "recent" | "name" | "relevant";

function compareLogRecency(a: Pick<ProgressionLog, "id" | "createdAt">, b: Pick<ProgressionLog, "id" | "createdAt">): number {
  const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  if (timeDiff !== 0) return timeDiff;
  return b.id.localeCompare(a.id);
}

function formatRelativeRecentDate(dateLike: string | null | undefined): string {
  if (!dateLike) return "Not logged";
  const timestamp = new Date(dateLike).getTime();
  if (!Number.isFinite(timestamp)) return "Not logged";

  const diffMs = Date.now() - timestamp;
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < hourMs) return `${Math.max(1, Math.floor(diffMs / minuteMs))}m ago`;
  if (diffMs < dayMs) return `${Math.max(1, Math.floor(diffMs / hourMs))}h ago`;
  if (diffMs < 14 * dayMs) {
    const days = Math.max(1, Math.floor(diffMs / dayMs));
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  return new Date(timestamp).toLocaleDateString();
}

function getRecentExerciseTextColor(dateLike: string | null | undefined): string {
  if (!dateLike) return "var(--cloud-white)";

  const timestamp = new Date(dateLike).getTime();
  if (!Number.isFinite(timestamp)) return "var(--cloud-white)";

  const diffMs = Math.max(0, Date.now() - timestamp);
  const dayMs = 24 * 60 * 60 * 1000;

  if (diffMs <= 7 * dayMs) {
    return "color-mix(in srgb, var(--cultivator-amber) 68%, white 32%)";
  }

  if (diffMs <= 14 * dayMs) {
    return "color-mix(in srgb, var(--cultivator-amber) 58%, var(--mist-light) 42%)";
  }

  return "var(--cloud-white)";
}

function getPrimaryCategory(category: string | null | undefined): string {
  const raw = String(category || "").trim();
  if (!raw) return "Other";
  return raw.split(",")[0]?.trim() || "Other";
}

function getExerciseFormatLabel(exercise: ProgressionExercise): string {
  if (exercise.weighted) return "Weighted";
  if (exercise.bodyweight) return "Bodyweight";

  const category = String(exercise.category || "").toLowerCase();
  if (category.includes("yoga") || category.includes("stretch")) return "Timed";
  return "Movement";
}

function getLogsWithinDays(logs: ProgressionLog[], days: number): ProgressionLog[] {
  const now = Date.now();
  const limit = days * 24 * 60 * 60 * 1000;
  return logs.filter((log) => now - new Date(log.createdAt).getTime() <= limit);
}

function buildDisplayItems(values: Array<string | null | undefined>): string[] {
  const items = Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
  return items.length > 0 ? items : ["-"];
}

export default function ExercisesCanvasPage() {
  const { settings } = useDisplaySettings();
  const { user } = useAuth();
  const displayTerminologyMode = !settings.showExerciseForeignLanguage && settings.languageMode === "english"
    ? "normal"
    : settings.terminologyMode;

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [exercises, setExercises] = useState<ProgressionExercise[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const sortPreferenceRef = useRef<Exclude<SortBy, "relevant">>("recent");

  useEffect(() => {
    let cancelled = false;

    const loadExercises = async () => {
      setLoading(true);
      setErrorMessage("");

      try {
        const data = await api.get<ProgressionsResponse>("/api/progressions/history?logLimit=50&exerciseLimit=500", { cache: "no-store" });
        if (!cancelled) {
          const visibleExercises = Array.isArray(data.exercises)
            ? data.exercises.filter((exercise) => !isDeletedExerciseDescription(exercise.story))
            : [];
          setExercises(visibleExercises);
        }
      } catch (error) {
        console.error("Failed to load exercises:", error);
        if (!cancelled) {
          setExercises([]);
          setErrorMessage("Could not load the exercises right now.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadExercises();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (sortBy !== "relevant") {
      sortPreferenceRef.current = sortBy;
    }
  }, [sortBy]);

  useEffect(() => {
    const hasQuery = search.trim().length > 0;
    if (hasQuery) {
      if (sortBy !== "relevant") setSortBy("relevant");
    } else if (sortBy === "relevant") {
      setSortBy(sortPreferenceRef.current);
    }
  }, [search, sortBy]);

  const categoryOptions = useMemo(() => {
    const values = Array.from(new Set(exercises.map((exercise) => getPrimaryCategory(exercise.category)).filter(Boolean)));
    values.sort((a, b) => a.localeCompare(b));
    return ["all", ...values];
  }, [exercises]);

  const exerciseRows = useMemo(() => {
    return exercises.filter((exercise) => !isDeletedExerciseDescription(exercise.story)).map((exercise) => {
      const logs = exercise.userProgress?.[0]?.logs ?? [];
      const latestLog = logs.length > 0 ? [...logs].sort(compareLogRecency)[0] : null;
      const level = latestLog?.level ?? exercise.userProgress?.[0]?.currentLevel ?? exercise.tiers?.[0]?.level ?? 1;
      const progressionName = exercise.tiers.find((tier) => tier.level === level)?.name ?? `Progression ${level}`;
      const displayName = getExerciseDisplayName(exercise, displayTerminologyMode, settings.showExerciseForeignLanguage);
      const category = getPrimaryCategory(exercise.category);
      const formatLabel = getExerciseFormatLabel(exercise);
      const recentText = latestLog
        ? `Recent: ${latestLog.variant ? `${latestLog.variant} ` : ""}${progressionName}`
        : `Ready: ${progressionName}`;

      return {
        exercise,
        displayName,
        category,
        formatLabel,
        latestLogAt: latestLog?.createdAt ?? null,
        recentText,
        variationValues: buildDisplayItems(exercise.variations.map((variation) => variation.name)),
        progressionValues: buildDisplayItems(exercise.tiers.map((tier) => tier.name)),
        totalLogs: logs.length,
        sessions14d: getLogsWithinDays(logs, 14).length,
      };
    });
  }, [displayTerminologyMode, exercises, settings.showExerciseForeignLanguage]);

  const summary = useMemo(() => {
    const total = exerciseRows.length;
    const logged = exerciseRows.filter((row) => row.totalLogs > 0).length;
    const active14d = exerciseRows.filter((row) => row.sessions14d > 0).length;
    const categories = new Set(exerciseRows.map((row) => row.category).filter(Boolean)).size;
    return { total, logged, active14d, categories };
  }, [exerciseRows]);

  const visibleRows = useMemo(() => {
    const query = search.trim();
    const list = exerciseRows.filter((row) => {
      if (categoryFilter !== "all" && row.category !== categoryFilter) return false;
      if (activityFilter === "logged" && row.totalLogs === 0) return false;
      if (activityFilter === "unlogged" && row.totalLogs > 0) return false;

      if (!query) return true;

      return matchesLooseSearchInFields(query, [
        row.displayName,
        row.exercise.name,
        row.exercise.englishName,
        row.exercise.vietnameseName,
        row.category,
        row.formatLabel,
        row.exercise.story,
        row.exercise.primaryMuscles,
        row.exercise.secondaryMuscles,
        ...row.exercise.tiers.map((tier) => tier.name),
        ...row.exercise.variations.map((variation) => variation.name),
      ]);
    });

    if (sortBy === "relevant" && query) {
      return rankExerciseSearchResults(
        list.map((row) => ({
          ...row,
          displayLabel: row.displayName,
          canonicalName: row.exercise.name || row.displayName,
          searchLabel: [
            row.displayName,
            row.exercise.name,
            row.exercise.englishName,
            row.exercise.vietnameseName,
            row.category,
            row.formatLabel,
            row.exercise.story,
            row.exercise.primaryMuscles,
            row.exercise.secondaryMuscles,
            ...row.exercise.tiers.map((tier) => tier.name),
            ...row.exercise.variations.map((variation) => variation.name),
          ].filter(Boolean).join(" "),
          hasHistory: row.totalLogs > 0,
          lastLoggedAt: row.latestLogAt,
          matchSource: "name" as const,
        })),
        query,
      );
    }

    return [...list].sort((a, b) => {
      if (sortBy === "name") return a.displayName.localeCompare(b.displayName);
      const left = a.latestLogAt ? new Date(a.latestLogAt).getTime() : Number.NEGATIVE_INFINITY;
      const right = b.latestLogAt ? new Date(b.latestLogAt).getTime() : Number.NEGATIVE_INFINITY;
      if (left !== right) return right - left;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [activityFilter, categoryFilter, exerciseRows, search, sortBy]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filtersActive = categoryFilter !== "all" || activityFilter !== "all" || sortBy !== "recent";

  return (
    <PageLayout
      title="Exercises"
      subtitle="Workout-history style exercise list"
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="space-y-3 px-0 py-2 sm:space-y-4 sm:py-3">
        <section
          className="overflow-hidden rounded-xl border"
          style={{
            borderColor: "color-mix(in srgb, var(--ink-light) 56%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
          }}
        >
          <div
            className="border-b px-3 py-3 sm:px-4"
            style={{
              borderBottomColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))",
            }}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-jade-glow/80">
                  Train canvas
                </p>
                <h1 className="text-xl font-semibold text-cloud-white sm:text-2xl">
                  Exercises
                </h1>
                <p className="max-w-2xl text-sm text-mist-light">
                  The list now follows the flatter workout history style, with recent activity shown first.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {user?.role === "admin" ? (
                  <Link
                    href="/dashboard/exercise-db"
                    className="theme-action-btn rounded-lg border px-3 py-2 text-sm font-medium transition hover:scale-[1.02]"
                  >
                    Exercise DB
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 px-3 py-3 text-sm sm:px-4">
            <span className="text-mist-light"><span className="font-semibold text-cloud-white">{summary.total}</span> exercises</span>
            <span className="text-mist-light"><span className="font-semibold text-cloud-white">{summary.logged}</span> logged</span>
            <span className="text-mist-light"><span className="font-semibold text-cloud-white">{summary.active14d}</span> active in 14d</span>
            <span className="text-mist-light"><span className="font-semibold text-cloud-white">{summary.categories}</span> categories</span>
          </div>
        </section>


        {errorMessage ? (
          <section
            className="rounded-xl border px-4 py-3 text-sm text-rose-200"
            style={{
              borderColor: "rgba(251, 113, 133, 0.45)",
              backgroundColor: "rgba(127, 29, 29, 0.25)",
            }}
          >
            {errorMessage}
          </section>
        ) : null}

        {loading ? (
          <section
            className="rounded-xl border px-4 py-8 text-sm text-mist-light"
            style={{
              borderColor: "color-mix(in srgb, var(--ink-light) 50%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))",
            }}
          >
            Loading exercises...
          </section>
        ) : null}

        {!loading && !errorMessage ? (
          <section
            className="overflow-hidden rounded-xl border"
            style={{
              borderColor: "color-mix(in srgb, var(--ink-light) 52%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--ink-deep) 95%, var(--ink-mid))",
            }}
          >
            <div
              className="border-b px-3 py-2.5 sm:px-4"
              style={{
                borderBottomColor: "color-mix(in srgb, var(--ink-light) 40%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--ink-deep) 92%, var(--ink-mid))",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-cloud-white">Exercise list</h2>
                  <p className="text-xs text-mist-light">Tap a row to expand.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSearchOpen((prev) => !prev)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-mist-light transition hover:border-jade-glow/60 hover:text-cloud-white"
                    style={{
                      borderColor: "color-mix(in srgb, var(--ink-light) 55%, transparent)",
                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 88%, var(--ink-deep))",
                    }}
                    aria-label="Open search"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden>
                      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M13.5 13.5L18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterDrawerOpen(true)}
                    className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border text-mist-light transition hover:border-jade-glow/60 hover:text-cloud-white"
                    style={{
                      borderColor: "color-mix(in srgb, var(--ink-light) 55%, transparent)",
                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 88%, var(--ink-deep))",
                    }}
                    aria-label="Open filters"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M6 12h12m-9 7h6" />
                    </svg>
                    {filtersActive ? (
                      <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-jade-glow" />
                    ) : null}
                  </button>
                </div>
              </div>
            </div>

            {searchOpen ? (
              <div className="border-b px-3 py-2.5 sm:px-4" style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 30%, transparent)" }}>
                <SearchField
                  value={search}
                  onChange={setSearch}
                  placeholder="Search exercises"
                  aria-label="Search exercises"
                  className="rounded-lg py-2 text-sm text-cloud-white"
                  style={{
                    borderColor: "color-mix(in srgb, var(--ink-light) 45%, transparent)",
                    backgroundColor: "color-mix(in srgb, var(--ink-mid) 88%, var(--ink-deep))",
                  }}
                />
              </div>
            ) : null}

            <div>
              {visibleRows.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <h2 className="text-lg font-semibold text-cloud-white">No exercises matched</h2>
                  <p className="mt-1 text-sm text-mist-light">Try loosening the search or switching filters.</p>
                </div>
              ) : visibleRows.map((row) => {
                const detailHref = `/dashboard/train/${encodeURIComponent(row.exercise.id)}?from=exercises`;
                const isExpanded = Boolean(expandedIds[row.exercise.id]);

                return (
                  <article
                    key={row.exercise.id}
                    className="mx-1 my-0.5 rounded-md border-t"
                    style={{
                      borderTopColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                      backgroundColor: isExpanded ? "color-mix(in srgb, var(--ink-mid) 22%, var(--ink-deep))" : "transparent",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpanded(row.exercise.id)}
                      className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left sm:px-4"
                      aria-expanded={isExpanded}
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-sm font-semibold leading-tight sm:text-[14px]"
                          style={{ color: getRecentExerciseTextColor(row.latestLogAt) }}
                        >
                          {row.displayName}
                        </p>
                      </div>
                      <div className="ml-2 flex items-center gap-2">
                        <span className="shrink-0 text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {formatRelativeRecentDate(row.latestLogAt)}
                        </span>
                        <span className="text-[10px] text-mist-light">{isExpanded ? "▾" : "▸"}</span>
                      </div>
                    </button>

                    {isExpanded ? (
                      <div className="px-3 pb-2.5 sm:px-4">
                        <div
                          className="overflow-hidden rounded-md border"
                          style={{
                            borderColor: "color-mix(in srgb, var(--ink-light) 45%, transparent)",
                            backgroundColor: "color-mix(in srgb, var(--ink-mid) 86%, var(--ink-deep))",
                          }}
                        >
                          <div className="grid gap-0 text-[11px]">
                            <div className="grid grid-cols-2 gap-x-4 border-b px-3 py-2" style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 20%, transparent)" }}>
                              <div className="min-w-0">
                                <div className="grid grid-cols-[92px_1fr] gap-2">
                                  <span className="font-medium text-mist-dark">Progression:</span>
                                  <div className="space-y-0.5 text-cloud-white">
                                    {row.progressionValues.map((value, index) => (
                                      <div key={`${row.exercise.id}-progression-${index}`} className="break-words">
                                        {value}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="min-w-0">
                                <div className="grid grid-cols-[72px_1fr] gap-2">
                                  <span className="font-medium text-mist-dark">Variation:</span>
                                  <div className="space-y-0.5 text-cloud-white">
                                    {row.variationValues.map((value, index) => (
                                      <div key={`${row.exercise.id}-variation-${index}`} className="break-words">
                                        {value}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-[92px_1fr] gap-3 px-3 py-2">
                              <span className="font-medium text-mist-dark">Logs:</span>
                              <Link href={detailHref} className="font-semibold text-jade-light transition hover:text-jade-glow">
                                {row.totalLogs}
                              </Link>
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Link
                            href={`/dashboard/train/input/${row.exercise.id}`}
                            className="rounded-md border border-jade/55 bg-jade-deep px-2.5 py-1 text-[11px] font-medium text-jade-light transition hover:border-jade-glow/60 hover:bg-jade/30"
                          >
                            Log
                          </Link>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>

      <AnimatePresence>
        {filterDrawerOpen ? (
          <>
            <motion.div
              key="exercise-filter-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[250]"
              style={{ backgroundColor: "color-mix(in srgb, var(--void-black) 74%, transparent)" }}
              onClick={() => setFilterDrawerOpen(false)}
            />
            <motion.aside
              key="exercise-filter-drawer"
              initial={{ x: "100%", opacity: 0.98 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 right-0 z-[260] flex h-[100dvh] max-h-[100dvh] w-[min(22rem,92vw)] flex-col overflow-hidden border-l shadow-2xl sm:my-3 sm:mr-3 sm:h-[calc(100dvh-1.5rem)] sm:max-h-[52rem] sm:rounded-2xl sm:border"
              style={{
                borderColor: "color-mix(in srgb, var(--jade-glow) 18%, var(--ink-light))",
                background: "linear-gradient(180deg, color-mix(in srgb, var(--ink-dark) 98%, transparent) 0%, color-mix(in srgb, var(--ink-mid) 92%, transparent) 100%)",
                boxShadow: "0 18px 56px rgba(0, 0, 0, 0.45)",
              }}
            >
              <div className="shrink-0 border-b px-4 pb-3 pt-[max(env(safe-area-inset-top,0px),1rem)]" style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 55%, transparent)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Filters</p>
                    <h2 className="mt-1 text-base font-semibold text-[color:var(--text-primary)]">Exercise Library</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFilterDrawerOpen(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
                    style={{
                      borderColor: "color-mix(in srgb, var(--ink-light) 55%, transparent)",
                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 88%, var(--ink-deep))",
                    }}
                    aria-label="Close exercise filters"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" style={{ WebkitOverflowScrolling: "touch" }}>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">Category</label>
                    <select
                      value={categoryFilter}
                      onChange={(event) => setCategoryFilter(event.target.value)}
                      className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                      style={{
                        borderColor: "color-mix(in srgb, var(--border) 78%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--surface) 92%, black)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {categoryOptions.map((option) => (
                        <option key={option} value={option}>
                          {option === "all" ? "All categories" : option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">Activity</label>
                    <select
                      value={activityFilter}
                      onChange={(event) => setActivityFilter(event.target.value as ActivityFilter)}
                      className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                      style={{
                        borderColor: "color-mix(in srgb, var(--border) 78%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--surface) 92%, black)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <option value="all">All activity</option>
                      <option value="logged">Logged only</option>
                      <option value="unlogged">Not logged yet</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">Sort by</label>
                    <select
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value as SortBy)}
                      className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                      style={{
                        borderColor: "color-mix(in srgb, var(--border) 78%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--surface) 92%, black)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <option value="relevant">Relevant</option>
                      <option value="recent">Most recent</option>
                      <option value="name">Name A-Z</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t px-4 pb-[max(env(safe-area-inset-bottom,0px),1rem)] pt-3" style={{ borderTopColor: "color-mix(in srgb, var(--ink-light) 55%, transparent)" }}>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryFilter("all");
                      setActivityFilter("all");
                      setSortBy("recent");
                    }}
                    className="h-11 rounded-xl border px-3 text-sm font-medium text-[color:var(--text-primary)] transition-colors"
                    style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 92%, black)" }}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterDrawerOpen(false)}
                    className="h-11 rounded-xl border px-3 text-sm font-semibold text-[color:var(--cloud-white)] transition-colors"
                    style={{ borderColor: "color-mix(in srgb, var(--forest) 42%, transparent)", backgroundColor: "color-mix(in srgb, var(--forest) 88%, transparent)" }}
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </PageLayout>
  );
}
