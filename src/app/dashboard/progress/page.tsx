"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import PageLayout from "@/components/layout/PageLayout";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { api } from "@/lib/api-client";
import { formatDateWithPreference } from "@/lib/constants";
import { getExerciseDisplayName } from "@/lib/exercise-name";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import { PROGRESSION_EXERCISES_UPDATED_EVENT } from "@/lib/progression-events";
import type { ProgressionExercise, ProgressionLog } from "../workout/types";

type TierStat = {
  attempts: number;
  best: string;
  lastPerformedAt: string | null;
};

type ProgressSkill = {
  id: string;
  name: string;
  englishName?: string;
  vietnameseName?: string;
  wuxiaName?: string;
  category: string;
  tierNames: string[];
  tierStats: TierStat[];
  performed: number;
  lastLogAt: string | null;
  sessions14d: number;
  attemptedTierCount: number;
  coveragePct: number;
};

type ProgressionsResponse = { exercises: ProgressionExercise[] };
type CategoryFilter = "all" | string;
type ActivityFilter = "all" | "active" | "stale" | "untouched";
type SortBy = "recent" | "name" | "sessions" | "coverage";

function getPrimaryCategory(category: string | null | undefined): string {
  const raw = String(category || "").trim();
  if (!raw) return "Other";
  const first = raw.split(",")[0]?.trim();
  return first || "Other";
}

function getLogsWithinDays(logs: ProgressionLog[], days: number): ProgressionLog[] {
  const now = Date.now();
  const limit = days * 24 * 60 * 60 * 1000;
  return logs.filter((log) => now - new Date(log.createdAt).getTime() <= limit);
}

function formatDate(
  value: string | null,
  dateFormat: "dd-mm-yyyy" | "dd-mmm-yyyy" | "dd-mm-yy" | "dd-mmm-yy",
  timeZone?: string,
): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return formatDateWithPreference(date, dateFormat, timeZone);
}

