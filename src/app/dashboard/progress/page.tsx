"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PageLayout from "@/components/layout/PageLayout";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { useDrawerA11y } from "@/hooks/useDrawerA11y";
import { api } from "@/lib/api-client";
import { formatDateWithPreference } from "@/lib/constants";
import { getExerciseDisplayName } from "@/lib/exercise-name";
import { translateEnglishToLanguage } from "@/lib/language";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import { PROGRESSION_EXERCISES_UPDATED_EVENT } from "@/lib/progression-events";
import type { ProgressionExercise, ProgressionLog } from "../workout/types";

type ComboRow = {
  key: string;
  progressionName: string;
  variantName: string;
  machineName: string;
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
  comboRows: ComboRow[];
  performed: number;
  lastLogAt: string | null;
  sessions14d: number;
  loggedCombos: number;
  catalogCombos: number;
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
  lt: (text: string) => string,
  timeZone?: string,
): string {
  if (!value) return lt("Never");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return lt("Never");
  return formatDateWithPreference(date, dateFormat, timeZone);
}

function formatDaysAgo(value: string | null, lt: (text: string) => string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));
  if (days === 0) return lt("Today");
  if (days === 1) return `1 ${lt("day")}`;
  return `${days} ${lt("days")}`;
}

function getBestStatText(logs: ProgressionLog[], lt: (text: string) => string): string {
  const holds = logs.flatMap((log) => [log.holdTime, log.holdTime2, log.holdTime3]).filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (holds.length > 0) return `${Math.max(...holds)}s ${lt("hold")}`;

  const weights = logs.flatMap((log) => [log.weight1, log.weight2, log.weight3]).filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (weights.length > 0) return `${Math.max(...weights)} kg`;

  const reps = logs.flatMap((log) => [log.reps1, log.reps2, log.reps3, log.reps]).filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (reps.length > 0) return `${Math.max(...reps)} ${lt("reps")}`;

  return "-";
}

function getCategoryTint(category: string): string {
  const key = category.toLowerCase();
  if (key.includes("gym")) return "var(--warning, #f59e0b)";
  if (key.includes("yoga")) return "var(--forest, #22c55e)";
  if (key.includes("cardio")) return "var(--danger, #ef4444)";
  return "var(--accent, #38bdf8)";
}

