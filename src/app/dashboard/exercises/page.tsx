"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import PageLayout from "@/components/layout/PageLayout";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { api } from "@/lib/api-client";
import { getExerciseDisplayName, matchesLooseSearchInFields } from "@/lib/exercise-name";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import { isDeletedExerciseDescription } from "@/lib/pending-exercises";
import type { ProgressionExercise, ProgressionLog } from "../workout/types";

type ProgressionsResponse = {
  exercises?: ProgressionExercise[];
};

type CategoryFilter = "all" | string;
type ActivityFilter = "all" | "logged" | "unlogged";
type SortBy = "recent" | "name";

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
    const list = exerciseRows.filter((row) => {
      if (categoryFilter !== "all" && row.category !== categoryFilter) return false;
      if (activityFilter === "logged" && row.totalLogs === 0) return false;
      if (activityFilter === "unlogged" && row.totalLogs > 0) return false;

      if (!search.trim()) return true;

      return matchesLooseSearchInFields(search, [
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
                    className="rounded-lg border border-sky-400/35 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-100 transition hover:scale-[1.02] hover:border-sky-300/60 hover:bg-sky-500/20"
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

        {!loading && !errorMessage && visibleRows.length === 0 ? (
          <section
            className="rounded-xl border px-4 py-8 text-center"
            style={{
              borderColor: "color-mix(in srgb, var(--ink-light) 50%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))",
            }}
          >
            <h2 className="text-lg font-semibold text-cloud-white">No exercises matched</h2>
            <p className="mt-1 text-sm text-mist-light">Try loosening the search or switching filters.</p>
          </section>
        ) : null}

        {!loading && !errorMessage && visibleRows.length > 0 ? (
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
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search exercises"
                  className="w-full rounded-lg border px-3 py-2 text-sm text-cloud-white outline-none"
                  style={{
                    borderColor: "color-mix(in srgb, var(--ink-light) 45%, transparent)",
                    backgroundColor: "color-mix(in srgb, var(--ink-mid) 88%, var(--ink-deep))",
                  }}
                />
              </div>
            ) : null}

            <div>
              {visibleRows.map((row) => {
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
              className="fixed inset-0 z-[237]"
              style={{ backgroundColor: "color-mix(in srgb, var(--void-black) 74%, transparent)" }}
              onClick={() => setFilterDrawerOpen(false)}
            />
            <motion.aside
              key="exercise-filter-drawer"
              initial={{ x: "100%" }}
              animate={{ x: "0%" }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 right-0 z-[239] w-[min(320px,88vw)] border-l overflow-hidden"
              style={{
                borderLeftColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--ink-deep) 97%, var(--ink-mid))",
              }}
            >
              <div className="flex h-full min-h-0 flex-col overflow-hidden">
                <div className="border-b px-3 py-2.5" style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-mist-light">
                      Exercise Filters
                    </h2>
                    <button
                      type="button"
                      onClick={() => setFilterDrawerOpen(false)}
                      className="h-8 w-8 rounded-md border text-sm"
                      style={{
                        borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                        color: "var(--mist-light)",
                        backgroundColor: "color-mix(in srgb, var(--ink-mid) 88%, var(--ink-deep))",
                      }}
                      aria-label="Close exercise filters"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 space-y-3">
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-mist-dark">Category</label>
                    <select
                      value={categoryFilter}
                      onChange={(event) => setCategoryFilter(event.target.value)}
                      className="h-9 w-full rounded-md border px-2.5 text-sm outline-none"
                      style={{
                        borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                        color: "var(--cloud-white)",
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
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-mist-dark">Activity</label>
                    <select
                      value={activityFilter}
                      onChange={(event) => setActivityFilter(event.target.value as ActivityFilter)}
                      className="h-9 w-full rounded-md border px-2.5 text-sm outline-none"
                      style={{
                        borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                        color: "var(--cloud-white)",
                      }}
                    >
                      <option value="all">All activity</option>
                      <option value="logged">Logged only</option>
                      <option value="unlogged">Not logged yet</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-mist-dark">Sort</label>
                    <select
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value as SortBy)}
                      className="h-9 w-full rounded-md border px-2.5 text-sm outline-none"
                      style={{
                        borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                        color: "var(--cloud-white)",
                      }}
                    >
                      <option value="recent">Most recent</option>
                      <option value="name">Name A-Z</option>
                    </select>
                  </div>
                </div>

                <div className="border-t px-3 py-3" style={{ borderTopColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryFilter("all");
                      setActivityFilter("all");
                      setSortBy("recent");
                      setFilterDrawerOpen(false);
                    }}
                    className="w-full rounded-md border px-3 py-2 text-sm font-semibold"
                    style={{
                      borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                      color: "var(--mist-light)",
                    }}
                  >
                    Clear filters
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