function formatDaysAgo(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function getBestStatText(logs: ProgressionLog[]): string {
  const holds = logs.flatMap((log) => [log.holdTime, log.holdTime2, log.holdTime3]).filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (holds.length > 0) return `${Math.max(...holds)}s hold`;

  const weights = logs.flatMap((log) => [log.weight1, log.weight2, log.weight3]).filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (weights.length > 0) return `${Math.max(...weights)} kg`;

  const reps = logs.flatMap((log) => [log.reps1, log.reps2, log.reps3, log.reps]).filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (reps.length > 0) return `${Math.max(...reps)} reps`;

  return "-";
}

function getCategoryTint(category: string): string {
  const key = category.toLowerCase();
  if (key.includes("gym")) return "var(--warning)";
  if (key.includes("yoga")) return "var(--forest)";
  if (key.includes("cardio")) return "var(--danger)";
  return "var(--accent)";
}

export default function ProgressPage() {
  const { settings } = useDisplaySettings();
  const displayTerminologyMode = !settings.showExerciseForeignLanguage && settings.languageMode === "english"
    ? "normal"
    : settings.terminologyMode;

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [skills, setSkills] = useState<ProgressSkill[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [showLoggedOnly, setShowLoggedOnly] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await api.get<ProgressionsResponse>("/api/progressions");
      const mapped = (data.exercises ?? []).map((exercise): ProgressSkill => {
          const logs = exercise.userProgress?.[0]?.logs ?? [];
          const sortedTiers = (exercise.tiers ?? []).slice().sort((a, b) => a.level - b.level);
          const tierNames = sortedTiers.length > 0
            ? sortedTiers.map((tier) => String(tier.name || `Progression ${tier.level}`).trim())
            : [exercise.name];

          const tierStats = tierNames.map((_, index) => {
            const levelLogs = logs.filter((log) => (Number(log.level) || 0) === index + 1);
            const lastPerformedAt = levelLogs.length > 0
              ? [...levelLogs]
                  .map((log) => log.createdAt)
                  .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
              : null;

            return {
              attempts: levelLogs.length,
              best: getBestStatText(levelLogs),
              lastPerformedAt,
            };
          });

          const lastLogAt = logs.length > 0
            ? [...logs]
                .map((log) => log.createdAt)
                .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
            : null;

          const attemptedTierCount = tierStats.filter((tier) => tier.attempts > 0).length;
          const coveragePct = tierNames.length > 0 ? Math.round((attemptedTierCount / tierNames.length) * 100) : 0;

          return {
            id: exercise.id,
            name: exercise.name,
            englishName: exercise.englishName,
            vietnameseName: exercise.vietnameseName,
            wuxiaName: exercise.wuxiaName,
            category: getPrimaryCategory(exercise.category),
            tierNames,
            tierStats,
            performed: logs.length,
            lastLogAt,
            sessions14d: getLogsWithinDays(logs, 14).length,
            attemptedTierCount,
            coveragePct,
          };
        });

      setSkills(mapped);
    } catch (error) {
      console.error("Failed to load progress:", error);
      setErrorMessage("Could not load progress data right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  useEffect(() => {
    const handleProgressionUpdate = () => {
      void loadSkills();
    };

    window.addEventListener(PROGRESSION_EXERCISES_UPDATED_EVENT, handleProgressionUpdate);
    return () => {
      window.removeEventListener(PROGRESSION_EXERCISES_UPDATED_EVENT, handleProgressionUpdate);
    };
  }, [loadSkills]);

  useEffect(() => {
    if (!filterDrawerOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [filterDrawerOpen]);

  const categoryOptions = useMemo(() => {
    const categories = Array.from(new Set(skills.map((skill) => skill.category).filter(Boolean)));
    categories.sort((a, b) => a.localeCompare(b));
    return ["all", ...categories];
  }, [skills]);

  const summary = useMemo(() => {
    const totalExercises = skills.length;
    const loggedExercises = skills.filter((skill) => skill.performed > 0).length;
    const totalSessions = skills.reduce((sum, skill) => sum + skill.performed, 0);
    const active14d = skills.filter((skill) => skill.sessions14d > 0).length;
    const untouched = Math.max(0, totalExercises - loggedExercises);

    return {
      totalExercises,
      loggedExercises,
      totalSessions,
      active14d,
      untouched,
      coveragePct: totalExercises > 0 ? Math.round((loggedExercises / totalExercises) * 100) : 0,
    };
  }, [skills]);

  const categoryProgress = useMemo(() => {
    const grouped = new Map<string, { category: string; total: number; logged: number }>();

    skills.forEach((skill) => {
      const key = skill.category || "Other";
      const existing = grouped.get(key) ?? { category: key, total: 0, logged: 0 };
      existing.total += 1;
      if (skill.performed > 0) existing.logged += 1;
      grouped.set(key, existing);
    });

    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        pct: item.total > 0 ? Math.round((item.logged / item.total) * 100) : 0,
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [skills]);

  const visibleSkills = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const list = skills.filter((skill) => {
      if (categoryFilter !== "all" && skill.category !== categoryFilter) return false;
      if (showLoggedOnly && skill.performed === 0) return false;

      if (activityFilter === "active" && skill.sessions14d === 0) return false;
      if (activityFilter === "stale") {
        if (skill.performed === 0 || !skill.lastLogAt) return false;
        const daysAgo = (now - new Date(skill.lastLogAt).getTime()) / dayMs;
        if (daysAgo <= 30) return false;
      }
      if (activityFilter === "untouched" && skill.performed > 0) return false;

      if (!query) return true;

      const displayName = getExerciseDisplayName(
        {
          name: skill.englishName || skill.name,
          wuxiaName: skill.vietnameseName || skill.wuxiaName,
          englishName: skill.englishName,
          vietnameseName: skill.vietnameseName,
        },
        displayTerminologyMode,
        settings.showExerciseForeignLanguage,
      ).toLowerCase();

      return `${displayName} ${skill.category}`.includes(query);
    });

    return [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "sessions") return b.performed - a.performed;
      if (sortBy === "coverage") return b.coveragePct - a.coveragePct;
      const aTime = a.lastLogAt ? new Date(a.lastLogAt).getTime() : 0;
      const bTime = b.lastLogAt ? new Date(b.lastLogAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [skills, search, categoryFilter, activityFilter, sortBy, showLoggedOnly, displayTerminologyMode, settings.showExerciseForeignLanguage]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filtersActive = categoryFilter !== "all" || activityFilter !== "all" || sortBy !== "recent" || showLoggedOnly;

  return (
    <PageLayout
      title="Progress"
      subtitle="Coverage across all skill progressions"
      mobileContentPaddingClass="px-2 pt-4 pb-24"
    >
      <div className="space-y-3 px-0 py-0 sm:space-y-4 sm:py-1">
        <section
          className="overflow-hidden rounded-xl border"
          style={{
            borderColor: "color-mix(in srgb, var(--ink-light) 56%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
          }}
        >
          <div
            className="border-b px-3 py-2.5"
            style={{
              borderBottomColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))",
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Coverage</p>
            <h2 className="mt-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-primary)]">Progress overview</h2>
            <p className="mt-0.5 text-[11px] text-[color:var(--text-secondary)]">A snapshot of what you've logged and what's still untouched.</p>
          </div>

          <div className="px-3 py-3">
            <div className="grid gap-4 lg:grid-cols-[150px_minmax(0,1fr)] lg:items-start">
              <div className="flex items-center justify-center lg:justify-start">
                <div
                  className="relative h-28 w-28 rounded-full"
                  style={{
                    background: `conic-gradient(color-mix(in srgb, var(--forest) 86%, transparent) 0 ${summary.coveragePct}%, color-mix(in srgb, var(--surface) 84%, black) ${summary.coveragePct}% 100%)`,
                  }}
                >
                  <div
                    className="absolute inset-[9px] flex flex-col items-center justify-center rounded-full border"
                    style={{
                      borderColor: "color-mix(in srgb, var(--ink-light) 52%, transparent)",
                      backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
                    }}
                  >
                    <span className="text-xl font-semibold text-[color:var(--text-primary)]">{summary.coveragePct}%</span>
                    <span className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">logged once</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[color:var(--text-secondary)]">
                  <span>Progressions: <span className="font-semibold text-[color:var(--text-primary)]">{summary.totalExercises}</span></span>
                  <span>Logged once: <span className="font-semibold text-[color:var(--forest)]">{summary.loggedExercises}</span></span>
                  <span>Untouched: <span className="font-semibold text-[color:var(--text-primary)]">{summary.untouched}</span></span>
                  <span>Sessions: <span className="font-semibold text-[color:var(--forest)]">{summary.totalSessions}</span></span>
                </div>

                <div className="space-y-2">
                  {categoryProgress.map((item) => {
                    const tint = getCategoryTint(item.category);

                    return (
                      <div key={item.category} className="space-y-1">
                        <div className="flex items-center justify-between gap-3 text-[11px]">
                          <span className="font-medium text-[color:var(--text-primary)]">{item.category}</span>
                          <span className="text-[color:var(--text-secondary)]">{item.logged}/{item.total} • {item.pct}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: "color-mix(in srgb, var(--surface) 82%, black)" }}>
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${item.pct}%`,
                              background: `linear-gradient(90deg, ${tint}, color-mix(in srgb, ${tint} 65%, white 35%))`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[11px] text-[color:var(--text-muted)]">Each bar counts a progression once as soon as it has at least one logged session.</p>
              </div>
            </div>
          </div>
        </section>

        {errorMessage ? (
          <section
            className="rounded-xl border px-3 py-2.5"
            style={{
              borderColor: "color-mix(in srgb, var(--danger) 40%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--danger) 10%, transparent)",
            }}
          >
            <p className="text-sm" style={{ color: "color-mix(in srgb, var(--danger) 78%, white)" }}>{errorMessage}</p>
          </section>
        ) : null}

        {loading ? (
          <section className="rounded-xl border px-3 py-3" style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 92%, black)" }}>
            <p className="text-sm text-[color:var(--text-secondary)]">Loading progress...</p>
          </section>
        ) : null}

        {!loading && visibleSkills.length === 0 ? (
          <section className="rounded-xl border px-3 py-3" style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 92%, black)" }}>
            <p className="text-sm text-[color:var(--text-secondary)]">No exercises match the current filters.</p>
          </section>
        ) : null}

        {!loading ? (
          <>
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
                    <h2 className="text-base font-semibold text-[color:var(--text-primary)]">Skills</h2>
                    <p className="text-xs text-[color:var(--text-secondary)]">Tap a row to expand.</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSearchOpen((prev) => !prev)}
                      className="theme-control-btn inline-flex h-8 w-8 items-center justify-center rounded-md border"
                      aria-label="Toggle search"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden>
                        <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
                        <path d="M13.5 13.5L18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFilterDrawerOpen(true)}
                      className="theme-control-btn relative inline-flex h-8 w-8 items-center justify-center rounded-md border"
                      aria-label="Open filters"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M6 12h12m-9 7h6" />
                      </svg>
                      {filtersActive ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full" style={{ backgroundColor: "var(--accent)" }} /> : null}
                    </button>
                  </div>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {searchOpen ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0, y: -6 }}
                    animate={{ height: "auto", opacity: 1, y: 0 }}
                    exit={{ height: 0, opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="overflow-hidden border-b px-3 py-2.5 sm:px-4"
                    style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 30%, transparent)" }}
                  >
                    <input
                      type="text"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search exercise..."
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                      style={{
                        borderColor: "color-mix(in srgb, var(--border) 72%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="space-y-2.5 p-1.5 sm:p-2">
                {visibleSkills.map((skill) => {
                  const displayName = getExerciseDisplayName(
                    {
                      name: skill.englishName || skill.name,
                      wuxiaName: skill.vietnameseName || skill.wuxiaName,
                      englishName: skill.englishName,
                      vietnameseName: skill.vietnameseName,
                    },
                    displayTerminologyMode,
                    settings.showExerciseForeignLanguage,
                  );

                  const historyHref = `${DASHBOARD_ROUTES.workoutHistory}/${encodeURIComponent(skill.id)}`;
                  const logHref = `/dashboard/train/input/${encodeURIComponent(skill.id)}?prefillExerciseId=${encodeURIComponent(skill.id)}&prefillExercise=${encodeURIComponent(skill.name)}`;
                  const isLogged = skill.performed > 0;
                  const isExpanded = Boolean(expandedIds[skill.id]);

                  return (
                    <section
                      key={skill.id}
                      className="overflow-hidden rounded-xl border"
                      style={{
                        borderColor: "color-mix(in srgb, var(--border) 78%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--surface) 92%, black)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpanded(skill.id)}
                        className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left"
                        style={{ backgroundColor: isExpanded ? "color-mix(in srgb, var(--surface) 84%, transparent)" : "transparent" }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px]"
                              style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", color: "var(--text-secondary)" }}
                            >
                              {isExpanded ? "−" : "+"}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">{skill.category}</p>
                              <h3 className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{displayName}</h3>
                            </div>
                          </div>
                          <p className="mt-1 pl-7 text-[11px] text-[color:var(--text-secondary)]">
                            {isLogged
                              ? `${skill.performed} logs • ${skill.coveragePct}% coverage • ${formatDaysAgo(skill.lastLogAt)}`
                              : `${skill.tierNames.length} tiers available • no sessions logged yet`}
                          </p>
                        </div>

                        <span
                          className="shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]"
                          style={{
                            borderColor: isLogged ? "color-mix(in srgb, var(--forest) 36%, transparent)" : "color-mix(in srgb, var(--border) 78%, transparent)",
                            backgroundColor: isLogged ? "color-mix(in srgb, var(--forest) 10%, transparent)" : "color-mix(in srgb, var(--surface) 86%, black)",
                            color: isLogged ? "color-mix(in srgb, var(--forest) 82%, white)" : "var(--text-secondary)",
                          }}
                        >
                          {isLogged ? "Logged" : "Untouched"}
                        </span>
                      </button>

                      {isExpanded ? (
                        <div
                          className="border-t px-3 py-3"
                          style={{ borderTopColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 84%, transparent)" }}
                        >
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[color:var(--text-secondary)]">
                            <span>Coverage: <span className="font-semibold text-[color:var(--forest)]">{skill.coveragePct}%</span></span>
                            <span>Sessions: <span className="font-semibold text-[color:var(--text-primary)]">{skill.performed}</span></span>
                            <span>Last: <span className="font-semibold text-[color:var(--text-primary)]">{formatDate(skill.lastLogAt, settings.dateFormat || "dd-mmm-yyyy", settings.timeZone)}</span></span>
                          </div>

                          <div className="mt-3 divide-y" style={{ borderColor: "color-mix(in srgb, var(--border) 72%, transparent)" }}>
                            {skill.tierNames.map((tierName, index) => {
                              const stat = skill.tierStats[index];
                              return (
                                <div key={skill.id + "-" + tierName + "-" + index} className="flex items-center justify-between gap-3 py-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-[11px] font-medium text-[color:var(--text-primary)]">{tierName}</p>
                                    <p className="mt-0.5 text-[10px] text-[color:var(--text-muted)]">{stat.attempts} attempts • {stat.best}</p>
                                  </div>
                                  <span className="shrink-0 text-[10px] text-[color:var(--text-secondary)]">{formatDate(stat.lastPerformedAt, settings.dateFormat || "dd-mmm-yyyy", settings.timeZone)}</span>
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-3 flex gap-2">
                            <Link
                              href={historyHref}
                              className="theme-control-btn inline-flex flex-1 items-center justify-center rounded-md border px-3 py-2 text-sm font-medium"
                            >
                              History
                            </Link>
                            <Link
                              href={logHref}
                              className="theme-action-btn inline-flex flex-1 items-center justify-center rounded-md border px-3 py-2 text-sm font-medium"
                            >
                              Log session
                            </Link>
                          </div>
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            </section>

            {typeof document !== "undefined" && createPortal(
              <AnimatePresence>
                {filterDrawerOpen ? (
                  <>
                    <motion.button
                      type="button"
                      aria-label="Close filters"
                      className="fixed inset-0 z-[250] bg-black/55"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setFilterDrawerOpen(false)}
                    />

                    <div className="fixed inset-0 z-[260] pointer-events-none">
                      <motion.aside
                        role="dialog"
                        aria-modal="true"
                        aria-label="Progress filters"
                        className="pointer-events-auto ml-auto flex h-[100dvh] max-h-[100dvh] w-[min(22rem,92vw)] flex-col overflow-hidden border-l shadow-2xl sm:my-3 sm:mr-3 sm:h-[calc(100dvh-1.5rem)] sm:max-h-[52rem] sm:rounded-2xl sm:border"
                        initial={{ x: "100%", opacity: 0.98 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: "100%", opacity: 0.98 }}
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        style={{
                          borderColor: "color-mix(in srgb, var(--jade-glow) 18%, var(--ink-light))",
                          background: "linear-gradient(180deg, color-mix(in srgb, var(--ink-dark) 98%, transparent) 0%, color-mix(in srgb, var(--ink-mid) 92%, transparent) 100%)",
                          boxShadow: "0 18px 56px rgba(0, 0, 0, 0.45)",
                        }}
                      >
                        <div
                          className="shrink-0 border-b px-4 pb-3 pt-[max(env(safe-area-inset-top,0px),1rem)]"
                          style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 55%, transparent)" }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Filters</p>
                              <h3 className="mt-1 text-base font-semibold text-[color:var(--text-primary)]">Filter</h3>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFilterDrawerOpen(false)}
                              className="theme-control-btn inline-flex h-9 w-9 items-center justify-center rounded-md border"
                              aria-label="Close filter drawer"
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        <div
                          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
                          style={{ WebkitOverflowScrolling: "touch" }}
                        >
                          <div className="space-y-4">
                            <div>
                              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">Category</label>
                              <select
                                value={categoryFilter}
                                onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
                                className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                                style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 92%, black)", color: "var(--text-primary)" }}
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
                                style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 92%, black)", color: "var(--text-primary)" }}
                              >
                                <option value="all">All exercises</option>
                                <option value="active">Active in 14 days</option>
                                <option value="stale">Stale 30+ days</option>
                                <option value="untouched">Never logged</option>
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={() => setShowLoggedOnly((prev) => !prev)}
                              className="h-11 w-full rounded-xl border px-3 text-sm font-medium transition-colors"
                              style={{
                                borderColor: showLoggedOnly ? "color-mix(in srgb, var(--forest) 42%, transparent)" : "color-mix(in srgb, var(--border) 78%, transparent)",
                                backgroundColor: showLoggedOnly ? "color-mix(in srgb, var(--forest) 10%, transparent)" : "color-mix(in srgb, var(--surface) 92%, black)",
                                color: showLoggedOnly ? "color-mix(in srgb, var(--forest) 82%, white)" : "var(--text-primary)",
                              }}
                            >
                              {showLoggedOnly ? "Showing logged exercises" : "Show logged only"}
                            </button>

                            <div>
                              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">Sort by</label>
                              <select
                                value={sortBy}
                                onChange={(event) => setSortBy(event.target.value as SortBy)}
                                className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                                style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 92%, black)", color: "var(--text-primary)" }}
                              >
                                <option value="recent">Recently trained</option>
                                <option value="coverage">Best coverage</option>
                                <option value="sessions">Most sessions</option>
                                <option value="name">Name A-Z</option>
                              </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setCategoryFilter("all");
                                  setActivityFilter("all");
                                  setSortBy("recent");
                                  setShowLoggedOnly(false);
                                }}
                                className="theme-control-btn h-11 rounded-xl border px-3 text-sm font-medium"
                              >
                                Reset
                              </button>
                              <button
                                type="button"
                                onClick={() => setFilterDrawerOpen(false)}
                                className="theme-action-btn h-11 rounded-xl border px-3 text-sm font-semibold"
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.aside>
                    </div>
                  </>
                ) : null}
              </AnimatePresence>,
              document.body,
            )}
          </>
        ) : null}
      </div>
    </PageLayout>
  );
}