export default function ProgressPage() {
  const { settings } = useDisplaySettings();
  const prefersReducedMotion = useReducedMotion();
  const lt = useCallback((text: string) => translateEnglishToLanguage(text, settings.languageMode), [settings.languageMode]);
  const displayTerminologyMode = !settings.showExerciseForeignLanguage && settings.languageMode === "english"
    ? "normal"
    : settings.terminologyMode;

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [skills, setSkills] = useState<ProgressSkill[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [showLoggedOnly, setShowLoggedOnly] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const filterDrawerRef = useRef<HTMLElement | null>(null);
  const filterDrawerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const filterDrawerFirstFieldRef = useRef<HTMLSelectElement | null>(null);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const data = await api.get<ProgressionsResponse>("/api/progressions");
      const mapped = (data.exercises ?? []).map((exercise): ProgressSkill => {
          const logs = exercise.userProgress?.[0]?.logs ?? [];
          const sortedTiers = (exercise.tiers ?? []).slice().sort((a, b) => a.level - b.level);
          const tierLookup = new Map<number, string>();
          sortedTiers.forEach((tier) => {
            tierLookup.set(tier.level, String(tier.name || `Lv ${tier.level}`).trim());
          });

          // Catalog size: every (progression × variant × machine) combination counts
          // as a unique "workout slot" under this parent. Grip (setupOption) is
          // intentionally excluded from the count.
          const tierCount = Math.max(1, sortedTiers.length);
          const variantCount = Math.max(1, (exercise.variations ?? []).length);
          const machineCount = Math.max(1, (exercise.modifiers ?? []).length);
          const catalogCombos = tierCount * variantCount * machineCount;

          // Group logs by (level, variant, modifier) — ignore setupOption/grip.
          const comboMap = new Map<string, { logs: ProgressionLog[]; level: number; variant: string; modifier: string }>();
          for (const log of logs) {
            const level = Number(log.level) || 0;
            const variant = (log.variant || "").trim();
            const modifier = (log.modifier || "").trim();
            const key = `${level}::${variant.toLowerCase()}::${modifier.toLowerCase()}`;
            const existing = comboMap.get(key);
            if (existing) {
              existing.logs.push(log);
            } else {
              comboMap.set(key, { logs: [log], level, variant, modifier });
            }
          }

          const comboRows: ComboRow[] = Array.from(comboMap.entries()).map(([key, entry]) => {
            const lastPerformedAt = entry.logs.length > 0
              ? [...entry.logs]
                  .map((log) => log.createdAt)
                  .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
              : null;
            const progressionName = tierLookup.get(entry.level) || `Lv ${entry.level || 1}`;
            return {
              key,
              progressionName,
              variantName: entry.variant || "",
              machineName: entry.modifier || "",
              attempts: entry.logs.length,
              best: getBestStatText(entry.logs, lt),
              lastPerformedAt,
            };
          });

          comboRows.sort((a, b) => {
            const aTime = a.lastPerformedAt ? new Date(a.lastPerformedAt).getTime() : 0;
            const bTime = b.lastPerformedAt ? new Date(b.lastPerformedAt).getTime() : 0;
            if (bTime !== aTime) return bTime - aTime;
            return a.progressionName.localeCompare(b.progressionName);
          });

          const lastLogAt = logs.length > 0
            ? [...logs]
                .map((log) => log.createdAt)
                .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
            : null;

          const loggedCombos = comboRows.length;
          const coveragePct = catalogCombos > 0
            ? Math.min(100, Math.round((loggedCombos / catalogCombos) * 100))
            : 0;

          return {
            id: exercise.id,
            name: exercise.name,
            englishName: exercise.englishName,
            vietnameseName: exercise.vietnameseName,
            wuxiaName: exercise.wuxiaName,
            category: getPrimaryCategory(exercise.category),
            comboRows,
            performed: logs.length,
            lastLogAt,
            sessions14d: getLogsWithinDays(logs, 14).length,
            loggedCombos,
            catalogCombos,
            coveragePct,
          };
        });

      setSkills(mapped);
    } catch (error) {
      console.error("Failed to load progress:", error);
      setErrorMessage(lt("Could not load progress data right now."));
    } finally {
      setLoading(false);
    }
  }, [lt]);

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

  useDrawerA11y({
    active: filterDrawerOpen,
    containerRef: filterDrawerRef,
    initialFocusRef: filterDrawerFirstFieldRef,
    restoreFocusRef: filterDrawerTriggerRef,
    onEscape: () => setFilterDrawerOpen(false),
  });

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
          wuxiaName: skill.wuxiaName,
          englishName: skill.englishName,
          vietnameseName: skill.vietnameseName,
        },
        displayTerminologyMode,
        settings.showExerciseForeignLanguage,
      ).toLowerCase();

      return `${displayName} ${skill.category}`.includes(query);
    });

    return [...list].sort((a, b) => {
      if (sortBy === "sessions") return b.performed - a.performed;
      if (sortBy === "coverage") return b.coveragePct - a.coveragePct;
      if (sortBy === "recent") {
        const aTime = a.lastLogAt ? new Date(a.lastLogAt).getTime() : 0;
        const bTime = b.lastLogAt ? new Date(b.lastLogAt).getTime() : 0;
        return bTime - aTime;
      }
      // "name" (default): logged exercises first, then alphabetical within each group
      const aLogged = a.performed > 0 ? 0 : 1;
      const bLogged = b.performed > 0 ? 0 : 1;
      if (aLogged !== bLogged) return aLogged - bLogged;
      return a.name.localeCompare(b.name);
    });
  }, [skills, search, categoryFilter, activityFilter, sortBy, showLoggedOnly, displayTerminologyMode, settings.showExerciseForeignLanguage]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filtersActive = categoryFilter !== "all" || activityFilter !== "all" || sortBy !== "name" || showLoggedOnly;
  const sectionReveal = prefersReducedMotion
    ? { initial: { opacity: 1, y: 0 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const } };
  const listReveal = prefersReducedMotion
    ? {
        initial: { opacity: 1 },
        animate: { opacity: 1, transition: { duration: 0 } },
      }
    : {
        initial: { opacity: 0 },
        animate: {
          opacity: 1,
          transition: { staggerChildren: 0.04, delayChildren: 0.04 },
        },
      };
  const cardReveal = prefersReducedMotion
    ? {
        initial: { opacity: 1, y: 0, scale: 1 },
        animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0 } },
      }
    : {
        initial: { opacity: 0, y: 12, scale: 0.992 },
        animate: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
        },
      };

  return (
    <PageLayout
      title={lt("Progress")}
      mobileContentPaddingClass="px-2 pt-4 pb-24"
    >
      <div className="mx-auto w-full max-w-[1120px] space-y-3 px-0 py-0 sm:space-y-4 sm:py-1 lg:space-y-5">
        <motion.section
          initial={sectionReveal.initial}
          animate={sectionReveal.animate}
          transition={sectionReveal.transition}
          className="completionist-modern-overview relative overflow-hidden rounded-2xl border"
          style={{
            borderColor: "color-mix(in srgb, var(--ink-light) 64%, transparent)",
            background: "linear-gradient(155deg, color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid)) 0%, color-mix(in srgb, var(--ink-mid) 88%, var(--ink-deep)) 54%, color-mix(in srgb, var(--ink-dark) 96%, var(--ink-mid)) 100%)",
            boxShadow: "0 16px 44px color-mix(in srgb, var(--void-black) 34%, transparent), inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 7%, transparent)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full"
            style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--forest) 30%, transparent) 0%, transparent 72%)" }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full"
            style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 22%, transparent) 0%, transparent 74%)" }}
          />

          <div className="relative z-[1] px-3 py-3 sm:px-4 sm:py-4 md:px-5">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">{lt("Progress overview")}</p>
                <h2 className="mt-1 text-lg font-semibold leading-tight text-[color:var(--text-primary)]">{lt("Mastery Map")}</h2>
                <p className="mt-1 text-xs text-[color:var(--text-secondary)]">{lt("How consistently you have touched each progression family.")}</p>
              </div>
              <span
                className="inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  borderColor: "color-mix(in srgb, var(--forest) 36%, transparent)",
                  backgroundColor: "color-mix(in srgb, var(--forest) 12%, transparent)",
                  color: "color-mix(in srgb, var(--forest) 84%, white)",
                }}
              >
                {summary.active14d} {lt("active in 14d")}
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-[174px_minmax(0,1fr)] lg:items-start">
              <div className="flex items-center justify-center lg:justify-start">
                <div
                  className="relative h-32 w-32 rounded-full"
                  style={{
                    background: `conic-gradient(var(--forest, #22c55e) 0 ${summary.coveragePct}%, color-mix(in srgb, var(--surface) 88%, black) ${summary.coveragePct}% 100%)`,
                    boxShadow: "0 0 0 1px color-mix(in srgb, var(--ink-light) 42%, transparent)",
                  }}
                >
                  <div
                    className="absolute inset-[10px] flex flex-col items-center justify-center rounded-full border"
                    style={{
                      borderColor: "color-mix(in srgb, var(--ink-light) 58%, transparent)",
                      backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))",
                    }}
                  >
                    <span className="text-2xl font-semibold text-[color:var(--text-primary)]">{summary.coveragePct}%</span>
                    <span className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">{lt("logged once")}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <div className="rounded-xl border px-2.5 py-2" style={{ borderColor: "color-mix(in srgb, var(--ink-light) 48%, transparent)", backgroundColor: "color-mix(in srgb, var(--ink-deep) 86%, var(--ink-mid))" }}>
                    <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Progressions")}</p>
                    <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">{summary.totalExercises}</p>
                  </div>
                  <div className="rounded-xl border px-2.5 py-2" style={{ borderColor: "color-mix(in srgb, var(--forest) 34%, transparent)", backgroundColor: "color-mix(in srgb, var(--forest) 10%, transparent)" }}>
                    <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Logged once")}</p>
                    <p className="mt-1 text-lg font-semibold text-[color:var(--forest)]">{summary.loggedExercises}</p>
                  </div>
                  <div className="rounded-xl border px-2.5 py-2" style={{ borderColor: "color-mix(in srgb, var(--warning) 36%, transparent)", backgroundColor: "color-mix(in srgb, var(--warning) 10%, transparent)" }}>
                    <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Untouched")}</p>
                    <p className="mt-1 text-lg font-semibold" style={{ color: "var(--warning)" }}>{summary.untouched}</p>
                  </div>
                  <div className="rounded-xl border px-2.5 py-2" style={{ borderColor: "color-mix(in srgb, var(--accent) 38%, transparent)", backgroundColor: "color-mix(in srgb, var(--accent) 11%, transparent)" }}>
                    <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lt("Sessions")}</p>
                    <p className="mt-1 text-lg font-semibold" style={{ color: "var(--accent)" }}>{summary.totalSessions}</p>
                  </div>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  {categoryProgress.map((item) => {
                    const tint = getCategoryTint(item.category);

                    return (
                      <div
                        key={item.category}
                        className="rounded-xl border px-2.5 py-2"
                        style={{
                          borderColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)",
                          backgroundColor: "color-mix(in srgb, var(--ink-deep) 87%, var(--ink-mid))",
                        }}
                      >
                        <div className="flex items-center justify-between gap-3 text-[11px]">
                          <span className="font-medium text-[color:var(--text-primary)]">{item.category}</span>
                          <span className="text-[color:var(--text-secondary)]">{item.logged}/{item.total} • {item.pct}%</span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "color-mix(in srgb, var(--surface) 82%, black)" }}>
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${item.pct}%`,
                              background: `linear-gradient(90deg, ${tint}, color-mix(in srgb, ${tint} 66%, white 34%))`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {errorMessage ? (
          <section
            className="rounded-2xl border px-3 py-3"
            style={{
              borderColor: "color-mix(in srgb, var(--danger) 40%, transparent)",
              background: "linear-gradient(135deg, color-mix(in srgb, var(--danger) 14%, transparent) 0%, color-mix(in srgb, var(--ink-deep) 90%, var(--ink-mid)) 100%)",
            }}
          >
            <p className="text-sm" style={{ color: "color-mix(in srgb, var(--danger) 78%, white)" }}>{errorMessage}</p>
          </section>
        ) : null}

        {loading ? (
          <section className="rounded-2xl border px-3 py-3" style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", background: "linear-gradient(180deg, color-mix(in srgb, var(--surface) 94%, black) 0%, color-mix(in srgb, var(--ink-mid) 86%, black) 100%)" }}>
            <p className="text-sm text-[color:var(--text-secondary)]">{lt("Loading progress...")}</p>
          </section>
        ) : null}

        {!loading && visibleSkills.length === 0 ? (
          <section className="rounded-2xl border px-3 py-3" style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", background: "linear-gradient(180deg, color-mix(in srgb, var(--surface) 94%, black) 0%, color-mix(in srgb, var(--ink-mid) 86%, black) 100%)" }}>
            <p className="text-sm text-[color:var(--text-secondary)]">{lt("No exercises match the current filters.")}</p>
          </section>
        ) : null}

        {!loading ? (
          <>
            <motion.section
              initial={sectionReveal.initial}
              animate={sectionReveal.animate}
              transition={prefersReducedMotion ? sectionReveal.transition : { ...sectionReveal.transition, delay: 0.04 }}
              className="completionist-modern-filters overflow-hidden rounded-2xl border"
              style={{
                borderColor: "color-mix(in srgb, var(--ink-light) 60%, transparent)",
                background: "linear-gradient(180deg, color-mix(in srgb, var(--ink-deep) 95%, var(--ink-mid)) 0%, color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep)) 100%)",
              }}
            >
              <div
                className="px-3 py-2.5 sm:px-4"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--ink-deep) 90%, var(--ink-mid))",
                  borderBottom: "1px solid color-mix(in srgb, var(--ink-light) 42%, transparent)",
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-[color:var(--text-primary)]">{lt("Skills")}</h2>
                    <p className="mt-0.5 text-xs text-[color:var(--text-secondary)]">{visibleSkills.length} {lt("results")}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSearchOpen((prev) => !prev)}
                      className="theme-control-btn inline-flex h-8 w-8 items-center justify-center rounded-md border"
                      aria-label={lt("Toggle search")}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden>
                        <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
                        <path d="M13.5 13.5L18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </button>

                    <button
                      ref={filterDrawerTriggerRef}
                      type="button"
                      onClick={() => setFilterDrawerOpen(true)}
                      className="theme-control-btn relative inline-flex h-8 w-8 items-center justify-center rounded-md border"
                      aria-label={lt("Open filters")}
                      aria-haspopup="dialog"
                      aria-expanded={filterDrawerOpen}
                      aria-controls="progress-filter-drawer"
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
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
                    className="overflow-hidden px-3 py-2.5 sm:px-4"
                  >
                    <input
                      type="text"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={lt("Search exercise...")}
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                      style={{
                        borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--surface) 88%, black)",
                        color: "var(--text-primary)",
                        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--cloud-white) 3%, transparent)",
                      }}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <motion.div
                className="space-y-2.5 p-2 sm:p-2.5 md:space-y-3 md:p-3"
                initial={listReveal.initial}
                animate={listReveal.animate}
              >
                {visibleSkills.map((skill) => {
                  const displayName = getExerciseDisplayName(
                    {
                      name: skill.englishName || skill.name,
                      wuxiaName: skill.wuxiaName,
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
                    <motion.section
                      key={skill.id}
                      layout
                      initial={cardReveal.initial}
                      animate={cardReveal.animate}
                      transition={prefersReducedMotion ? { duration: 0 } : { layout: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
                      className="completionist-modern-skill-mobile overflow-hidden rounded-2xl border"
                      style={{
                        borderColor: isExpanded
                          ? "color-mix(in srgb, var(--accent) 36%, transparent)"
                          : "color-mix(in srgb, var(--ink-light) 52%, transparent)",
                        background: isExpanded
                          ? "linear-gradient(180deg, color-mix(in srgb, var(--ink-mid) 74%, var(--ink-deep)) 0%, color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid)) 100%)"
                          : "linear-gradient(180deg, color-mix(in srgb, var(--ink-deep) 95%, var(--ink-mid)) 0%, color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep)) 100%)",
                        boxShadow: isExpanded
                          ? "0 14px 30px color-mix(in srgb, var(--void-black) 26%, transparent)"
                          : "none",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpanded(skill.id)}
                        className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left"
                        style={{
                          backgroundColor: isExpanded ? "color-mix(in srgb, var(--ink-mid) 58%, var(--ink-deep))" : "transparent",
                          borderBottom: isExpanded ? "1px solid color-mix(in srgb, var(--ink-light) 38%, transparent)" : "none",
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <motion.span
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px]"
                              animate={prefersReducedMotion ? { rotate: 0 } : { rotate: isExpanded ? 90 : 0 }}
                              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
                              style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", color: "var(--text-secondary)" }}
                            >
                              {isExpanded ? "−" : "+"}
                            </motion.span>
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">{skill.category}</p>
                              <h3 className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{displayName}</h3>
                            </div>
                          </div>
                          <p className="mt-1 pl-7 text-[11px] text-[color:var(--text-secondary)]">
                            {isLogged
                              ? `${skill.performed} ${lt("logs")} • ${skill.loggedCombos}/${skill.catalogCombos} ${lt("workouts")} • ${skill.coveragePct}% • ${formatDaysAgo(skill.lastLogAt, lt)}`
                              : `${skill.catalogCombos} ${lt("workouts available")} • ${lt("no sessions logged yet")}`}
                          </p>
                          <div className="mt-2 pl-7">
                            <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "color-mix(in srgb, var(--surface) 84%, black)" }}>
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${skill.coveragePct}%`,
                                  background: "linear-gradient(90deg, var(--forest), color-mix(in srgb, var(--forest) 62%, white 38%))",
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <span
                          className="shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]"
                          style={{
                            borderColor: isLogged ? "color-mix(in srgb, var(--forest) 36%, transparent)" : "color-mix(in srgb, var(--border) 78%, transparent)",
                            backgroundColor: isLogged ? "color-mix(in srgb, var(--forest) 10%, transparent)" : "color-mix(in srgb, var(--surface) 86%, black)",
                            color: isLogged ? "color-mix(in srgb, var(--forest) 82%, white)" : "var(--text-secondary)",
                          }}
                        >
                          {isLogged ? lt("Logged") : lt("Untouched")}
                        </span>
                      </button>

                      <AnimatePresence initial={false}>
                        {isExpanded ? (
                        <motion.div
                          key="expanded-details"
                          initial={prefersReducedMotion ? { opacity: 1, height: "auto" } : { opacity: 0, height: 0 }}
                          animate={prefersReducedMotion ? { opacity: 1, height: "auto" } : { opacity: 1, height: "auto" }}
                          exit={prefersReducedMotion ? { opacity: 0, height: 0 } : { opacity: 0, height: 0 }}
                          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                        <div
                          className="px-3 py-3"
                          style={{
                            backgroundColor: "color-mix(in srgb, var(--ink-mid) 46%, var(--ink-deep))",
                          }}
                        >
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[color:var(--text-secondary)]">
                            <span>{lt("Coverage")}: <span className="font-semibold text-[color:var(--forest)]">{skill.coveragePct}%</span></span>
                            <span>{lt("Sessions")}: <span className="font-semibold text-[color:var(--text-primary)]">{skill.performed}</span></span>
                            <span>{lt("Last")}: <span className="font-semibold text-[color:var(--text-primary)]">{formatDate(skill.lastLogAt, settings.dateFormat || "dd-mmm-yyyy", lt, settings.timeZone)}</span></span>
                          </div>

                          <div className="mt-3">
                            {skill.comboRows.length === 0 ? (
                              <p className="py-2 text-[11px] text-[color:var(--text-muted)]">{lt("No workout combinations logged yet.")}</p>
                            ) : (
                              skill.comboRows.map((row) => {
                                const subParts = [row.variantName, row.machineName].filter(Boolean);
                                const subLabel = subParts.length > 0 ? subParts.join(" • ") : lt("Base");
                                return (
                                  <div
                                    key={skill.id + "-" + row.key}
                                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2"
                                    style={{ backgroundColor: "color-mix(in srgb, var(--ink-deep) 78%, var(--ink-mid))" }}
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate text-[11px] font-medium text-[color:var(--text-primary)]">{row.progressionName}</p>
                                      <p className="mt-0.5 truncate text-[10px] text-[color:var(--text-secondary)]">{subLabel}</p>
                                      <p className="mt-0.5 text-[10px] text-[color:var(--text-muted)]">{row.attempts} {lt("attempts")} • {row.best}</p>
                                    </div>
                                    <span className="shrink-0 text-[10px] text-[color:var(--text-secondary)]">{formatDate(row.lastPerformedAt, settings.dateFormat || "dd-mmm-yyyy", lt, settings.timeZone)}</span>
                                  </div>
                                );
                              })
                            )}
                          </div>

                          <div className="mt-3 flex gap-2">
                            <Link
                              href={historyHref}
                              className="theme-control-btn inline-flex flex-1 items-center justify-center rounded-md border px-3 py-2 text-sm font-medium"
                            >
                              {lt("History")}
                            </Link>
                            <Link
                              href={logHref}
                              className="theme-action-btn inline-flex flex-1 items-center justify-center rounded-md border px-3 py-2 text-sm font-medium"
                            >
                              {lt("Log session")}
                            </Link>
                          </div>
                        </div>
                        </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </motion.section>
                  );
                })}
              </motion.div>
            </motion.section>

            {typeof document !== "undefined" && createPortal(
              <AnimatePresence>
                {filterDrawerOpen ? (
                  <>
                    <motion.button
                      type="button"
                      aria-label={lt("Close filters")}
                      className="fixed inset-0 z-[250] bg-black/55"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.16 }}
                      onClick={() => setFilterDrawerOpen(false)}
                    />

                    <div className="fixed inset-0 z-[260] pointer-events-none">
                      <motion.aside
                        ref={filterDrawerRef}
                        id="progress-filter-drawer"
                        role="dialog"
                        aria-modal="true"
                        aria-label={lt("Progress filters")}
                        className="pointer-events-auto ml-auto flex h-[100dvh] max-h-[100dvh] w-[min(22rem,92vw)] flex-col overflow-hidden border-l shadow-2xl sm:my-3 sm:mr-3 sm:h-[calc(100dvh-1.5rem)] sm:max-h-[52rem] sm:rounded-2xl sm:border"
                        initial={{ x: "100%", opacity: 0.98 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: "100%", opacity: 0.98 }}
                        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
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
                              <p className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">{lt("Filters")}</p>
                              <h3 className="mt-1 text-base font-semibold text-[color:var(--text-primary)]">{lt("Filter")}</h3>
                              <p className="mt-1 text-xs text-[color:var(--text-secondary)]">{lt("Narrow the skill list by activity and focus.")}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFilterDrawerOpen(false)}
                              className="theme-control-btn inline-flex h-9 w-9 items-center justify-center rounded-md border"
                              aria-label={lt("Close filter drawer")}
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
                              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">{lt("Category")}</label>
                              <select
                                ref={filterDrawerFirstFieldRef}
                                value={categoryFilter}
                                onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
                                className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                                style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 92%, black)", color: "var(--text-primary)" }}
                              >
                                {categoryOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option === "all" ? lt("All categories") : option}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">{lt("Activity")}</label>
                              <select
                                value={activityFilter}
                                onChange={(event) => setActivityFilter(event.target.value as ActivityFilter)}
                                className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                                style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 92%, black)", color: "var(--text-primary)" }}
                              >
                                <option value="all">{lt("All exercises")}</option>
                                <option value="active">{lt("Active in 14 days")}</option>
                                <option value="stale">{lt("Stale 30+ days")}</option>
                                <option value="untouched">{lt("Never logged")}</option>
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
                              {showLoggedOnly ? lt("Showing logged exercises") : lt("Show logged only")}
                            </button>

                            <div>
                              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">{lt("Sort by")}</label>
                              <select
                                value={sortBy}
                                onChange={(event) => setSortBy(event.target.value as SortBy)}
                                className="h-11 w-full rounded-xl border px-3 text-sm outline-none"
                                style={{ borderColor: "color-mix(in srgb, var(--border) 78%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 92%, black)", color: "var(--text-primary)" }}
                              >
                                <option value="recent">{lt("Recently trained")}</option>
                                <option value="coverage">{lt("Best coverage")}</option>
                                <option value="sessions">{lt("Most sessions")}</option>
                                <option value="name">{lt("Name A-Z")}</option>
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
                                {lt("Reset")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setFilterDrawerOpen(false)}
                                className="theme-action-btn h-11 rounded-xl border px-3 text-sm font-semibold"
                              >
                                {lt("Done")}
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
